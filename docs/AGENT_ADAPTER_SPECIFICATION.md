# DeOrch — Agent Adapter Specification

## 1. Adapter Interface Contract

Every agent adapter must implement this TypeScript interface:

```typescript
export interface AgentAdapter {
  /** Unique identifier matching AgentProvider.slug */
  readonly slug: string;

  /** Human-readable name */
  readonly displayName: string;

  /** Declared capabilities of this adapter */
  readonly capabilities: AdapterCapability[];

  /**
   * Initialize the adapter. Called once when the companion starts.
   * Should register hooks, start listeners, etc.
   */
  initialize(context: AdapterContext): Promise<void>;

  /**
   * Called when the companion is shutting down.
   * Should deregister hooks and release resources.
   */
  shutdown(): Promise<void>;

  /**
   * Called when a pending approval decision arrives from the backend.
   * The adapter must deliver it to the agent and confirm delivery.
   */
  deliverDecision(
    sessionId: string,
    requestId: string,
    decision: ApprovalDecision
  ): Promise<DeliveryResult>;
}

export type AdapterCapability =
  | 'pre_tool_approval'    // Can intercept tool calls and approve/deny
  | 'post_tool_observe'    // Can observe completed tool calls
  | 'session_tracking'     // Can detect session start/end
  | 'notifications'        // Receives informational messages from agent
  | 'agent_messaging';     // Can send messages to the agent

export interface AdapterContext {
  /** Emit an event to the backend (queued if offline) */
  emitEvent(event: AdapterEvent): Promise<void>;

  /** Create an approval request and wait for a decision */
  requestApproval(request: ApprovalRequest): Promise<ApprovalDecision>;

  /** Current device ID */
  deviceId: string;

  /** Logger */
  logger: Logger;
}
```

## 2. Event Types

All adapters emit events via `context.emitEvent()`:

```typescript
export interface AdapterEvent {
  sessionId: string;
  eventType: AdapterEventType;
  payload: Record<string, unknown>;
  sequenceNumber: number;
  idempotencyKey: string;   // Must be globally unique per event
}

export type AdapterEventType =
  | 'session.started'
  | 'session.ended'
  | 'session.error'
  | 'tool.pre_use'
  | 'tool.post_use'
  | 'notification'
  | 'approval.requested'
  | 'approval.decided';
```

## 3. Claude Code Adapter

### Hook Registration

Claude Code supports hooks registered in `~/.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -X POST http://localhost:8765/hooks/pre-tool-use -H 'Content-Type: application/json' -d @-"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -X POST http://localhost:8765/hooks/post-tool-use -H 'Content-Type: application/json' -d @-"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -X POST http://localhost:8765/hooks/stop -H 'Content-Type: application/json' -d @-"
          }
        ]
      }
    ],
    "Notification": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -X POST http://localhost:8765/hooks/notification -H 'Content-Type: application/json' -d @-"
          }
        ]
      }
    ]
  }
}
```

The hooks port (default: 8765) is the companion's local HTTP server. No external exposure needed.

### PreToolUse Hook

Payload received from Claude Code:
```json
{
  "session_id": "abc123",
  "hook_event_name": "PreToolUse",
  "tool_name": "Bash",
  "tool_input": { "command": "rm -rf ./node_modules" },
  "transcript_path": "/tmp/claude_transcript_abc123.json"
}
```

Response written to stdout (Claude Code reads it):
```json
{
  "continue": true,
  "stopReason": null
}
```
Or to block:
```json
{
  "continue": false,
  "stopReason": "Action denied by remote approval: user rejected shell command execution"
}
```

### Approval Decision Mapping

| Claude Code hook | Action |
|-----------------|--------|
| `Bash` tool | Always request approval if command contains destructive patterns |
| `Write` tool | Request approval if writing outside project directory |
| `Edit` / `MultiEdit` | Observe (PostToolUse), no pre-approval by default |
| `WebFetch` | Observe only |
| `Read` | Observe only |

Destructive patterns requiring approval:
- `rm -rf`, `rmdir`, `rm -r`
- `git reset --hard`, `git clean -f`, `git push --force`
- `DROP TABLE`, `DELETE FROM` (without WHERE)
- `chmod -R`, `chown -R`
- `kill`, `killall`, `pkill`
- Network calls to non-localhost hosts (configurable)

### Session Detection

Sessions are detected when the first PreToolUse hook arrives with a new `session_id`. The adapter:
1. Checks if session_id is already registered locally
2. If new: calls backend `POST /api/v1/sessions` with provider="claude-code" and external_session_id
3. Emits `session.started` event

### Session End Detection

On `Stop` hook: emit `session.ended`, mark session COMPLETED in backend.

### Idempotency Keys

`{session_id}:pre_tool_use:{tool_name}:{sequence}` for approval requests
`{session_id}:{event_type}:{sequence}` for events

Sequence numbers increment per session and are tracked in memory (with SQLite persistence for restarts).

## 4. Future Adapter Stubs

### Codex Adapter (not yet implemented)
```typescript
export class CodexAdapter implements AgentAdapter {
  slug = 'codex';
  displayName = 'OpenAI Codex';
  capabilities = [];  // Unknown until integration research

  async initialize(): Promise<void> {
    throw new Error('Codex adapter not yet implemented');
  }
}
```

### Cursor Adapter, Copilot Adapter, ACP Adapter
Same stub pattern — slug, displayName, empty capabilities, unimplemented initialize().

Each adapter must only advertise capabilities it actually implements.

## 5. Adapter Registry

```typescript
export class AdapterRegistry {
  private adapters: Map<string, AgentAdapter> = new Map();

  register(adapter: AgentAdapter): void {
    this.adapters.set(adapter.slug, adapter);
  }

  get(slug: string): AgentAdapter | undefined {
    return this.adapters.get(slug);
  }

  getSupportedAdapters(): AgentAdapter[] {
    return [...this.adapters.values()].filter(
      a => a.capabilities.length > 0
    );
  }
}
```

## 6. Error Behavior

| Scenario | Behavior |
|----------|----------|
| Backend unreachable when PreToolUse arrives | Queue event, default to DENY (fail-closed) |
| Approval request times out (user doesn't respond) | Return DENY to Claude Code |
| Companion crashes mid-session | On restart, incomplete sessions marked ERROR |
| Hook server port already in use | Log error with clear message, exit with code 1 |
| Claude Code sends unknown hook type | Log warning, respond with `{"continue": true}` (safe default for unknown hooks) |
