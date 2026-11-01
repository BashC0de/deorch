from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class ProjectCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=1000)
    device_id: uuid.UUID | None = None
    path: str | None = Field(default=None, max_length=1000)
    git_remote: str | None = Field(default=None, max_length=500)


class ProjectRead(BaseModel):
    id: uuid.UUID
    name: str
    description: str | None
    device_id: uuid.UUID | None
    path: str | None
    git_remote: str | None
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class ProjectUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = None
    path: str | None = None
    git_remote: str | None = None
    is_active: bool | None = None
