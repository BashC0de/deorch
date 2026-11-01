from __future__ import annotations

import asyncio
from datetime import UTC, datetime

import structlog
from sqlalchemy import select, update

from deorch_api.database import AsyncSessionFactory
from deorch_api.models.approval import ApprovalRequest
from deorch_api.models.audit import AuditRecord

log = structlog.get_logger(__name__)


async def expire_pending_requests() -> int:
    """Expire all PENDING approval requests that have passed their expires_at."""
    async with AsyncSessionFactory() as db:
        now = datetime.now(UTC)
        result = await db.execute(
            select(ApprovalRequest)
            .where(ApprovalRequest.status == "PENDING")
            .where(ApprovalRequest.expires_at < now)
        )
        expired = result.scalars().all()

        if not expired:
            return 0

        ids = [r.id for r in expired]
        await db.execute(
            update(ApprovalRequest)
            .where(ApprovalRequest.id.in_(ids))
            .values(status="EXPIRED")
        )

        for req in expired:
            db.add(AuditRecord(
                user_id=None,
                device_id=str(req.device_id),
                session_id=str(req.session_id) if req.session_id else None,
                request_id=str(req.id),
                event_type="approval_request.expired",
                actor_type="SYSTEM",
                payload={"request_type": req.request_type},
            ))

        await db.commit()
        log.info("approval_requests_expired", count=len(ids))
        return len(ids)


async def retry_undelivered_decisions() -> int:
    """Retry delivery of approval decisions that haven't been confirmed as received."""
    from deorch_api.models.approval import ApprovalDecision
    from deorch_api.websocket.manager import connection_manager
    from deorch_api.websocket.messages import approval_decision_msg

    async with AsyncSessionFactory() as db:
        now = datetime.now(UTC)
        # Find undelivered decisions where the request isn't expired and retries < 10
        result = await db.execute(
            select(ApprovalDecision)
            .join(ApprovalRequest, ApprovalDecision.request_id == ApprovalRequest.id)
            .where(ApprovalDecision.delivered_at.is_(None))
            .where(ApprovalDecision.delivery_attempts < 10)
            .where(ApprovalRequest.expires_at > now)
        )
        undelivered = result.scalars().all()

        if not undelivered:
            return 0

        delivered_count = 0
        for decision in undelivered:
            request = await db.get(ApprovalRequest, decision.request_id)
            if not request:
                continue

            device_id = str(request.device_id)
            if not connection_manager.is_device_connected(device_id):
                continue

            # Load user for decided_by
            from deorch_api.models.user import User
            user = await db.get(User, decision.user_id)
            decided_by = user.email if user else "unknown"

            success = await connection_manager.send_to_device(
                device_id,
                approval_decision_msg(
                    request_id=str(request.id),
                    decision=decision.decision.lower(),
                    decided_by=decided_by,
                    decided_at=decision.decided_at.isoformat(),
                    reason=decision.reason,
                ),
            )

            decision.delivery_attempts += 1
            if success:
                decision.delivered_at = now
                delivered_count += 1

        await db.commit()
        if delivered_count > 0:
            log.info("decisions_redelivered", count=delivered_count)
        return delivered_count


async def run_expiry_loop(interval_seconds: float = 30.0) -> None:
    """Background loop that periodically expires stale requests and retries undelivered decisions."""
    log.info("expiry_loop_started", interval=interval_seconds)
    while True:
        try:
            await expire_pending_requests()
        except Exception:
            log.exception("expiry_loop_error")
        try:
            await retry_undelivered_decisions()
        except Exception:
            log.exception("retry_loop_error")
        await asyncio.sleep(interval_seconds)
