# M13 Production Security Closure

## Risk Closure Table

| M12 Risk | M13 Fix | Evidence | Status |
|----------|---------|----------|--------|
| DNS rebinding / TOCTOU | `resolve_and_validate()` in url_validator.py resolves DNS and validates ALL resolved IPs before connecting | `socket.getaddrinfo()` → check each IP against BLOCKED_NETWORKS | CLOSED |
| HTTP redirect SSRF bypass | Custom `_NoRedirectHandler` in webhook_delivery.py blocks all redirects | urllib opener raises HTTPError on 3xx status | CLOSED |
| In-memory webhook dedup | `InboundWebhookLog` DB table with `UNIQUE(provider_delivery_id, integration_slug)` constraint | IntegrityError caught for concurrent duplicates; survives restarts | CLOSED |
| Encryption key not enforced | `validate_crypto_config()` called in production lifespan; raises RuntimeError if key missing | config.py + main.py startup check | CLOSED |
| No key versioning | `CURRENT_KEY_VERSION` in ciphertext; `decrypt()` reads version; `re_encrypt()` migrates old versions | struct.pack version byte + version-aware key lookup | CLOSED |

## DNS-Aware SSRF Defense

The `resolve_and_validate(url)` function:
1. Validates URL scheme, hostname, port (basic checks)
2. Resolves DNS via `socket.getaddrinfo()`
3. Validates EVERY resolved IP against blocked networks
4. Returns list of safe IPs
5. Called on every outgoing webhook delivery attempt

Blocked ranges include all RFC 1918 private, loopback, link-local, metadata (169.254.x.x), IPv6 equivalents, and IPv4-mapped IPv6 forms.

## Redirect Hardening

Outgoing webhook delivery uses a custom urllib opener (`_NoRedirectHandler`) that:
- Blocks ALL HTTP redirects (3xx responses)
- Records the redirect as a delivery failure
- Prevents SSRF via redirect to internal destinations

## Persistent Deduplication

`InboundWebhookLog` table:
- Fields: integration_slug, provider_delivery_id, event_type, processed, created_at
- Unique constraint on (provider_delivery_id, integration_slug)
- Concurrent duplicate requests caught by IntegrityError → return `{duplicate: true}`
- Survives server restarts (database-backed)

## Production Key Management

- `ENCRYPTION_KEY` must be set in production (base64-encoded 32 bytes)
- Development can fall back to derived key from DEORCH_SECRET_KEY (with warning log)
- Production startup fails if encryption key is missing
- Key version stored in ciphertext envelope for future rotation
- `re_encrypt()` function available for key migration

## Known Remaining Limitations

1. **DNS re-resolution between validation and connection**: urllib may re-resolve DNS during the actual connection, potentially hitting a different IP. Full mitigation requires binding connections to validated IPs, which is complex with urllib. For production, consider using httpx with IP pinning.
2. **No KMS provider implemented**: Key management is config-based. Production should use AWS KMS, GCP KMS, or HashiCorp Vault via a provider adapter.
3. **Dedup log retention**: InboundWebhookLog grows unbounded. Add a periodic cleanup job for records older than 30 days.
