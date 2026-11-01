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
    device_connections: local companion connections (multiple providers per device)
    """

    def __init__(self) -> None:
        self._user_connections: dict[str, set[WebSocket]] = defaultdict(set)
        # device_id → provider_slug → WebSocket
        self._device_connections: dict[str, dict[str, WebSocket]] = defaultdict(dict)
        self._lock = asyncio.Lock()

    async def connect_user(self, ws: WebSocket, user_id: str) -> None:
        async with self._lock:
            self._user_connections[user_id].add(ws)
        log.info("ws_user_connected", user_id=user_id)

    async def connect_device(self, ws: WebSocket, device_id: str, provider_slug: str = "default") -> None:
        async with self._lock:
            self._device_connections[device_id][provider_slug] = ws
        log.info("ws_device_connected", device_id=device_id, provider=provider_slug)

    async def disconnect_user(self, ws: WebSocket, user_id: str) -> None:
        async with self._lock:
            self._user_connections[user_id].discard(ws)
            if not self._user_connections[user_id]:
                del self._user_connections[user_id]
        log.info("ws_user_disconnected", user_id=user_id)

    async def disconnect_device(self, ws: WebSocket, device_id: str, provider_slug: str = "default") -> None:
        async with self._lock:
            providers = self._device_connections.get(device_id, {})
            if provider_slug in providers and providers[provider_slug] is ws:
                del providers[provider_slug]
            if not providers:
                self._device_connections.pop(device_id, None)
        log.info("ws_device_disconnected", device_id=device_id, provider=provider_slug)

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
        """Send to all companion connections for this device. Returns True if any delivered."""
        payload = json.dumps(message)
        delivered = False
        async with self._lock:
            providers = dict(self._device_connections.get(device_id, {}))
        for ws in providers.values():
            try:
                await ws.send_text(payload)
                delivered = True
            except Exception:
                log.warning("ws_device_send_failed", device_id=device_id)
        return delivered

    async def send_to_device_provider(self, device_id: str, provider_slug: str, message: dict) -> bool:
        """Send to a specific provider's companion connection. Returns True if delivered."""
        payload = json.dumps(message)
        async with self._lock:
            ws = self._device_connections.get(device_id, {}).get(provider_slug)
        if ws is None:
            return False
        try:
            await ws.send_text(payload)
            return True
        except Exception:
            log.warning("ws_device_provider_send_failed", device_id=device_id, provider=provider_slug)
            return False

    def is_device_connected(self, device_id: str) -> bool:
        return bool(self._device_connections.get(device_id))

    def get_connected_device_ids(self) -> list[str]:
        return list(self._device_connections.keys())

    def get_connected_user_ids(self) -> list[str]:
        return list(self._user_connections.keys())


# Module-level singleton — imported by routers and services
connection_manager = ConnectionManager()
