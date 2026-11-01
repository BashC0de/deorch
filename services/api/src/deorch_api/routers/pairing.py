from __future__ import annotations

import uuid
from datetime import UTC, datetime

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from deorch_api.database import get_db
from deorch_api.dependencies import get_current_user
from deorch_api.models.audit import AuditRecord
from deorch_api.models.device import Device, DevicePairing
from deorch_api.models.user import User
from deorch_api.schemas.device import (
    PairingChallengeRequest,
    PairingChallengeResponse,
    PairingCompleteRequest,
    PairingCompleteResponse,
)
from deorch_api.services.device import (
    generate_device_secret,
    generate_pairing_challenge,
    verify_challenge_token,
)
from deorch_api.config import get_settings

router = APIRouter(prefix="/pairing", tags=["pairing"])
log = structlog.get_logger(__name__)
settings = get_settings()


@router.post("/challenge", response_model=PairingChallengeResponse)
async def create_challenge(
    body: PairingChallengeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PairingChallengeResponse:
    device = await db.get(Device, body.device_id)
    if not device or device.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    if device.status == "REVOKED":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Device is revoked")

    token, token_hash, expires_at = generate_pairing_challenge()
    pairing = DevicePairing(
        device_id=device.id,
        challenge_hash=token_hash,
        expires_at=expires_at,
        created_at=datetime.now(UTC),
    )
    db.add(pairing)
    db.add(AuditRecord(
        user_id=user.id,
        device_id=device.id,
        event_type="device.pairing_started",
        actor_type="USER",
        payload={"device_name": device.name},
        created_at=datetime.now(UTC),
    ))

    log.info("pairing_challenge_created", device_id=str(device.id))
    return PairingChallengeResponse(challenge_token=token, expires_at=expires_at)


@router.post("/complete", response_model=PairingCompleteResponse)
async def complete_pairing(
    body: PairingCompleteRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> PairingCompleteResponse:
    from sqlalchemy import select
    device = await db.get(Device, body.device_id)
    if not device or device.user_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Device not found")
    if device.status == "REVOKED":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Device is revoked")

    # Find most recent incomplete pairing
    result = await db.execute(
        select(DevicePairing)
        .where(DevicePairing.device_id == device.id)
        .where(DevicePairing.completed_at.is_(None))
        .order_by(DevicePairing.created_at.desc())
        .limit(1)
    )
    pairing = result.scalar_one_or_none()
    if not pairing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="No pending pairing challenge")

    now = datetime.now(UTC)

    if pairing.attempts >= settings.device_pairing_max_attempts:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Too many attempts")

    if pairing.expires_at < now:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Pairing challenge expired")

    pairing.attempts += 1

    if not verify_challenge_token(body.challenge_token, pairing.challenge_hash):
        db.add(AuditRecord(
            user_id=user.id,
            device_id=device.id,
            event_type="device.pairing_failed",
            actor_type="SYSTEM",
            payload={"reason": "invalid_token", "attempts": pairing.attempts},
            created_at=now,
        ))
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid challenge token")

    # Pairing success
    device_secret, secret_hash = generate_device_secret()
    device.device_secret_hash = secret_hash
    device.status = "PAIRED"
    device.paired_at = now
    pairing.completed_at = now

    db.add(AuditRecord(
        user_id=user.id,
        device_id=device.id,
        event_type="device.pairing_completed",
        actor_type="USER",
        payload={"device_name": device.name},
        created_at=now,
    ))

    log.info("device_paired", device_id=str(device.id))
    return PairingCompleteResponse(device_secret=device_secret)
