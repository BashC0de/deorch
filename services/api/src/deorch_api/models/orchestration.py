from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from deorch_api.models.base import Base, TimestampMixin, UUIDMixin


class OrchestrationRun(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "orchestration_runs"
    __table_args__ = (
        Index("ix_orchestration_runs_user_id", "user_id"),
        Index("ix_orchestration_runs_project_id", "project_id"),
        Index("ix_orchestration_runs_status", "status"),
    )

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    project_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="SET NULL")
    )
    workflow_version_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("workflow_versions.id", ondelete="SET NULL")
    )
    objective: Mapped[str] = mapped_column(Text, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="CREATED")
    execution_mode: Mapped[str] = mapped_column(String(20), nullable=False, default="sequential")
    config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    budget_config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    max_concurrent_tasks: Mapped[int] = mapped_column(Integer, nullable=False, default=3)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    final_result: Mapped[dict | None] = mapped_column(JSON)

    tasks: Mapped[list["Task"]] = relationship(
        back_populates="run", cascade="all, delete-orphan", order_by="Task.priority"
    )


class Task(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "orchestration_tasks"
    __table_args__ = (
        Index("ix_orchestration_tasks_run_id", "run_id"),
        Index("ix_orchestration_tasks_status", "status"),
    )

    run_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("orchestration_runs.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    task_type: Mapped[str] = mapped_column(String(50), nullable=False, default="general")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="CREATED")
    priority: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    assigned_provider: Mapped[str | None] = mapped_column(String(50))
    assigned_session_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("agent_sessions.id", ondelete="SET NULL")
    )
    workspace_path: Mapped[str | None] = mapped_column(String(1000))
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    max_retries: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    estimated_complexity: Mapped[str | None] = mapped_column(String(20))
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    result: Mapped[dict | None] = mapped_column(JSON)
    failure_reason: Mapped[str | None] = mapped_column(Text)
    validation_status: Mapped[str] = mapped_column(String(30), nullable=False, default="NOT_STARTED")
    validation_evidence: Mapped[dict | None] = mapped_column(JSON)

    run: Mapped["OrchestrationRun"] = relationship(back_populates="tasks")
    dependencies_as_dependent: Mapped[list["TaskDependency"]] = relationship(
        foreign_keys="TaskDependency.dependent_task_id", cascade="all, delete-orphan"
    )
    artifacts: Mapped[list["TaskArtifact"]] = relationship(
        back_populates="task", cascade="all, delete-orphan"
    )


class TaskDependency(UUIDMixin, Base):
    __tablename__ = "task_dependencies"
    __table_args__ = (
        Index("ix_task_dependencies_source", "source_task_id"),
        Index("ix_task_dependencies_dependent", "dependent_task_id"),
        UniqueConstraint("source_task_id", "dependent_task_id", name="uq_task_dependency_pair"),
    )

    source_task_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("orchestration_tasks.id", ondelete="CASCADE"), nullable=False
    )
    dependent_task_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("orchestration_tasks.id", ondelete="CASCADE"), nullable=False
    )
    dependency_type: Mapped[str] = mapped_column(String(30), nullable=False, default="FINISH_TO_START")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING")
    satisfied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class TaskArtifact(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "task_artifacts"
    __table_args__ = (
        Index("ix_task_artifacts_task_id", "task_id"),
    )

    task_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("orchestration_tasks.id", ondelete="CASCADE"), nullable=False
    )
    artifact_type: Mapped[str] = mapped_column(String(50), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    storage_path: Mapped[str | None] = mapped_column(String(1000))
    metadata: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    checksum: Mapped[str | None] = mapped_column(String(64))

    task: Mapped["Task"] = relationship(back_populates="artifacts")
