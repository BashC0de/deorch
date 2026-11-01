# DeOrch — Domain Model

## Entity Definitions

### User
The human developer who owns machines, projects, and sessions.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Stable identifier |
| email | string | Login credential, unique |
| hashed_password | string | bcrypt hash, never exposed |
| display_name | string | Shown in UI |
| is_active | bool | Soft-disable without delete |
| is_verified | bool | Email verification (future) |

**Invariants**:
- Email is immutable once set
- A User can only access their own Devices, Projects, Sessions, ApprovalRequests

---

### Device
A registered development machine.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | Stable identifier |
| user_id | UUID | Owner |
| name | string | Human label (e.g. "MacBook Pro") |
| hostname | string | Machine hostname |
| os_info | JSON | OS type, version |
| status | DeviceStatus | Current state |
| device_secret_hash | string | bcrypt hash of device_secret |
| last_seen_at | datetime? | Last WS heartbeat or event |
| paired_at | datetime? | When pairing completed |

**Status lifecycle**:
```
PENDING ──► PAIRED ──► ACTIVE
              │           │
              └─────►  REVOKED
```
- `PENDING`: registered but pairing not yet completed
- `PAIRED`: pairing completed, secret set, never connected
- `ACTIVE`: connected via WS (in-memory state, not persisted)
- `REVOKED`: permanently disabled, cannot authenticate

**Invariants**:
- A REVOKED device cannot authenticate, even with correct credentials
- device_secret is shown exactly once, at pairing completion
- device_secret_hash is computed immediately and the plaintext is discarded

---

### DevicePairing
A short-lived challenge used to complete device pairing.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | |
| device_id | UUID | Device being paired |
| challenge_hash | string | SHA-256 of the displayed challenge token |
| expires_at | datetime | 5 minutes from creation |
| completed_at | datetime? | When pairing completed |
| attempts | int | Brute-force protection |

**Invariants**:
- Max 5 attempts before pairing is locked
- A completed pairing cannot be re-used
- An expired pairing cannot be completed

---

### Project
A software project associated with a device and local path.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | |
| user_id | UUID | Owner |
| device_id | UUID? | Primary device |
| name | string | Human label |
| path | string? | Local filesystem path |
| git_remote | string? | Git remote URL |
| is_active | bool | |

---

### AgentProvider
A registered AI coding agent type.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | |
| slug | string | e.g. "claude-code", "codex" |
| display_name | string | e.g. "Claude Code" |
| capabilities | JSON | Array of capability strings |
| is_supported | bool | Actively supported |

**Seeded data**:
```json
[
  {"slug": "claude-code", "display_name": "Claude Code", "is_supported": true,
   "capabilities": ["pre_tool_approval", "post_tool_observe", "session_tracking", "notifications"]},
  {"slug": "codex", "display_name": "OpenAI Codex", "is_supported": false, "capabilities": []},
  {"slug": "cursor", "display_name": "Cursor", "is_supported": false, "capabilities": []},
  {"slug": "copilot", "display_name": "GitHub Copilot", "is_supported": false, "capabilities": []}
]
```

---

### AgentSession
A single run of an AI coding agent.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | |
| device_id | UUID | Machine where agent runs |
| project_id | UUID? | Associated project |
| provider_id | UUID | Which agent |
| external_session_id | string? | Agent's own session ID (e.g. Claude Code session_id from hooks) |
| status | SessionStatus | Current state |
| metadata | JSON | Agent-specific metadata |
| started_at | datetime? | |
| ended_at | datetime? | |

**Status lifecycle**:
```
INITIALIZING ──► ACTIVE ──► COMPLETED
                   │
                   └──────► ERROR
```

**Invariants**:
- Only one ACTIVE session per external_session_id
- A COMPLETED or ERROR session is immutable

---

### AgentEvent
An observable event from an agent session.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | |
| session_id | UUID | Parent session |
| event_type | string | e.g. "tool_use", "notification", "session_end" |
| payload | JSON | Event-specific data |
| sequence_number | int | Ordered within session |
| idempotency_key | string | `{session_id}:{event_type}:{sequence_number}` |

**Invariants**:
- idempotency_key is globally unique — duplicate submissions are rejected with 409
- Events within a session are ordered by sequence_number

---

### ApprovalRequest
A request from an agent for the developer to approve or deny an action.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | |
| session_id | UUID | The agent session |
| device_id | UUID | The device |
| project_id | UUID? | |
| request_type | string | e.g. "tool_use", "bash_execution" |
| action_summary | string | Short human-readable description (≤500 chars) |
| details | JSON | Full context (command, args, etc.) |
| working_directory | string? | |
| reason | string? | Why the agent wants to do this |
| risk_level | RiskLevel? | LOW / MEDIUM / HIGH / CRITICAL |
| status | ApprovalStatus | Current state |
| idempotency_key | string | From companion — prevents duplicate requests |
| expires_at | datetime | After this, auto-denied |

**Status lifecycle**:
```
PENDING ──► APPROVED
   │
   ├──────► DENIED
   │
   ├──────► EXPIRED  (background task sets this)
   │
   └──────► CANCELLED (companion withdraws request)
```

**Invariants**:
- Only PENDING requests can be decided
- A request past expires_at must be treated as EXPIRED regardless of stored status
- NEVER auto-approve — only PENDING → APPROVED via explicit user decision

---

### ApprovalDecision
The user's response to an approval request.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | |
| request_id | UUID | Unique (one decision per request) |
| user_id | UUID | Who decided |
| decision | string | APPROVE or DENY |
| reason | string? | Optional user note |
| decided_at | datetime | |
| delivered_at | datetime? | When companion received it |
| delivery_attempts | int | For retry tracking |

**Invariants**:
- One decision per request (FK unique constraint)
- user_id must be the owner of the device that submitted the request

---

### AuditRecord
Append-only event log entry.

| Field | Type | Description |
|-------|------|-------------|
| id | UUID | |
| user_id | UUID? | Actor (if user action) |
| device_id | UUID? | Actor (if device action) |
| session_id | UUID? | Related session |
| request_id | UUID? | Related approval request |
| event_type | string | Namespaced event type |
| actor_type | string | USER / DEVICE / SYSTEM |
| payload | JSON | Event details |
| ip_address | string? | Client IP at time of action |

**Invariants**:
- AuditRecords are never modified or deleted
- Every security-significant action produces an AuditRecord

## Aggregate Boundaries

- **User aggregate**: User, Device (listed), Project (listed)
- **Device aggregate**: Device, DevicePairing, AgentSession (listed)
- **Session aggregate**: AgentSession, AgentEvent (appended)
- **Approval aggregate**: ApprovalRequest, ApprovalDecision

Cross-aggregate references are by ID only.

## Tenant Isolation Rules

Every query involving Device, Project, AgentSession, ApprovalRequest, or AuditRecord MUST include a join or filter to the authenticated user's id. No row from another user's data may be returned. This is enforced at the service layer, not only at the router layer.
