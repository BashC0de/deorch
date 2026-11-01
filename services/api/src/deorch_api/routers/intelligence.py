from __future__ import annotations

import uuid
from datetime import UTC, datetime

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from deorch_api.database import get_db
from deorch_api.dependencies import get_current_device, get_current_user
from deorch_api.models.device import Device
from deorch_api.models.intelligence import (
    BuildResult,
    GitSnapshot,
    ServiceHealthCheck,
    ServiceRegistration,
    TestRun,
)
from deorch_api.models.project import Project
from deorch_api.models.user import User
from deorch_api.schemas.intelligence import (
    BuildResultCreate,
    BuildResultRead,
    GitSnapshotCreate,
    GitSnapshotRead,
    HealthCheckCreate,
    HealthCheckRead,
    ProjectHealthRead,
    ServiceCreate,
    ServiceRead,
    TestRunCreate,
    TestRunRead,
)
from deorch_api.websocket.manager import connection_manager
from deorch_api.websocket.messages import _envelope

router = APIRouter(tags=["intelligence"])
log = structlog.get_logger(__name__)


# ── Services ────────────────────────────────────────────────────────────────

@router.post("/services", response_model=ServiceRead, status_code=status.HTTP_201_CREATED)
async def register_service(
    body: ServiceCreate,
    device: Device = Depends(get_current_device),
    db: AsyncSession = Depends(get_db),
) -> ServiceRead:
    svc = ServiceRegistration(
        device_id=device.id,
        project_id=body.project_id,
        name=body.name,
        service_type=body.service_type,
        host=body.host,
        port=body.port,
        health_path=body.health_path,
        expected_status=body.expected_status,
        interval_seconds=body.interval_seconds,
    )
    db.add(svc)
    await db.flush()
    log.info("service_registered", service_id=str(svc.id), name=body.name)
    return ServiceRead.model_validate(svc)


@router.get("/services", response_model=list[ServiceRead])
async def list_services(
    device_id: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ServiceRead]:
    stmt = (
        select(ServiceRegistration)
        .join(Device, ServiceRegistration.device_id == Device.id)
        .where(Device.user_id == user.id)
        .where(ServiceRegistration.is_active.is_(True))
    )
    if device_id:
        stmt = stmt.where(ServiceRegistration.device_id == device_id)
    result = await db.execute(stmt.order_by(ServiceRegistration.created_at.desc()))
    return [ServiceRead.model_validate(s) for s in result.scalars().all()]


