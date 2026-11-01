from __future__ import annotations

import uuid

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from deorch_api.models.device import Device, DevicePairing
from deorch_api.models.user import User


@pytest.mark.asyncio
async def test_register_device(client: AsyncClient, test_user_token: str) -> None:
    resp = await client.post(
        "/api/v1/devices",
        json={"name": "My Laptop", "hostname": "laptop.local"},
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "My Laptop"
    assert data["status"] == "PENDING"
    assert "id" in data


@pytest.mark.asyncio
async def test_list_devices(client: AsyncClient, test_user_token: str, test_device: tuple) -> None:
    device, _ = test_device
    resp = await client.get(
        "/api/v1/devices",
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    assert resp.status_code == 200
    ids = [d["id"] for d in resp.json()]
    assert str(device.id) in ids


@pytest.mark.asyncio
async def test_pairing_flow(
    client: AsyncClient,
    test_user_token: str,
    test_user: User,
    db: AsyncSession,
) -> None:
    # Register a new device
    reg = await client.post(
        "/api/v1/devices",
        json={"name": "Pairing Test Machine"},
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    assert reg.status_code == 201
    device_id = reg.json()["id"]

    # Generate challenge
    challenge_resp = await client.post(
        "/api/v1/pairing/challenge",
        json={"device_id": device_id},
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    assert challenge_resp.status_code == 200
    token = challenge_resp.json()["challenge_token"]

    # Complete pairing
    complete_resp = await client.post(
        "/api/v1/pairing/complete",
        json={"device_id": device_id, "challenge_token": token},
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    assert complete_resp.status_code == 200
    data = complete_resp.json()
    assert "device_secret" in data
    assert len(data["device_secret"]) > 20

    # Device should now be PAIRED
    device_resp = await client.get(
        f"/api/v1/devices/{device_id}",
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    assert device_resp.json()["status"] == "PAIRED"


@pytest.mark.asyncio
async def test_wrong_challenge_token(
    client: AsyncClient,
    test_user_token: str,
) -> None:
    reg = await client.post(
        "/api/v1/devices",
        json={"name": "Wrong Token Machine"},
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    device_id = reg.json()["id"]

    await client.post(
        "/api/v1/pairing/challenge",
        json={"device_id": device_id},
        headers={"Authorization": f"Bearer {test_user_token}"},
    )

    resp = await client.post(
        "/api/v1/pairing/complete",
        json={"device_id": device_id, "challenge_token": "wrong-token"},
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    assert resp.status_code == 400


@pytest.mark.asyncio
async def test_revoke_device(
    client: AsyncClient,
    test_user_token: str,
    test_device: tuple,
) -> None:
    device, _ = test_device
    resp = await client.delete(
        f"/api/v1/devices/{device.id}",
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    assert resp.status_code == 200

    # Check status
    get_resp = await client.get(
        f"/api/v1/devices/{device.id}",
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    assert get_resp.json()["status"] == "REVOKED"


@pytest.mark.asyncio
async def test_cannot_access_other_users_device(
    client: AsyncClient,
    test_device: tuple,
    db: AsyncSession,
) -> None:
    from deorch_api.services.auth import create_access_token, hash_password

    other_user = User(
        email=f"other-{uuid.uuid4()}@example.com",
        hashed_password=hash_password("pass"),
        display_name="Other",
    )
    db.add(other_user)
    await db.flush()
    other_token = create_access_token(other_user.id)

    device, _ = test_device
    resp = await client.get(
        f"/api/v1/devices/{device.id}",
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert resp.status_code == 404
