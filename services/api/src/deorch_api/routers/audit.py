from __future__ import annotations

from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from deorch_api.database import get_db
from deorch_api.dependencies import get_current_user
from deorch_api.models.audit import AuditRecord
from deorch_api.models.device import Device
from deorch_api.models.user import User

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("")
async def list_audit(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    event_type: str | None = None,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[dict]:
    stmt = (
        select(AuditRecord)
        .where(AuditRecord.user_id == user.id)
        .order_by(AuditRecord.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    if event_type:
        stmt = stmt.where(AuditRecord.event_type == event_type)
    result = await db.execute(stmt)
    records = result.scalars().all()
    return [
        {
            "id": str(r.id),
            "event_type": r.event_type,
            "actor_type": r.actor_type,
            "device_id": str(r.device_id) if r.device_id else None,
            "session_id": str(r.session_id) if r.session_id else None,
            "request_id": str(r.request_id) if r.request_id else None,
            "payload": r.payload,
            "created_at": r.created_at.isoformat(),
        }
        for r in records
    ]
