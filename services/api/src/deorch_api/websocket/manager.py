from __future__ import annotations

import asyncio
import json
from collections import defaultdict

import structlog
from fastapi import WebSocket

log = structlog.get_logger(__name__)


class ConnectionManager:
    """
    Tracks all active WebSocket connections.

    user_connections: browser dashboard sessions (multiple per user)
    device_connections: local companion connections (one per device)
    """

    def __init__(self) -> None:
        self._user_connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._device_connections: dict[str, WebSocket] = {}
        self._lock = asyncio.Lock()

    async def connect_user(self, ws: WebSocket, user_id: str) -> None:
        async with self._lock:
            self._user_connections[user_id].add(ws)
        log.info("ws_user_connected", user_id=user_id)

    async def connect_device(self, ws: WebSocket, device_id: str) -> None:
        async with self._lock:
            self._device_connections[device_id] = ws
        log.info("ws_device_connected", device_id=device_id)

    async def disconnect_user(self, ws: WebSocket, user_id: str) -> None:
        async with self._lock:
            self._user_connections[user_id].discard(ws)
            if not self._user_connections[user_id]:
                del self._user_connections[user_id]
        log.info("ws_user_disconnected", user_id=user_id)

    async def disconnect_device(self, ws: WebSocket, device_id: str) -> None:
        async with self._lock:
            self._device_connections.pop(device_id, None)
        log.info("ws_device_disconnected", device_id=device_id)

    async def send_to_user(self, user_id: str, message: dict) -> int:
        """Send to all browser connections for this user. Returns delivery count."""
        payload = json.dumps(message)
        delivered = 0
        connections = set()
        async with self._lock:
            connections = set(self._user_connections.get(user_id, set()))
        for ws in connections:
            try:
                await ws.send_text(payload)
                delivered += 1
            except Exception:
                log.warning("ws_user_send_failed", user_id=user_id)
        return delivered

    async def send_to_device(self, device_id: str, message: dict) -> bool:
        """Send to companion connection. Returns True if delivered."""
        payload = json.dumps(message)
        async with self._lock:
            ws = self._device_connections.get(device_id)
        if ws is None:
            return False
        try:
            await ws.send_text(payload)
            return True
        except Exception:
            log.warning("ws_device_send_failed", device_id=device_id)
            return False

    def is_device_connected(self, device_id: str) -> bool:
        return device_id in self._device_connections

    def get_connected_device_ids(self) -> list[str]:
        return list(self._device_connections.keys())

    def get_connected_user_ids(self) -> list[str]:
        return list(self._user_connections.keys())


# Module-level singleton — imported by routers and services
connection_manager = ConnectionManager()
