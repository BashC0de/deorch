from __future__ import annotations

import pytest
from httpx import AsyncClient

from deorch_api.models.user import User


@pytest.mark.asyncio
async def test_register_user(client: AsyncClient) -> None:
    resp = await client.post("/api/v1/auth/register", json={
        "email": "newuser@example.com",
        "password": "securepassword",
        "display_name": "New User",
    })
    assert resp.status_code == 201
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_register_duplicate_email(client: AsyncClient) -> None:
    payload = {"email": "dup@example.com", "password": "password123", "display_name": "Dup"}
    resp1 = await client.post("/api/v1/auth/register", json=payload)
    assert resp1.status_code == 201
    resp2 = await client.post("/api/v1/auth/register", json=payload)
    assert resp2.status_code == 409


@pytest.mark.asyncio
async def test_login_success(client: AsyncClient, test_user: User) -> None:
    resp = await client.post("/api/v1/auth/login", json={
        "email": test_user.email,
        "password": "testpassword123",
    })
    assert resp.status_code == 200
    assert "access_token" in resp.json()


@pytest.mark.asyncio
async def test_login_wrong_password(client: AsyncClient, test_user: User) -> None:
    resp = await client.post("/api/v1/auth/login", json={
        "email": test_user.email,
        "password": "wrongpassword",
    })
    assert resp.status_code == 401


@pytest.mark.asyncio
async def test_access_protected_route(client: AsyncClient, test_user_token: str) -> None:
    resp = await client.get(
        "/api/v1/devices",
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    assert resp.status_code == 200


@pytest.mark.asyncio
async def test_access_without_token(client: AsyncClient) -> None:
    resp = await client.get("/api/v1/devices")
    assert resp.status_code == 403  # HTTPBearer returns 403 when no credentials


@pytest.mark.asyncio
async def test_access_invalid_token(client: AsyncClient) -> None:
    resp = await client.get(
        "/api/v1/devices",
        headers={"Authorization": "Bearer invalid.token.here"},
    )
    assert resp.status_code == 401
