from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from deorch_api.models.base import Base, TimestampMixin, UUIDMixin


class AnalyticsEvent(UUIDMixin, Base):
    __tablename__ = "analytics_events"
    __table_args__ = (
        Index("ix_analytics_events_event_name", "event_name"),
        Index("ix_analytics_events_user_id", "user_id"),
        Index("ix_analytics_events_created_at", "created_at"),
        Index("ix_analytics_events_org_id", "org_id"),
    )

    event_name: Mapped[str] = mapped_column(String(100), nullable=False)
    user_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL")
    )
    org_id: Mapped[str | None] = mapped_column(String(36))
    device_id: Mapped[str | None] = mapped_column(String(36))
    session_id: Mapped[str | None] = mapped_column(String(36))
    workflow_id: Mapped[str | None] = mapped_column(String(36))
    properties: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    schema_version: Mapped[str] = mapped_column(String(10), nullable=False, default="1")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class FeatureFlag(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "feature_flags"

    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text)
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    allowed_orgs: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    allowed_users: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
