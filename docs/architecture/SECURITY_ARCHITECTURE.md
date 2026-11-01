# DeOrch — Security Architecture

## 1. Threat Model

### Assets
- Developer credentials (email + password)
- Device pairing secrets
- Agent approval decisions (can trigger real shell commands)
- Code context forwarded in approval requests
- Audit history

### Threats

| Threat | Impact | Mitigation |
|--------|--------|------------|
| Network MITM intercepts approval decision | Attacker delivers false decision to Claude Code | TLS everywhere, decision validation at companion |
| Stolen device secret → impersonate companion | Fake events, receive real decisions | Device revocation, secret rotation |
| Stolen user JWT → access dashboard | View sessions, make approval decisions | Short TTL (30 min), refresh token revocation |
| Replay attack: re-send captured approval decision | Force re-execution of already-approved action | Request IDs validated as single-use, expiry checked |
| IDOR: user accesses another user's approval request | Privacy breach, wrong decisions delivered | Tenant isolation enforced at service layer |
| Compromised mobile browser → CSRF | Submit malicious approval decision | CSRF tokens on state-changing requests, SameSite cookies |
| Companion exposes local port → RCE | Attacker sends fake hook responses | Companion hooks server binds to 127.0.0.1 only |
| Prompt injection in approval request content | Attacker crafts agent output to auto-approve | Approval is always explicit human action; no auto-approve |

## 2. Authentication Architecture

### User Authentication (JWT)

```
Access Token:
  - Algorithm: HS256
  - Claims: sub (user_id), iat, exp, jti
  - TTL: 30 minutes
  - Stored: memory only (not localStorage to reduce XSS risk)
  - Transmitted: Authorization: Bearer header

Refresh Token:
  - Algorithm: HS256
  - Claims: sub (user_id), iat, exp, jti
  - TTL: 30 days
  - Stored: httpOnly SameSite=Strict cookie
  - Tracked: jti stored in DB for revocation
  - Rotation: new refresh token issued on each refresh
```

### Device Authentication

```
Device secret:
  - Generated: 32 cryptographically random bytes, base64url encoded
  - Stored: bcrypt hash in DB (device.device_secret_hash)
  - Transmitted: Authorization: Bearer <device_id>:<device_secret>
  - Shown: once only, at pairing completion
  - Rotation: supported via re-pairing flow

Device request validation:
  1. Parse device_id and device_secret from header
  2. Validate device_id is a valid UUID
  3. Load device from DB by id
  4. Verify device.user_id = authenticated context (no cross-user)
  5. bcrypt.verify(device_secret, device.device_secret_hash)
  6. Check device.status ∈ {PAIRED, ACTIVE}
  7. Update device.last_seen_at = now()
```

## 3. Device Pairing Protocol

```
Step 1: Device Registration
  POST /api/v1/devices
  Auth: User JWT
  Body: { name, hostname }
  Creates: Device(status=PENDING)
  Returns: { device_id }

Step 2: Challenge Generation
  POST /api/v1/pairing/challenge
  Auth: User JWT
  Body: { device_id }
  Generates:
    - challenge_token = base64url(crypto.randomBytes(32))
    - challenge_hash = sha256(challenge_token)   ← stored in DB
    - expires_at = now() + 5 minutes
  Returns: { challenge_token }   ← shown to user once

Step 3: Challenge Completion (on the local machine)
  POST /api/v1/pairing/complete
  Auth: User JWT
  Body: { device_id, challenge_token }
  Validates:
    - challenge_hash matches stored hash
    - not expired
    - attempts < 5
    - not already completed
  On success:
    - device_secret = base64url(crypto.randomBytes(32))
    - device.device_secret_hash = bcrypt(device_secret)
    - device.status = PAIRED
    - pairing.completed_at = now()
  Returns: { device_secret }   ← shown ONCE, never stored plaintext
  
Step 4: Companion configuration
  - User saves COMPANION_DEVICE_ID and COMPANION_DEVICE_SECRET to .env
  - These are used for all subsequent companion→backend communication
```

## 4. Approval Decision Validation

The local companion MUST validate every incoming approval_decision before acting on it:

