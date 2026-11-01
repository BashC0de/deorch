from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from deorch_api.models.base import Base, TimestampMixin, UUIDMixin


class ServiceRegistration(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "service_registrations"
    __table_args__ = (
        Index("ix_service_registrations_device_id", "device_id"),
        Index("ix_service_registrations_project_id", "project_id"),
    )

    project_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="SET NULL")
    )
    device_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    service_type: Mapped[str] = mapped_column(String(50), nullable=False, default="http")
    host: Mapped[str] = mapped_column(String(255), nullable=False, default="localhost")
    port: Mapped[int] = mapped_column(Integer, nullable=False)
    health_path: Mapped[str | None] = mapped_column(String(500))
    expected_status: Mapped[int] = mapped_column(Integer, nullable=False, default=200)
    interval_seconds: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="UNKNOWN")
    is_active: Mapped[bool] = mapped_column(default=True)

    device: Mapped["Device"] = relationship()  # type: ignore[name-defined]
    project: Mapped["Project | None"] = relationship()  # type: ignore[name-defined]
    health_checks: Mapped[list["ServiceHealthCheck"]] = relationship(
        back_populates="service", cascade="all, delete-orphan"
    )


class ServiceHealthCheck(UUIDMixin, Base):
    __tablename__ = "service_health_checks"
    __table_args__ = (
        Index("ix_service_health_checks_service_id", "service_id"),
        Index("ix_service_health_checks_checked_at", "checked_at"),
    )

    service_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("service_registrations.id", ondelete="CASCADE"), nullable=False
    )
    status: Mapped[str] = mapped_column(String(20), nullable=False)
    response_ms: Mapped[int | None] = mapped_column(Integer)
    status_code: Mapped[int | None] = mapped_column(Integer)
    error: Mapped[str | None] = mapped_column(Text)
    checked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    service: Mapped["ServiceRegistration"] = relationship(back_populates="health_checks")


class TestRun(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "test_runs"
    __table_args__ = (
        Index("ix_test_runs_project_id", "project_id"),
        Index("ix_test_runs_device_id", "device_id"),
        Index("ix_test_runs_created_at", "created_at"),
    )

    project_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="SET NULL")
    )
    device_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False
    )
    session_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("agent_sessions.id", ondelete="SET NULL")
    )
    framework: Mapped[str] = mapped_column(String(50), nullable=False)
    total_tests: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    passed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    skipped: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="RUNNING")
    failures: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    error_output: Mapped[str | None] = mapped_column(Text)


class GitSnapshot(UUIDMixin, Base):
    __tablename__ = "git_snapshots"
    __table_args__ = (
        Index("ix_git_snapshots_project_id", "project_id"),
        Index("ix_git_snapshots_device_id", "device_id"),
        Index("ix_git_snapshots_created_at", "created_at"),
    )

    project_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="SET NULL")
    )
    device_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False
    )
    branch: Mapped[str] = mapped_column(String(255), nullable=False)
    commit_hash: Mapped[str] = mapped_column(String(40), nullable=False)
    modified_files: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    added_files: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    deleted_files: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    untracked_files: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    diff_stats: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class BuildResult(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "build_results"
    __table_args__ = (
        Index("ix_build_results_project_id", "project_id"),
        Index("ix_build_results_device_id", "device_id"),
        Index("ix_build_results_created_at", "created_at"),
    )

    project_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="SET NULL")
    )
    device_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False
    )
    session_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("agent_sessions.id", ondelete="SET NULL")
    )
    build_type: Mapped[str] = mapped_column(String(50), nullable=False)
    command: Mapped[str] = mapped_column(String(500), nullable=False)
    exit_code: Mapped[int | None] = mapped_column(Integer)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="RUNNING")
    error_output: Mapped[str | None] = mapped_column(Text)
    duration_ms: Mapped[int | None] = mapped_column(Integer)
