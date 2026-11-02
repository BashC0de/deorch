from __future__ import annotations

import asyncio
import json

import structlog
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from deorch_api.config import get_settings
from deorch_api.database import AsyncSessionFactory
from deorch_api.models.device import Device
from deorch_api.models.user import User
from deorch_api.services.auth import decode_token
from deorch_api.services.device import parse_device_credentials, verify_device_secret
from deorch_api.websocket.manager import connection_manager
from deorch_api.websocket.messages import (
    auth_error,
    auth_ok,
    auth_required,
    device_connected_msg,
    device_disconnected_msg,
    error_msg,
    pong,
)

router = APIRouter()
log = structlog.get_logger(__name__)
settings = get_settings()


@router.websocket("/ws/dashboard")
async def dashboard_ws(ws: WebSocket) -> None:
    await ws.accept()
    user_id: str | None = None
    try:
        # Step 1: request auth
        await ws.send_json(auth_required())

        # Step 2: wait for auth_token message (with timeout)
        try:
            raw = await asyncio.wait_for(ws.receive_text(), timeout=30.0)
        except asyncio.TimeoutError:
            await ws.send_json(auth_error("Authentication timeout"))
            await ws.close(code=4001)
            return

        msg = json.loads(raw)
        if msg.get("type") != "auth_token" or "payload" not in msg:
            await ws.send_json(auth_error("Expected auth_token message"))
            await ws.close(code=4001)
            return

        token = msg["payload"].get("token", "")

        # Step 3: validate JWT
        async with AsyncSessionFactory() as db:
            try:
                claims = decode_token(token)
                if claims.get("type") != "access":
                    raise ValueError("Not an access token")
                user_id_str = claims["sub"]
                user = await db.get(User, user_id_str)
                if not user or not user.is_active:
                    raise ValueError("User not found or inactive")
                user_id = str(user.id)
            except (ValueError, KeyError) as e:
                await ws.send_json(auth_error(str(e)))
                await ws.close(code=4001)
                return

        await connection_manager.connect_user(ws, user_id)
        await ws.send_json(auth_ok(user_id=user_id))
        log.info("ws_dashboard_authenticated", user_id=user_id)

        # Step 4: message loop
        while True:
            try:
                raw = await asyncio.wait_for(
                    ws.receive_text(),
                    timeout=float(settings.ws_heartbeat_interval_seconds) * 2,
                )
            except asyncio.TimeoutError:
                await ws.send_json(error_msg("timeout", "No message received, closing"))
                break

            msg = json.loads(raw)
            msg_type = msg.get("type")

            if msg_type == "ping":
                await ws.send_json(pong(msg.get("id", "")))
            # Other client→server message types can be handled here

    except WebSocketDisconnect:
        pass
    except Exception:
        log.exception("ws_dashboard_error", user_id=user_id)
    finally:
        if user_id:
            await connection_manager.disconnect_user(ws, user_id)


@router.websocket("/ws/companion")
async def companion_ws(ws: WebSocket) -> None:
    await ws.accept()
    device_id: str | None = None
    try:
        # Step 1: request auth
        await ws.send_json(auth_required())

        # Step 2: wait for device credentials
        try:
            raw = await asyncio.wait_for(ws.receive_text(), timeout=30.0)
        except asyncio.TimeoutError:
            await ws.send_json(auth_error("Authentication timeout"))
            await ws.close(code=4001)
            return

        msg = json.loads(raw)
        if msg.get("type") != "auth_token" or "payload" not in msg:
            await ws.send_json(auth_error("Expected auth_token message"))
            await ws.close(code=4001)
            return

        payload = msg["payload"]
        raw_device_id = payload.get("device_id", "")
        raw_secret = payload.get("device_secret", "")
        provider_slug = payload.get("provider_slug", "default")

        async with AsyncSessionFactory() as db:
            try:
                import uuid as _uuid
                dev_uuid = _uuid.UUID(raw_device_id)
                device = await db.get(Device, dev_uuid)
                if not device:
                    raise ValueError("Device not found")
                if device.status == "REVOKED":
                    raise ValueError("Device is revoked")
                if device.status == "PENDING":
                    raise ValueError("Device not yet paired")
                if not device.device_secret_hash:
                    raise ValueError("Device has no secret hash")
                if not verify_device_secret(raw_secret, device.device_secret_hash):
                    raise ValueError("Invalid device secret")

                device_id = str(device.id)
                device_name = device.name
                user_id = str(device.user_id)

                # Update last_seen_at and set status to ACTIVE
                from datetime import UTC, datetime
                await db.execute(
                    update(Device)
                    .where(Device.id == device.id)
                    .values(last_seen_at=datetime.now(UTC), status="ACTIVE")
                )
                await db.commit()

            except (ValueError, Exception) as e:
                await ws.send_json(auth_error(str(e)))
                await ws.close(code=4001)
                return

        await connection_manager.connect_device(ws, device_id, provider_slug)
        await ws.send_json(auth_ok(device_id=device_id))

        # Notify user's dashboard that device connected
        await connection_manager.send_to_user(
            user_id, device_connected_msg(device_id, device_name)
        )
        log.info("ws_companion_authenticated", device_id=device_id)

        # Step 3: message loop
        while True:
            try:
                raw = await asyncio.wait_for(
                    ws.receive_text(),
                    timeout=float(settings.ws_heartbeat_interval_seconds) * 2,
                )
            except asyncio.TimeoutError:
                await ws.send_json(error_msg("timeout", "No heartbeat received, closing"))
                break

            msg = json.loads(raw)
            msg_type = msg.get("type")

            if msg_type == "ping":
                await ws.send_json(pong(msg.get("id", "")))
            elif msg_type == "approval_response":
                # Companion confirms it received and delivered a decision
                log.info(
                    "approval_response_received",
                    device_id=device_id,
                    request_id=msg.get("payload", {}).get("request_id"),
                )
            elif msg_type == "agent_event":
                # Forward event to user's dashboard
                await connection_manager.send_to_user(user_id, msg)

    except WebSocketDisconnect:
        pass
    except Exception:
        log.exception("ws_companion_error", device_id=device_id)
    finally:
        if device_id:
            await connection_manager.disconnect_device(ws, device_id, provider_slug)
            if user_id:  # Guard against undefined user_id if auth failed early
                await connection_manager.send_to_user(
                    user_id, device_disconnected_msg(device_id)
                )
            # Revert device status and cancel pending approvals
            try:
                from datetime import UTC, datetime
                from deorch_api.models.approval import ApprovalRequest
                from deorch_api.models.audit import AuditRecord

                async with AsyncSessionFactory() as db:
                    await db.execute(
                        update(Device)
                        .where(Device.id == device_id)
                        .where(Device.status == "ACTIVE")
                        .values(status="PAIRED", last_seen_at=datetime.now(UTC))
                    )

                    # Cancel all PENDING approval requests for this device
                    result = await db.execute(
                        select(ApprovalRequest)
                        .where(ApprovalRequest.device_id == device_id)
                        .where(ApprovalRequest.status == "PENDING")
                    )
                    pending = result.scalars().all()
                    for req in pending:
                        req.status = "CANCELLED"
                        db.add(AuditRecord(
                            device_id=device_id,
                            request_id=str(req.id),
                            event_type="approval_request.cancelled",
                            actor_type="SYSTEM",
                            payload={"reason": "device_disconnected"},
                            created_at=datetime.now(UTC),
                        ))
                    if pending:
                        log.info("pending_approvals_cancelled", device_id=device_id, count=len(pending))

                    await db.commit()
            except Exception:
                log.exception("failed_to_revert_device_status", device_id=device_id)


