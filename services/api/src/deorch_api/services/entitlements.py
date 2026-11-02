"""Centralized entitlement and usage metering service."""
from __future__ import annotations

from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from deorch_api.models.billing import Plan, Subscription, UsageRecord


async def get_active_subscription(org_id: str, db: AsyncSession) -> Subscription | None:
    """Get the active subscription for an organization."""
    result = await db.execute(
        select(Subscription)
        .where(Subscription.org_id == org_id)
        .where(Subscription.status.in_(["TRIAL", "ACTIVE"]))
        .order_by(Subscription.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def get_plan_entitlements(org_id: str, db: AsyncSession) -> dict:
    """Get the entitlements for an org's active plan. Returns empty dict if no subscription."""
    sub = await get_active_subscription(org_id, db)
    if not sub:
        return {}
    plan = await db.get(Plan, sub.plan_id)
    if not plan:
        return {}
    return plan.entitlements


async def check_entitlement(org_id: str, entitlement_name: str, db: AsyncSession) -> bool:
    """Check if an org has a specific entitlement."""
    entitlements = await get_plan_entitlements(org_id, db)
    value = entitlements.get(entitlement_name)
    if value is None:
        return False
    if isinstance(value, bool):
        return value
    if isinstance(value, int):
        return value > 0  # Has a non-zero limit
    return bool(value)


async def check_usage_limit(
    org_id: str,
    metric_name: str,
    db: AsyncSession,
) -> tuple[bool, int, int]:
    """Check if org is within usage limits. Returns (within_limit, current_usage, limit)."""
    entitlements = await get_plan_entitlements(org_id, db)
    limit = entitlements.get(f"max_{metric_name}")

    if limit is None or limit == -1:  # -1 = unlimited
        current = await get_current_usage(org_id, metric_name, db)
        return (True, current, -1)

    if not isinstance(limit, int):
        return (True, 0, 0)

    current = await get_current_usage(org_id, metric_name, db)
    return (current < limit, current, limit)


async def get_current_usage(org_id: str, metric_name: str, db: AsyncSession) -> int:
    """Get current period usage for a metric."""
    now = datetime.now(UTC)
    # Current period = current month
    period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    result = await db.execute(
        select(func.coalesce(func.sum(UsageRecord.quantity), 0))
        .where(UsageRecord.org_id == org_id)
        .where(UsageRecord.metric_name == metric_name)
        .where(UsageRecord.period_start >= period_start)
    )
    return result.scalar() or 0


async def record_usage(
    org_id: str,
    metric_name: str,
    db: AsyncSession,
    quantity: int = 1,
) -> None:
    """Record a usage event for metering."""
    now = datetime.now(UTC)
    period_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    period_end = (period_start + timedelta(days=32)).replace(day=1)  # First day of next month

    record = UsageRecord(
        org_id=org_id,
        metric_name=metric_name,
        quantity=quantity,
        period_start=period_start,
        period_end=period_end,
        recorded_at=now,
    )
    db.add(record)
