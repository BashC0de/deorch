from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any


def _envelope(msg_type: str, payload: dict[str, Any]) -> dict[str, Any]:
    return {
        "type": msg_type,
        "id": str(uuid.uuid4()),
        "timestamp": datetime.now(UTC).isoformat(),
        "payload": payload,
    }


def auth_required() -> dict:
    return _envelope("auth_required", {})


def auth_ok(user_id: str | None = None, device_id: str | None = None) -> dict:
    payload: dict = {}
    if user_id:
        payload["user_id"] = user_id
    if device_id:
        payload["device_id"] = device_id
    return _envelope("auth_ok", payload)


def auth_error(reason: str) -> dict:
    return _envelope("auth_error", {"reason": reason})


def pong(ping_id: str) -> dict:
    return _envelope("pong", {"ping_id": ping_id})


def approval_request_msg(
    request_id: str,
    session_id: str | None,
    device_id: str,
    device_name: str,
    agent_slug: str,
    action_summary: str,
    details: dict,
    working_directory: str | None,
    reason: str | None,
    risk_level: str | None,
    expires_at: str,
    hook_event_name: str | None = None,
    tool_name: str | None = None,
) -> dict:
    return _envelope(
        "approval_request",
        {
            "request_id": request_id,
            "session_id": session_id,
            "device_id": device_id,
            "device_name": device_name,
            "agent": agent_slug,
            "hook_event_name": hook_event_name,
            "tool_name": tool_name,
            "action_summary": action_summary,
            "details": details,
            "working_directory": working_directory,
            "reason": reason,
            "risk_level": risk_level,
            "expires_at": expires_at,
        },
    )


def approval_decision_msg(
    request_id: str,
    decision: str,
    decided_by: str,
    decided_at: str,
    reason: str | None = None,
) -> dict:
    return _envelope(
        "approval_decision",
        {
            "request_id": request_id,
            "decision": decision,
            "decided_by": decided_by,
            "decided_at": decided_at,
            "reason": reason,
        },
    )


def device_registered_msg(device_id: str, device_name: str) -> dict:
    return _envelope("device_registered", {"device_id": device_id, "device_name": device_name})


def device_connected_msg(device_id: str, device_name: str) -> dict:
    return _envelope("device_connected", {"device_id": device_id, "device_name": device_name})


def device_disconnected_msg(device_id: str) -> dict:
    return _envelope("device_disconnected", {"device_id": device_id})


def session_started_msg(session_id: str, device_id: str, agent_slug: str) -> dict:
    return _envelope(
        "session_started",
        {"session_id": session_id, "device_id": device_id, "agent": agent_slug},
    )


def session_ended_msg(session_id: str, status: str) -> dict:
    return _envelope("session_ended", {"session_id": session_id, "status": status})


def error_msg(code: str, message: str) -> dict:
    return _envelope("error", {"code": code, "message": message})
