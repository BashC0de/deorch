from __future__ import annotations

import uuid
from datetime import UTC, datetime

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from deorch_api.database import get_db
from deorch_api.dependencies import get_current_user
from deorch_api.models.orchestration import OrchestrationRun, Task, TaskArtifact, TaskDependency
from deorch_api.models.user import User
from deorch_api.schemas.orchestration import (
    DependencyCreate,
    DependencyRead,
    RunCreate,
    RunGraphRead,
    RunRead,
    RunUpdate,
    TaskCreate,
    TaskRead,
    TaskUpdate,
)
from deorch_api.services.dag import get_ready_tasks, propagate_completion, propagate_failure, validate_dag
from deorch_api.websocket.manager import connection_manager
from deorch_api.websocket.messages import _envelope

router = APIRouter(prefix="/orchestration", tags=["orchestration"])
log = structlog.get_logger(__name__)


# ── Runs ────────────────────────────────────────────────────────────────────

@router.post("/runs", response_model=RunRead, status_code=status.HTTP_201_CREATED)
async def create_run(
    body: RunCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RunRead:
    run = OrchestrationRun(
        user_id=user.id,
        project_id=body.project_id,
        objective=body.objective,
        description=body.description,
        execution_mode=body.execution_mode,
        max_concurrent_tasks=body.max_concurrent_tasks,
        config=body.config,
        budget_config=body.budget_config,
    )
    db.add(run)
    await db.flush()
    log.info("orchestration_run_created", run_id=str(run.id))

    result = RunRead.model_validate(run)
    result.task_count = 0

    await connection_manager.send_to_user(
        str(user.id),
        _envelope("run_updated", {"run_id": str(run.id), "status": "CREATED"}),
    )
    return result


@router.get("/runs", response_model=list[RunRead])
async def list_runs(
    status_filter: str | None = Query(default=None, alias="status"),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[RunRead]:
    stmt = select(OrchestrationRun).where(OrchestrationRun.user_id == user.id)
    if status_filter:
        stmt = stmt.where(OrchestrationRun.status == status_filter.upper())
    stmt = stmt.order_by(OrchestrationRun.created_at.desc())
    result = await db.execute(stmt)
    runs = result.scalars().all()

    reads = []
    for run in runs:
        r = RunRead.model_validate(run)
        count = await db.execute(
            select(func.count()).select_from(Task).where(Task.run_id == str(run.id))
        )
        r.task_count = count.scalar() or 0
        reads.append(r)
    return reads


@router.get("/runs/{run_id}", response_model=RunRead)
async def get_run(
    run_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RunRead:
    run = await db.get(OrchestrationRun, run_id)
    if not run or run.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="Run not found")
    r = RunRead.model_validate(run)
    count = await db.execute(
        select(func.count()).select_from(Task).where(Task.run_id == str(run.id))
    )
    r.task_count = count.scalar() or 0
    return r


@router.patch("/runs/{run_id}", response_model=RunRead)
async def update_run(
    run_id: uuid.UUID,
    body: RunUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RunRead:
    run = await db.get(OrchestrationRun, run_id)
    if not run or run.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="Run not found")

    if body.status:
        run.status = body.status
        if body.status == "RUNNING" and not run.started_at:
            run.started_at = datetime.now(UTC)
        if body.status in ("COMPLETED", "FAILED", "CANCELLED"):
            run.completed_at = datetime.now(UTC)
    if body.description is not None:
        run.description = body.description
    if body.max_concurrent_tasks is not None:
        run.max_concurrent_tasks = body.max_concurrent_tasks

    await connection_manager.send_to_user(
        str(user.id),
        _envelope("run_updated", {"run_id": str(run_id), "status": run.status}),
    )
    r = RunRead.model_validate(run)
    return r


@router.post("/runs/{run_id}/start")
async def start_run(
    run_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    run = await db.get(OrchestrationRun, run_id)
    if not run or run.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status not in ("CREATED", "READY", "PAUSED"):
        raise HTTPException(status_code=400, detail=f"Cannot start run in {run.status} state")

    # Validate DAG
    errors = await validate_dag(str(run_id), db)
    if errors:
        raise HTTPException(status_code=400, detail=f"Invalid task graph: {'; '.join(errors)}")

    # Initialize task statuses
    ready = await get_ready_tasks(str(run_id), db)
    for task in ready:
        task.status = "READY"

    run.status = "RUNNING"
    run.started_at = datetime.now(UTC)

    await connection_manager.send_to_user(
        str(user.id),
        _envelope("run_updated", {"run_id": str(run_id), "status": "RUNNING"}),
    )
    return {"message": "Run started", "ready_tasks": len(ready)}


# ── Tasks ───────────────────────────────────────────────────────────────────

@router.post("/runs/{run_id}/tasks", response_model=TaskRead, status_code=status.HTTP_201_CREATED)
async def create_task(
    run_id: uuid.UUID,
    body: TaskCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskRead:
    run = await db.get(OrchestrationRun, run_id)
    if not run or run.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="Run not found")
    if run.status not in ("CREATED", "PLANNING", "READY"):
        raise HTTPException(status_code=400, detail="Cannot add tasks to a running or completed run")

    task = Task(
        run_id=str(run_id),
        title=body.title,
        description=body.description,
        task_type=body.task_type,
        priority=body.priority,
        assigned_provider=body.assigned_provider,
        workspace_path=body.workspace_path,
        max_retries=body.max_retries,
        estimated_complexity=body.estimated_complexity,
    )
    db.add(task)
    await db.flush()
    return TaskRead.model_validate(task)


@router.get("/runs/{run_id}/tasks", response_model=list[TaskRead])
async def list_tasks(
    run_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[TaskRead]:
    run = await db.get(OrchestrationRun, run_id)
    if not run or run.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="Run not found")

    result = await db.execute(
        select(Task).where(Task.run_id == str(run_id)).order_by(Task.priority, Task.created_at)
    )
    return [TaskRead.model_validate(t) for t in result.scalars().all()]


@router.patch("/tasks/{task_id}", response_model=TaskRead)
async def update_task(
    task_id: uuid.UUID,
    body: TaskUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> TaskRead:
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    run = await db.get(OrchestrationRun, task.run_id)
    if not run or run.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="Task not found")

    now = datetime.now(UTC)
    if body.status:
        old_status = task.status
        task.status = body.status
        if body.status == "RUNNING" and not task.started_at:
            task.started_at = now
        if body.status in ("COMPLETED", "FAILED", "CANCELLED"):
            task.completed_at = now
        # Propagate completion/failure through DAG
        if body.status == "COMPLETED":
            await propagate_completion(str(task_id), db)
        elif body.status == "FAILED":
            await propagate_failure(str(task_id), db)
    if body.assigned_provider is not None:
        task.assigned_provider = body.assigned_provider
    if body.result is not None:
        task.result = body.result
    if body.failure_reason is not None:
        task.failure_reason = body.failure_reason
    if body.validation_status is not None:
        task.validation_status = body.validation_status
    if body.validation_evidence is not None:
        task.validation_evidence = body.validation_evidence

    await connection_manager.send_to_user(
        str(run.user_id),
        _envelope("task_updated", {
            "run_id": task.run_id,
            "task_id": str(task_id),
            "status": task.status,
            "title": task.title,
        }),
    )
    return TaskRead.model_validate(task)


@router.post("/tasks/{task_id}/retry")
async def retry_task(
    task_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    task = await db.get(Task, task_id)
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    run = await db.get(OrchestrationRun, task.run_id)
    if not run or run.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="Task not found")
    if task.status != "FAILED":
        raise HTTPException(status_code=400, detail="Only failed tasks can be retried")
    if task.retry_count >= task.max_retries:
        raise HTTPException(status_code=400, detail="Maximum retries exceeded")

    task.status = "READY"
    task.retry_count += 1
    task.failure_reason = None
    task.result = None
    task.started_at = None
    task.completed_at = None
    return {"message": "Task queued for retry", "retry_count": task.retry_count}


# ── Dependencies ────────────────────────────────────────────────────────────

@router.post("/runs/{run_id}/dependencies", response_model=DependencyRead, status_code=status.HTTP_201_CREATED)
async def add_dependency(
    run_id: uuid.UUID,
    body: DependencyCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> DependencyRead:
    run = await db.get(OrchestrationRun, run_id)
    if not run or run.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="Run not found")

    # Verify both tasks belong to this run
    source = await db.get(Task, body.source_task_id)
    dependent = await db.get(Task, body.dependent_task_id)
    if not source or source.run_id != str(run_id):
        raise HTTPException(status_code=400, detail="Source task not in this run")
    if not dependent or dependent.run_id != str(run_id):
        raise HTTPException(status_code=400, detail="Dependent task not in this run")
    if str(body.source_task_id) == str(body.dependent_task_id):
        raise HTTPException(status_code=400, detail="Task cannot depend on itself")

    dep = TaskDependency(
        source_task_id=str(body.source_task_id),
        dependent_task_id=str(body.dependent_task_id),
        dependency_type=body.dependency_type,
    )
    db.add(dep)
    await db.flush()

    # Validate no cycles
    errors = await validate_dag(str(run_id), db)
    if errors:
        await db.rollback()
        raise HTTPException(status_code=400, detail=f"Adding this dependency creates a cycle")

    return DependencyRead.model_validate(dep)


@router.get("/runs/{run_id}/graph", response_model=RunGraphRead)
async def get_run_graph(
    run_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RunGraphRead:
    run = await db.get(OrchestrationRun, run_id)
    if not run or run.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="Run not found")

    tasks_result = await db.execute(
        select(Task).where(Task.run_id == str(run_id)).order_by(Task.priority)
    )
    tasks = [TaskRead.model_validate(t) for t in tasks_result.scalars().all()]

    deps_result = await db.execute(
        select(TaskDependency)
        .join(Task, TaskDependency.source_task_id == Task.id)
        .where(Task.run_id == str(run_id))
    )
    deps = [DependencyRead.model_validate(d) for d in deps_result.scalars().all()]

    run_read = RunRead.model_validate(run)
    run_read.task_count = len(tasks)

    return RunGraphRead(run=run_read, tasks=tasks, dependencies=deps)
