from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from deorch_api.models.base import Base, TimestampMixin, UUIDMixin


class Integration(UUIDMixin, TimestampMixin, Base):
    """Available integration definitions (catalog entries)."""
    __tablename__ = "integrations"

    slug: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(30), nullable=False)  # source_control, communication, project_mgmt, ci_cd
    provider: Mapped[str] = mapped_column(String(50), nullable=False)  # github, slack, linear, etc.
    auth_type: Mapped[str] = mapped_column(String(20), nullable=False)  # oauth, token, webhook
    config_schema: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    capabilities: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    required_permissions: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    is_available: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    trust_status: Mapped[str] = mapped_column(String(20), nullable=False, default="VERIFIED")  # first-party
    icon_url: Mapped[str | None] = mapped_column(String(500))
    docs_url: Mapped[str | None] = mapped_column(String(500))


class IntegrationConnection(UUIDMixin, TimestampMixin, Base):
    """An org's active connection to an integration."""
    __tablename__ = "integration_connections"
    __table_args__ = (
        Index("ix_integration_connections_org_id", "org_id"),
        UniqueConstraint("integration_id", "org_id", name="uq_integration_org"),
    )

    integration_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("integrations.id", ondelete="CASCADE"), nullable=False
    )
    org_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    config: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    credentials_encrypted: Mapped[str | None] = mapped_column(Text)  # encrypted token/credentials
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="ACTIVE")
    connected_by: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=False
    )
    connected_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)

    integration: Mapped["Integration"] = relationship()


class WebhookEndpoint(UUIDMixin, TimestampMixin, Base):
    """Registered outgoing webhook endpoints."""
    __tablename__ = "webhook_endpoints"
    __table_args__ = (
        Index("ix_webhook_endpoints_org_id", "org_id"),
    )

    org_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    integration_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("integrations.id", ondelete="SET NULL")
    )
    url: Mapped[str] = mapped_column(String(1000), nullable=False)
    secret_hash: Mapped[str | None] = mapped_column(String(255))
    subscribed_events: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class WebhookDelivery(UUIDMixin, Base):
    __tablename__ = "webhook_deliveries"
    __table_args__ = (
        Index("ix_webhook_deliveries_endpoint_id", "endpoint_id"),
        Index("ix_webhook_deliveries_created_at", "created_at"),
    )

    endpoint_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("webhook_endpoints.id", ondelete="CASCADE"), nullable=False
    )
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    payload: Mapped[dict] = mapped_column(JSON, nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING")
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    response_code: Mapped[int | None] = mapped_column(Integer)
    error: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class InboundWebhookLog(UUIDMixin, Base):
    """Persistent deduplication log for inbound webhooks. Survives restarts."""
    __tablename__ = "inbound_webhook_logs"
    __table_args__ = (
        UniqueConstraint("provider_delivery_id", "integration_slug", name="uq_inbound_webhook_dedup"),
        Index("ix_inbound_webhook_logs_created_at", "created_at"),
    )

    integration_slug: Mapped[str] = mapped_column(String(50), nullable=False)
    provider_delivery_id: Mapped[str] = mapped_column(String(255), nullable=False)
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    processed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
