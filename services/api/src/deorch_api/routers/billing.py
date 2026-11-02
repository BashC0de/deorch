from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from deorch_api.database import get_db
from deorch_api.dependencies import get_current_user
from deorch_api.models.billing import BillingEvent, Plan, Subscription, UsageRecord
from deorch_api.models.workflow import Organization, OrganizationMember
from deorch_api.models.user import User
from deorch_api.services.entitlements import (
    check_usage_limit,
    get_active_subscription,
    get_current_usage,
    get_plan_entitlements,
)

router = APIRouter(prefix="/billing", tags=["billing"])
log = structlog.get_logger(__name__)


class PlanRead(BaseModel):
    id: uuid.UUID
    slug: str
    display_name: str
    tier: str
    description: str | None
    entitlements: dict[str, Any]
    price_monthly_cents: int
    sort_order: int

    model_config = {"from_attributes": True}


class SubscriptionRead(BaseModel):
    id: uuid.UUID
    org_id: uuid.UUID
    plan_id: uuid.UUID
    status: str
    trial_ends_at: datetime | None
    current_period_start: datetime | None
    current_period_end: datetime | None
    cancelled_at: datetime | None
    created_at: datetime
    plan: PlanRead | None = None

    model_config = {"from_attributes": True}


class SubscribeRequest(BaseModel):
    org_id: uuid.UUID
    plan_slug: str = Field(max_length=50)


class UsageSummary(BaseModel):
    metric: str
    current: int
    limit: int  # -1 = unlimited
    within_limit: bool


# ── Plans ───────────────────────────────────────────────────────────────────

@router.get("/plans", response_model=list[PlanRead])
async def list_plans(
    db: AsyncSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[PlanRead]:
    result = await db.execute(
        select(Plan).where(Plan.is_active.is_(True)).order_by(Plan.sort_order)
    )
    return [PlanRead.model_validate(p) for p in result.scalars().all()]


# ── Subscriptions ───────────────────────────────────────────────────────────

@router.get("/subscription")
async def get_subscription(
    org_id: str = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    # Verify user is org member
    member = await db.execute(
        select(OrganizationMember)
        .where(OrganizationMember.organization_id == org_id)
        .where(OrganizationMember.user_id == user.id)
    )
    if not member.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Organization not found")

    sub = await get_active_subscription(org_id, db)
    if not sub:
        return {"subscription": None, "entitlements": {}}

    plan = await db.get(Plan, sub.plan_id)
    return {
        "subscription": SubscriptionRead.model_validate(sub).model_dump(),
        "entitlements": plan.entitlements if plan else {},
    }


@router.post("/subscribe", status_code=status.HTTP_201_CREATED)
async def subscribe(
    body: SubscribeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    # Verify user is org admin/owner
    member = await db.execute(
        select(OrganizationMember)
        .where(OrganizationMember.organization_id == str(body.org_id))
        .where(OrganizationMember.user_id == user.id)
        .where(OrganizationMember.role.in_(["admin", "owner"]))
    )
    if not member.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Only admins can manage subscriptions")

    # Find plan
    plan_result = await db.execute(
        select(Plan).where(Plan.slug == body.plan_slug).where(Plan.is_active.is_(True))
    )
    plan = plan_result.scalar_one_or_none()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    # Check for existing active subscription
    existing = await get_active_subscription(str(body.org_id), db)
    if existing:
        raise HTTPException(status_code=400, detail="Organization already has an active subscription")

    now = datetime.now(UTC)
    sub = Subscription(
        org_id=str(body.org_id),
        plan_id=str(plan.id),
        status="TRIAL",
        trial_ends_at=now + timedelta(days=14),
        current_period_start=now,
        current_period_end=now + timedelta(days=30),
    )
    db.add(sub)

    # Record billing event
    db.add(BillingEvent(
        org_id=str(body.org_id),
        event_type="subscription.created",
        payload={"plan_slug": body.plan_slug, "status": "TRIAL"},
        idempotency_key=f"sub-create-{body.org_id}-{now.isoformat()}",
        created_at=now,
    ))

    await db.flush()
    log.info("subscription_created", org_id=str(body.org_id), plan=body.plan_slug)
    return {"message": "Subscription created", "status": "TRIAL", "trial_ends_at": sub.trial_ends_at}


@router.post("/cancel")
async def cancel_subscription(
    org_id: str = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    member = await db.execute(
        select(OrganizationMember)
        .where(OrganizationMember.organization_id == org_id)
        .where(OrganizationMember.user_id == user.id)
        .where(OrganizationMember.role.in_(["admin", "owner"]))
    )
    if not member.scalar_one_or_none():
        raise HTTPException(status_code=403, detail="Only admins can cancel subscriptions")

    sub = await get_active_subscription(org_id, db)
    if not sub:
        raise HTTPException(status_code=404, detail="No active subscription")

    now = datetime.now(UTC)
    sub.status = "CANCELLED"
    sub.cancelled_at = now

    db.add(BillingEvent(
        org_id=org_id,
        event_type="subscription.cancelled",
        payload={"previous_status": sub.status},
        idempotency_key=f"sub-cancel-{org_id}-{now.isoformat()}",
        created_at=now,
    ))

    return {"message": "Subscription cancelled"}


# ── Usage ───────────────────────────────────────────────────────────────────

@router.get("/usage", response_model=list[UsageSummary])
async def get_usage(
    org_id: str = Query(...),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[UsageSummary]:
    member = await db.execute(
        select(OrganizationMember)
        .where(OrganizationMember.organization_id == org_id)
        .where(OrganizationMember.user_id == user.id)
    )
    if not member.scalar_one_or_none():
        raise HTTPException(status_code=404, detail="Organization not found")

    metrics = ["devices", "sessions", "workflow_executions", "users"]
    summaries = []
    for metric in metrics:
        within, current, limit = await check_usage_limit(org_id, metric, db)
        summaries.append(UsageSummary(metric=metric, current=current, limit=limit, within_limit=within))
    return summaries
