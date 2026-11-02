from __future__ import annotations

from datetime import UTC, datetime, timedelta

import structlog
from fastapi import APIRouter, Depends, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Any

from deorch_api.database import get_db
from deorch_api.dependencies import get_current_user
from deorch_api.models.analytics import AnalyticsEvent, FeatureFlag
from deorch_api.models.user import User

router = APIRouter(prefix="/analytics", tags=["analytics"])
log = structlog.get_logger(__name__)


class EventCreate(BaseModel):
    event_name: str = Field(max_length=100)
    properties: dict[str, Any] = Field(default_factory=dict)
    device_id: str | None = None
    session_id: str | None = None
    workflow_id: str | None = None


class EventRead(BaseModel):
    id: str
    event_name: str
    user_id: str | None
    org_id: str | None
    device_id: str | None
    session_id: str | None
    properties: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


@router.post("/events", status_code=status.HTTP_201_CREATED)
async def record_event(
    body: EventCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    event = AnalyticsEvent(
        event_name=body.event_name,
        user_id=user.id,
        device_id=body.device_id,
        session_id=body.session_id,
        workflow_id=body.workflow_id,
        properties=body.properties,
        created_at=datetime.now(UTC),
    )
    db.add(event)
    await db.flush()
    return {"recorded": True}


@router.get("/events", response_model=list[EventRead])
async def list_events(
    event_name: str | None = Query(default=None),
    limit: int = Query(default=100, ge=1, le=1000),
    days: int = Query(default=30, ge=1, le=365),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[EventRead]:
    since = datetime.now(UTC) - timedelta(days=days)
    stmt = (
        select(AnalyticsEvent)
        .where(AnalyticsEvent.user_id == user.id)
        .where(AnalyticsEvent.created_at >= since)
    )
    if event_name:
        stmt = stmt.where(AnalyticsEvent.event_name == event_name)
    stmt = stmt.order_by(AnalyticsEvent.created_at.desc()).limit(limit)
    result = await db.execute(stmt)
    return [EventRead.model_validate(e) for e in result.scalars().all()]


@router.get("/metrics")
async def get_metrics(
    days: int = Query(default=30, ge=1, le=365),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Compute pilot metrics from real analytics events."""
    since = datetime.now(UTC) - timedelta(days=days)

    # Count events by name for this user
    result = await db.execute(
        select(AnalyticsEvent.event_name, func.count())
        .where(AnalyticsEvent.user_id == user.id)
        .where(AnalyticsEvent.created_at >= since)
        .group_by(AnalyticsEvent.event_name)
    )
    counts = {name: count for name, count in result.all()}

    # Distinct active days
    active_days_result = await db.execute(
        select(func.count(func.distinct(func.date(AnalyticsEvent.created_at))))
        .where(AnalyticsEvent.user_id == user.id)
        .where(AnalyticsEvent.created_at >= since)
    )
    active_days = active_days_result.scalar() or 0

    return {
        "period_days": days,
        "event_counts": counts,
        "active_days": active_days,
        "total_events": sum(counts.values()),
        "devices_paired": counts.get("device_paired", 0),
        "sessions_started": counts.get("session_started", 0),
        "approvals_handled": counts.get("approval_handled", 0),
        "workflows_executed": counts.get("workflow_executed", 0),
    }


@router.get("/flags")
async def get_feature_flags(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict[str, bool]:
    """Return active feature flags for the current user."""
    result = await db.execute(select(FeatureFlag))
    flags = result.scalars().all()

    active: dict[str, bool] = {}
    for flag in flags:
        if not flag.is_enabled:
            active[flag.name] = False
        elif flag.allowed_users and str(user.id) in flag.allowed_users:
            active[flag.name] = True
        elif not flag.allowed_users and not flag.allowed_orgs:
            active[flag.name] = True  # Globally enabled
        else:
            active[flag.name] = False
    return active
