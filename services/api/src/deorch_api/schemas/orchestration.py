from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class RunCreate(BaseModel):
    project_id: uuid.UUID | None = None
    objective: str = Field(min_length=1, max_length=5000)
    description: str | None = None
    execution_mode: str = Field(default="sequential", max_length=20)
    max_concurrent_tasks: int = Field(default=3, ge=1, le=20)
    config: dict[str, Any] = Field(default_factory=dict)
    budget_config: dict[str, Any] = Field(default_factory=dict)


class RunRead(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    project_id: uuid.UUID | None
    objective: str
    description: str | None
    status: str
    execution_mode: str
    max_concurrent_tasks: int
    config: dict[str, Any]
    budget_config: dict[str, Any]
    started_at: datetime | None
    completed_at: datetime | None
    final_result: dict[str, Any] | None
    created_at: datetime
    task_count: int = 0

    model_config = {"from_attributes": True}


class RunUpdate(BaseModel):
    status: str | None = None
    description: str | None = None
    max_concurrent_tasks: int | None = None


class TaskCreate(BaseModel):
    title: str = Field(min_length=1, max_length=500)
    description: str | None = None
    task_type: str = Field(default="general", max_length=50)
    priority: int = Field(default=0)
    assigned_provider: str | None = None
    workspace_path: str | None = None
    max_retries: int = Field(default=2, ge=0, le=10)
    estimated_complexity: str | None = None


class TaskRead(BaseModel):
    id: uuid.UUID
    run_id: uuid.UUID
    title: str
    description: str | None
    task_type: str
    status: str
    priority: int
    assigned_provider: str | None
    assigned_session_id: uuid.UUID | None
    workspace_path: str | None
    retry_count: int
    max_retries: int
    estimated_complexity: str | None
    started_at: datetime | None
    completed_at: datetime | None
    result: dict[str, Any] | None
    failure_reason: str | None
    validation_status: str
    validation_evidence: dict[str, Any] | None
    created_at: datetime

    model_config = {"from_attributes": True}


class TaskUpdate(BaseModel):
    status: str | None = None
    assigned_provider: str | None = None
    result: dict[str, Any] | None = None
    failure_reason: str | None = None
    validation_status: str | None = None
    validation_evidence: dict[str, Any] | None = None


class DependencyCreate(BaseModel):
    source_task_id: uuid.UUID
    dependent_task_id: uuid.UUID
    dependency_type: str = Field(default="FINISH_TO_START", max_length=30)


class DependencyRead(BaseModel):
    id: uuid.UUID
    source_task_id: uuid.UUID
    dependent_task_id: uuid.UUID
    dependency_type: str
    status: str
    satisfied_at: datetime | None

    model_config = {"from_attributes": True}


class RunGraphRead(BaseModel):
    run: RunRead
    tasks: list[TaskRead]
    dependencies: list[DependencyRead]
