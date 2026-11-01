# DeOrch — Implementation Roadmap

## Current Status

**Milestone 0 complete**: Repository assessed, architecture documented, monorepo scaffold created.

---

## Milestone 1 — Local Companion & Control Plane

**Goal**: End-to-end vertical slice. Real Claude Code permission request → mobile decision → decision delivered back to Claude Code. Fully audited.

### Week 1: Backend Foundation

- [x] Domain models (User, Device, DevicePairing, Project, AgentProvider, AgentSession, AgentEvent, ApprovalRequest, ApprovalDecision, AuditRecord)
- [x] Database configuration (async SQLAlchemy, asyncpg)
- [x] Alembic migrations — initial revision
- [ ] Auth service: register, login, JWT access + refresh tokens
- [ ] Device registration endpoint
- [ ] Pairing challenge + completion endpoints
- [ ] Health check endpoint
- [ ] Basic test fixtures (test user, test device, test DB)

**Deliverable**: `make dev-api` starts, migrations run, user can register and login.

### Week 2: Sessions & Approvals

- [ ] Session creation and status management (device-authenticated endpoints)
- [ ] Event ingestion with idempotency
- [ ] Approval request creation (device-authenticated)
- [ ] Approval decision endpoint (user-authenticated)
- [ ] Approval expiry background task
- [ ] Audit record emission for all significant events
- [ ] Tests: approval lifecycle, expiry, replay protection

**Deliverable**: Full approval request/decision cycle works via REST.

### Week 3: WebSocket Relay

- [ ] Connection manager (user_connections dict, device_connections dict)
- [ ] `/ws/dashboard` endpoint with auth flow
- [ ] `/ws/companion` endpoint with device auth flow
- [ ] Event routing: companion event → forward to user's browser connections
- [ ] Decision routing: user decision → forward to companion connection
- [ ] Heartbeat (ping/pong) on both channels
- [ ] Reconnect handling (no duplicate registrations)
- [ ] Tests: WS auth, message routing, disconnect handling

**Deliverable**: Backend WS relay routes messages correctly between companion and dashboard.

### Week 4: Local Companion

- [ ] WS client with exponential backoff reconnect
- [ ] Device authentication on WS connect
- [ ] SQLite event queue (enqueue on failure, flush on reconnect)
- [ ] HTTP hooks server (binds 127.0.0.1:8765)
- [ ] Claude Code adapter: PreToolUse, PostToolUse, Stop, Notification handlers
- [ ] Approval request → backend → wait for decision → return to Claude Code
- [ ] Decision validation (fail-closed)
- [ ] Secret redaction before forwarding event payloads
- [ ] Companion graceful shutdown

**Deliverable**: Companion starts, connects to backend, receives Claude Code hooks, routes approval requests, delivers decisions.

### Definition of Done — Milestone 1

All 12 items from README section 11 must pass:
1. ✅ Backend starts locally
2. ✅ Local companion starts
3. ✅ Developer can pair a machine
4. ✅ Companion establishes authenticated connection
5. ✅ Claude Code session identified
6. ✅ Real permission request reaches backend
7. ✅ Dashboard receives the request
8. ✅ Authenticated user can approve or deny
9. ✅ Decision reaches companion
10. ✅ Agent receives correct decision
11. ✅ Sequence recorded in auditable event history
12. ✅ Tests verify authorization, expiration, disconnection, failure

---

## Milestone 2 — Mobile Control Dashboard

**Goal**: Usable mobile-first web dashboard. Genuine approval flow on a phone.

- [ ] Next.js app: routing, layout, auth
- [ ] Login + register screens (mobile-optimized)
- [ ] Dashboard overview: machine status, active sessions, pending approvals
- [ ] Approval inbox with real-time updates via WS
- [ ] Approval detail view: full context, risk badge, expiry countdown
- [ ] Approve / Deny with confirmation step
- [ ] Session list and event feed
- [ ] Device list with connection status
- [ ] Browser push notifications for pending approvals
- [ ] Graceful WS reconnect with connection status indicator

---

## Milestone 3 — Development Intelligence

**Goal**: Observability beyond permission requests.

- [ ] Git working-tree change events
- [ ] Development server health checks (detect running dev servers by port)
- [ ] Test execution event capture (detect test runner output)
- [ ] Build status monitoring
- [ ] Session summaries (what did the agent accomplish?)
- [ ] Error and log collection (structured logs from agent events)

---

## Milestone 4 — Multi-Agent Ecosystem

**Goal**: Not just Claude Code.

- [ ] Codex adapter research and implementation
- [ ] Cursor adapter (if integration mechanism exists)
- [ ] ACP (Agent Client Protocol) adapter
- [ ] Multi-machine management UI
- [ ] Project-scoped approval policies
- [ ] Time-limited auto-approve rules (with explicit consent)
- [ ] Rule-based approval patterns

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Claude Code hook format changes | Medium | High | Pin Claude Code version in companion, test against hook payloads |
| WebSocket scaling beyond single node | Low (v1) | Medium | Redis pub/sub design doc ready; defer until needed |
| Device secret phishing | Low | Critical | Pairing UX makes it clear secret is shown once; audit on every auth |
| SQLite corruption on hard crash | Low | Medium | WAL mode enabled, periodic vacuum, event idempotency means replay is safe |
| User leaves approval pending → agent blocked | High | Medium | Clear TTL display in dashboard, browser notifications |

## Dependency Graph

```
Week 1 (Models + Auth)
    │
    ├──► Week 2 (Sessions + Approvals)
    │         │
    │         └──► Week 3 (WebSocket)
    │                   │
    │                   └──► Week 4 (Companion)
    │                              │
    └──────────────────────────────┴──► M2 Dashboard
```
