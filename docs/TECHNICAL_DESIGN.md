# DeOrch — Technical Design

## 1. Database Schema

### users
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK, default uuid4 |
| email | VARCHAR(255) | UNIQUE, NOT NULL, indexed |
| hashed_password | VARCHAR(255) | NOT NULL |
| display_name | VARCHAR(100) | NOT NULL |
| is_active | BOOLEAN | NOT NULL, default TRUE |
| is_verified | BOOLEAN | NOT NULL, default FALSE |
| created_at | TIMESTAMPTZ | NOT NULL, server default NOW() |
| updated_at | TIMESTAMPTZ | NOT NULL, server default NOW(), on update |

### devices
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK→users.id, NOT NULL, indexed |
| name | VARCHAR(100) | NOT NULL |
| hostname | VARCHAR(255) | |
| os_info | JSONB | |
| status | VARCHAR(20) | NOT NULL, default 'PENDING' |
| device_secret_hash | VARCHAR(255) | |
| last_seen_at | TIMESTAMPTZ | |
| paired_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | NOT NULL |
| updated_at | TIMESTAMPTZ | NOT NULL |

### device_pairings
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| device_id | UUID | FK→devices.id, NOT NULL |
| challenge_hash | VARCHAR(255) | NOT NULL |
| expires_at | TIMESTAMPTZ | NOT NULL |
| completed_at | TIMESTAMPTZ | |
| attempts | INTEGER | NOT NULL, default 0 |
| created_at | TIMESTAMPTZ | NOT NULL |

### projects
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK→users.id, NOT NULL |
| device_id | UUID | FK→devices.id |
| name | VARCHAR(200) | NOT NULL |
| path | VARCHAR(1000) | |
| git_remote | VARCHAR(500) | |
| is_active | BOOLEAN | NOT NULL, default TRUE |
| created_at | TIMESTAMPTZ | NOT NULL |
| updated_at | TIMESTAMPTZ | NOT NULL |

### agent_providers
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| slug | VARCHAR(50) | UNIQUE, NOT NULL |
| display_name | VARCHAR(100) | NOT NULL |
| capabilities | JSONB | NOT NULL, default '[]' |
| is_supported | BOOLEAN | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL |

### agent_sessions
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| device_id | UUID | FK→devices.id, NOT NULL, indexed |
| project_id | UUID | FK→projects.id |
| provider_id | UUID | FK→agent_providers.id, NOT NULL |
| external_session_id | VARCHAR(255) | indexed |
| status | VARCHAR(20) | NOT NULL, default 'INITIALIZING' |
| metadata | JSONB | NOT NULL, default '{}' |
| started_at | TIMESTAMPTZ | |
| ended_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | NOT NULL |
| updated_at | TIMESTAMPTZ | NOT NULL |

### agent_events
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| session_id | UUID | FK→agent_sessions.id, NOT NULL, indexed |
| event_type | VARCHAR(100) | NOT NULL |
| payload | JSONB | NOT NULL |
| sequence_number | INTEGER | NOT NULL |
| idempotency_key | VARCHAR(255) | UNIQUE, NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL, indexed |

### approval_requests
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| session_id | UUID | FK→agent_sessions.id, indexed |
| device_id | UUID | FK→devices.id, NOT NULL, indexed |
| project_id | UUID | FK→projects.id |
| request_type | VARCHAR(100) | NOT NULL |
| action_summary | VARCHAR(500) | NOT NULL |
| details | JSONB | NOT NULL |
| working_directory | VARCHAR(1000) | |
| reason | TEXT | |
| risk_level | VARCHAR(20) | |
| status | VARCHAR(20) | NOT NULL, default 'PENDING', indexed |
| idempotency_key | VARCHAR(255) | UNIQUE, NOT NULL |
| expires_at | TIMESTAMPTZ | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL, indexed |
| updated_at | TIMESTAMPTZ | NOT NULL |

### approval_decisions
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| request_id | UUID | FK→approval_requests.id, UNIQUE |
| user_id | UUID | FK→users.id, NOT NULL |
| decision | VARCHAR(10) | NOT NULL ('APPROVE' or 'DENY') |
| reason | TEXT | |
| decided_at | TIMESTAMPTZ | NOT NULL |
| delivered_at | TIMESTAMPTZ | |
| delivery_attempts | INTEGER | NOT NULL, default 0 |
| created_at | TIMESTAMPTZ | NOT NULL |

### audit_records
| Column | Type | Constraints |
|--------|------|-------------|
| id | UUID | PK |
| user_id | UUID | FK→users.id |
| device_id | UUID | FK→devices.id |
| session_id | UUID | FK→agent_sessions.id |
| request_id | UUID | FK→approval_requests.id |
| event_type | VARCHAR(100) | NOT NULL, indexed |
| actor_type | VARCHAR(20) | NOT NULL ('USER', 'DEVICE', 'SYSTEM') |
| payload | JSONB | NOT NULL |
| ip_address | VARCHAR(45) | |
| created_at | TIMESTAMPTZ | NOT NULL, indexed |

## 2. API Endpoint Inventory

### Authentication
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/v1/auth/register | None | Create user account |
| POST | /api/v1/auth/login | None | Login, get tokens |
| POST | /api/v1/auth/refresh | Refresh token | Exchange refresh → access token |
| POST | /api/v1/auth/logout | Access token | Invalidate refresh token |

### Devices
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/v1/devices | User JWT | Register new device |
| GET | /api/v1/devices | User JWT | List user's devices |
| GET | /api/v1/devices/{id} | User JWT | Get device detail |
| DELETE | /api/v1/devices/{id} | User JWT | Revoke device |
| GET | /api/v1/devices/{id}/sessions | User JWT | List sessions for device |

