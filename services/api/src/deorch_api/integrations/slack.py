"""Slack integration adapter.

Capabilities: notifications, approval_alerts, workflow_completion
Auth: Bot token (manual or OAuth)
"""
from __future__ import annotations

import json
import urllib.request
import urllib.error

import structlog

log = structlog.get_logger(__name__)

INTEGRATION_DEFINITION = {
    "slug": "slack",
    "name": "Slack",
    "description": "Send approval requests, workflow completions, and alerts to Slack channels",
    "category": "communication",
    "provider": "slack",
    "auth_type": "token",
    "capabilities": [
        "notifications",
        "approval_alerts",
        "workflow_completion",
        "failure_alerts",
    ],
    "required_permissions": [
        "send_messages",
        "post_to_channel",
    ],
    "config_schema": {
        "type": "object",
        "properties": {
            "channel": {"type": "string", "description": "Slack channel ID or name"},
            "notify_on": {
                "type": "array",
                "items": {"type": "string", "enum": ["approval_request", "workflow_completed", "workflow_failed", "device_disconnected"]},
                "default": ["approval_request", "workflow_failed"],
            },
        },
        "required": ["channel"],
    },
    "trust_status": "VERIFIED",
}

REQUEST_TIMEOUT_SECONDS = 10
MAX_MESSAGE_LENGTH = 3000


def send_slack_message_sync(
    bot_token: str,
    channel: str,
    text: str,
    blocks: list[dict] | None = None,
) -> bool:
    """Send a message to a Slack channel. Returns True on success."""
    if not bot_token or not channel:
        log.warning("slack_missing_config", has_token=bool(bot_token), has_channel=bool(channel))
        return False

    text = text[:MAX_MESSAGE_LENGTH]

    payload: dict = {"channel": channel, "text": text}
    if blocks:
        payload["blocks"] = blocks

    try:
        data = json.dumps(payload).encode()
        req = urllib.request.Request(
            "https://slack.com/api/chat.postMessage",
            data=data,
            headers={
                "Authorization": f"Bearer {bot_token}",
                "Content-Type": "application/json; charset=utf-8",
            },
        )
        with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_SECONDS) as resp:
            result = json.loads(resp.read().decode())
            if not result.get("ok"):
                log.warning("slack_api_error", error=result.get("error", "unknown"))
                return False
            return True
    except urllib.error.URLError as e:
        log.error("slack_send_failed", error=str(e))
        return False
    except Exception as e:
        log.error("slack_send_error", error=type(e).__name__)
        return False


def send_approval_alert(
    bot_token: str,
    channel: str,
    action_summary: str,
    risk_level: str | None,
    approval_url: str,
) -> bool:
    """Send an approval request notification to Slack."""
    safe_summary = action_summary[:200]
    risk_display = risk_level or "Unknown"

    text = f"Approval Required: {safe_summary}"
    blocks = [
        {"type": "section", "text": {"type": "mrkdwn", "text": f"*Approval Required*\n{safe_summary}"}},
        {"type": "section", "fields": [
            {"type": "mrkdwn", "text": f"*Risk:* {risk_display}"},
        ]},
        {"type": "actions", "elements": [
            {"type": "button", "text": {"type": "plain_text", "text": "Review in DeOrch"}, "url": approval_url},
        ]},
    ]
    return send_slack_message_sync(bot_token, channel, text, blocks)
