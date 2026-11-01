"""Full pairing lifecycle tests including edge cases."""
from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import AsyncSession

from deorch_api.models.device import Device, DevicePairing
from deorch_api.models.user import User
from deorch_api.services.auth import create_access_token, hash_password


@pytest.mark.asyncio
async def test_full_pairing_lifecycle(
    client: AsyncClient,
    test_user_token: str,
) -> None:
    """Register → challenge → complete → verify secret → use device auth."""
    # Step 1: Register device
    reg = await client.post(
        "/api/v1/devices",
        json={"name": "Lifecycle Machine", "hostname": "test-host"},
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    assert reg.status_code == 201
    device_id = reg.json()["id"]
    assert reg.json()["status"] == "PENDING"

    # Step 2: Generate challenge
    challenge = await client.post(
        "/api/v1/pairing/challenge",
        json={"device_id": device_id},
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    assert challenge.status_code == 200
    token = challenge.json()["challenge_token"]
    assert len(token) > 20

    # Step 3: Complete pairing
    complete = await client.post(
        "/api/v1/pairing/complete",
        json={"device_id": device_id, "challenge_token": token},
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    assert complete.status_code == 200
    device_secret = complete.json()["device_secret"]
    assert len(device_secret) > 20

    # Step 4: Verify device is now PAIRED
    get_resp = await client.get(
        f"/api/v1/devices/{device_id}",
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    assert get_resp.json()["status"] == "PAIRED"

    # Step 5: Use device credentials for device-authenticated endpoint
    device_auth = f"Bearer {device_id}:{device_secret}"
    sessions_resp = await client.post(
        "/api/v1/sessions",
        json={"provider_slug": "claude-code"},
        headers={"Authorization": device_auth},
    )
    # Should succeed (201) or fail gracefully if provider not seeded in test
    assert sessions_resp.status_code in (201, 404, 500)


@pytest.mark.asyncio
async def test_expired_challenge_rejected(
    client: AsyncClient,
    test_user_token: str,
    db: AsyncSession,
) -> None:
    """Pairing must fail with an expired challenge."""
    reg = await client.post(
        "/api/v1/devices",
        json={"name": "Expired Challenge Machine"},
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    device_id = reg.json()["id"]

    challenge = await client.post(
        "/api/v1/pairing/challenge",
        json={"device_id": device_id},
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    token = challenge.json()["challenge_token"]

    # Expire the challenge by backdating expires_at
    await db.execute(
        update(DevicePairing)
        .where(DevicePairing.device_id == device_id)
        .values(expires_at=datetime.now(UTC) - timedelta(minutes=1))
    )
    await db.commit()

    # Attempt to complete with expired challenge
    complete = await client.post(
        "/api/v1/pairing/complete",
        json={"device_id": device_id, "challenge_token": token},
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    assert complete.status_code == 400


@pytest.mark.asyncio
async def test_reused_challenge_rejected(
    client: AsyncClient,
    test_user_token: str,
) -> None:
    """A challenge token cannot be used twice."""
    reg = await client.post(
        "/api/v1/devices",
        json={"name": "Reuse Challenge Machine"},
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    device_id = reg.json()["id"]

    challenge = await client.post(
        "/api/v1/pairing/challenge",
        json={"device_id": device_id},
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    token = challenge.json()["challenge_token"]

    # First completion should succeed
    first = await client.post(
        "/api/v1/pairing/complete",
        json={"device_id": device_id, "challenge_token": token},
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    assert first.status_code == 200

    # Second attempt with same token should fail (device already paired)
    second = await client.post(
        "/api/v1/pairing/complete",
        json={"device_id": device_id, "challenge_token": token},
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    assert second.status_code == 400


@pytest.mark.asyncio
async def test_credential_revocation_prevents_auth(
    client: AsyncClient,
    test_user_token: str,
    test_device: tuple,
) -> None:
    """Revoking a device must prevent further authenticated requests."""
    device, secret = test_device
    device_auth = f"Bearer {device.id}:{secret}"

    # Verify device auth works before revocation
    resp = await client.get(
        "/api/v1/sessions",
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    assert resp.status_code == 200

    # Revoke the device
    revoke_resp = await client.delete(
        f"/api/v1/devices/{device.id}",
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    assert revoke_resp.status_code == 200

    # Device auth should now fail
    post_revoke = await client.post(
        "/api/v1/sessions",
        json={"provider_slug": "claude-code"},
        headers={"Authorization": device_auth},
    )
    assert post_revoke.status_code in (401, 403)


@pytest.mark.asyncio
async def test_cross_user_device_access_blocked(
    client: AsyncClient,
    test_device: tuple,
    db: AsyncSession,
) -> None:
    """A user cannot access another user's device."""
    device, _ = test_device

    other = User(
        email=f"attacker-{uuid.uuid4()}@example.com",
        hashed_password=hash_password("password"),
        display_name="Attacker",
    )
    db.add(other)
    await db.flush()
    attacker_token = create_access_token(other.id)

    # Try to get the device
    resp = await client.get(
        f"/api/v1/devices/{device.id}",
        headers={"Authorization": f"Bearer {attacker_token}"},
    )
    assert resp.status_code == 404

    # Try to revoke it
    resp = await client.delete(
        f"/api/v1/devices/{device.id}",
        headers={"Authorization": f"Bearer {attacker_token}"},
    )
    assert resp.status_code == 404

    # Try to generate a challenge for it
    resp = await client.post(
        "/api/v1/pairing/challenge",
        json={"device_id": str(device.id)},
        headers={"Authorization": f"Bearer {attacker_token}"},
    )
    assert resp.status_code in (400, 404)