### Pairing
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/v1/pairing/challenge | User JWT | Generate pairing challenge |
| POST | /api/v1/pairing/complete | User JWT | Complete pairing with challenge token |

### Projects
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/v1/projects | User JWT | Create project |
| GET | /api/v1/projects | User JWT | List user's projects |
| GET | /api/v1/projects/{id} | User JWT | Get project |
| PATCH | /api/v1/projects/{id} | User JWT | Update project |
| DELETE | /api/v1/projects/{id} | User JWT | Delete project |

### Sessions
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/v1/sessions | Device creds | Create session (companion) |
| GET | /api/v1/sessions | User JWT | List sessions |
| GET | /api/v1/sessions/{id} | User JWT | Session detail |
| PATCH | /api/v1/sessions/{id} | Device creds | Update session status |
| GET | /api/v1/sessions/{id}/events | User JWT | Session event log |
| POST | /api/v1/sessions/{id}/events | Device creds | Ingest event |

### Approvals
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /api/v1/approvals | Device creds | Create approval request |
| GET | /api/v1/approvals | User JWT | List approval requests |
| GET | /api/v1/approvals/{id} | User JWT | Get request detail |
| POST | /api/v1/approvals/{id}/decide | User JWT | Submit decision |

### Audit
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /api/v1/audit | User JWT | Paginated audit log |

### System
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | /health | None | Health check |

## 3. WebSocket Message Schemas

All messages follow the envelope:
```json
{
  "type": "<message_type>",
  "id": "<uuid>",
  "timestamp": "<iso8601>",
  "payload": {}
}
```

### approval_request (server → dashboard + companion)
```json
{
  "type": "approval_request",
  "id": "msg-uuid",
  "timestamp": "2026-01-01T12:00:00Z",
  "payload": {
    "request_id": "req-uuid",
    "session_id": "sess-uuid",
    "device_id": "dev-uuid",
    "device_name": "macbook-pro",
    "agent": "claude-code",
    "action_summary": "Execute shell command",
    "details": { "command": "rm -rf ./build", "tool": "Bash" },
    "working_directory": "/home/user/project",
    "reason": "Cleaning build artifacts before rebuild",
    "risk_level": "HIGH",
    "expires_at": "2026-01-01T12:05:00Z"
  }
}
```

### approval_decision (server → companion)
```json
{
  "type": "approval_decision",
  "id": "msg-uuid",
  "timestamp": "2026-01-01T12:01:00Z",
  "payload": {
    "request_id": "req-uuid",
    "decision": "approve",
    "decided_by": "user@example.com",
    "decided_at": "2026-01-01T12:01:00Z"
  }
}
```

### agent_event (companion → server, server → dashboard)
```json
{
  "type": "agent_event",
  "id": "msg-uuid",
  "timestamp": "2026-01-01T12:00:30Z",
  "payload": {
    "session_id": "sess-uuid",
    "event_type": "tool_use",
    "event_data": { "tool": "Read", "path": "src/main.py" },
    "sequence_number": 42,
    "idempotency_key": "sess-uuid:tool_use:42"
  }
}
```

## 4. Authentication Flow

### User Auth
1. Register: POST /auth/register → hash password with bcrypt → create user → issue access + refresh tokens
2. Login: POST /auth/login → verify password → issue tokens
3. Access token: JWT, 30 min TTL, signed with JWT_SECRET_KEY
4. Refresh token: JWT, 30 day TTL, stored jti tracked in DB for revocation
5. Every request: decode access token, load user from DB, check is_active

### Device Auth
1. HTTP header: `Authorization: Bearer <device_id>:<device_secret>`
2. Decode: split on `:`, validate UUID, look up device
3. Verify: `bcrypt.verify(device_secret, device.device_secret_hash)`
4. Check status: must be PAIRED or ACTIVE
5. Update: `device.last_seen_at = now()`

## 5. Event Sourcing for Audit Trail

Every significant state change emits an AuditRecord:
- `user.registered`
- `user.login`
- `device.registered`
- `device.pairing_started`
- `device.pairing_completed`
- `device.revoked`
- `session.started`
- `session.ended`
- `approval_request.created`
- `approval_decision.approved`
- `approval_decision.denied`
- `approval_request.expired`

AuditRecords are append-only and never updated.

## 6. Local Companion Event Queue

SQLite table `queued_events`:
```sql
CREATE TABLE queued_events (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  payload TEXT NOT NULL,
  idempotency_key TEXT UNIQUE NOT NULL,
  created_at INTEGER NOT NULL,
  delivered INTEGER NOT NULL DEFAULT 0,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_attempt_at INTEGER
);
```

On send failure: increment attempts, update last_attempt_at.
On connect: flush all undelivered events in order of created_at.
On server ACK: mark delivered = 1.
Prune delivered events older than 7 days on startup.

## 7. Error Handling Strategy

- `400 Bad Request`: validation errors (Pydantic model_validate failures)
- `401 Unauthorized`: missing, invalid, or expired token
- `403 Forbidden`: valid token but insufficient permission (wrong user's resource)
- `404 Not Found`: resource doesn't exist
- `409 Conflict`: duplicate registration, duplicate idempotency key
- `410 Gone`: approval request expired
- `422 Unprocessable Entity`: structurally valid but semantically invalid request
- `500 Internal Server Error`: unexpected error (logged with full context, generic message to client)

All error responses: `{"detail": "<message>", "code": "<error_code>"}`
