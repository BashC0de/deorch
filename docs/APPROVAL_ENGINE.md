# Approval Engine

The approval engine manages the lifecycle of permission requests from coding agents through to developer decisions and enforcement.

## Approval Lifecycle

```
PENDING → APPROVED → (delivered to agent)
PENDING → DENIED   → (delivered to agent)
PENDING → EXPIRED  → (TTL elapsed, auto-denied)
PENDING → CANCELLED → (device disconnected or session terminated)
```

### State Transitions

| From | To | Trigger |
|------|----|---------|
| PENDING | APPROVED | User approves via dashboard |
| PENDING | DENIED | User denies via dashboard |
| PENDING | EXPIRED | TTL elapses without decision (background task, every 30s) |
| PENDING | CANCELLED | Device disconnects while request pending |

Once a request leaves PENDING, it cannot be re-decided. The unique constraint on `ApprovalDecision.request_id` enforces exactly-one-decision.

## Request Fields

| Field | Description |
|-------|-------------|
| `request_type` | Category: `tool_use` |
| `hook_event_name` | Claude Code event: `PreToolUse` |
| `tool_name` | Tool being invoked: `Bash`, `Edit`, `Write` |
| `action_category` | `shell_command`, `file_write`, `file_edit`, `tool_use` |
| `action_summary` | Human-readable: "Execute Bash: rm -rf ./dist" |
| `details` | Full tool input (redacted secrets) |
| `risk_level` | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `working_directory` | Agent's current working directory |
| `idempotency_key` | Prevents duplicate requests |
| `expires_at` | TTL deadline (default 300s, max 3600s) |

## Decision Delivery

1. When user decides, backend pushes `approval_decision` via WebSocket to companion
2. If device is offline, decision is retried every 30 seconds (up to 10 attempts)
3. Companion validates the decision (request_id match, not expired, not replayed)
4. On validation failure: fail-closed (DENY)

### Replay Protection

- Companion tracks `seenDecisionIds` (last 1000 message IDs)
- Duplicate decision messages are ignored
- Cross-session injection prevented by request_id → session_id binding

## Security Controls

- Device identity validated on every approval request (Bearer token auth)
- User ownership verified on every decision (JWT + device→user FK)
- Idempotency keys prevent duplicate requests
- Expired requests auto-rejected (background task)
- Disconnected devices cause immediate cancellation of pending requests
- Secrets redacted from tool inputs before transmission
- Fail-closed on all error paths
- Audit trail for every state transition

## Timeout Behavior

- Hook timeout: 300 seconds (configurable in hooks config)
- Approval TTL: 300 seconds (configurable per-request, max 3600)
- If both elapse, the hook returns `permissionDecision: "deny"` and the tool is blocked
- The companion never blocks indefinitely
