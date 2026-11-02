from __future__ import annotations

import hashlib
import json
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, JSON, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from deorch_api.models.base import Base, TimestampMixin, UUIDMixin


class Workflow(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "workflows"
    __table_args__ = (
        Index("ix_workflows_author_id", "author_id"),
        Index("ix_workflows_category", "category"),
        Index("ix_workflows_visibility", "visibility"),
    )

    author_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(50), nullable=False, default="general")
    tags: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    visibility: Mapped[str] = mapped_column(String(20), nullable=False, default="PRIVATE")
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="DRAFT")
    org_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="SET NULL")
    )

    versions: Mapped[list["WorkflowVersion"]] = relationship(
        back_populates="workflow", cascade="all, delete-orphan",
        order_by="WorkflowVersion.version_number.desc()"
    )
    installations: Mapped[list["WorkflowInstallation"]] = relationship(
        back_populates="workflow", cascade="all, delete-orphan"
    )


class WorkflowVersion(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "workflow_versions"
    __table_args__ = (
        Index("ix_workflow_versions_workflow_id", "workflow_id"),
        UniqueConstraint("workflow_id", "version_number", name="uq_workflow_version"),
    )

    workflow_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False
    )
    version_number: Mapped[str] = mapped_column(String(20), nullable=False)
    definition: Mapped[dict] = mapped_column(JSON, nullable=False)
    checksum: Mapped[str] = mapped_column(String(64), nullable=False)
    trust_status: Mapped[str] = mapped_column(String(20), nullable=False, default="UNVERIFIED")
    changelog: Mapped[str | None] = mapped_column(Text)
    required_capabilities: Mapped[list] = mapped_column(JSON, nullable=False, default=list)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    workflow: Mapped["Workflow"] = relationship(back_populates="versions")

    @staticmethod
    def compute_checksum(definition: dict) -> str:
        canonical = json.dumps(definition, sort_keys=True, separators=(",", ":"))
        return hashlib.sha256(canonical.encode()).hexdigest()


class WorkflowInstallation(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "workflow_installations"
    __table_args__ = (
        Index("ix_workflow_installations_user_id", "user_id"),
        Index("ix_workflow_installations_project_id", "project_id"),
    )

    workflow_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False
    )
    workflow_version_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("workflow_versions.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    project_id: Mapped[str | None] = mapped_column(
        String(36), ForeignKey("projects.id", ondelete="SET NULL")
    )
    config_overrides: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    workflow: Mapped["Workflow"] = relationship(back_populates="installations")
    version: Mapped["WorkflowVersion"] = relationship()


class Organization(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "organizations"

    name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    display_name: Mapped[str] = mapped_column(String(200), nullable=False)
    owner_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    members: Mapped[list["OrganizationMember"]] = relationship(
        back_populates="organization", cascade="all, delete-orphan"
    )


class OrganizationMember(UUIDMixin, Base):
    __tablename__ = "organization_members"
    __table_args__ = (
        UniqueConstraint("organization_id", "user_id", name="uq_org_member"),
    )

    organization_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=False
    )
    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    role: Mapped[str] = mapped_column(String(30), nullable=False, default="developer")

    organization: Mapped["Organization"] = relationship(back_populates="members")
