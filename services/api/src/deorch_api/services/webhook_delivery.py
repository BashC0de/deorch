"""Outgoing webhook delivery engine with retry and signing."""
from __future__ import annotations

import asyncio
import hashlib
import hmac
import json
from datetime import UTC, datetime

import structlog
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from deorch_api.database import AsyncSessionFactory
from deorch_api.models.integration import WebhookDelivery, WebhookEndpoint
from deorch_api.services.url_validator import SSRFError

log = structlog.get_logger(__name__)

MAX_ATTEMPTS = 5
BACKOFF_BASE_SECONDS = 2


def sign_payload(payload: str, secret: str) -> str:
    """Sign a webhook payload with HMAC-SHA256."""
    return hmac.new(secret.encode(), payload.encode(), hashlib.sha256).hexdigest()


async def deliver_webhook(
    endpoint: WebhookEndpoint,
    event_type: str,
    payload: dict,
    db: AsyncSession,
) -> str:
    """Create a delivery record and attempt immediate delivery."""
    delivery = WebhookDelivery(
        endpoint_id=str(endpoint.id),
        event_type=event_type,
        payload=payload,
        status="PENDING",
        created_at=datetime.now(UTC),
    )
    db.add(delivery)
    await db.flush()
    return str(delivery.id)


async def process_pending_deliveries() -> int:
    """Process all pending webhook deliveries. Returns count of successful deliveries."""
    from deorch_api.services.url_validator import validate_url, SSRFError

    async with AsyncSessionFactory() as db:
        result = await db.execute(
            select(WebhookDelivery)
            .where(WebhookDelivery.status.in_(["PENDING", "RETRYING"]))
            .where(WebhookDelivery.attempts < MAX_ATTEMPTS)
            .order_by(WebhookDelivery.created_at)
            .limit(50)
        )
        deliveries = result.scalars().all()

        if not deliveries:
            return 0

        delivered = 0
        for delivery in deliveries:
            endpoint = await db.get(WebhookEndpoint, delivery.endpoint_id)
            if not endpoint or not endpoint.is_active:
                delivery.status = "CANCELLED"
                continue

            # DNS-aware SSRF check — resolve and validate all IPs
            try:
                from deorch_api.services.url_validator import resolve_and_validate
                resolve_and_validate(endpoint.url)
            except SSRFError as e:
                delivery.status = "FAILED"
                delivery.error = f"SSRF blocked: {e}"
                log.warning("webhook_ssrf_blocked", url=endpoint.url, error=str(e))
                continue

            # Attempt delivery
            delivery.attempts += 1
            payload_str = json.dumps(delivery.payload)
            headers: dict[str, str] = {
                "Content-Type": "application/json",
                "X-DeOrch-Event": delivery.event_type,
                "X-DeOrch-Delivery": str(delivery.id),
            }

            # Sign if secret configured
            if endpoint.secret_hash:
                signature = sign_payload(payload_str, endpoint.secret_hash)
                headers["X-DeOrch-Signature-256"] = f"sha256={signature}"

            try:
                import urllib.request

                # Custom opener that blocks redirects — prevents SSRF via redirect
                class _NoRedirectHandler(urllib.request.HTTPErrorProcessor):
                    def http_response(self, request, response):
                        if 300 <= response.status < 400:
                            raise urllib.error.HTTPError(
                                request.full_url, response.status,
                                "Redirects blocked for webhook delivery",
                                response.headers, response,
                            )
                        return response
                    https_response = http_response

                opener = urllib.request.build_opener(_NoRedirectHandler)
                req = urllib.request.Request(
                    endpoint.url,
                    data=payload_str.encode(),
                    headers=headers,
                    method="POST",
                )
                with opener.open(req, timeout=10) as resp:
                    delivery.response_code = resp.status
                    if 200 <= resp.status < 300:
                        delivery.status = "DELIVERED"
                        delivery.delivered_at = datetime.now(UTC)
                        delivered += 1
                    else:
                        delivery.status = "RETRYING" if delivery.attempts < MAX_ATTEMPTS else "FAILED"
                        delivery.error = f"HTTP {resp.status}"
            except Exception as e:
                delivery.status = "RETRYING" if delivery.attempts < MAX_ATTEMPTS else "DEAD_LETTERED"
                delivery.error = str(e)[:500]

        await db.commit()
        if delivered > 0:
            log.info("webhooks_delivered", count=delivered)
        return delivered


async def run_delivery_loop(interval_seconds: float = 15.0) -> None:
    """Background loop for webhook delivery."""
    log.info("webhook_delivery_loop_started", interval=interval_seconds)
    while True:
        try:
            await process_pending_deliveries()
        except Exception:
            log.exception("webhook_delivery_loop_error")
        await asyncio.sleep(interval_seconds)
