# Claude Code Integration

DeOrch integrates with Claude Code through its official hooks system, intercepting permission-sensitive operations and routing them through a remote approval workflow.

## How It Works

```
Claude Code → HTTP Hook → DeOrch Companion → Backend → Dashboard
                                              ↓
                                        User Approves/Denies
                                              ↓
Claude Code ← HTTP Response ← Companion ← Backend ← Decision
```

1. Claude Code triggers a hook event (e.g., `PreToolUse` for a `rm -rf` command)
2. The hook sends an HTTP POST to the companion's hooks server (`127.0.0.1:8765`)
3. Companion evaluates risk: safe commands pass through, destructive commands require approval
4. For risky commands, companion creates an approval request in the backend
5. Dashboard notifies the developer via WebSocket + browser notification
6. Developer approves or denies on their phone/browser
7. Decision flows back through WebSocket to the companion
8. Companion returns the hook response to Claude Code:
   - `permissionDecision: "allow"` → Claude Code proceeds
   - `permissionDecision: "deny"` → Claude Code blocks the operation

## Installation

```bash
# 1. Install and pair (if not done already)
deorch login
deorch pair --name "My Laptop"

# 2. Install hooks into Claude Code
deorch setup

# 3. Start the companion
deorch start
```

`deorch setup` writes hook configuration to `~/.claude/settings.json`. It registers handlers for:
- `PreToolUse` — intercepts tool calls, routes destructive ones for approval (300s timeout)
- `PostToolUse` — observes completed tool calls
- `PostToolUseFailure` — observes failed tool calls
- `SessionStart` — registers new agent sessions
- `Stop` — tracks session completion
- `Notification` — captures agent notifications

## Removal

```bash
deorch uninstall
```

This removes DeOrch hook entries from `~/.claude/settings.json`.

## Supported Capabilities

| Capability | Status |
|-----------|--------|
| observe_sessions | Supported |
| observe_tool_activity | Supported |
| intercept_permission_requests | Supported |
| resolve_permission_requests | Supported |
| observe_session_completion | Supported |
| observe_errors | Supported |
| send_follow_up_message | Not supported (no reliable API) |
| stop_session | Not supported (no reliable API) |

## Hook Response Format

DeOrch uses the modern `hookSpecificOutput` format:

```json
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "allow|deny|ask|defer",
    "permissionDecisionReason": "Reason for denial (when deny)"
  }
}
```

Precedence: `deny > defer > ask > allow` (when multiple hooks exist).

## Risk Classification

Commands that trigger remote approval:

| Pattern | Risk Level |
|---------|-----------|
| `rm -rf /` | CRITICAL |
| `dd if=` | CRITICAL |
| `rm -rf <path>` | HIGH |
| `git push --force` | HIGH |
| `git reset --hard` | MEDIUM |
| `DROP TABLE` | MEDIUM |
| `kill` / `killall` | MEDIUM |
| `chmod -R` / `chown -R` | MEDIUM |

Safe commands (ls, cat, git status, npm install, etc.) pass through without approval.

## Troubleshooting

**Hooks not triggering:**
- Verify hooks are installed: `cat ~/.claude/settings.json | grep deorch`
- Ensure companion is running: `deorch status`
- Check hooks server health: `curl http://127.0.0.1:8765/hooks/health`

**Approval times out:**
- Default TTL is 300 seconds (5 minutes)
- Ensure dashboard WebSocket is connected (check connection indicator)
- Check if the request reached the backend: look in the Approvals page

**Decision not reaching Claude Code:**
- Backend retries undelivered decisions every 30 seconds
- Companion must be connected via WebSocket to receive decisions
- Check companion logs for `approval_decision_received`
