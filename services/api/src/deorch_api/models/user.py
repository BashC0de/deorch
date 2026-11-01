from __future__ import annotations

from sqlalchemy import Boolean, Index, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from deorch_api.models.base import Base, TimestampMixin, UUIDMixin


class User(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "users"
    __table_args__ = (Index("ix_users_email", "email"),)

    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    devices: Mapped[list["Device"]] = relationship(back_populates="user", lazy="select")  # type: ignore[name-defined]
    projects: Mapped[list["Project"]] = relationship(back_populates="user", lazy="select")  # type: ignore[name-defined]
    audit_records: Mapped[list["AuditRecord"]] = relationship(back_populates="user", lazy="select")  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<User id={self.id} email={self.email}>"
