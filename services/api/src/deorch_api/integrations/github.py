"""GitHub integration adapter.

Capabilities: repo_link, pr_context, branch_refs, commit_refs, webhook_events
Auth: Personal access token or OAuth app token
"""
from __future__ import annotations

INTEGRATION_DEFINITION = {
    "slug": "github",
    "name": "GitHub",
    "description": "Connect GitHub repositories for PR context, branch tracking, and webhook events",
    "category": "source_control",
    "provider": "github",
    "auth_type": "token",
    "capabilities": [
        "repo_link",
        "pr_context",
        "branch_refs",
        "commit_refs",
        "webhook_events",
        "status_checks",
    ],
    "required_permissions": [
        "read_repository",
        "read_pull_requests",
        "write_status_checks",
    ],
    "config_schema": {
        "type": "object",
        "properties": {
            "repository": {"type": "string", "description": "owner/repo format"},
            "default_branch": {"type": "string", "default": "main"},
        },
        "required": ["repository"],
    },
    "trust_status": "VERIFIED",
}

WEBHOOK_EVENTS = ["push", "pull_request", "check_run", "check_suite"]


def validate_webhook_signature(payload: bytes, signature: str, secret: str) -> bool:
    """Validate GitHub webhook HMAC-SHA256 signature."""
    import hashlib
    import hmac

    if not signature.startswith("sha256="):
        return False
    expected = hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()
    return hmac.compare_digest(f"sha256={expected}", signature)


def parse_push_event(payload: dict) -> dict:
    """Extract structured data from a GitHub push webhook event."""
    return {
        "ref": payload.get("ref", ""),
        "before": payload.get("before", ""),
        "after": payload.get("after", ""),
        "repository": payload.get("repository", {}).get("full_name", ""),
        "pusher": payload.get("pusher", {}).get("name", ""),
        "commits_count": len(payload.get("commits", [])),
        "head_commit_message": (payload.get("head_commit") or {}).get("message", ""),
    }


def parse_pr_event(payload: dict) -> dict:
    """Extract structured data from a GitHub pull_request webhook event."""
    pr = payload.get("pull_request", {})
    return {
        "action": payload.get("action", ""),
        "number": pr.get("number"),
        "title": pr.get("title", ""),
        "state": pr.get("state", ""),
        "author": (pr.get("user") or {}).get("login", ""),
        "base_branch": (pr.get("base") or {}).get("ref", ""),
        "head_branch": (pr.get("head") or {}).get("ref", ""),
        "repository": (payload.get("repository") or {}).get("full_name", ""),
    }
