from __future__ import annotations

import uuid
from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


# ── Service Registration ────────────────────────────────────────────────────

class ServiceCreate(BaseModel):
    name: str = Field(max_length=100)
    service_type: str = Field(default="http", max_length=50)
    project_id: uuid.UUID | None = None
    host: str = Field(default="localhost", max_length=255)
    port: int = Field(ge=1, le=65535)
    health_path: str | None = Field(default=None, max_length=500)
    expected_status: int = Field(default=200)
    interval_seconds: int = Field(default=30, ge=5, le=3600)


class ServiceRead(BaseModel):
    id: uuid.UUID
    name: str
    service_type: str
    project_id: uuid.UUID | None
    device_id: uuid.UUID
    host: str
    port: int
    health_path: str | None
    expected_status: int
    interval_seconds: int
    status: str
    is_active: bool
    created_at: datetime

    model_config = {"from_attributes": True}


class HealthCheckCreate(BaseModel):
    status: str = Field(max_length=20)
    response_ms: int | None = None
    status_code: int | None = None
    error: str | None = None


class HealthCheckRead(BaseModel):
    id: uuid.UUID
    service_id: uuid.UUID
    status: str
    response_ms: int | None
    status_code: int | None
    error: str | None
    checked_at: datetime

    model_config = {"from_attributes": True}


# ── Test Runs ───────────────────────────────────────────────────────────────

class TestRunCreate(BaseModel):
    project_id: uuid.UUID | None = None
    session_id: uuid.UUID | None = None
    framework: str = Field(max_length=50)
    total_tests: int = Field(ge=0)
    passed: int = Field(ge=0)
    failed: int = Field(ge=0)
    skipped: int = Field(ge=0, default=0)
    duration_ms: int | None = None
    status: str = Field(default="COMPLETED", max_length=20)
    failures: list[dict[str, Any]] = Field(default_factory=list)
    error_output: str | None = None


class TestRunRead(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID | None
    device_id: uuid.UUID
    session_id: uuid.UUID | None
    framework: str
    total_tests: int
    passed: int
    failed: int
    skipped: int
    duration_ms: int | None
    status: str
    failures: list[dict[str, Any]]
    error_output: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Git Snapshots ───────────────────────────────────────────────────────────

class GitSnapshotCreate(BaseModel):
    project_id: uuid.UUID | None = None
    branch: str = Field(max_length=255)
    commit_hash: str = Field(max_length=40)
    modified_files: list[str] = Field(default_factory=list)
    added_files: list[str] = Field(default_factory=list)
    deleted_files: list[str] = Field(default_factory=list)
    untracked_files: list[str] = Field(default_factory=list)
    diff_stats: dict[str, Any] = Field(default_factory=dict)


class GitSnapshotRead(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID | None
    device_id: uuid.UUID
    branch: str
    commit_hash: str
    modified_files: list[str]
    added_files: list[str]
    deleted_files: list[str]
    untracked_files: list[str]
    diff_stats: dict[str, Any]
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Build Results ───────────────────────────────────────────────────────────

class BuildResultCreate(BaseModel):
    project_id: uuid.UUID | None = None
    session_id: uuid.UUID | None = None
    build_type: str = Field(max_length=50)
    command: str = Field(max_length=500)
    exit_code: int | None = None
    status: str = Field(default="COMPLETED", max_length=20)
    error_output: str | None = None
    duration_ms: int | None = None


class BuildResultRead(BaseModel):
    id: uuid.UUID
    project_id: uuid.UUID | None
    device_id: uuid.UUID
    session_id: uuid.UUID | None
    build_type: str
    command: str
    exit_code: int | None
    status: str
    error_output: str | None
    duration_ms: int | None
    created_at: datetime

    model_config = {"from_attributes": True}


# ── Project Health (aggregated) ─────────────────────────────────────────────

class ProjectHealthRead(BaseModel):
    project_id: uuid.UUID
    project_name: str
    services: list[ServiceRead]
    latest_test_run: TestRunRead | None
    latest_build: BuildResultRead | None
    latest_git: GitSnapshotRead | None
