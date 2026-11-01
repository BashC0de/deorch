# DeOrch — System Architecture

## 1. Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     Developer's Machine                         │
│                                                                 │
│  ┌──────────────┐    hooks     ┌──────────────────────────────┐ │
│  │  Claude Code │◄────────────►│     Local Companion          │ │
│  │  (AI Agent)  │  HTTP/stdin  │  (Node.js / TypeScript)      │ │
│  └──────────────┘              │                              │ │
│                                │  ┌────────────────────────┐  │ │
│                                │  │  Claude Code Adapter   │  │ │
│                                │  └────────────────────────┘  │ │
│                                │  ┌────────────────────────┐  │ │
│                                │  │  SQLite Event Queue    │  │ │
│                                │  └────────────────────────┘  │ │
│                                │  ┌────────────────────────┐  │ │
│                                │  │  WS Client (outbound)  │  │ │
│                                │  └────────────┬───────────┘  │ │
│                                └───────────────┼──────────────┘ │
└───────────────────────────────────────────────┼────────────────┘
                                                 │ WSS (outbound only)
                                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     DeOrch Backend                              │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    FastAPI Application                   │   │
│  │                                                          │   │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────────────┐   │   │
│  │  │  REST API  │  │  WS Relay  │  │  Background Tasks│   │   │
│  │  │  /api/v1   │  │  /ws/*     │  │  (expiry, audit) │   │   │
│  │  └────────────┘  └────────────┘  └──────────────────┘   │   │
│  │                                                          │   │
│  │  ┌────────────────────────────────────────────────────┐  │   │
│  │  │              Connection Manager                    │  │   │
│  │  │  user_connections: {user_id → Set[WebSocket]}      │  │   │
│  │  │  device_connections: {device_id → WebSocket}       │  │   │
│  │  └────────────────────────────────────────────────────┘  │   │
│  └──────────────────────────────────────────────────────────┘   │
│                          │              │                        │
│            ┌─────────────┘              └──────────────┐        │
│            ▼                                           ▼        │
│  ┌─────────────────┐                       ┌─────────────────┐  │
│  │   PostgreSQL    │                       │      Redis      │  │
│  │   (primary DB)  │                       │ (optional: pub/ │  │
│  │                 │                       │  sub for multi- │  │
│  └─────────────────┘                       │  node deploys)  │  │
│                                            └─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                                 │ WSS
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Developer's Phone / Browser                 │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Next.js Web Dashboard                       │   │
│  │                                                          │   │
│  │  Approvals │ Sessions │ Devices │ Audit                  │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

## 2. Data Flow Diagrams

### 2a. Machine Pairing Flow

```
Developer CLI          Local Companion         Backend API
     │                      │                      │
     │──── POST /devices ───►│                      │
     │                      │── POST /devices ─────►│
     │                      │◄── 201 {device_id} ───│
     │                      │                      │
     │── POST /pairing/challenge ─────────────────►│
     │◄────────── {challenge_token} ───────────────│
     │                      │                      │
     │  (user copies token to companion CLI)        │
     │                      │                      │
     │──── pairing complete ►│                      │
     │                      │── POST /pairing/complete ►│
     │                      │   {challenge_token}   │
     │                      │◄── {device_secret} ───│
     │                      │   (shown once)        │
     │                      │                      │
     │                      │  [saves device_id +   │
     │                      │   device_secret to    │
     │                      │   .env / config]      │
```

### 2b. Permission Request Flow

```
Claude Code     Companion      Backend API    ConnectionMgr   Dashboard
    │               │               │               │             │
    │──PreToolUse──►│               │               │             │
    │   (hook)      │               │               │             │
    │               │── POST /approvals ───────────►│             │
    │               │   {device_id, session_id,     │             │
    │               │    action, details, ttl}       │             │
    │               │◄── 201 {request_id} ──────────│             │
    │               │               │               │             │
    │               │               │──send_to_user(user_id, ───►│
    │               │               │  {type:"approval_request"})│
    │               │               │               │             │
    │               │               │               │  [user taps │
    │               │               │               │   Approve]  │
    │               │               │               │◄── POST /approvals/{id}/decide
    │               │               │               │             │
    │               │               │──send_to_device(device_id,──┘
    │               │               │  {type:"approval_decision", │
    │               │               │   decision:"approve"})      │
    │               │◄──────────────────────────────│             │
    │               │   [validates decision:         │             │
    │               │    user owns device,           │             │
    │               │    request not expired,        │             │
    │               │    idempotency check]          │             │
    │◄── approve ───│               │               │             │
    │   (hook resp) │               │               │             │
```

### 2c. WebSocket Authentication Flow

```
Client (Browser/Companion)          Backend WS Endpoint
         │                                   │
         │────────── WS connect ────────────►│
         │◄─── {type:"auth_required"} ───────│
         │                                   │
         │─── {type:"auth_token",            │
         │     payload:{token:"<jwt>"}} ────►│
         │                                   │  [validate JWT]
         │                                   │  [register in ConnectionManager]
         │◄─── {type:"auth_ok"} ─────────────│
         │                                   │
         │  (heartbeat every 30s)            │
         │─── {type:"ping"} ────────────────►│
         │◄── {type:"pong"} ─────────────────│
```

## 3. Communication Protocols

### REST API
- Base path: `/api/v1`
- Authentication: `Authorization: Bearer <jwt>` for user endpoints
- Device authentication: `Authorization: Bearer <device_id>:<device_secret>`
- Content-Type: `application/json`
- Pagination: cursor-based (`?cursor=<id>&limit=<n>`)

### WebSocket
- User dashboard: `wss://<host>/ws/dashboard`
- Local companion: `wss://<host>/ws/companion`
- Messages: JSON with envelope `{type, id, payload, timestamp}`
- Heartbeat: ping every 30s, disconnect if no pong within 45s

## 4. Component Responsibilities

| Component | Responsibility | Does NOT |
|-----------|---------------|----------|
| Local Companion | Hooks server, WS client, event queue, decision relay | Execute decisions itself |
| Claude Code Adapter | Hook registration, payload mapping, response formatting | Make network calls directly |
| Backend API | Auth, device registry, event ingestion, approval routing | Execute local commands |
| Connection Manager | WS state, routing messages to correct connections | Persist to DB |
| PostgreSQL | All persistent state | Real-time message routing |
| Dashboard | Display, decision input | Know local machine state directly |

## 5. Deployment Architecture

### Local Development
```
docker compose up
  ├── postgres:5432
  ├── api:8000 (with hot reload)
  └── web:3000 (with hot reload)

# Run companion locally (not in Docker — needs access to Claude Code hooks)
cd packages/local-companion && pnpm dev
```

### Production (single-node)
```
nginx (TLS termination)
  ├── → api:8000 (gunicorn/uvicorn workers)
  └── → web:3000 (Next.js standalone)

PostgreSQL (managed or self-hosted)
```
