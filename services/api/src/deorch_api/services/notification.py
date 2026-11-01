from __future__ import annotations

import structlog

log = structlog.get_logger(__name__)

# Import lazily to avoid circular imports at module load time
_manager = None


def get_manager() -> "ConnectionManager":  # type: ignore[name-defined]
    global _manager
    if _manager is None:
        from deorch_api.websocket.manager import ConnectionManager
        _manager = ConnectionManager()
    return _manager
