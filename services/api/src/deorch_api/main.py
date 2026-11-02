from __future__ import annotations

from contextlib import asynccontextmanager
from datetime import UTC, datetime

import structlog
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from deorch_api.config import get_settings

log = structlog.get_logger(__name__)
settings = get_settings()


def configure_logging() -> None:
    import logging
    import structlog

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.JSONRenderer() if settings.log_format == "json"
            else structlog.dev.ConsoleRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, settings.log_level.upper(), logging.INFO)
        ),
        logger_factory=structlog.PrintLoggerFactory(),
    )


async def seed_agent_providers(db_session) -> None:  # type: ignore[no-untyped-def]
    from sqlalchemy import select
    from deorch_api.models.agent import AgentProvider

    providers = [
        {"slug": "claude-code", "display_name": "Claude Code", "is_supported": True,
         "capabilities": ["pre_tool_approval", "post_tool_observe", "session_tracking", "notifications"]},
        {"slug": "codex", "display_name": "OpenAI Codex", "is_supported": False, "capabilities": []},
        {"slug": "cursor", "display_name": "Cursor", "is_supported": False, "capabilities": []},
        {"slug": "copilot", "display_name": "GitHub Copilot", "is_supported": False, "capabilities": []},
        {"slug": "acp", "display_name": "ACP Compatible Agent", "is_supported": False, "capabilities": []},
    ]
    for p in providers:
        existing = await db_session.execute(
            select(AgentProvider).where(AgentProvider.slug == p["slug"])
        )
        if not existing.scalar_one_or_none():
            db_session.add(AgentProvider(
                slug=p["slug"],
                display_name=p["display_name"],
                is_supported=p["is_supported"],
                capabilities=p["capabilities"],
                created_at=datetime.now(UTC),
            ))
    await db_session.commit()


async def seed_plans(db_session) -> None:  # type: ignore[no-untyped-def]
    from sqlalchemy import select
    from deorch_api.models.billing import Plan

    plans = [
        {
            "slug": "individual", "display_name": "Individual", "tier": "individual",
            "description": "For solo developers",
            "price_monthly_cents": 0, "sort_order": 0,
            "entitlements": {
                "max_users": 1, "max_devices": 3, "max_sessions": 10,
                "max_workflow_executions": 5, "audit_export": False, "sso": False,
            },
        },
        {
            "slug": "team", "display_name": "Team", "tier": "team",
            "description": "For development teams",
            "price_monthly_cents": 2900, "sort_order": 1,
            "entitlements": {
                "max_users": 10, "max_devices": 20, "max_sessions": -1,
                "max_workflow_executions": 50, "audit_export": True, "sso": False,
            },
        },
        {
            "slug": "enterprise", "display_name": "Enterprise", "tier": "enterprise",
            "description": "For organizations at scale",
            "price_monthly_cents": 9900, "sort_order": 2,
            "entitlements": {
                "max_users": -1, "max_devices": -1, "max_sessions": -1,
                "max_workflow_executions": -1, "audit_export": True, "sso": True,
            },
        },
    ]
    for p in plans:
        existing = await db_session.execute(
            select(Plan).where(Plan.slug == p["slug"])
        )
        if not existing.scalar_one_or_none():
            db_session.add(Plan(**p))
    await db_session.commit()


async def seed_integrations(db_session) -> None:  # type: ignore[no-untyped-def]
    from sqlalchemy import select
    from deorch_api.models.integration import Integration
    from deorch_api.integrations.github import INTEGRATION_DEFINITION as github_def
    from deorch_api.integrations.slack import INTEGRATION_DEFINITION as slack_def

    for defn in [github_def, slack_def]:
        existing = await db_session.execute(
            select(Integration).where(Integration.slug == defn["slug"])
        )
        if not existing.scalar_one_or_none():
            db_session.add(Integration(**defn))
    await db_session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    import asyncio

    configure_logging()
    log.info("deorch_api_starting", version=settings.app_version, env=settings.environment)

    # Validate security-critical configuration
    if settings.environment == "production":
        from deorch_api.services.crypto import validate_crypto_config
        validate_crypto_config()  # Raises RuntimeError if encryption key missing

    if settings.environment in ("development", "test"):
        from deorch_api.database import create_tables
        await create_tables()

    from deorch_api.database import AsyncSessionFactory
    async with AsyncSessionFactory() as db:
        await seed_agent_providers(db)
        await seed_plans(db)
        await seed_integrations(db)

    # Start background tasks
    from deorch_api.services.expiry import run_expiry_loop
    from deorch_api.services.webhook_delivery import run_delivery_loop
    expiry_task = asyncio.create_task(run_expiry_loop())
    delivery_task = asyncio.create_task(run_delivery_loop())

    log.info("deorch_api_ready")
    yield

    expiry_task.cancel()
    delivery_task.cancel()
    try:
        await expiry_task
    except asyncio.CancelledError:
        pass
    try:
        await delivery_task
    except asyncio.CancelledError:
        pass
    log.info("deorch_api_shutdown")


def create_app() -> FastAPI:
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        docs_url="/docs" if settings.environment == "development" else None,
        redoc_url=None,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Routers
    from deorch_api.routers import auth, devices, pairing, projects, sessions, approvals, audit, notifications, intelligence, orchestration, workflow, analytics, feedback, billing, integrations
    from deorch_api.websocket import routes as ws_routes

    prefix = "/api/v1"
    app.include_router(auth.router, prefix=prefix)
    app.include_router(devices.router, prefix=prefix)
    app.include_router(pairing.router, prefix=prefix)
    app.include_router(projects.router, prefix=prefix)
    app.include_router(sessions.router, prefix=prefix)
    app.include_router(approvals.router, prefix=prefix)
    app.include_router(audit.router, prefix=prefix)
    app.include_router(notifications.router, prefix=prefix)
    app.include_router(intelligence.router, prefix=prefix)
    app.include_router(orchestration.router, prefix=prefix)
    app.include_router(workflow.router, prefix=prefix)
    app.include_router(analytics.router, prefix=prefix)
    app.include_router(feedback.router, prefix=prefix)
    app.include_router(billing.router, prefix=prefix)
    app.include_router(integrations.router, prefix=prefix)
    app.include_router(ws_routes.router)  # WS routes at root level

    @app.get("/health", tags=["system"])
    async def health() -> dict:
        from deorch_api.database import engine
        try:
            async with engine.connect() as conn:
                await conn.execute(__import__("sqlalchemy").text("SELECT 1"))
            db_status = "ok"
        except Exception:
            db_status = "error"
        return {
            "status": "ok" if db_status == "ok" else "degraded",
            "version": settings.app_version,
            "database": db_status,
            "timestamp": datetime.now(UTC).isoformat(),
        }

    @app.exception_handler(404)
    async def not_found_handler(request: Request, exc: Exception) -> JSONResponse:
        return JSONResponse(status_code=404, content={"detail": "Not found", "code": "not_found"})

    @app.exception_handler(500)
    async def server_error_handler(request: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled_error", path=str(request.url))
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal server error", "code": "internal_error"},
        )

    return app


app = create_app()
