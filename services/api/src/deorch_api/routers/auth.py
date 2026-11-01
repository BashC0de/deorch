from __future__ import annotations

from datetime import UTC, datetime

import structlog
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from deorch_api.database import get_db
from deorch_api.models.audit import AuditRecord
from deorch_api.models.user import User
from deorch_api.schemas.user import TokenResponse, UserCreate, UserLogin, UserRead
from deorch_api.services.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from deorch_api.config import get_settings

router = APIRouter(prefix="/auth", tags=["auth"])
log = structlog.get_logger(__name__)
settings = get_settings()


def _audit(db: AsyncSession, event_type: str, actor_type: str, payload: dict, user_id=None, ip: str | None = None) -> None:
    record = AuditRecord(
        user_id=user_id,
        event_type=event_type,
        actor_type=actor_type,
        payload=payload,
        ip_address=ip,
        created_at=datetime.now(UTC),
    )
    db.add(record)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(body: UserCreate, request: Request, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    existing = await db.execute(select(User).where(User.email == body.email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        display_name=body.display_name,
    )
    db.add(user)
    try:
        await db.flush()
    except IntegrityError:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Email already registered")

    _audit(db, "user.registered", "SYSTEM", {"email_hash": str(hash(body.email))}, ip=request.client.host if request.client else None)

    access_token = create_access_token(user.id)
    refresh_token, _ = create_refresh_token(user.id)
    log.info("user_registered", user_id=str(user.id))
    return TokenResponse(
        access_token=access_token,
        expires_in=settings.jwt_access_token_expire_minutes * 60,
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: UserLogin, request: Request, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    ip = request.client.host if request.client else None

    if not user or not verify_password(body.password, user.hashed_password):
        _audit(db, "user.login_failed", "SYSTEM", {"email_hash": str(hash(body.email))}, ip=ip)
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account disabled")

    _audit(db, "user.login", "USER", {}, user_id=user.id, ip=ip)
    access_token = create_access_token(user.id)
    create_refresh_token(user.id)
    log.info("user_login", user_id=str(user.id))
    return TokenResponse(
        access_token=access_token,
        expires_in=settings.jwt_access_token_expire_minutes * 60,
    )


@router.post("/refresh", response_model=TokenResponse)
async def refresh(request: Request, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing refresh token")
    token = auth[7:]
    try:
        claims = decode_token(token)
        if claims.get("type") != "refresh":
            raise ValueError("Not a refresh token")
    except ValueError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    import uuid
    user = await db.get(User, uuid.UUID(claims["sub"]))
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found")

    new_access = create_access_token(user.id)
    return TokenResponse(
        access_token=new_access,
        expires_in=settings.jwt_access_token_expire_minutes * 60,
    )
