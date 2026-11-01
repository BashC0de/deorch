from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from deorch_api.config import get_settings
from deorch_api.database import get_db
from deorch_api.dependencies import get_current_device, get_current_user
from deorch_api.models.agent import AgentProvider, AgentSession
from deorch_api.models.approval import ApprovalDecision, ApprovalRequest
from deorch_api.models.audit import AuditRecord
from deorch_api.models.device import Device
from deorch_api.models.user import User
from deorch_api.schemas.approval import (
    ApprovalDecisionCreate,
    ApprovalRequestCreate,
    ApprovalRequestRead,
)
from deorch_api.websocket.manager import connection_manager
from deorch_api.websocket.messages import approval_decision_msg, approval_request_msg

router = APIRouter(prefix="/approvals", tags=["approvals"])
log = structlog.get_logger(__name__)
settings = get_settings()


@router.post("", response_model=ApprovalRequestRead, status_code=status.HTTP_201_CREATED)
async def create_approval_request(
    body: ApprovalRequestCreate,
    device: Device = Depends(get_current_device),
    db: AsyncSession = Depends(get_db),
) -> ApprovalRequestRead:
    ttl = min(body.ttl_seconds, settings.approval_request_max_ttl_seconds)
    expires_at = datetime.now(UTC) + timedelta(seconds=ttl)

    req = ApprovalRequest(
        session_id=body.session_id,
        device_id=device.id,
        project_id=body.project_id,
        request_type=body.request_type,
        hook_event_name=body.hook_event_name,
        tool_name=body.tool_name,
        action_category=body.action_category,
        action_summary=body.action_summary,
        details=body.details,
        working_directory=body.working_directory,
        reason=body.reason,
        risk_level=body.risk_level,
        idempotency_key=body.idempotency_key,
        expires_at=expires_at,
    )
    db.add(req)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        # Return existing request with same idempotency key
        result = await db.execute(
            select(ApprovalRequest).where(ApprovalRequest.idempotency_key == body.idempotency_key)
        )
        existing = result.scalar_one_or_none()
        if existing:
            return ApprovalRequestRead.model_validate(existing)
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Duplicate request")

    db.add(AuditRecord(
        device_id=device.id,
        session_id=body.session_id,
        request_id=req.id,
        event_type="approval_request.created",
        actor_type="DEVICE",
        payload={
            "action_summary": body.action_summary,
            "risk_level": body.risk_level,
            "request_type": body.request_type,
        },
        created_at=datetime.now(UTC),
    ))
    await db.flush()

    # Resolve provider slug for the notification
    agent_slug = "unknown"
    if body.session_id:
        session_result = await db.execute(
            select(AgentSession).where(AgentSession.id == body.session_id)
        )
        session = session_result.scalar_one_or_none()
        if session:
            provider = await db.get(AgentProvider, session.provider_id)
            if provider:
                agent_slug = provider.slug

    # Notify user's dashboard via WebSocket
    user_id = str(device.user_id)
    await connection_manager.send_to_user(
        user_id,
        approval_request_msg(
            request_id=str(req.id),
            session_id=str(body.session_id) if body.session_id else None,
            device_id=str(device.id),
            device_name=device.name,
            agent_slug=agent_slug,
            action_summary=body.action_summary,
            details=body.details,
            working_directory=body.working_directory,
            reason=body.reason,
            risk_level=body.risk_level,
            expires_at=expires_at.isoformat(),
            hook_event_name=body.hook_event_name,
            tool_name=body.tool_name,
        ),
    )

    log.info("approval_request_created", request_id=str(req.id), device_id=str(device.id))
    return ApprovalRequestRead.model_validate(req)


@router.get("", response_model=list[ApprovalRequestRead])
async def list_approvals(
    status_filter: str | None = Query(default=None, alias="status"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ApprovalRequestRead]:
    from deorch_api.models.device import Device as DeviceModel
    stmt = (
        select(ApprovalRequest)
        .join(DeviceModel, ApprovalRequest.device_id == DeviceModel.id)
        .where(DeviceModel.user_id == user.id)
        .order_by(ApprovalRequest.created_at.desc())
    )
    if status_filter:
        stmt = stmt.where(ApprovalRequest.status == status_filter.upper())
    result = await db.execute(stmt)
    requests = result.scalars().all()
    return [ApprovalRequestRead.model_validate(r) for r in requests]


@router.get("/{request_id}", response_model=ApprovalRequestRead)
async def get_approval(
    request_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApprovalRequestRead:
    req = await db.get(ApprovalRequest, request_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    # Verify ownership via device
    device = await db.get(Device, req.device_id)
    if not device or device.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")
    return ApprovalRequestRead.model_validate(req)


@router.post("/{request_id}/decide", response_model=dict)
async def decide_approval(
    request_id: uuid.UUID,
    body: ApprovalDecisionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    req = await db.get(ApprovalRequest, request_id)
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    # Verify ownership
    device = await db.get(Device, req.device_id)
    if not device or device.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Request not found")

    if req.status != "PENDING":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Request is {req.status}")

    now = datetime.now(UTC)
    if req.expires_at < now:
        req.status = "EXPIRED"
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="Request has expired")

    # Record decision — normalize to past tense for status
    req.status = "APPROVED" if body.decision == "APPROVE" else "DENIED"
    decision = ApprovalDecision(
        request_id=req.id,
        user_id=user.id,
        decision=body.decision,
        reason=body.reason,
        decided_at=now,
        created_at=now,
    )
    db.add(decision)

    event_type = "approval_decision.approved" if body.decision == "APPROVE" else "approval_decision.denied"
    db.add(AuditRecord(
        user_id=user.id,
        device_id=req.device_id,
        request_id=req.id,
        event_type=event_type,
        actor_type="USER",
        payload={"decision": body.decision, "reason": body.reason},
        created_at=now,
    ))
    await db.flush()

    # Deliver to companion via WebSocket
    delivered = await connection_manager.send_to_device(
        str(req.device_id),
        approval_decision_msg(
            request_id=str(req.id),
            decision=body.decision.lower(),
            decided_by=user.email,
            decided_at=now.isoformat(),
            reason=body.reason,
        ),
    )

    if delivered:
        decision.delivered_at = now

    log.info("approval_decision_made", request_id=str(req.id), decision=body.decision, delivered=delivered)
    return {"message": "Decision recorded", "delivered": delivered}
