"""DAG validation and task scheduling engine."""
from __future__ import annotations

from collections import defaultdict
from datetime import UTC, datetime

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from deorch_api.models.orchestration import Task, TaskDependency


async def validate_dag(run_id: str, db: AsyncSession) -> list[str]:
    """Validate the task DAG for a run. Returns list of errors (empty = valid)."""
    errors: list[str] = []

    result = await db.execute(
        select(TaskDependency)
        .join(Task, TaskDependency.source_task_id == Task.id)
        .where(Task.run_id == run_id)
    )
    deps = result.scalars().all()

    # Build adjacency list
    graph: dict[str, list[str]] = defaultdict(list)
    for dep in deps:
        graph[dep.source_task_id].append(dep.dependent_task_id)

    # Cycle detection via DFS
    visited: set[str] = set()
    in_stack: set[str] = set()

    def has_cycle(node: str) -> bool:
        if node in in_stack:
            return True
        if node in visited:
            return False
        visited.add(node)
        in_stack.add(node)
        for neighbor in graph.get(node, []):
            if has_cycle(neighbor):
                return True
        in_stack.discard(node)
        return False

    all_nodes = set(graph.keys())
    for dep in deps:
        all_nodes.add(dep.dependent_task_id)

    for node in all_nodes:
        if has_cycle(node):
            errors.append(f"Dependency cycle detected involving task {node}")
            break

    # Self-dependency check
    for dep in deps:
        if dep.source_task_id == dep.dependent_task_id:
            errors.append(f"Task {dep.source_task_id} depends on itself")

    return errors


async def get_ready_tasks(run_id: str, db: AsyncSession) -> list[Task]:
    """Get tasks that are CREATED/BLOCKED but have all dependencies satisfied."""
    # Get all tasks in this run
    tasks_result = await db.execute(
        select(Task).where(Task.run_id == run_id).where(Task.status.in_(["CREATED", "BLOCKED", "READY"]))
    )
    candidate_tasks = tasks_result.scalars().all()

    ready = []
    for task in candidate_tasks:
        # Check all dependencies for this task
        deps_result = await db.execute(
            select(TaskDependency).where(TaskDependency.dependent_task_id == task.id)
        )
        deps = deps_result.scalars().all()

        if not deps:
            ready.append(task)
            continue

        # Check if all source tasks are COMPLETED
        all_satisfied = True
        for dep in deps:
            source_task = await db.get(Task, dep.source_task_id)
            if not source_task or source_task.status != "COMPLETED":
                all_satisfied = False
                break

        if all_satisfied:
            ready.append(task)

    return ready


async def propagate_completion(task_id: str, db: AsyncSession) -> list[str]:
    """After a task completes, mark its dependencies as satisfied and return newly ready task IDs."""
    now = datetime.now(UTC)

    # Find all dependencies where this task is the source
    deps_result = await db.execute(
        select(TaskDependency).where(TaskDependency.source_task_id == task_id)
    )
    deps = deps_result.scalars().all()

    newly_ready: list[str] = []
    for dep in deps:
        dep.status = "SATISFIED"
        dep.satisfied_at = now

        # Check if the dependent task is now fully unblocked
        dependent = await db.get(Task, dep.dependent_task_id)
        if dependent and dependent.status in ("CREATED", "BLOCKED"):
            all_deps = await db.execute(
                select(TaskDependency).where(TaskDependency.dependent_task_id == dep.dependent_task_id)
            )
            all_satisfied = all(d.status == "SATISFIED" for d in all_deps.scalars().all())
            if all_satisfied:
                dependent.status = "READY"
                newly_ready.append(dep.dependent_task_id)

    return newly_ready


async def propagate_failure(task_id: str, db: AsyncSession) -> list[str]:
    """After a task fails, mark dependent tasks as BLOCKED. Returns blocked task IDs."""
    deps_result = await db.execute(
        select(TaskDependency).where(TaskDependency.source_task_id == task_id)
    )
    deps = deps_result.scalars().all()

    blocked: list[str] = []
    for dep in deps:
        dep.status = "FAILED"
        dependent = await db.get(Task, dep.dependent_task_id)
        if dependent and dependent.status in ("CREATED", "READY", "BLOCKED"):
            dependent.status = "BLOCKED"
            blocked.append(dep.dependent_task_id)
            # Propagate recursively
            sub_blocked = await propagate_failure(dep.dependent_task_id, db)
            blocked.extend(sub_blocked)

    return blocked
