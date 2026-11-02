from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from deorch_api.database import get_db
from deorch_api.dependencies import get_current_user
from deorch_api.models.audit import AuditRecord
from deorch_api.models.integration import Integration, IntegrationConnection, InboundWebhookLog, WebhookDelivery, WebhookEndpoint
from deorch_api.models.workflow import OrganizationMember
from deorch_api.models.user import User

router = APIRouter(tags=["integrations"])
log = structlog.get_logger(__name__)


class IntegrationRead(BaseModel):
    id: uuid.UUID
    slug: str
    name: str
    description: str | None
    category: str
    provider: str
    auth_type: str
    capabilities: list[str]
    required_permissions: list[str]
    is_available: bool
    trust_status: str
    created_at: datetime

    model_config = {"from_attributes": True}


class ConnectionCreate(BaseModel):
    integration_slug: str
    org_id: uuid.UUID
    credentials: str | None = None  # Token or encrypted credentials
    config: dict[str, Any] = Field(default_factory=dict)


class ConnectionRead(BaseModel):
    id: uuid.UUID
    integration_id: uuid.UUID
    org_id: uuid.UUID
    config: dict[str, Any]
    status: str
    connected_at: datetime
    created_at: datetime
    integration: IntegrationRead | None = None

    model_config = {"from_attributes": True}


class DeliveryRead(BaseModel):
    id: uuid.UUID
    event_type: str
    status: str
    attempts: int
    response_code: int | None
    error: str | None
    created_at: datetime
    delivered_at: datetime | None

    model_config = {"from_attributes": True}


# ── Catalog ─────────────────────────────────────────────────────────────────

