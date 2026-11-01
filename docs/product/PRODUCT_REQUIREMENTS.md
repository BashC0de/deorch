# DeOrch — Product Requirements Document

## 1. Problem Statement

AI coding agents (Claude Code, Cursor, Copilot, Codex) run on developer machines and perform real, consequential actions: writing code, executing shell commands, modifying files, making network requests. Developers working away from their desk — or who want a second checkpoint before an agent executes a destructive command — have no mechanism to observe, review, or intervene in agent activity from a remote device.

Current pain points:
- No visibility into what agents are doing when you step away from the keyboard
- Permission prompts are only visible on the local terminal — unreachable from a phone
- No audit trail of what agents did and what decisions were made
- No unified surface when multiple agents or machines are in use

## 2. Target Users

**Primary**: Individual developers using AI coding agents daily for non-trivial work. They leave agents running, work across multiple machines, and care about auditability and control.

**Secondary**: Engineering leads who want oversight of agentic work happening on team machines.

## 3. Jobs To Be Done

| Job | Description |
|-----|-------------|
| **Review & approve** | When my agent needs permission to run a command, I want to see what it's asking and approve or deny from my phone |
| **Stay informed** | When I'm away from my desk, I want to know what my agent is currently doing |
| **Audit past actions** | After a session ends, I want to see a log of what the agent did and what I approved |
| **Manage machines** | Register my dev machines and see which are active |
| **Respond quickly** | Not miss a permission request that's blocking my agent |

## 4. User Stories

### Machine Registration
- As a developer, I want to register my development machine with DeOrch so it appears in my dashboard
- As a developer, I want to complete machine pairing using a short challenge code, not by exposing ports
- As a developer, I want to revoke a machine if it's lost or compromised

### Agent Monitoring
- As a developer, I want to see when a Claude Code session starts on any of my machines
- As a developer, I want to see a live feed of what my agent is doing
- As a developer, I want to be notified when a session ends or encounters an error

### Approval Center
- As a developer, I want to receive a notification when my agent requests permission for an action
- As a developer, I want to see the full context of what the agent wants to do (command, working directory, reason)
- As a developer, I want to approve or deny with a single tap on my phone
- As a developer, I want expired requests to be automatically rejected — never left pending indefinitely
- As a developer, I want a confirmation step before approving to prevent accidental taps

### Audit & History
- As a developer, I want a complete record of all permission requests and my decisions
- As a developer, I want to filter audit history by machine, session, date, and decision type

## 5. Acceptance Criteria

### Machine Registration
- [ ] A developer can install the local companion on any machine
- [ ] Registration completes without exposing local ports to the internet
- [ ] Device pairing uses a short-lived challenge that expires in ≤ 5 minutes
- [ ] Device secret is shown exactly once and never stored in plaintext
- [ ] Revoked devices immediately lose the ability to send events or receive decisions

### Agent Session Tracking
- [ ] A new Claude Code session is detected within 2 seconds of starting
- [ ] Session status (active, completed, error) is accurately reflected in the dashboard
- [ ] Session events are ordered and deduplicated using sequence numbers and idempotency keys

### Approval Requests
- [ ] A permission request from Claude Code appears in the dashboard within 1 second (on a healthy connection)
- [ ] Each request displays: agent name, project, action summary, command details, working directory, reason, risk level, timestamp, expiry countdown
- [ ] Approve and Deny require a confirmation step
- [ ] Requests expire automatically after the configured TTL (default: 5 minutes)
- [ ] Expired requests return a deny decision to the local companion
- [ ] The companion delivers the decision back to Claude Code's permission hook within 2 seconds of the user deciding
- [ ] The approval sequence is fully recorded in the audit log

### WebSocket Reliability
- [ ] The companion reconnects automatically after a network interruption
- [ ] Events generated during disconnection are queued locally (SQLite) and flushed on reconnect
- [ ] Duplicate events delivered after reconnect are deduplicated by idempotency key
- [ ] The dashboard reconnects automatically and shows correct connection status

### Security
- [ ] All communication over TLS in production
- [ ] Device credentials are separate from user credentials
- [ ] A compromised device token cannot impersonate another user's devices
- [ ] Approval decisions are validated at the companion before being delivered to the agent (not trusted blindly)

## 6. Non-Functional Requirements

| Requirement | Target |
|-------------|--------|
| Approval request → dashboard latency | < 1 second (p99, stable connection) |
| Decision → agent latency | < 2 seconds |
| Companion memory footprint | < 50 MB RSS |
| API response time (REST) | < 200ms p95 |
| Uptime (backend) | 99.5% monthly |
| Request expiry accuracy | Within ±5 seconds of configured TTL |

## 7. Out of Scope — v1

- Mobile native apps (iOS/Android) — web dashboard only
- Blanket auto-approval rules
- Team/organization accounts — single user only
- Billing and subscription management
- Agent output streaming to dashboard (agent activity summaries only)
- Terminal emulation or remote shell access
- Uploading repository contents to the backend
- Agents other than Claude Code

## 8. Success Metrics

- Time from permission request to user decision < 30 seconds (median)
- Zero cases of an approval decision being delivered to the wrong user or session
- Zero cases of a revoked device being able to send events
- Companion process running stable for 48+ hours without restart
