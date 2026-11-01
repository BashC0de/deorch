# DeOrch Roadmap

## Milestone 0 — Architecture & Assessment ✅
*Current milestone*

- [x] Repository and codebase assessment
- [x] Architecture documentation (PRD, system design, domain model, security, adapter spec)
- [x] Monorepo scaffold (docker-compose, Makefile, package configs)
- [x] Development environment setup

---

## Milestone 1 — Local Companion & Control Plane
*Target: 4 weeks*

Core objective: a developer can pair their machine, start a Claude Code session, receive a real permission request on their phone, and approve or deny it. The full sequence is recorded in the audit log.

- [ ] Backend: User authentication (register, login, JWT refresh)
- [ ] Backend: Device registration and pairing challenge flow
- [ ] Backend: Agent session tracking and event ingestion
- [ ] Backend: Approval request creation, decision processing, expiry
- [ ] Backend: Authenticated WebSocket relay (dashboard + companion channels)
- [ ] Local Companion: Authenticated outbound WS connection with reconnect
- [ ] Local Companion: SQLite-backed event queue for offline durability
- [ ] Local Companion: HTTP hooks server for Claude Code integration
- [ ] Local Companion: Approval request forwarding and decision relay
- [ ] Claude Code Adapter: PreToolUse, PostToolUse, Stop, Notification hooks
- [ ] Alembic migrations covering all domain models
- [ ] Tests: auth, device pairing, approval lifecycle, WS, reconnect

**Definition of Done**: End-to-end flow from Claude Code permission request → mobile approval → decision delivered back to Claude Code, all recorded in audit log.

---

## Milestone 2 — Mobile Control Dashboard
*Target: 3 weeks after M1*

- [ ] Responsive Next.js dashboard (mobile-first dark design)
- [ ] Authentication screens (login, register)
- [ ] Device list and connection status
- [ ] Real-time approval inbox with approve/deny
- [ ] Agent session feed with event history
- [ ] WebSocket client with reconnect and notification
- [ ] Push notification support (browser notifications for pending approvals)

---

## Milestone 3 — Development Intelligence
*Target: 2 weeks after M2*

- [ ] Git working-tree change visibility
- [ ] Development server health monitoring
- [ ] Port monitoring
- [ ] Test execution event capture
- [ ] Build status tracking
- [ ] Structured error and log collection
- [ ] Session summaries

---

## Milestone 4 — Multi-Agent Ecosystem
*Ongoing*

- [ ] OpenAI Codex adapter
- [ ] Cursor adapter
- [ ] GitHub Copilot adapter
- [ ] ACP (Agent Client Protocol) compatible agent support
- [ ] Multi-machine management
- [ ] Project-scoped approval policies
- [ ] Time-limited permissions
- [ ] Rule-based auto-approvals
- [ ] Audit and policy history UI
