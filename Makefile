.PHONY: dev dev-api dev-web down logs migrate migration test test-all test-api test-web test-companion lint format companion cli-install clean setup

# ── Local Development (no Docker needed) ──────────────────────────────────────

dev-api:
	cd services/api && uvicorn deorch_api.main:app --host 0.0.0.0 --port 8000 --reload --reload-dir src

dev-web:
	cd apps/web && pnpm dev

dev:
	@echo Run these in separate terminals:
	@echo   make dev-api     (backend on :8000)
	@echo   make dev-web     (frontend on :3000)
	@echo   make companion   (local companion)

# ── Docker (optional — for PostgreSQL or full-stack containers) ───────────────

docker-up:
	docker compose up --build

docker-down:
	docker compose down

docker-logs:
	docker compose logs -f

# ── Database ──────────────────────────────────────────────────────────────────

migrate:
	cd services/api && alembic upgrade head

# Usage: make migration name=add_approval_policies
migration:
	cd services/api && alembic revision --autogenerate -m "$(name)"

# ── Testing ───────────────────────────────────────────────────────────────────

test: test-api test-companion test-web

test-all: test-api test-companion test-web

test-api:
	cd services/api && python -m pytest tests/ -v --cov=deorch_api --cov-report=term-missing

test-web:
	cd apps/web && pnpm test

test-companion:
	cd packages/local-companion && pnpm test

# ── Linting & Formatting ──────────────────────────────────────────────────────

lint:
	@echo ==> Linting Python...
	cd services/api && python -m ruff check src/
	@echo ==> Linting TypeScript...
	pnpm --filter "@deorch/*" lint

format:
	@echo ==> Formatting Python...
	cd services/api && python -m black src/ tests/
	cd services/api && python -m ruff check --fix src/
	@echo ==> Formatting TypeScript...
	pnpm --filter "@deorch/*" format

typecheck:
	pnpm --filter "@deorch/*" typecheck

# ── Local Companion ───────────────────────────────────────────────────────────

companion:
	cd packages/local-companion && pnpm dev

companion-build:
	cd packages/local-companion && pnpm build

cli-install: companion-build
	cd packages/local-companion && npm link

# ── Setup ─────────────────────────────────────────────────────────────────────

setup:
	@echo ==> Installing Node dependencies...
	pnpm install
	@echo ==> Installing Python dependencies...
	cd services/api && pip install -e ".[dev]"
	@echo.
	@echo Setup complete!
	@echo   1. make dev-api   (start backend on :8000)
	@echo   2. make dev-web   (start frontend on :3000)

# ── Cleanup ───────────────────────────────────────────────────────────────────

clean:
	-del /s /q *.pyc 2>nul
	-rmdir /s /q __pycache__ 2>nul
	-del deorch.db 2>nul
