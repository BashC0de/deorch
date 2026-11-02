from __future__ import annotations

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from deorch_api.models.base import Base, TimestampMixin, UUIDMixin


class FeedbackItem(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "feedback_items"
    __table_args__ = (
        Index("ix_feedback_items_user_id", "user_id"),
        Index("ix_feedback_items_status", "status"),
    )

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="general")
    severity: Mapped[str] = mapped_column(String(20), nullable=False, default="low")
    description: Mapped[str] = mapped_column(Text, nullable=False)
    session_ref: Mapped[str | None] = mapped_column(String(36))
    workflow_ref: Mapped[str | None] = mapped_column(String(36))
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="new")
    priority: Mapped[str] = mapped_column(String(20), nullable=False, default="normal")
    resolution_notes: Mapped[str | None] = mapped_column(Text)
    product_area: Mapped[str | None] = mapped_column(String(50))
