from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class AgentSessionCreate(BaseModel):
    provider_slug: str
    external_session_id: str | None = None
    project_id: uuid.UUID | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class AgentSessionRead(BaseModel):
    id: uuid.UUID
    device_id: uuid.UUID
    project_id: uuid.UUID | None
    provider_slug: str
    external_session_id: str | None
    status: str
    started_at: datetime | None
    ended_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class AgentSessionUpdate(BaseModel):
    status: str | None = None
    ended_at: datetime | None = None


class AgentEventCreate(BaseModel):
    event_type: str = Field(max_length=100)
    payload: dict[str, Any] = Field(default_factory=dict)
    sequence_number: int = Field(ge=0)
    idempotency_key: str = Field(max_length=255)


class AgentEventRead(BaseModel):
    id: uuid.UUID
    session_id: uuid.UUID
    event_type: str
    payload: dict[str, Any]
    sequence_number: int
    idempotency_key: str
    created_at: datetime

    model_config = {"from_attributes": True}
