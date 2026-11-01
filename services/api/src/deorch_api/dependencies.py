from __future__ import annotations

import uuid

import structlog
from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession

from deorch_api.database import get_db
from deorch_api.models.device import Device
from deorch_api.models.user import User
from deorch_api.services.auth import decode_token
from deorch_api.services.device import verify_device_secret

log = structlog.get_logger(__name__)

oauth2_scheme = HTTPBearer()
device_security = HTTPBearer()


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    token = credentials.credentials
    try:
        claims = decode_token(token)
        if claims.get("type") != "access":
            raise ValueError("Not an access token")
        user_id = uuid.UUID(claims["sub"])
    except (ValueError, KeyError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = await db.get(User, user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")
    return user


async def get_current_device(
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> Device:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing device credentials")

    credentials = auth[7:]
    parts = credentials.split(":", 1)
    if len(parts) != 2:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credential format")

    try:
        device_id = uuid.UUID(parts[0])
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid device ID")

    device_secret = parts[1]
    device = await db.get(Device, device_id)

    if not device:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Device not found")
    if device.status == "REVOKED":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Device is revoked")
    if device.status == "PENDING":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Device not yet paired")
    if not device.device_secret_hash:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Device has no credentials")
    if not verify_device_secret(device_secret, device.device_secret_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid device secret")

    # Update last_seen_at
    from datetime import UTC, datetime
    from sqlalchemy import update
    await db.execute(
        update(Device).where(Device.id == device.id).values(last_seen_at=datetime.now(UTC))
    )

    return device
