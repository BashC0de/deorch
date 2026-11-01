from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from deorch_api.models.base import Base, TimestampMixin, UUIDMixin


class ApprovalRequest(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "approval_requests"
    __table_args__ = (
        Index("ix_approval_requests_device_id", "device_id"),
        Index("ix_approval_requests_session_id", "session_id"),
        Index("ix_approval_requests_status", "status"),
        Index("ix_approval_requests_created_at", "created_at"),
        UniqueConstraint("idempotency_key", name="uq_approval_requests_idempotency_key"),
    )

    session_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("agent_sessions.id", ondelete="SET NULL")
    )
    device_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False
    )
    project_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="SET NULL")
    )
    request_type: Mapped[str] = mapped_column(String(100), nullable=False)
    hook_event_name: Mapped[str | None] = mapped_column(String(50))
    tool_name: Mapped[str | None] = mapped_column(String(100))
    action_category: Mapped[str | None] = mapped_column(String(50))
    action_summary: Mapped[str] = mapped_column(String(500), nullable=False)
    details: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    working_directory: Mapped[str | None] = mapped_column(String(1000))
    reason: Mapped[str | None] = mapped_column(Text)
    risk_level: Mapped[str | None] = mapped_column(String(20))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING")
    idempotency_key: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    session: Mapped["AgentSession | None"] = relationship(back_populates="approval_requests")  # type: ignore[name-defined]
    device: Mapped["Device"] = relationship()  # type: ignore[name-defined]
    decision: Mapped["ApprovalDecision | None"] = relationship(
        back_populates="request", uselist=False, lazy="select"
    )


class ApprovalDecision(UUIDMixin, Base):
    __tablename__ = "approval_decisions"

    request_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("approval_requests.id", ondelete="CASCADE"),
        unique=True,
        nullable=False,
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id"), nullable=False
    )
    decision: Mapped[str] = mapped_column(String(10), nullable=False)
    reason: Mapped[str | None] = mapped_column(Text)
    decided_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    delivery_attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    request: Mapped["ApprovalRequest"] = relationship(back_populates="decision")
    user: Mapped["User"] = relationship()  # type: ignore[name-defined]
