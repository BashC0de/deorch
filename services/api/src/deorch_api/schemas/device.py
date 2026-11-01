from __future__ import annotations

import uuid
from datetime import datetime

from pydantic import BaseModel, Field


class DeviceRegister(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    hostname: str | None = None


class DeviceRead(BaseModel):
    id: uuid.UUID
    name: str
    hostname: str | None
    status: str
    last_seen_at: datetime | None
    paired_at: datetime | None
    created_at: datetime

    model_config = {"from_attributes": True}


class PairingChallengeRequest(BaseModel):
    device_id: uuid.UUID


class PairingChallengeResponse(BaseModel):
    challenge_token: str
    expires_at: datetime


class PairingCompleteRequest(BaseModel):
    device_id: uuid.UUID
    challenge_token: str


class PairingCompleteResponse(BaseModel):
    device_secret: str
    message: str = "Device paired successfully. Save your device_secret — it will not be shown again."
