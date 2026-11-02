from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class WorkflowCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    display_name: str = Field(min_length=1, max_length=200)
    description: str | None = None
    category: str = Field(default="general", max_length=50)
    tags: list[str] = Field(default_factory=list)
    visibility: str = Field(default="PRIVATE", pattern="^(PRIVATE|PUBLIC|ORGANIZATION)$")


class WorkflowRead(BaseModel):
    id: uuid.UUID
    author_id: uuid.UUID
    name: str
    display_name: str
    description: str | None
    category: str
    tags: list[str]
    visibility: str
    status: str
    org_id: uuid.UUID | None
    created_at: datetime
    latest_version: str | None = None
    version_count: int = 0
    installation_count: int = 0

    model_config = {"from_attributes": True}


class WorkflowUpdate(BaseModel):
    display_name: str | None = None
    description: str | None = None
    category: str | None = None
    tags: list[str] | None = None
    visibility: str | None = None
    status: str | None = None


# ── Workflow Definition Schema ──────────────────────────────────────────────

class TaskDefinition(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    title: str = Field(min_length=1, max_length=500)
    description: str | None = None
    task_type: str = Field(default="general", max_length=50)
    priority: int = Field(default=0)
    required_capabilities: list[str] = Field(default_factory=list)
    preferred_provider: str | None = None
    max_retries: int = Field(default=2, ge=0, le=10)
    estimated_complexity: str | None = None


class DependencyDefinition(BaseModel):
    source: str  # task id
    dependent: str  # task id
    type: str = "FINISH_TO_START"


class WorkflowDefinition(BaseModel):
    """The declarative definition of a workflow."""
    tasks: list[TaskDefinition] = Field(min_length=1)
    dependencies: list[DependencyDefinition] = Field(default_factory=list)
    constraints: dict[str, Any] = Field(default_factory=dict)
    inputs: list[dict[str, Any]] = Field(default_factory=list)
    outputs: list[str] = Field(default_factory=list)


# ── Versions ────────────────────────────────────────────────────────────────

class VersionCreate(BaseModel):
    version_number: str = Field(min_length=1, max_length=20)
    definition: WorkflowDefinition
    changelog: str | None = None
    required_capabilities: list[str] = Field(default_factory=list)


class VersionRead(BaseModel):
    id: uuid.UUID
    workflow_id: uuid.UUID
    version_number: str
    definition: dict[str, Any]
    checksum: str
    trust_status: str
    changelog: str | None
    required_capabilities: list[str]
    published_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Installations ───────────────────────────────────────────────────────────

class InstallationCreate(BaseModel):
    workflow_id: uuid.UUID
    workflow_version_id: uuid.UUID
    project_id: uuid.UUID | None = None
    config_overrides: dict[str, Any] = Field(default_factory=dict)


class InstallationRead(BaseModel):
    id: uuid.UUID
    workflow_id: uuid.UUID
    workflow_version_id: uuid.UUID
    user_id: uuid.UUID
    project_id: uuid.UUID | None
    config_overrides: dict[str, Any]
    is_enabled: bool
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Organizations ───────────────────────────────────────────────────────────

class OrgCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    display_name: str = Field(min_length=1, max_length=200)


class OrgRead(BaseModel):
    id: uuid.UUID
    name: str
    display_name: str
    owner_id: uuid.UUID
    created_at: datetime

    model_config = {"from_attributes": True}
