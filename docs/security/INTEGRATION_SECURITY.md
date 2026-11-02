# Integration Security Architecture

## Credential Encryption

All integration credentials are encrypted at rest using AES-256-GCM via the `crypto.py` service.

**Encryption scheme:**
- Algorithm: AES-256-GCM (authenticated encryption)
- Key: 32-byte key derived from `ENCRYPTION_KEY` config or `DEORCH_SECRET_KEY`
- Nonce: 12-byte random per encryption
- Associated Data: `org_id` (prevents cross-org credential theft)
- Format: `version(1) + nonce(12) + ciphertext + tag(16)`, base64-encoded

**Key management:**
- Production: Set `ENCRYPTION_KEY` as a base64-encoded 32-byte key
- Development: Derives key from `DEORCH_SECRET_KEY` (not recommended for production)
- Key rotation: Change `ENCRYPTION_KEY` and re-encrypt existing credentials

**Credential lifecycle:**
- Encrypted before database persistence
- Never returned in API responses
- Cleared (nullified) on disconnect/revocation
- Decrypted only for authorized backend operations

## Inbound Webhook Security

### GitHub Webhooks
- HMAC-SHA256 signature validation using `X-Hub-Signature-256` header
- Constant-time comparison via `hmac.compare_digest()`
- Webhook secret stored in connection config
- Unsigned webhooks rejected with 401

### Replay Protection
- GitHub delivery ID (`X-GitHub-Delivery`) tracked for deduplication
- Duplicate deliveries return `{received: true, duplicate: true}`
- In-memory dedup set (bounded at 10K entries)

### Request Validation
- Body size limit: 1MB
- JSON parse validation
- Unknown event types safely recorded
- Audit payload sanitized (sensitive fields stripped)

## SSRF Prevention

All outbound HTTP requests to user-configured URLs pass through `url_validator.py`.

**Blocked destinations:**
- IPv4 loopback (127.0.0.0/8)
- IPv4 private (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16)
- IPv4 link-local (169.254.0.0/16, includes cloud metadata)
- IPv6 loopback (::1)
- IPv6 link-local (fe80::/10)
- IPv6 unique local (fc00::/7)
- IPv4-mapped IPv6 addresses for all above ranges
- Hostnames: localhost, metadata.google.internal
- Internal service ports: Redis, PostgreSQL, MySQL, MongoDB, Memcached

## Outgoing Webhook Delivery

**Delivery lifecycle:** PENDING → PROCESSING → DELIVERED / RETRYING → FAILED / DEAD_LETTERED

- Max 5 delivery attempts
- Background loop processes pending deliveries every 15 seconds
- HMAC-SHA256 payload signing with `X-DeOrch-Signature-256` header
- SSRF validation on every delivery attempt
- Delivery history with response codes and errors

## Slack Security

- Bot token never exposed in logs or responses
- Message text truncated to 3000 chars to prevent abuse
- Request timeout: 10 seconds
- Approval alert links point to DeOrch dashboard (not Slack actions)
- Slack button clicks are NOT treated as authorization — revalidation required

## Remaining Security Items

| Item | Status | Risk |
|------|--------|------|
| OAuth 2.0 flow | NOT IMPLEMENTED | Token-based auth works but less secure than OAuth |
| DNS resolution validation | NOT IMPLEMENTED | Hostname-based SSRF possible via DNS rebinding |
| Redirect following | NOT RESTRICTED | urllib follows redirects by default |
| Credential encryption key in env | DEVELOPMENT ONLY | Production should use KMS/vault |
| Webhook replay timestamp window | NOT IMPLEMENTED | Dedup by delivery ID only |
