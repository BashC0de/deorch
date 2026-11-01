from __future__ import annotations

from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from deorch_api.models.base import Base, TimestampMixin, UUIDMixin


class PushSubscription(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "push_subscriptions"
    __table_args__ = (
        Index("ix_push_subscriptions_user_id", "user_id"),
    )

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    endpoint: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    p256dh: Mapped[str] = mapped_column(String(255), nullable=False)
    auth: Mapped[str] = mapped_column(String(255), nullable=False)

    user: Mapped["User"] = relationship()  # type: ignore[name-defined]
