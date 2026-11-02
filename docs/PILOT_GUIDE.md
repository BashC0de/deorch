# Pilot Launch Guide

## For Pilot Developers

### Getting Started

1. **Create an account** — Register at the DeOrch web dashboard
2. **Install the companion** — `npm install -g @deorch/local-companion`
3. **Authenticate** — `deorch login`
4. **Pair your device** — `deorch pair --name "My Laptop"`
5. **Install agent hooks** — `deorch setup` (auto-detects Claude Code, Codex, Gemini CLI)
6. **Start the companion** — `deorch start`
7. **Open the dashboard** — Navigate to the web/mobile app

### Onboarding Checklist

The dashboard shows a progress checklist. Complete each step to activate your workspace:
- Pair a device
- Connect an agent (run `deorch setup`)
- Start a coding session
- Handle an approval request

### Submitting Feedback

Use the Feedback page in the dashboard to report:
- Bugs
- Feature requests
- Onboarding difficulties
- Agent integration issues

### Supported Agents

| Agent | Status | Install |
|-------|--------|---------|
| Claude Code | Supported | `deorch setup --provider claude-code` |
| OpenAI Codex | Supported | `deorch setup --provider codex` |
| Gemini CLI | Supported | `deorch setup --provider gemini` |

## For Pilot Operators

### Analytics Dashboard

The Analytics page shows real-time metrics computed from actual usage:
- Total events, active days, devices paired
- Sessions started, approvals handled, workflows executed
- Event breakdown by type

### Feedback Management

Review user feedback at `/dashboard/feedback`. Each item has:
- Category (bug, feature-request, onboarding, etc.)
- Severity (low, medium, high)
- Status (new, triaged, in_progress, resolved)

### Feature Flags

Feature flags are stored in the `feature_flags` database table:
- `is_enabled`: Global on/off
- `allowed_orgs`: Restrict to specific organizations
- `allowed_users`: Restrict to specific users

Query flags via `GET /api/v1/analytics/flags`.

### API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/v1/analytics/events` | Record analytics event |
| `GET /api/v1/analytics/events` | List events |
| `GET /api/v1/analytics/metrics` | Computed metrics |
| `GET /api/v1/analytics/flags` | Feature flags for user |
| `POST /api/v1/feedback` | Submit feedback |
| `GET /api/v1/feedback` | List feedback |
| `PATCH /api/v1/feedback/{id}` | Update feedback status |
