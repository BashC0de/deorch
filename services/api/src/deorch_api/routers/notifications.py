from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from deorch_api.database import get_db
from deorch_api.dependencies import get_current_user
from deorch_api.models.notification import PushSubscription
from deorch_api.models.user import User

router = APIRouter(prefix="/notifications", tags=["notifications"])


class PushSubscribeRequest(BaseModel):
    endpoint: str
    keys: dict  # { p256dh: str, auth: str }


@router.post("/subscribe", status_code=status.HTTP_201_CREATED)
async def subscribe_push(
    body: PushSubscribeRequest,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    p256dh = body.keys.get("p256dh", "")
    auth = body.keys.get("auth", "")

    if not body.endpoint or not p256dh or not auth:
        raise HTTPException(status_code=400, detail="Missing subscription fields")

    # Upsert: remove old subscription for this endpoint, add new
    await db.execute(
        delete(PushSubscription).where(PushSubscription.endpoint == body.endpoint)
    )
    sub = PushSubscription(
        user_id=user.id,
        endpoint=body.endpoint,
        p256dh=p256dh,
        auth=auth,
    )
    db.add(sub)
    return {"message": "Push subscription registered"}


@router.delete("/subscribe", status_code=status.HTTP_200_OK)
async def unsubscribe_push(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    await db.execute(
        delete(PushSubscription).where(PushSubscription.user_id == user.id)
    )
    return {"message": "Push subscriptions removed"}
