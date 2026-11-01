# DeOrch — Development Setup

## Prerequisites

| Tool | Version | Purpose |
|------|---------|---------|
| Docker + Docker Compose | 24+ | PostgreSQL, API, web containers |
| Node.js | 20+ | Local companion, frontend |
| pnpm | 9+ | JavaScript package manager |
| Python | 3.12+ | Backend (if running outside Docker) |
| Git | 2.40+ | Version control |

Install pnpm: `npm install -g pnpm@9`

## 1. Clone and Configure

```bash
git clone https://github.com/BashC0de/deorch.git
cd deorch

# Create your .env from the example
cp .env.example .env
```

Edit `.env` and set at minimum:
- `JWT_SECRET_KEY` — 64 random characters
- `DEORCH_SECRET_KEY` — 32 random characters

Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## 2. Install JavaScript Dependencies

```bash
pnpm install
```

This installs dependencies for all packages in the workspace (web, local-companion, shared-contracts, agent-adapters).

## 3. Start the Backend Stack

```bash
make dev-api
```

This starts:
- `postgres` on port 5432
- `api` on port 8000 (with hot reload)

Wait for the API to print `Application startup complete`. First start will be slower (pulling images).

Check health:
```bash
curl http://localhost:8000/health
```

## 4. Run Database Migrations

```bash
make migrate
```

This runs `alembic upgrade head` inside the API container. Seeds the `agent_providers` table with supported agents.

## 5. Start the Frontend

```bash
# In a new terminal
cd apps/web && pnpm dev
```

Or with Docker:
```bash
make dev
```

Dashboard is at http://localhost:3000.

## 6. Register and Pair Your Machine

### Option A: DeOrch CLI (Recommended)

```bash
# Install the CLI
make cli-install

# Authenticate
deorch login

# Pair this machine (auto-generates device name from hostname)
deorch pair --name "My Dev Machine"

# Verify
deorch status
deorch devices
```

### Option B: Web Dashboard

1. Open http://localhost:3000 and register/login
2. Navigate to Devices page
3. Click "Connect Machine"
4. Enter a device name and click Register
5. Copy the pairing code shown in the modal
6. Run: `deorch pair --device-id <id> --token <code>`

### Option C: Manual curl (for scripting)

```bash
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email": "you@example.com", "password": "yourpassword", "display_name": "Your Name"}'

TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email": "you@example.com", "password": "yourpassword"}' \
  | jq -r '.access_token')

DEVICE_ID=$(curl -s -X POST http://localhost:8000/api/v1/devices \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"name": "My Dev Machine", "hostname": "'$(hostname)'"}' \
  | jq -r '.id')

CHALLENGE=$(curl -s -X POST http://localhost:8000/api/v1/pairing/challenge \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"device_id\": \"$DEVICE_ID\"}" \
  | jq -r '.challenge_token')

DEVICE_SECRET=$(curl -s -X POST http://localhost:8000/api/v1/pairing/complete \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d "{\"device_id\": \"$DEVICE_ID\", \"challenge_token\": \"$CHALLENGE\"}" \
  | jq -r '.device_secret')
echo "Device secret: $DEVICE_SECRET"
```

## 7. Start the Local Companion

```bash
# Using CLI (reads credentials from ~/.deorch/credentials.json)
deorch start

# Or using make (reads from env vars / .env file)
make companion
```

The companion will:
1. Connect to the backend at `COMPANION_WS_URL`
2. Authenticate using device credentials
3. Start the hooks server at `http://127.0.0.1:8765`
4. Print `DeOrch companion ready` when connected

## 8. Configure Claude Code Hooks

Add to `~/.claude/settings.json`:
```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -X POST http://127.0.0.1:8765/hooks/pre-tool-use -H 'Content-Type: application/json' -d @-"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -X POST http://127.0.0.1:8765/hooks/post-tool-use -H 'Content-Type: application/json' -d @-"
          }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -X POST http://127.0.0.1:8765/hooks/stop -H 'Content-Type: application/json' -d @-"
          }
        ]
      }
    ],
    "Notification": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "curl -s -X POST http://127.0.0.1:8765/hooks/notification -H 'Content-Type: application/json' -d @-"
          }
        ]
      }
    ]
  }
}
```

## 9. Common Development Tasks

```bash
# Run all tests
make test-all

# Run API tests only
make test-api

# Create a new database migration
make migration name=add_feature_x

# Open PostgreSQL shell
make db-shell

# View container logs
make logs
make logs-api

# Format code
make format

# Run type checking
pnpm typecheck
cd services/api && python -m mypy src/
```

## 10. Troubleshooting

**Companion can't connect to backend**
- Check `COMPANION_WS_URL` in `packages/local-companion/.env`
- Ensure the API container is running: `docker compose ps`
- Check API logs: `make logs-api`

**Migrations fail**
- Ensure postgres is healthy: `docker compose ps`
- Check for migration conflicts: `docker compose exec api alembic history`

**Claude Code hooks not reaching companion**
- Verify companion is running and shows `hooks server listening on 127.0.0.1:8765`
- Test manually: `echo '{"session_id":"test","hook_event_name":"Notification","message":"test"}' | curl -s -X POST http://127.0.0.1:8765/hooks/notification -H 'Content-Type: application/json' -d @-`

**Port conflicts**
- API: change `8000` → any in docker-compose.yml and `NEXT_PUBLIC_API_URL`
- Web: change `3000` → any in docker-compose.yml and Next.js config
- Hooks server: change `COMPANION_HOOKS_PORT` in companion .env AND Claude Code settings.json
