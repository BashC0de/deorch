from __future__ import annotations

import uuid
from datetime import UTC, datetime

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from deorch_api.database import get_db
from deorch_api.dependencies import get_current_device, get_current_user
from deorch_api.models.agent import AgentEvent, AgentProvider, AgentSession
from deorch_api.models.device import Device
from deorch_api.models.user import User
from deorch_api.schemas.agent import (
    AgentEventCreate,
    AgentEventRead,
    AgentSessionCreate,
    AgentSessionRead,
    AgentSessionUpdate,
)
from deorch_api.websocket.manager import connection_manager
from deorch_api.websocket.messages import session_ended_msg, session_started_msg

router = APIRouter(prefix="/sessions", tags=["sessions"])
log = structlog.get_logger(__name__)


@router.post("", response_model=AgentSessionRead, status_code=status.HTTP_201_CREATED)
async def create_session(
    body: AgentSessionCreate,
    device: Device = Depends(get_current_device),
    db: AsyncSession = Depends(get_db),
) -> AgentSessionRead:
    result = await db.execute(
        select(AgentProvider).where(AgentProvider.slug == body.provider_slug)
    )
    provider = result.scalar_one_or_none()
    if not provider:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Unknown provider: {body.provider_slug}")

    now = datetime.now(UTC)
    session = AgentSession(
        device_id=device.id,
        project_id=body.project_id,
        provider_id=provider.id,
        external_session_id=body.external_session_id,
        status="ACTIVE",
        metadata_=body.metadata,
        started_at=now,
    )
    db.add(session)
    await db.flush()

    # Notify dashboard
    user_id = str(device.user_id)
    await connection_manager.send_to_user(
        user_id,
        session_started_msg(str(session.id), str(device.id), provider.slug),
    )

    log.info("session_created", session_id=str(session.id), device_id=str(device.id))

    # Return with provider_slug field
    read = AgentSessionRead(
        id=session.id,
        device_id=session.device_id,
        project_id=session.project_id,
        provider_slug=provider.slug,
        external_session_id=session.external_session_id,
        status=session.status,
        started_at=session.started_at,
        ended_at=session.ended_at,
        created_at=session.created_at,
    )
    return read


@router.get("", response_model=list[AgentSessionRead])
async def list_sessions(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AgentSessionRead]:
    result = await db.execute(
        select(AgentSession, AgentProvider.slug)
        .join(AgentProvider, AgentSession.provider_id == AgentProvider.id)
        .join(Device, AgentSession.device_id == Device.id)
        .where(Device.user_id == user.id)
        .order_by(AgentSession.created_at.desc())
    )
    rows = result.all()
    return [
        AgentSessionRead(
            id=s.id,
            device_id=s.device_id,
            project_id=s.project_id,
            provider_slug=slug,
            external_session_id=s.external_session_id,
            status=s.status,
            started_at=s.started_at,
            ended_at=s.ended_at,
            created_at=s.created_at,
        )
        for s, slug in rows
    ]


@router.get("/{session_id}", response_model=AgentSessionRead)
async def get_session(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AgentSessionRead:
    result = await db.execute(
        select(AgentSession, AgentProvider.slug)
        .join(AgentProvider, AgentSession.provider_id == AgentProvider.id)
        .join(Device, AgentSession.device_id == Device.id)
        .where(AgentSession.id == session_id)
        .where(Device.user_id == user.id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    s, slug = row
    return AgentSessionRead(
        id=s.id, device_id=s.device_id, project_id=s.project_id,
        provider_slug=slug, external_session_id=s.external_session_id,
        status=s.status, started_at=s.started_at, ended_at=s.ended_at, created_at=s.created_at,
    )


@router.patch("/{session_id}", response_model=AgentSessionRead)
async def update_session(
    session_id: uuid.UUID,
    body: AgentSessionUpdate,
    device: Device = Depends(get_current_device),
    db: AsyncSession = Depends(get_db),
) -> AgentSessionRead:
    session = await db.get(AgentSession, session_id)
    if not session or session.device_id != device.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    old_status = session.status
    if body.status:
        session.status = body.status
    if body.ended_at:
        session.ended_at = body.ended_at

    if body.status in ("COMPLETED", "ERROR") and old_status == "ACTIVE":
        user_id = str(device.user_id)
        await connection_manager.send_to_user(
            user_id, session_ended_msg(str(session.id), session.status)
        )

    await db.flush()
    provider = await db.get(AgentProvider, session.provider_id)
    return AgentSessionRead(
        id=session.id, device_id=session.device_id, project_id=session.project_id,
        provider_slug=provider.slug if provider else "unknown",
        external_session_id=session.external_session_id,
        status=session.status, started_at=session.started_at,
        ended_at=session.ended_at, created_at=session.created_at,
    )


@router.post("/{session_id}/events", response_model=AgentEventRead, status_code=status.HTTP_201_CREATED)
async def ingest_event(
    session_id: uuid.UUID,
    body: AgentEventCreate,
    device: Device = Depends(get_current_device),
    db: AsyncSession = Depends(get_db),
) -> AgentEventRead:
    session = await db.get(AgentSession, session_id)
    if not session or session.device_id != device.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    from sqlalchemy.exc import IntegrityError
    event = AgentEvent(
        session_id=session_id,
        event_type=body.event_type,
        payload=body.payload,
        sequence_number=body.sequence_number,
        idempotency_key=body.idempotency_key,
        created_at=datetime.now(UTC),
    )
    db.add(event)
    try:
        await db.flush()
    except IntegrityError:
        await db.rollback()
        result = await db.execute(
            select(AgentEvent).where(AgentEvent.idempotency_key == body.idempotency_key)
        )
        existing = result.scalar_one()
        return AgentEventRead.model_validate(existing)

    return AgentEventRead.model_validate(event)


@router.get("/{session_id}/events", response_model=list[AgentEventRead])
async def list_events(
    session_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[AgentEventRead]:
    # Verify ownership
    result = await db.execute(
        select(AgentSession)
        .join(Device, AgentSession.device_id == Device.id)
        .where(AgentSession.id == session_id)
        .where(Device.user_id == user.id)
    )
    if not result.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")

    events_result = await db.execute(
        select(AgentEvent)
        .where(AgentEvent.session_id == session_id)
        .order_by(AgentEvent.sequence_number)
    )
    return [AgentEventRead.model_validate(e) for e in events_result.scalars().all()]
