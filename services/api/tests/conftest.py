from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import AsyncGenerator

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from deorch_api.database import get_db
from deorch_api.main import app
from deorch_api.models.base import Base
from deorch_api.models.user import User
from deorch_api.models.device import Device
from deorch_api.services.auth import create_access_token, hash_password
from deorch_api.services.device import generate_device_secret

TEST_DATABASE_URL = "postgresql+asyncpg://deorch:deorch@localhost:5432/deorch_test"

_engine = create_async_engine(TEST_DATABASE_URL, echo=False)
_TestSession = async_sessionmaker(_engine, expire_on_commit=False)


@pytest_asyncio.fixture(scope="session", autouse=True)
async def setup_database():
    import deorch_api.models  # noqa: F401 — register all models
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with _engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db() -> AsyncGenerator[AsyncSession, None]:
    async with _TestSession() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(db: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    app.dependency_overrides[get_db] = lambda: db
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_user(db: AsyncSession) -> User:
    user = User(
        email=f"test-{uuid.uuid4()}@example.com",
        hashed_password=hash_password("testpassword123"),
        display_name="Test User",
    )
    db.add(user)
    await db.flush()
    return user


@pytest_asyncio.fixture
def test_user_token(test_user: User) -> str:
    return create_access_token(test_user.id)


@pytest_asyncio.fixture
async def test_device(db: AsyncSession, test_user: User) -> tuple[Device, str]:
    """Returns (device, device_secret)."""
    secret, secret_hash = generate_device_secret()
    device = Device(
        user_id=test_user.id,
        name="Test Machine",
        hostname="test-host",
        status="PAIRED",
        device_secret_hash=secret_hash,
        paired_at=datetime.now(UTC),
    )
    db.add(device)
    await db.flush()
    return device, secret