```typescript
function validateApprovalDecision(
  msg: ApprovalDecisionMessage,
  pendingRequest: PendingApprovalRequest
): ValidationResult {
  // 1. Request ID matches what we sent
  if (msg.payload.request_id !== pendingRequest.requestId) {
    return { valid: false, reason: 'request_id mismatch' };
  }

  // 2. Request has not expired locally
  if (Date.now() > pendingRequest.expiresAt.getTime()) {
    return { valid: false, reason: 'request expired locally' };
  }

  // 3. Decision is one of the allowed values
  if (!['approve', 'deny'].includes(msg.payload.decision)) {
    return { valid: false, reason: 'invalid decision value' };
  }

  // 4. Message ID has not been seen before (replay protection)
  if (seenMessageIds.has(msg.id)) {
    return { valid: false, reason: 'duplicate message id (replay)' };
  }

  return { valid: true };
}
```

**Fail-closed rule**: If validation fails for ANY reason, the companion returns DENY to the agent. Never approve on validation failure.

## 5. Secret Redaction Policy

Before forwarding agent event payloads to the backend, the companion MUST redact:

- Values of environment variables (keys are OK, values are not)
- File contents that match secret patterns:
  - Lines matching: `(password|secret|token|key|api_key|auth)[=:]\s*.+` (case-insensitive)
  - Contents of known secret files: `.env`, `*.key`, `*.pem`, `id_rsa`, `credentials.json`
- Any string matching common secret formats:
  - AWS: `AKIA[A-Z0-9]{16}`
  - GitHub tokens: `gh[ps]_[A-Za-z0-9]{36}`
  - Generic: sequences of 40+ hex characters

Redaction replaces matched content with `[REDACTED]`.

## 6. Audit Log Requirements

The following events MUST produce an AuditRecord before the operation completes:

| Event | actor_type | payload must include |
|-------|-----------|---------------------|
| user.registered | SYSTEM | email (hashed), ip_address |
| user.login | USER | ip_address |
| user.login_failed | SYSTEM | email (hashed), ip_address |
| device.registered | USER | device_id, name |
| device.pairing_started | USER | device_id |
| device.pairing_completed | USER | device_id |
| device.pairing_failed | SYSTEM | device_id, reason |
| device.revoked | USER | device_id |
| approval_request.created | DEVICE | request_id, session_id, action_summary, risk_level |
| approval_decision.approved | USER | request_id, user_id, decided_at |
| approval_decision.denied | USER | request_id, user_id, decided_at |
| approval_request.expired | SYSTEM | request_id |
| approval_decision.delivered | SYSTEM | request_id, device_id, delivered_at |

AuditRecords are append-only. No UPDATE or DELETE is permitted on the audit_records table.

## 7. TLS Configuration

Production requirements:
- TLS 1.2 minimum, TLS 1.3 preferred
- Certificate from a trusted CA (Let's Encrypt acceptable)
- HSTS header: `Strict-Transport-Security: max-age=63072000; includeSubDomains`
- No self-signed certificates in production
- Companion validates TLS certificates on outbound connections (no InsecureSkipVerify)

## 8. Tenant Isolation

All database queries involving user-owned resources must include an explicit user_id filter. This is enforced in two places:

1. **Service layer**: Every service function takes `user_id` as a parameter and includes it in queries
2. **Router layer**: `user_id` comes from the authenticated token, never from the request body

Cross-tenant access is impossible by design — a user JWT cannot be used to access another user's devices, projects, sessions, or approval requests.

## 9. Replay Protection

- Each WebSocket message has a unique `id` (UUID)
- The companion tracks seen message IDs for the last 1000 messages (rotating ring buffer)
- Approval decision message IDs are tracked indefinitely (persist to SQLite)
- ApprovalRequests have an `idempotency_key` — duplicate submissions return the existing record (409-safe)
- ApprovalDecisions have a unique FK on request_id — only one decision per request is possible at the DB level

## 10. Hooks Server Security

The companion's HTTP hooks server:
- Binds to `127.0.0.1` only (never `0.0.0.0`)
- Does not require authentication (Claude Code is the only local caller)
- Validates that the Content-Type is `application/json`
- Has a request size limit of 1 MB
- Logs all received hooks (without secret content) for auditability
