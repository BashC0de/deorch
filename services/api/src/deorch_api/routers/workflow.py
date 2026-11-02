from __future__ import annotations

import uuid
from datetime import UTC, datetime

import structlog
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from deorch_api.database import get_db
from deorch_api.dependencies import get_current_user
from deorch_api.models.orchestration import OrchestrationRun, Task, TaskDependency
from deorch_api.models.workflow import (
    Organization,
    OrganizationMember,
    Workflow,
    WorkflowInstallation,
    WorkflowVersion,
)
from deorch_api.models.user import User
from deorch_api.schemas.orchestration import RunRead
from deorch_api.schemas.workflow import (
    InstallationCreate,
    InstallationRead,
    OrgCreate,
    OrgRead,
    VersionCreate,
    VersionRead,
    WorkflowCreate,
    WorkflowRead,
    WorkflowUpdate,
)

router = APIRouter(prefix="/workflows", tags=["workflows"])
log = structlog.get_logger(__name__)


# ── Workflows ───────────────────────────────────────────────────────────────

@router.post("", response_model=WorkflowRead, status_code=status.HTTP_201_CREATED)
async def create_workflow(
    body: WorkflowCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkflowRead:
    wf = Workflow(
        author_id=user.id,
        name=body.name,
        display_name=body.display_name,
        description=body.description,
        category=body.category,
        tags=body.tags,
        visibility=body.visibility,
    )
    db.add(wf)
    await db.flush()
    log.info("workflow_created", workflow_id=str(wf.id))
    return WorkflowRead.model_validate(wf)


@router.get("", response_model=list[WorkflowRead])
async def list_workflows(
    category: str | None = Query(default=None),
    q: str | None = Query(default=None),
    visibility: str | None = Query(default=None),
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[WorkflowRead]:
    stmt = select(Workflow).where(
        or_(
            Workflow.author_id == user.id,
            Workflow.visibility == "PUBLIC",
        )
    )
    if category:
        stmt = stmt.where(Workflow.category == category)
    if visibility:
        stmt = stmt.where(Workflow.visibility == visibility.upper())
    if q:
        pattern = f"%{q}%"
        stmt = stmt.where(
            or_(
                Workflow.name.ilike(pattern),
                Workflow.display_name.ilike(pattern),
                Workflow.description.ilike(pattern),
            )
        )
    stmt = stmt.order_by(Workflow.created_at.desc())
    result = await db.execute(stmt)
    workflows = result.scalars().all()

    reads = []
    for wf in workflows:
        r = WorkflowRead.model_validate(wf)
        vc = await db.execute(
            select(func.count()).select_from(WorkflowVersion).where(WorkflowVersion.workflow_id == str(wf.id))
        )
        r.version_count = vc.scalar() or 0
        latest = await db.execute(
            select(WorkflowVersion.version_number)
            .where(WorkflowVersion.workflow_id == str(wf.id))
            .order_by(WorkflowVersion.created_at.desc())
            .limit(1)
        )
        lv = latest.scalar_one_or_none()
        r.latest_version = lv
        reads.append(r)
    return reads


@router.get("/{workflow_id}", response_model=WorkflowRead)
async def get_workflow(
    workflow_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkflowRead:
    wf = await db.get(Workflow, workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if wf.visibility == "PRIVATE" and wf.author_id != str(user.id):
        raise HTTPException(status_code=404, detail="Workflow not found")
    r = WorkflowRead.model_validate(wf)
    vc = await db.execute(
        select(func.count()).select_from(WorkflowVersion).where(WorkflowVersion.workflow_id == str(wf.id))
    )
    r.version_count = vc.scalar() or 0
    return r


@router.patch("/{workflow_id}", response_model=WorkflowRead)
async def update_workflow(
    workflow_id: uuid.UUID,
    body: WorkflowUpdate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> WorkflowRead:
    wf = await db.get(Workflow, workflow_id)
    if not wf or wf.author_id != str(user.id):
        raise HTTPException(status_code=404, detail="Workflow not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(wf, field, value)
    return WorkflowRead.model_validate(wf)


# ── Versions ────────────────────────────────────────────────────────────────

@router.post("/{workflow_id}/versions", response_model=VersionRead, status_code=status.HTTP_201_CREATED)
async def create_version(
    workflow_id: uuid.UUID,
    body: VersionCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> VersionRead:
    wf = await db.get(Workflow, workflow_id)
    if not wf or wf.author_id != str(user.id):
        raise HTTPException(status_code=404, detail="Workflow not found")

    definition_dict = body.definition.model_dump()
    checksum = WorkflowVersion.compute_checksum(definition_dict)

    version = WorkflowVersion(
        workflow_id=str(workflow_id),
        version_number=body.version_number,
        definition=definition_dict,
        checksum=checksum,
        changelog=body.changelog,
        required_capabilities=body.required_capabilities,
        published_at=datetime.now(UTC),
    )
    db.add(version)
    await db.flush()

    wf.status = "PUBLISHED"
    log.info("workflow_version_created", workflow_id=str(workflow_id), version=body.version_number)
    return VersionRead.model_validate(version)


@router.get("/{workflow_id}/versions", response_model=list[VersionRead])
async def list_versions(
    workflow_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[VersionRead]:
    wf = await db.get(Workflow, workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if wf.visibility == "PRIVATE" and wf.author_id != str(user.id):
        raise HTTPException(status_code=404, detail="Workflow not found")

    result = await db.execute(
        select(WorkflowVersion)
        .where(WorkflowVersion.workflow_id == str(workflow_id))
        .order_by(WorkflowVersion.created_at.desc())
    )
    return [VersionRead.model_validate(v) for v in result.scalars().all()]


# ── Installations ───────────────────────────────────────────────────────────

@router.post("/installations", response_model=InstallationRead, status_code=status.HTTP_201_CREATED)
async def install_workflow(
    body: InstallationCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> InstallationRead:
    version = await db.get(WorkflowVersion, body.workflow_version_id)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    # Verify version belongs to the specified workflow
    if version.workflow_id != str(body.workflow_id):
        raise HTTPException(status_code=400, detail="Version does not belong to the specified workflow")
    wf = await db.get(Workflow, version.workflow_id)
    if not wf:
        raise HTTPException(status_code=404, detail="Workflow not found")
    if wf.visibility == "PRIVATE" and wf.author_id != str(user.id):
        raise HTTPException(status_code=403, detail="Cannot install private workflow")

    install = WorkflowInstallation(
        workflow_id=str(body.workflow_id),
        workflow_version_id=str(body.workflow_version_id),
        user_id=user.id,
        project_id=body.project_id,
        config_overrides=body.config_overrides,
    )
    db.add(install)
    await db.flush()
    log.info("workflow_installed", workflow_id=str(body.workflow_id), version=version.version_number)
    return InstallationRead.model_validate(install)


@router.get("/installations", response_model=list[InstallationRead])
async def list_installations(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[InstallationRead]:
    result = await db.execute(
        select(WorkflowInstallation)
        .where(WorkflowInstallation.user_id == user.id)
        .order_by(WorkflowInstallation.created_at.desc())
    )
    return [InstallationRead.model_validate(i) for i in result.scalars().all()]


@router.delete("/installations/{installation_id}")
async def uninstall_workflow(
    installation_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    install = await db.get(WorkflowInstallation, installation_id)
    if not install or install.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="Installation not found")
    await db.delete(install)
    return {"message": "Workflow uninstalled"}


# ── Execution Bridge ────────────────────────────────────────────────────────

@router.post("/installations/{installation_id}/execute", response_model=RunRead, status_code=status.HTTP_201_CREATED)
async def execute_workflow(
    installation_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> RunRead:
    """Create an OrchestrationRun from an installed workflow version."""
    install = await db.get(WorkflowInstallation, installation_id)
    if not install or install.user_id != str(user.id):
        raise HTTPException(status_code=404, detail="Installation not found")

    version = await db.get(WorkflowVersion, install.workflow_version_id)
    if not version:
        raise HTTPException(status_code=400, detail="Workflow version not found")

    wf = await db.get(Workflow, install.workflow_id)
    if not wf:
        raise HTTPException(status_code=400, detail="Workflow not found")

    definition = version.definition
    constraints = definition.get("constraints", {})

    # Create the orchestration run
    run = OrchestrationRun(
        user_id=user.id,
        project_id=install.project_id,
        workflow_version_id=str(version.id),
        objective=f"Execute workflow: {wf.display_name}",
        description=wf.description,
        execution_mode=constraints.get("executionMode", "sequential"),
        max_concurrent_tasks=constraints.get("maxConcurrentTasks", 3),
        config=install.config_overrides,
    )
    db.add(run)
    await db.flush()

    # Create tasks from definition
    task_id_map: dict[str, str] = {}  # definition task id → DB task id
    for task_def in definition.get("tasks", []):
        task = Task(
            run_id=str(run.id),
            title=task_def["title"],
            description=task_def.get("description"),
            task_type=task_def.get("task_type", "general"),
            priority=task_def.get("priority", 0),
            assigned_provider=task_def.get("preferred_provider"),
            max_retries=task_def.get("max_retries", 2),
            estimated_complexity=task_def.get("estimated_complexity"),
        )
        db.add(task)
        await db.flush()
        task_id_map[task_def["id"]] = str(task.id)

    # Create dependencies
    for dep_def in definition.get("dependencies", []):
        source_id = task_id_map.get(dep_def["source"])
        dependent_id = task_id_map.get(dep_def["dependent"])
        if source_id and dependent_id:
            dep = TaskDependency(
                source_task_id=source_id,
                dependent_task_id=dependent_id,
                dependency_type=dep_def.get("type", "FINISH_TO_START"),
            )
            db.add(dep)

    await db.flush()
    log.info("workflow_executed", workflow_id=str(wf.id), run_id=str(run.id))

    r = RunRead.model_validate(run)
    r.task_count = len(task_id_map)
    return r


# ── Organizations ───────────────────────────────────────────────────────────

@router.post("/orgs", response_model=OrgRead, status_code=status.HTTP_201_CREATED)
async def create_org(
    body: OrgCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> OrgRead:
    org = Organization(
        name=body.name,
        display_name=body.display_name,
        owner_id=user.id,
    )
    db.add(org)
    await db.flush()

    # Add owner as admin member
    member = OrganizationMember(
        organization_id=str(org.id),
        user_id=user.id,
        role="admin",
    )
    db.add(member)
    return OrgRead.model_validate(org)


@router.get("/orgs", response_model=list[OrgRead])
async def list_orgs(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[OrgRead]:
    result = await db.execute(
        select(Organization)
        .join(OrganizationMember, Organization.id == OrganizationMember.organization_id)
        .where(OrganizationMember.user_id == user.id)
    )
    return [OrgRead.model_validate(o) for o in result.scalars().all()]
