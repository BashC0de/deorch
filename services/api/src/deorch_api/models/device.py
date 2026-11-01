from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Index, Integer, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from deorch_api.models.base import Base, TimestampMixin, UUIDMixin


class Device(UUIDMixin, TimestampMixin, Base):
    __tablename__ = "devices"
    __table_args__ = (Index("ix_devices_user_id", "user_id"),)

    user_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    hostname: Mapped[str | None] = mapped_column(String(255))
    os_info: Mapped[dict | None] = mapped_column(JSON)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="PENDING")
    device_secret_hash: Mapped[str | None] = mapped_column(String(255))
    last_seen_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    paired_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    user: Mapped["User"] = relationship(back_populates="devices")  # type: ignore[name-defined]
    pairings: Mapped[list["DevicePairing"]] = relationship(back_populates="device", lazy="select")
    sessions: Mapped[list["AgentSession"]] = relationship(back_populates="device", lazy="select")  # type: ignore[name-defined]

    def __repr__(self) -> str:
        return f"<Device id={self.id} name={self.name} status={self.status}>"


class DevicePairing(UUIDMixin, Base):
    __tablename__ = "device_pairings"

    device_id: Mapped[str] = mapped_column(
        String(36), ForeignKey("devices.id", ondelete="CASCADE"), nullable=False
    )
    challenge_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False
    )

    device: Mapped["Device"] = relationship(back_populates="pairings")

    def __repr__(self) -> str:
        return f"<DevicePairing id={self.id} device_id={self.device_id}>"
