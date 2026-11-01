from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class ApprovalRequestCreate(BaseModel):
    session_id: uuid.UUID | None = None
    project_id: uuid.UUID | None = None
    request_type: str = Field(max_length=100)
    hook_event_name: str | None = Field(default=None, max_length=50)
    tool_name: str | None = Field(default=None, max_length=100)
    action_category: str | None = Field(default=None, max_length=50)
    action_summary: str = Field(max_length=500)
    details: dict[str, Any] = Field(default_factory=dict)
    working_directory: str | None = Field(default=None, max_length=1000)
    reason: str | None = None
    risk_level: str | None = None
    idempotency_key: str = Field(max_length=255)
    ttl_seconds: int = Field(default=300, ge=30, le=3600)


class ApprovalRequestRead(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID | None
    device_id: uuid.UUID
    project_id: uuid.UUID | None
    request_type: str
    hook_event_name: str | None
    tool_name: str | None
    action_category: str | None
    action_summary: str
    details: dict[str, Any]
    working_directory: str | None
    reason: str | None
    risk_level: str | None
    status: str
    expires_at: datetime
    created_at: datetime
    decision: "ApprovalDecisionRead | None" = None

    model_config = {"from_attributes": True}


class ApprovalDecisionCreate(BaseModel):
    decision: str = Field(pattern="^(APPROVE|DENY)$")
    reason: str | None = None


class ApprovalDecisionRead(BaseModel):
    id: uuid.UUID
    request_id: uuid.UUID
    user_id: uuid.UUID
    decision: str
    reason: str | None
    decided_at: datetime
    delivered_at: datetime | None

    model_config = {"from_attributes": True}
