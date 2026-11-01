# Development Intelligence

DeOrch provides real-time development intelligence by observing local development environments and correlating agent activity with actual outcomes.

## Architecture

```
Local Machine                    Backend                      Dashboard
┌─────────────────┐            ┌──────────┐               ┌──────────┐
│ Companion        │            │          │               │          │
│ ├─ServiceMonitor │──health──→│ REST API │──WS events──→│ Project  │
│ ├─GitMonitor     │──snapshot→│          │               │ Health   │
│ ├─TestObserver   │──results──│          │               │ Dashboard│
│ └─BuildObserver  │──builds──→│          │               │          │
└─────────────────┘            └──────────┘               └──────────┘
```

## Capabilities

### Service Monitoring
Register local development servers (frontend, backend, API, database). The companion periodically checks their health endpoints and reports status.

```bash
deorch services add --name "Frontend" --port 3000 --health /health
deorch services add --name "API" --port 8000 --health /health
deorch services list
```

Health states: HEALTHY, DEGRADED (>3s response), UNHEALTHY (wrong status code), STOPPED (connection refused), UNKNOWN (timeout).

### Git Intelligence
Periodic read-only git snapshots capture: branch, latest commit, modified/added/deleted/untracked files, diff statistics. No write operations (no commit, push, reset).

### Test Observability
Automatic detection of test runner commands (vitest, jest, pytest, playwright, mocha, cargo test, go test). Parses structured output to capture: total/passed/failed/skipped, duration, failure details.

### Build Observability
Automatic detection of build commands (npm/pnpm/yarn build, tsc, cargo build, go build, make). Captures exit code, status, error output, duration.

## Security

- **Read-only monitoring**: No process termination, no git writes, no file modifications
- **Explicit registration**: Only configured services are monitored
- **Redaction**: File contents never transmitted — only paths and line counts
- **Access control**: All data scoped to device → user ownership
- **Payload limits**: File lists capped at 100 items, output capped at 5000 chars

## API Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| POST | /api/v1/services | Device | Register service |
| GET | /api/v1/services | User | List services |
| DELETE | /api/v1/services/{id} | User | Remove service |
| POST | /api/v1/services/{id}/health | Device | Submit health check |
| GET | /api/v1/services/{id}/health | User | Health history |
| POST | /api/v1/test-runs | Device | Submit test results |
| GET | /api/v1/test-runs | User | List test runs |
| POST | /api/v1/git-snapshots | Device | Submit git state |
| GET | /api/v1/git-snapshots | User | List snapshots |
| POST | /api/v1/build-results | Device | Submit build result |
| GET | /api/v1/build-results | User | List builds |
| GET | /api/v1/projects/{id}/health | User | Aggregated health |
