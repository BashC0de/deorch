from __future__ import annotations

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from deorch_api.models.approval import ApprovalRequest
from deorch_api.models.device import Device
from deorch_api.models.user import User


def _device_auth_header(device: Device, secret: str) -> dict:
    return {"Authorization": f"Bearer {device.id}:{secret}"}


@pytest.mark.asyncio
async def test_create_approval_request(
    client: AsyncClient,
    test_device: tuple[Device, str],
    test_user_token: str,
) -> None:
    device, secret = test_device
    idem_key = str(uuid.uuid4())

    resp = await client.post(
        "/api/v1/approvals",
        json={
            "request_type": "bash_execution",
            "action_summary": "Run rm -rf ./dist",
            "details": {"command": "rm -rf ./dist", "tool": "Bash"},
            "working_directory": "/home/user/project",
            "reason": "Cleaning build artifacts",
            "risk_level": "MEDIUM",
            "idempotency_key": idem_key,
            "ttl_seconds": 300,
        },
        headers=_device_auth_header(device, secret),
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["status"] == "PENDING"
    assert data["action_summary"] == "Run rm -rf ./dist"

    # Should appear in user's approval list
    list_resp = await client.get(
        "/api/v1/approvals",
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    assert resp.json()["id"] in [r["id"] for r in list_resp.json()]


@pytest.mark.asyncio
async def test_idempotent_approval_request(
    client: AsyncClient,
    test_device: tuple[Device, str],
) -> None:
    device, secret = test_device
    idem_key = str(uuid.uuid4())
    payload = {
        "request_type": "bash_execution",
        "action_summary": "Idempotent test",
        "details": {},
        "idempotency_key": idem_key,
        "ttl_seconds": 300,
    }
    r1 = await client.post("/api/v1/approvals", json=payload, headers=_device_auth_header(device, secret))
    r2 = await client.post("/api/v1/approvals", json=payload, headers=_device_auth_header(device, secret))
    assert r1.status_code == 201
    # Second request should return same record (not 500)
    assert r2.status_code in (200, 201, 409)
    if r2.status_code in (200, 201):
        assert r1.json()["id"] == r2.json()["id"]


@pytest.mark.asyncio
async def test_approve_request(
    client: AsyncClient,
    test_device: tuple[Device, str],
    test_user_token: str,
) -> None:
    device, secret = test_device

    create_resp = await client.post(
        "/api/v1/approvals",
        json={
            "request_type": "bash_execution",
            "action_summary": "Approve test",
            "details": {},
            "idempotency_key": str(uuid.uuid4()),
            "ttl_seconds": 300,
        },
        headers=_device_auth_header(device, secret),
    )
    assert create_resp.status_code == 201
    request_id = create_resp.json()["id"]

    decide_resp = await client.post(
        f"/api/v1/approvals/{request_id}/decide",
        json={"decision": "APPROVE"},
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    assert decide_resp.status_code == 200

    # Status should be updated
    get_resp = await client.get(
        f"/api/v1/approvals/{request_id}",
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    assert get_resp.json()["status"] == "APPROVED"


@pytest.mark.asyncio
async def test_deny_request(
    client: AsyncClient,
    test_device: tuple[Device, str],
    test_user_token: str,
) -> None:
    device, secret = test_device

    create_resp = await client.post(
        "/api/v1/approvals",
        json={
            "request_type": "bash_execution",
            "action_summary": "Deny test",
            "details": {},
            "idempotency_key": str(uuid.uuid4()),
            "ttl_seconds": 300,
        },
        headers=_device_auth_header(device, secret),
    )
    request_id = create_resp.json()["id"]

    decide_resp = await client.post(
        f"/api/v1/approvals/{request_id}/decide",
        json={"decision": "DENY", "reason": "Not safe"},
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    assert decide_resp.status_code == 200


@pytest.mark.asyncio
async def test_expired_request_cannot_be_decided(
    client: AsyncClient,
    test_device: tuple[Device, str],
    test_user_token: str,
    db: AsyncSession,
) -> None:
    device, secret = test_device

    create_resp = await client.post(
        "/api/v1/approvals",
        json={
            "request_type": "bash_execution",
            "action_summary": "Expire test",
            "details": {},
            "idempotency_key": str(uuid.uuid4()),
            "ttl_seconds": 300,
        },
        headers=_device_auth_header(device, secret),
    )
    request_id = create_resp.json()["id"]

    # Manually expire the request
    import uuid as _uuid
    req = await db.get(ApprovalRequest, _uuid.UUID(request_id))
    req.expires_at = datetime.now(UTC) - timedelta(seconds=1)
    await db.flush()

    decide_resp = await client.post(
        f"/api/v1/approvals/{request_id}/decide",
        json={"decision": "APPROVE"},
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    assert decide_resp.status_code == 410  # Gone


@pytest.mark.asyncio
async def test_cannot_decide_others_request(
    client: AsyncClient,
    test_device: tuple[Device, str],
    db: AsyncSession,
) -> None:
    from deorch_api.services.auth import create_access_token, hash_password

    device, secret = test_device
    other_user = User(
        email=f"other2-{uuid.uuid4()}@example.com",
        hashed_password=hash_password("pass"),
        display_name="Other2",
    )
    db.add(other_user)
    await db.flush()
    other_token = create_access_token(other_user.id)

    create_resp = await client.post(
        "/api/v1/approvals",
        json={
            "request_type": "bash_execution",
            "action_summary": "IDOR test",
            "details": {},
            "idempotency_key": str(uuid.uuid4()),
            "ttl_seconds": 300,
        },
        headers=_device_auth_header(device, secret),
    )
    request_id = create_resp.json()["id"]

    decide_resp = await client.post(
        f"/api/v1/approvals/{request_id}/decide",
        json={"decision": "APPROVE"},
        headers={"Authorization": f"Bearer {other_token}"},
    )
    assert decide_resp.status_code == 404  # Not found from other user's perspective
