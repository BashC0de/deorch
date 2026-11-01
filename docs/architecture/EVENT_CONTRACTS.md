# Event Contracts

All DeOrch real-time communication uses a standard JSON envelope over WebSocket.

## Message Envelope

```json
{
  "type": "<message_type>",
  "id": "<uuid v4>",
  "timestamp": "<ISO 8601>",
  "payload": { ... }
}
```

## Authentication Messages

### auth_required
Sent by server on WebSocket connect. Client must respond with `auth_token`.

### auth_token
Client → Server. Dashboard sends `{ token: "<JWT>" }`. Companion sends `{ device_id, device_secret }`.

### auth_ok
Server → Client on successful auth. Contains `user_id` or `device_id`.

### auth_error
Server → Client on auth failure. Contains `{ reason: string }`. Connection closed with code 4001.

## Device Lifecycle Events

### device_registered
Server → Dashboard. Sent when a new device is registered via API.
```json
{ "device_id": "uuid", "device_name": "My Laptop" }
```

### device_connected
Server → Dashboard. Sent when a companion WebSocket authenticates.
```json
{ "device_id": "uuid", "device_name": "My Laptop" }
```

### device_disconnected
Server → Dashboard. Sent when a companion WebSocket disconnects.
```json
{ "device_id": "uuid" }
```

### device_heartbeat
Companion → Server (via ping/pong). Tracked via `last_seen_at` updates.
```json
{ "device_id": "uuid", "timestamp": "ISO 8601" }
```

## Approval Messages

### approval_request
Server → Dashboard. Sent when companion creates a new approval request.
```json
{
  "request_id": "uuid",
  "session_id": "uuid | null",
  "device_id": "uuid",
  "device_name": "My Laptop",
  "agent": "claude-code",
  "action_summary": "Execute rm -rf /tmp/test",
  "details": { "tool": "Bash", "input": { "command": "..." } },
  "working_directory": "/home/user/project",
  "reason": "Cleanup temporary files",
  "risk_level": "HIGH",
  "expires_at": "ISO 8601"
}
```

### approval_decision
Server → Companion. Sent after user approves/denies a request.
```json
{
  "request_id": "uuid",
  "decision": "approve | deny",
  "decided_by": "user@example.com",
  "decided_at": "ISO 8601",
  "reason": "optional reason"
}
```

### approval_response
Companion → Server. Acknowledgement that decision was received and delivered.
```json
{ "request_id": "uuid", "received": true }
```

## Session Messages

### session_started
Server → Dashboard. Sent when companion creates a new agent session.
```json
{ "session_id": "uuid", "device_id": "uuid", "agent": "claude-code" }
```

### session_ended
Server → Dashboard. Sent when a session transitions to COMPLETED or ERROR.
```json
{ "session_id": "uuid", "status": "COMPLETED | ERROR" }
```

## Agent Events

### agent_event
Companion → Server → Dashboard. Forwarded in real-time.
```json
{
  "session_id": "uuid",
  "event_type": "tool.pre_use | tool.post_use | session.ended | notification",
  "event_data": { ... },
  "sequence_number": 1234567890,
  "idempotency_key": "session:event_type:seq"
}
```

## Control Messages

### ping / pong
Heartbeat keepalive. Client sends `ping`, server responds with `pong { ping_id }`.
Timeout: 2x heartbeat interval (default 60s).

### error
Server → Client. Generic error notification.
```json
{ "code": "timeout | internal", "message": "description" }
```

## Event Processing Guarantees

- **Idempotency**: Agent events use `idempotency_key` (unique constraint). Duplicate keys return existing record.
- **Ordering**: Events ordered by `sequence_number` within a session.
- **Offline queue**: Companion queues events in local JSON file when disconnected. Flushed on reconnect (batch of 100).
- **Replay protection**: Decision message IDs tracked to prevent replay attacks.
- **Fail-closed**: Any validation failure in approval flow results in DENY.
