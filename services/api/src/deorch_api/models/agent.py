from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, JSON, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from deorch_api.models.base import Base, TimestampMixin, UUIDMixin


class AgentProvider(UUIDMixin, Base):
    __tablename__ = "agent_providers"

    slug: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    capabilities: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    is_supported: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    sessions: Mapped[list["AgentSession"]] = relationship(back_populates="provider", lazy="select")


class AgentSession(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "agent_sessions"
    __table_args__ = (
        Index("ix_agent_sessions_device_id", "device_id"),
        Index("ix_agent_sessions_external_session_id", "external_session_id"),
    )

    device_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False
    )
    project_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="SET NULL")
    )
    provider_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("agent_providers.id"), nullable=False
    )
    external_session_id: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="INITIALIZING")
    metadata_: Mapped[dict] = mapped_column("metadata", JSON, nullable=False, default=dict)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    device: Mapped["Device"] = relationship(back_populates="sessions")  # type: ignore[name-defined]
    project: Mapped["Project | None"] = relationship(back_populates="sessions")  # type: ignore[name-defined]
    provider: Mapped["AgentProvider"] = relationship(back_populates="sessions")
    events: Mapped[list["AgentEvent"]] = relationship(back_populates="session", lazy="select")
    approval_requests: Mapped[list["ApprovalRequest"]] = relationship(back_populates="session", lazy="select")  # type: ignore[name-defined]


class AgentEvent(UUIDMixin, Base):
    __tablename__ = "agent_events"
    __table_args__ = (
        Index("ix_agent_events_session_id", "session_id"),
        Index("ix_agent_events_created_at", "created_at"),
        UniqueConstraint("idempotency_key", name="uq_agent_events_idempotency_key"),
    )

    session_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("agent_sessions.id", ondelete="CASCADE"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    sequence_number: Mapped[int] = mapped_column(Integer, nullable=False)
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    session: Mapped["AgentSession"] = relationship(back_populates="events")
