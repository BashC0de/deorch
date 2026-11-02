from __future__ import annotations

import uuid

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from deorch_api.database import get_db
from deorch_api.dependencies import get_current_user
from deorch_api.models.feedback import FeedbackItem
from deorch_api.models.user import User

router = APIRouter(prefix="/feedback", tags=["feedback"])
log = structlog.get_logger(__name__)


class FeedbackCreate(BaseModel):
    category: str = Field(default="general", max_length=50)
    severity: str = Field(default="low", max_length=20)
    description: str = Field(min_length=1, max_length=5000)
    session_ref: str | None = None
    workflow_ref: str | None = None
    product_area: str | None = None


class FeedbackRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    category: str
    severity: str
    description: str
    session_ref: str | None
    workflow_ref: str | None
    status: str
    priority: str
    resolution_notes: str | None
    product_area: str | None
    created_at: str

    model_config = {"from_attributes": True}


class FeedbackUpdate(BaseModel):
    status: str | None = None
    priority: str | None = None
    resolution_notes: str | None = None
    product_area: str | None = None


@router.post("", response_model=FeedbackRead, status_code=status.HTTP_201_CREATED)
async def submit_feedback(
    body: FeedbackCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FeedbackRead:
    item = FeedbackItem(
        user_id=user.id,
        category=body.category,
        severity=body.severity,
        description=body.description,
        session_ref=body.session_ref,
        workflow_ref=body.workflow_ref,
        product_area=body.product_area,
    )
    db.add(item)
    await db.flush()
    log.info("feedback_submitted", feedback_id=str(item.id), category=body.category)
    return FeedbackRead.model_validate(item)


@router.get("", response_model=list[FeedbackRead])
async def list_feedback(
    status_filter: str | None = Query(default=None, alias="status"),
    category: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[FeedbackRead]:
    # Users see their own feedback; operators would see all (RBAC extension)
    stmt = select(FeedbackItem).where(FeedbackItem.user_id == user.id)
    if status_filter:
        stmt = stmt.where(FeedbackItem.status == status_filter.lower())
    if category:
        stmt = stmt.where(FeedbackItem.category == category)
    stmt = stmt.order_by(FeedbackItem.created_at.desc()).limit(limit)
    result = await db.execute(stmt)
    return [FeedbackRead.model_validate(f) for f in result.scalars().all()]


@router.patch("/{feedback_id}", response_model=FeedbackRead)
async def update_feedback(
    feedback_id: uuid.UUID,
    body: FeedbackUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> FeedbackRead:
    item = await db.get(FeedbackItem, feedback_id)
    if not item or item.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="Feedback not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    return FeedbackRead.model_validate(item)