@router.delete("/services/{service_id}", status_code=status.HTTP_200_OK)
async def remove_service(
    service_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    svc = await db.get(ServiceRegistration, service_id)
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")
    device = await db.get(Device, svc.device_id)
    if not device or device.user_id != user.id:
        raise HTTPException(status_code=404, detail="Service not found")
    svc.is_active = False
    return {"message": "Service removed"}


@router.post("/services/{service_id}/health", response_model=HealthCheckRead, status_code=status.HTTP_201_CREATED)
async def submit_health_check(
    service_id: uuid.UUID,
    body: HealthCheckCreate,
    device: Device = Depends(get_current_device),
    db: AsyncSession = Depends(get_db),
) -> HealthCheckRead:
    svc = await db.get(ServiceRegistration, service_id)
    if not svc or svc.device_id != str(device.id):
        raise HTTPException(status_code=404, detail="Service not found")

    check = ServiceHealthCheck(
        service_id=str(service_id),
        status=body.status,
        response_ms=body.response_ms,
        status_code=body.status_code,
        error=body.error,
        checked_at=datetime.now(UTC),
    )
    db.add(check)
    svc.status = body.status
    await db.flush()

    # Notify dashboard
    await connection_manager.send_to_user(
        str(device.user_id),
        _envelope("service_health_changed", {
            "service_id": str(service_id),
            "service_name": svc.name,
            "status": body.status,
            "response_ms": body.response_ms,
        }),
    )

    return HealthCheckRead.model_validate(check)


@router.get("/services/{service_id}/health", response_model=list[HealthCheckRead])
async def get_health_history(
    service_id: uuid.UUID,
    limit: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[HealthCheckRead]:
    svc = await db.get(ServiceRegistration, service_id)
    if not svc:
        raise HTTPException(status_code=404, detail="Service not found")
    device = await db.get(Device, svc.device_id)
    if not device or device.user_id != user.id:
        raise HTTPException(status_code=404, detail="Service not found")

    result = await db.execute(
        select(ServiceHealthCheck)
        .where(ServiceHealthCheck.service_id == str(service_id))
        .order_by(ServiceHealthCheck.checked_at.desc())
        .limit(limit)
    )
    return [HealthCheckRead.model_validate(c) for c in result.scalars().all()]


# ── Test Runs ───────────────────────────────────────────────────────────────

@router.post("/test-runs", response_model=TestRunRead, status_code=status.HTTP_201_CREATED)
async def submit_test_run(
    body: TestRunCreate,
    device: Device = Depends(get_current_device),
    db: AsyncSession = Depends(get_db),
) -> TestRunRead:
    run = TestRun(
        device_id=device.id,
        project_id=body.project_id,
        session_id=body.session_id,
        framework=body.framework,
        total_tests=body.total_tests,
        passed=body.passed,
        failed=body.failed,
        skipped=body.skipped,
        duration_ms=body.duration_ms,
        status=body.status,
        failures=body.failures,
        error_output=body.error_output,
    )
    db.add(run)
    await db.flush()

    await connection_manager.send_to_user(
        str(device.user_id),
        _envelope("test_run_completed", {
            "test_run_id": str(run.id),
            "framework": body.framework,
            "total": body.total_tests,
            "passed": body.passed,
            "failed": body.failed,
            "status": body.status,
        }),
    )

    return TestRunRead.model_validate(run)


@router.get("/test-runs", response_model=list[TestRunRead])
async def list_test_runs(
    project_id: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TestRunRead]:
    stmt = (
        select(TestRun)
        .join(Device, TestRun.device_id == Device.id)
        .where(Device.user_id == user.id)
    )
    if project_id:
        stmt = stmt.where(TestRun.project_id == project_id)
    result = await db.execute(stmt.order_by(TestRun.created_at.desc()).limit(limit))
    return [TestRunRead.model_validate(r) for r in result.scalars().all()]


@router.get("/test-runs/{run_id}", response_model=TestRunRead)
async def get_test_run(
    run_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TestRunRead:
    run = await db.get(TestRun, run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Test run not found")
    device = await db.get(Device, run.device_id)
    if not device or device.user_id != user.id:
        raise HTTPException(status_code=404, detail="Test run not found")
    return TestRunRead.model_validate(run)


# ── Git Snapshots ───────────────────────────────────────────────────────────

@router.post("/git-snapshots", response_model=GitSnapshotRead, status_code=status.HTTP_201_CREATED)
async def submit_git_snapshot(
    body: GitSnapshotCreate,
    device: Device = Depends(get_current_device),
    db: AsyncSession = Depends(get_db),
) -> GitSnapshotRead:
    snap = GitSnapshot(
        device_id=device.id,
        project_id=body.project_id,
        branch=body.branch,
        commit_hash=body.commit_hash,
        modified_files=body.modified_files,
        added_files=body.added_files,
        deleted_files=body.deleted_files,
        untracked_files=body.untracked_files,
        diff_stats=body.diff_stats,
        created_at=datetime.now(UTC),
    )
    db.add(snap)
    await db.flush()

    total_changed = len(body.modified_files) + len(body.added_files) + len(body.deleted_files)
    await connection_manager.send_to_user(
        str(device.user_id),
        _envelope("git_snapshot_updated", {
            "project_id": str(body.project_id) if body.project_id else None,
            "branch": body.branch,
            "changed_files": total_changed,
        }),
    )

    return GitSnapshotRead.model_validate(snap)


@router.get("/git-snapshots", response_model=list[GitSnapshotRead])
async def list_git_snapshots(
    project_id: str | None = Query(default=None),
    limit: int = Query(default=10, ge=1, le=50),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[GitSnapshotRead]:
    stmt = (
        select(GitSnapshot)
        .join(Device, GitSnapshot.device_id == Device.id)
        .where(Device.user_id == user.id)
    )
    if project_id:
        stmt = stmt.where(GitSnapshot.project_id == project_id)
    result = await db.execute(stmt.order_by(GitSnapshot.created_at.desc()).limit(limit))
    return [GitSnapshotRead.model_validate(s) for s in result.scalars().all()]


# ── Build Results ───────────────────────────────────────────────────────────

@router.post("/build-results", response_model=BuildResultRead, status_code=status.HTTP_201_CREATED)
async def submit_build_result(
    body: BuildResultCreate,
    device: Device = Depends(get_current_device),
    db: AsyncSession = Depends(get_db),
) -> BuildResultRead:
    build = BuildResult(
        device_id=device.id,
        project_id=body.project_id,
        session_id=body.session_id,
        build_type=body.build_type,
        command=body.command,
        exit_code=body.exit_code,
        status=body.status,
        error_output=body.error_output,
        duration_ms=body.duration_ms,
    )
    db.add(build)
    await db.flush()

    await connection_manager.send_to_user(
        str(device.user_id),
        _envelope("build_completed", {
            "build_id": str(build.id),
            "build_type": body.build_type,
            "status": body.status,
            "exit_code": body.exit_code,
        }),
    )

    return BuildResultRead.model_validate(build)


@router.get("/build-results", response_model=list[BuildResultRead])
async def list_build_results(
    project_id: str | None = Query(default=None),
    limit: int = Query(default=20, ge=1, le=100),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[BuildResultRead]:
    stmt = (
        select(BuildResult)
        .join(Device, BuildResult.device_id == Device.id)
        .where(Device.user_id == user.id)
    )
    if project_id:
        stmt = stmt.where(BuildResult.project_id == project_id)
    result = await db.execute(stmt.order_by(BuildResult.created_at.desc()).limit(limit))
    return [BuildResultRead.model_validate(b) for b in result.scalars().all()]


# ── Project Health ──────────────────────────────────────────────────────────

@router.get("/projects/{project_id}/health", response_model=ProjectHealthRead)
async def get_project_health(
    project_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ProjectHealthRead:
    project = await db.get(Project, project_id)
    if not project or project.user_id != user.id:
        raise HTTPException(status_code=404, detail="Project not found")

    # Services
    svcs = await db.execute(
        select(ServiceRegistration)
        .where(ServiceRegistration.project_id == str(project_id))
        .where(ServiceRegistration.is_active.is_(True))
    )
    services = [ServiceRead.model_validate(s) for s in svcs.scalars().all()]

    # Latest test run
    test_result = await db.execute(
        select(TestRun)
        .where(TestRun.project_id == str(project_id))
        .order_by(TestRun.created_at.desc())
        .limit(1)
    )
    latest_test = test_result.scalar_one_or_none()

    # Latest build
    build_result = await db.execute(
        select(BuildResult)
        .where(BuildResult.project_id == str(project_id))
        .order_by(BuildResult.created_at.desc())
        .limit(1)
    )
    latest_build = build_result.scalar_one_or_none()

    # Latest git snapshot
    git_result = await db.execute(
        select(GitSnapshot)
        .where(GitSnapshot.project_id == str(project_id))
        .order_by(GitSnapshot.created_at.desc())
        .limit(1)
    )
    latest_git = git_result.scalar_one_or_none()

    return ProjectHealthRead(
        project_id=project.id,
        project_name=project.name,
        services=services,
        latest_test_run=TestRunRead.model_validate(latest_test) if latest_test else None,
        latest_build=BuildResultRead.model_validate(latest_build) if latest_build else None,
        latest_git=GitSnapshotRead.model_validate(latest_git) if latest_git else None,
    )
