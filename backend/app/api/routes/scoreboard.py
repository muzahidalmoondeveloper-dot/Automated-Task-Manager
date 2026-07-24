from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi import status as http_status

from app.core.auth_errors import AppException, ErrorDef
from app.core.tenant import TenantContext, get_tenant_context
from app.repositories.project_repository import ProjectRepository
from app.repositories.task_repository import TaskRepository
from app.repositories.team_repository import TeamRepository
from app.repositories.user_repository import UserRepository
from app.schemas.scoreboard import (
    ScoreboardEmployee,
    ScoreboardResponse,
    ScoreboardSummary,
    ScoreboardTaskItem,
    ScoreBreakdown,
    ScoreHistoryPoint,
)
from app.services import scoreboard_service as scoring

router = APIRouter(prefix="/users/{user_id}/scoreboard", tags=["Scoreboard"])

_USER_NOT_FOUND = ErrorDef(code="USER_NOT_FOUND", status=http_status.HTTP_404_NOT_FOUND, message="User not found.")
_FORBIDDEN = ErrorDef(code="SCOREBOARD_FORBIDDEN", status=http_status.HTTP_403_FORBIDDEN, message="You do not have permission to view this employee's scoreboard.")
_INVALID_PERIOD = ErrorDef(code="SCOREBOARD_INVALID_PERIOD", status=http_status.HTTP_400_BAD_REQUEST, message="Invalid period or date range.")

_PERIOD_LABELS = {
    "this_week": "This Week",
    "this_month": "This Month",
    "this_quarter": "This Quarter",
    "this_year": "This Year",
    "custom": "Custom Range",
}


async def _require_can_view_scoreboard(tenant: TenantContext, target_user_id: int) -> None:
    if tenant.user.id == target_user_id:
        return
    if tenant.is_admin_or_owner:
        return

    if tenant.org_role == "team_manager":
        team_repo = TeamRepository(tenant.db, tenant.organization_id)
        teams = await team_repo.list_for_manager(tenant.user.id)
        for team in teams:
            if any(m.user_id == target_user_id for m in team.memberships):
                return
        raise AppException(_FORBIDDEN)

    if tenant.org_role == "project_manager":
        task_repo = TaskRepository(tenant.db, tenant.organization_id)
        target_tasks = await task_repo.list_for_assignee(target_user_id)
        project_ids = {t.project_id for t in target_tasks if t.project_id is not None}
        project_repo = ProjectRepository(tenant.db, tenant.organization_id)
        for project_id in project_ids:
            if await project_repo.is_member(project_id, tenant.user.id):
                return
        raise AppException(_FORBIDDEN)

    raise AppException(_FORBIDDEN)


async def _resolve_employee(tenant: TenantContext, user_id: int) -> ScoreboardEmployee:
    user_repo = UserRepository(tenant.db)
    employee = await user_repo.get_by_id(user_id)
    if employee is None:
        raise AppException(_USER_NOT_FOUND)

    team_repo = TeamRepository(tenant.db, tenant.organization_id)
    all_teams = await team_repo.list_all()
    teams = [
        t.name for t in all_teams
        if t.team_manager_id == user_id or any(m.user_id == user_id for m in t.memberships)
    ]

    return ScoreboardEmployee(
        id=employee.id, full_name=employee.full_name, email=employee.email,
        role=employee.role, teams=teams,
    )


@router.get("", response_model=ScoreboardResponse)
async def get_scoreboard(
    user_id: int,
    period: str = Query(default="this_month"),
    project_id: int | None = Query(default=None),
    team_id: int | None = Query(default=None),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    tenant: TenantContext = Depends(get_tenant_context),
):
    await _require_can_view_scoreboard(tenant, user_id)
    employee = await _resolve_employee(tenant, user_id)

    try:
        period_start, period_end = scoring.resolve_period(period, start_date, end_date)
    except ValueError as exc:
        raise AppException(_INVALID_PERIOD, message=str(exc))

    current_tasks = await scoring.fetch_eligible_tasks(
        tenant.db, tenant.organization_id, user_id, period_start, period_end, project_id, team_id,
    )
    current = scoring.compute_scoreboard(current_tasks)

    prev_start, prev_end = scoring.previous_period(period, period_start, period_end)
    prev_tasks = await scoring.fetch_eligible_tasks(
        tenant.db, tenant.organization_id, user_id, prev_start, prev_end, project_id, team_id,
    )
    previous = scoring.compute_scoreboard(prev_tasks)

    change_from_previous = None
    if current.has_data and previous.has_data:
        change_from_previous = current.rounded_score - previous.rounded_score

    trend: list[ScoreHistoryPoint] = []
    for window_start, window_end in scoring.trailing_periods(period, period_start, period_end, count=6):
        window_tasks = await scoring.fetch_eligible_tasks(
            tenant.db, tenant.organization_id, user_id, window_start, window_end, project_id, team_id,
        )
        window_result = scoring.compute_scoreboard(window_tasks)
        label = window_start.strftime("%b %d") if period == "this_week" else window_start.strftime("%b %Y")
        trend.append(ScoreHistoryPoint(
            period_label=label,
            period_start=window_start,
            period_end=window_end,
            rounded_score=window_result.rounded_score if window_result.has_data else None,
            completed_tasks=window_result.total_completed if window_result.has_data else None,
            overdue_tasks=window_result.overdue if window_result.has_data else None,
            has_data=window_result.has_data,
        ))

    explanation = scoring.build_explanation(current, previous)

    return ScoreboardResponse(
        employee=employee,
        period=period,
        period_start=period_start,
        period_end=period_end,
        summary=ScoreboardSummary(
            total_assigned=current.total_assigned,
            total_completed=current.total_completed,
            completed_before_due=current.completed_before_due,
            completed_on_due=current.completed_on_due,
            completed_after_due=current.completed_after_due,
            completed_no_due_date=current.completed_no_due_date,
            overdue=current.overdue,
            pending=current.pending,
            completion_rate=current.completion_rate,
            on_time_rate=current.on_time_rate,
        ),
        score=ScoreBreakdown(
            has_data=current.has_data,
            completion_score=current.completion_score,
            on_time_score=current.on_time_score,
            overdue_score=current.overdue_score,
            total_score=current.total_score,
            rounded_score=current.rounded_score,
            performance_level=current.performance_level,
            change_from_previous=change_from_previous,
        ),
        explanation=explanation,
        trend=trend,
    )


@router.get("/tasks", response_model=list[ScoreboardTaskItem])
async def get_scoreboard_tasks(
    user_id: int,
    period: str = Query(default="this_month"),
    project_id: int | None = Query(default=None),
    team_id: int | None = Query(default=None),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    tenant: TenantContext = Depends(get_tenant_context),
):
    await _require_can_view_scoreboard(tenant, user_id)

    try:
        period_start, period_end = scoring.resolve_period(period, start_date, end_date)
    except ValueError as exc:
        raise AppException(_INVALID_PERIOD, message=str(exc))

    tasks = await scoring.fetch_eligible_tasks(
        tenant.db, tenant.organization_id, user_id, period_start, period_end, project_id, team_id,
    )
    tasks = sorted(tasks, key=lambda t: t.due_date or date.max)[:200]

    today = date.today()
    return [
        ScoreboardTaskItem(
            id=t.id,
            name=t.name,
            project_id=t.project_id,
            project_name=t.project.name if t.project else None,
            priority=t.priority,
            due_date=t.due_date,
            completed_at=t.completed_at,
            status=t.status,
            score_impact=scoring.score_impact_label(t, today),
        )
        for t in tasks
    ]