@router.get("/integrations", response_model=list[IntegrationRead])
async def list_integrations(
    category: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[IntegrationRead]:
    stmt = select(Integration).where(Integration.is_available.is_(True))
    if category:
        stmt = stmt.where(Integration.category == category)
    result = await db.execute(stmt.order_by(Integration.name))
    return [IntegrationRead.model_validate(i) for i in result.scalars().all()]


# ── Connections ─────────────────────────────────────────────────────────────

@router.post("/integrations/connect", response_model=ConnectionRead, status_code=status.HTTP_201_CREATED)
async def connect_integration(
    body: ConnectionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ConnectionRead:
    # Verify org membership (admin/owner)
    member = await db.execute(
        select(OrganizationMember)
        .where(OrganizationMember.organization_id == str(body.org_id))
        .where(OrganizationMember.user_id == user.id)
        .where(OrganizationMember.role.in_(["admin", "owner"]))
    )
    if not member.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Only admins can connect integrations")

    # Find integration
    result = await db.execute(
        select(Integration).where(Integration.slug == body.integration_slug)
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail="Integration not found")

    now = datetime.now(UTC)
    conn = IntegrationConnection(
        integration_id=str(integration.id),
        org_id=str(body.org_id),
        config=body.config,
        credentials_encrypted=_encrypt_credential(body.credentials, str(body.org_id)),
        status="ACTIVE",
        connected_by=user.id,
        connected_at=now,
    )
    db.add(conn)

    db.add(AuditRecord(
        user_id=user.id,
        event_type="integration.connected",
        actor_type="USER",
        payload={"integration": body.integration_slug, "org_id": str(body.org_id)},
        created_at=now,
    ))

    await db.flush()
    log.info("integration_connected", integration=body.integration_slug, org_id=str(body.org_id))
    return ConnectionRead.model_validate(conn)


@router.get("/integrations/connections", response_model=list[ConnectionRead])
async def list_connections(
    org_id: str = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ConnectionRead]:
    member = await db.execute(
        select(OrganizationMember)
        .where(OrganizationMember.organization_id == org_id)
        .where(OrganizationMember.user_id == user.id)
    )
    if not member.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Organization not found")

    result = await db.execute(
        select(IntegrationConnection)
        .where(IntegrationConnection.org_id == org_id)
        .where(IntegrationConnection.status == "ACTIVE")
    )
    connections = result.scalars().all()

    reads = []
    for conn in connections:
        r = ConnectionRead.model_validate(conn)
        integration = await db.get(Integration, conn.integration_id)
        if integration:
            r.integration = IntegrationRead.model_validate(integration)
        reads.append(r)
    return reads


@router.delete("/integrations/connections/{connection_id}")
async def disconnect_integration(
    connection_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    conn = await db.get(IntegrationConnection, connection_id)
    if not conn:
        raise HTTPException(status_code=404, detail="Connection not found")

    member = await db.execute(
        select(OrganizationMember)
        .where(OrganizationMember.organization_id == conn.org_id)
        .where(OrganizationMember.user_id == user.id)
        .where(OrganizationMember.role.in_(["admin", "owner"]))
    )
    if not member.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Only admins can disconnect integrations")

    conn.status = "REVOKED"
    conn.credentials_encrypted = None  # Clear credentials on disconnect

    db.add(AuditRecord(
        user_id=user.id,
        event_type="integration.disconnected",
        actor_type="USER",
        payload={"connection_id": str(connection_id), "org_id": conn.org_id},
        created_at=datetime.now(UTC),
    ))

    log.info("integration_disconnected", connection_id=str(connection_id))
    return {"message": "Integration disconnected"}


# ── Helpers ──────────────────────────────────────────────────────────────────

def _encrypt_credential(credential: str | None, org_id: str) -> str | None:
    if not credential:
        return None
    from deorch_api.services.crypto import encrypt
    return encrypt(credential, org_id)


# ── Inbound Webhooks ────────────────────────────────────────────────────────

MAX_WEBHOOK_BODY_SIZE = 1_048_576  # 1 MB


@router.post("/webhooks/inbound/{integration_slug}")
async def receive_inbound_webhook(
    integration_slug: str,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Receive webhooks from external providers with signature validation."""
    # Enforce body size limit
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_WEBHOOK_BODY_SIZE:
        raise HTTPException(status_code=413, detail="Request too large")

    body = await request.body()
    if len(body) > MAX_WEBHOOK_BODY_SIZE:
        raise HTTPException(status_code=413, detail="Request too large")

    headers = dict(request.headers)

    # Find integration
    result = await db.execute(
        select(Integration).where(Integration.slug == integration_slug)
    )
    integration = result.scalar_one_or_none()
    if not integration:
        raise HTTPException(status_code=404, detail="Unknown integration")

    # GitHub: Validate webhook signature
    if integration_slug == "github":
        from deorch_api.integrations.github import validate_webhook_signature
        signature = headers.get("x-hub-signature-256", "")
        # Get webhook secret from connected org (first active connection)
        conn_result = await db.execute(
            select(IntegrationConnection)
            .where(IntegrationConnection.integration_id == str(integration.id))
            .where(IntegrationConnection.status == "ACTIVE")
            .limit(1)
        )
        conn = conn_result.scalar_one_or_none()
        webhook_secret = conn.config.get("webhook_secret", "") if conn else ""

        if webhook_secret and not validate_webhook_signature(body, signature, webhook_secret):
            log.warning("webhook_signature_invalid", integration=integration_slug)
            raise HTTPException(status_code=401, detail="Invalid webhook signature")

    # Persistent delivery ID deduplication (DB-backed, survives restarts)
    delivery_id = headers.get("x-github-delivery", "")
    if delivery_id:
        from sqlalchemy.exc import IntegrityError as SAIntegrityError
        try:
            dedup_record = InboundWebhookLog(
                integration_slug=integration_slug,
                provider_delivery_id=delivery_id,
                event_type=headers.get("x-github-event", "unknown"),
                created_at=datetime.now(UTC),
            )
            db.add(dedup_record)
            await db.flush()
        except SAIntegrityError:
            await db.rollback()
            log.info("webhook_duplicate_delivery", delivery_id=delivery_id)
            return {"received": True, "duplicate": True}

    # Parse payload
    import json
    try:
        payload = json.loads(body)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid JSON payload")

    event_type = headers.get("x-github-event", headers.get("x-slack-event", "unknown"))

    # Process based on integration
    if integration_slug == "github":
        from deorch_api.integrations.github import parse_push_event, parse_pr_event
        if event_type == "push":
            parsed = parse_push_event(payload)
        elif event_type == "pull_request":
            parsed = parse_pr_event(payload)
        else:
            parsed = {"raw_event": event_type}
    else:
        parsed = {"raw_event": event_type}

    # Sanitize audit payload (remove sensitive fields)
    sanitized = {k: v for k, v in parsed.items() if k not in ("token", "secret", "password")}

    db.add(AuditRecord(
        event_type=f"webhook.received.{integration_slug}",
        actor_type="SYSTEM",
        payload={"event_type": event_type, "parsed": sanitized},
        created_at=datetime.now(UTC),
    ))

    log.info("webhook_received", integration=integration_slug, event_type=event_type)
    return {"received": True, "event_type": event_type}
