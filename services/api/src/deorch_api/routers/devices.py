from __future__ import annotations

import uuid
from datetime import UTC, datetime

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from deorch_api.database import get_db
from deorch_api.dependencies import get_current_user
from deorch_api.models.audit import AuditRecord
from deorch_api.models.device import Device
from deorch_api.models.user import User
from deorch_api.schemas.device import DeviceRead, DeviceRegister

router = APIRouter(prefix="/devices", tags=["devices"])
log = structlog.get_logger(__name__)


@router.post("", response_model=DeviceRead, status_code=status.HTTP_201_CREATED)
async def register_device(
    body: DeviceRegister,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeviceRead:
    device = Device(
        user_id=user.id,
        name=body.name,
        hostname=body.hostname,
        status="PENDING",
    )
    db.add(device)
    await db.flush()

    db.add(AuditRecord(
        user_id=user.id,
        device_id=device.id,
        event_type="device.registered",
        actor_type="USER",
        payload={"device_name": body.name},
        created_at=datetime.now(UTC),
    ))

    log.info("device_registered", device_id=str(device.id), user_id=str(user.id))

    # Notify dashboard in real-time
    from deorch_api.websocket.manager import connection_manager
    from deorch_api.websocket.messages import device_registered_msg
    await connection_manager.send_to_user(
        str(user.id), device_registered_msg(str(device.id), body.name)
    )

    return DeviceRead.model_validate(device)


@router.get("", response_model=list[DeviceRead])
async def list_devices(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[DeviceRead]:
    result = await db.execute(select(Device).where(Device.user_id == user.id))
    devices = result.scalars().all()
    return [DeviceRead.model_validate(d) for d in devices]


@router.get("/{device_id}", response_model=DeviceRead)
async def get_device(
    device_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DeviceRead:
    device = await db.get(Device, device_id)
    if not device or device.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    return DeviceRead.model_validate(device)


@router.delete("/{device_id}", status_code=status.HTTP_200_OK)
async def revoke_device(
    device_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    device = await db.get(Device, device_id)
    if not device or device.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    if device.status == "REVOKED":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Device already revoked")

    device.status = "REVOKED"
    device.device_secret_hash = None  # invalidate credentials
    db.add(AuditRecord(
        user_id=user.id,
        device_id=device.id,
        event_type="device.revoked",
        actor_type="USER",
        payload={"device_name": device.name},
        created_at=datetime.now(UTC),
    ))

    log.info("device_revoked", device_id=str(device.id), user_id=str(user.id))
    return {"message": "Device revoked"}
