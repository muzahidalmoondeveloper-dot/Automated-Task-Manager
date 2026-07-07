from fastapi import APIRouter, Depends
from fastapi import status as http_status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_errors import AppException, ErrorDef
from app.core.database import get_db
from app.core.tenant import TenantContext, get_tenant_context, require_org_admin, require_org_manager
from app.models.issue import Issue
from app.models.kpi import KPI
from app.models.rock import Rock
from app.repositories.project_repository import ProjectRepository
from app.schemas.issue import IssueOut
from app.schemas.kpi import KPIOut
from app.schemas.project import ProjectCreate, ProjectRead, ProjectUpdate
from app.schemas.rock import RockOut

router = APIRouter(prefix="/projects", tags=["Projects"])

_NOT_FOUND = ErrorDef(code="PROJECT_NOT_FOUND", status=http_status.HTTP_404_NOT_FOUND, message="Project not found.")
_PLAN_LIMIT = ErrorDef(code="PLAN_LIMIT_EXCEEDED", status=http_status.HTTP_402_PAYMENT_REQUIRED, message="Your plan's project limit has been reached.")


@router.get("", response_model=list[ProjectRead])
async def list_projects(tenant: TenantContext = Depends(get_tenant_context)):
    repo = ProjectRepository(tenant.db, tenant.organization_id)
    return [ProjectRead.model_validate(p) for p in await repo.list_all()]


@router.post("", response_model=ProjectRead, status_code=http_status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    tenant: TenantContext = Depends(require_org_manager),
):
    limits = tenant.plan_limits
    if limits.max_projects != -1:
        repo_check = ProjectRepository(tenant.db, tenant.organization_id)
        projects = await repo_check.list_all()
        if len(projects) >= limits.max_projects:
            raise AppException(_PLAN_LIMIT, details={"limit": limits.max_projects})

    repo = ProjectRepository(tenant.db, tenant.organization_id)
    project = await repo.create(payload, created_by_id=tenant.user.id)
    return ProjectRead.model_validate(project)


@router.get("/{project_id}", response_model=ProjectRead)
async def get_project(project_id: int, tenant: TenantContext = Depends(get_tenant_context)):
    repo = ProjectRepository(tenant.db, tenant.organization_id)
    project = await repo.get_by_id(project_id)
    if project is None:
        raise AppException(_NOT_FOUND)
    return ProjectRead.model_validate(project)


@router.patch("/{project_id}", response_model=ProjectRead)
async def update_project(
    project_id: int,
    payload: ProjectUpdate,
    tenant: TenantContext = Depends(require_org_manager),
):
    repo = ProjectRepository(tenant.db, tenant.organization_id)
    project = await repo.get_by_id(project_id)
    if project is None:
        raise AppException(_NOT_FOUND)
    updated = await repo.update(project, payload)
    return ProjectRead.model_validate(updated)


@router.delete("/{project_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: int,
    tenant: TenantContext = Depends(require_org_manager),
):
    repo = ProjectRepository(tenant.db, tenant.organization_id)
    project = await repo.get_by_id(project_id)
    if project is None:
        raise AppException(_NOT_FOUND)
    await repo.delete(project)
    return None


@router.get("/{project_id}/items")
async def get_project_items(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    repo = ProjectRepository(db, tenant.organization_id)
    project = await repo.get_by_id(project_id)
    if project is None:
        raise AppException(_NOT_FOUND)

    org_id = tenant.organization_id

    rocks_result = await db.execute(
        select(Rock)
        .where(Rock.project_id == project_id, Rock.organization_id == org_id)
        .order_by(Rock.created_at.desc())
    )
    rocks = rocks_result.scalars().all()

    kpis_result = await db.execute(
        select(KPI)
        .where(KPI.project_id == project_id, KPI.organization_id == org_id)
        .order_by(KPI.created_at.desc())
    )
    kpis = kpis_result.scalars().all()

    issues_result = await db.execute(
        select(Issue)
        .where(Issue.project_id == project_id, Issue.organization_id == org_id)
        .order_by(Issue.priority.desc(), Issue.created_at.desc())
    )
    issues = issues_result.scalars().all()

    return {
        "rocks": [RockOut.model_validate(r) for r in rocks],
        "kpis": [KPIOut.model_validate(k) for k in kpis],
        "issues": [IssueOut.model_validate(i) for i in issues],
    }
