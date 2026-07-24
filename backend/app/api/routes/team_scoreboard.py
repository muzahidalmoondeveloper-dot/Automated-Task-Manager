from datetime import date

from fastapi import APIRouter, Depends, Query
from fastapi import status as http_status

from app.core.auth_errors import AppException, ErrorDef
from app.core.tenant import TenantContext, get_tenant_context
from app.models.team import Team
from app.repositories.project_repository import ProjectRepository
from app.repositories.task_repository import TaskRepository
from app.repositories.team_repository import TeamRepository
from app.schemas.scoreboard import (
    ScoreboardSummary,
    ScoreboardTaskItem,
    ScoreBreakdown,
    ScoreHistoryPoint,
    TeamInfo,
    TeamScoreboardMemberRow,
    TeamScoreboardResponse,
)
from app.services import scoreboard_service as scoring
from app.services.scoreboard_service import ScoreboardResult

router = APIRouter(prefix="/teams/{team_id}/scoreboard", tags=["Team Scoreboard"])

_TEAM_NOT_FOUND = ErrorDef(code="TEAM_NOT_FOUND", status=http_status.HTTP_404_NOT_FOUND, message="Team not found.")
_FORBIDDEN = ErrorDef(code="TEAM_SCOREBOARD_FORBIDDEN", status=http_status.HTTP_403_FORBIDDEN, message="You do not have permission to view this team's scoreboard.")
_INVALID_PERIOD = ErrorDef(code="SCOREBOARD_INVALID_PERIOD", status=http_status.HTTP_400_BAD_REQUEST, message="Invalid period or date range.")


async def _get_team_or_404(tenant: TenantContext, team_id: int) -> Team:
    team_repo = TeamRepository(tenant.db, tenant.organization_id)
    team = await team_repo.get_by_id(team_id)
    if team is None:
        raise AppException(_TEAM_NOT_FOUND)
    return team


async def _require_can_view_team_scoreboard(tenant: TenantContext, team: Team) -> None:
    if tenant.is_admin_or_owner:
        return

    if tenant.org_role == "team_manager":
        if team.team_manager_id == tenant.user.id:
            return
        raise AppException(_FORBIDDEN)

    if tenant.org_role == "team_member":
        if any(m.user_id == tenant.user.id for m in team.memberships):
            return
        raise AppException(_FORBIDDEN)

    if tenant.org_role == "project_manager":
        task_repo = TaskRepository(tenant.db, tenant.organization_id)
        team_tasks = await task_repo.list_by_team(team.id)
        project_ids = {t.project_id for t in team_tasks if t.project_id is not None}
        project_repo = ProjectRepository(tenant.db, tenant.organization_id)
        for project_id in project_ids:
            if await project_repo.is_member(project_id, tenant.user.id):
                return
        raise AppException(_FORBIDDEN)

    raise AppException(_FORBIDDEN)


def _team_info(team: Team) -> TeamInfo:
    return TeamInfo(
        id=team.id,
        name=team.name,
        description=team.description,
        manager_name=team.team_manager.full_name if team.team_manager else None,
        member_count=len(team.memberships),
    )


def _to_summary(result: ScoreboardResult) -> ScoreboardSummary:
    return ScoreboardSummary(
        total_assigned=result.total_assigned,
        total_completed=result.total_completed,
        completed_before_due=result.completed_before_due,
        completed_on_due=result.completed_on_due,
        completed_after_due=result.completed_after_due,
        completed_no_due_date=result.completed_no_due_date,
        overdue=result.overdue,
        pending=result.pending,
        completion_rate=result.completion_rate,
        on_time_rate=result.on_time_rate,
    )


def _to_score(result: ScoreboardResult, change_from_previous: int | None) -> ScoreBreakdown:
    return ScoreBreakdown(
        has_data=result.has_data,
        completion_score=result.completion_score,
        on_time_score=result.on_time_score,
        overdue_score=result.overdue_score,
        total_score=result.total_score,
        rounded_score=result.rounded_score,
        performance_level=result.performance_level,
        change_from_previous=change_from_previous,
    )


@router.get("", response_model=TeamScoreboardResponse)
async def get_team_scoreboard(
    team_id: int,
    period: str = Query(default="this_month"),
    project_id: int | None = Query(default=None),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    tenant: TenantContext = Depends(get_tenant_context),
):
    team = await _get_team_or_404(tenant, team_id)
    await _require_can_view_team_scoreboard(tenant, team)

    try:
        period_start, period_end = scoring.resolve_period(period, start_date, end_date)
    except ValueError as exc:
        raise AppException(_INVALID_PERIOD, message=str(exc))

    current_tasks = await scoring.fetch_eligible_team_tasks(
        tenant.db, tenant.organization_id, team_id, period_start, period_end, project_id,
    )
    current = scoring.compute_scoreboard(current_tasks)

    prev_start, prev_end = scoring.previous_period(period, period_start, period_end)
    prev_tasks = await scoring.fetch_eligible_team_tasks(
        tenant.db, tenant.organization_id, team_id, prev_start, prev_end, project_id,
    )
    previous = scoring.compute_scoreboard(prev_tasks)

    change_from_previous = None
    if current.has_data and previous.has_data:
        change_from_previous = current.rounded_score - previous.rounded_score

    async def _build_trend(anchor_start: date, anchor_end: date) -> list[ScoreHistoryPoint]:
        points: list[ScoreHistoryPoint] = []
        for window_start, window_end in scoring.trailing_periods(period, anchor_start, anchor_end, count=6):
            window_tasks = await scoring.fetch_eligible_team_tasks(
                tenant.db, tenant.organization_id, team_id, window_start, window_end, project_id,
            )
            window_result = scoring.compute_scoreboard(window_tasks)
            label = window_start.strftime("%b %d") if period == "this_week" else window_start.strftime("%b %Y")
            points.append(ScoreHistoryPoint(
                period_label=label,
                period_start=window_start,
                period_end=window_end,
                rounded_score=window_result.rounded_score if window_result.has_data else None,
                completed_tasks=window_result.total_completed if window_result.has_data else None,
                overdue_tasks=window_result.overdue if window_result.has_data else None,
                has_data=window_result.has_data,
            ))
        return points

    trend = await _build_trend(period_start, period_end)
    # A comparable earlier series — the 6 periods immediately preceding the
    # current trend window — plotted as a dashed reference line so managers
    # can see this cycle against the one before it.
    earliest_window_start, earliest_window_end = scoring.trailing_periods(period, period_start, period_end, count=6)[0]
    prev_anchor_start, prev_anchor_end = scoring.previous_period(period, earliest_window_start, earliest_window_end)
    previous_trend = await _build_trend(prev_anchor_start, prev_anchor_end)

    member_rows: list[TeamScoreboardMemberRow] = []
    member_results: list[tuple[str, ScoreboardResult]] = []
    for membership in team.memberships:
        member_tasks = await scoring.fetch_eligible_tasks(
            tenant.db, tenant.organization_id, membership.user_id, period_start, period_end, project_id, team_id,
        )
        member_result = scoring.compute_scoreboard(member_tasks)
        member_results.append((membership.user.full_name, member_result))
        member_rows.append(TeamScoreboardMemberRow(
            rank=0,
            user_id=membership.user_id,
            full_name=membership.user.full_name,
            role=membership.user.role,
            has_data=member_result.has_data,
            rounded_score=member_result.rounded_score if member_result.has_data else None,
            performance_level=member_result.performance_level if member_result.has_data else None,
            total_assigned=member_result.total_assigned,
            total_completed=member_result.total_completed,
            overdue=member_result.overdue,
            completion_rate=member_result.completion_rate,
            on_time_rate=member_result.on_time_rate,
        ))

    # Tie-breakers (spec §7): score desc -> on-time rate desc -> overdue asc -> completed desc.
    # Members with no data sort to the bottom.
    member_rows.sort(
        key=lambda m: (
            m.has_data is False,
            -(m.rounded_score or 0),
            -(m.on_time_rate or 0),
            m.overdue,
            -m.total_completed,
        )
    )
    for i, row in enumerate(member_rows, start=1):
        row.rank = i

    insights = scoring.build_team_insights(current, previous, member_results)

    return TeamScoreboardResponse(
        team=_team_info(team),
        period=period,
        period_start=period_start,
        period_end=period_end,
        summary=_to_summary(current),
        score=_to_score(current, change_from_previous),
        members=member_rows,
        trend=trend,
        previous_trend=previous_trend,
        insights=insights,
    )


@router.get("/tasks", response_model=list[ScoreboardTaskItem])
async def get_team_scoreboard_tasks(
    team_id: int,
    period: str = Query(default="this_month"),
    project_id: int | None = Query(default=None),
    start_date: date | None = Query(default=None),
    end_date: date | None = Query(default=None),
    tenant: TenantContext = Depends(get_tenant_context),
):
    team = await _get_team_or_404(tenant, team_id)
    await _require_can_view_team_scoreboard(tenant, team)

    try:
        period_start, period_end = scoring.resolve_period(period, start_date, end_date)
    except ValueError as exc:
        raise AppException(_INVALID_PERIOD, message=str(exc))

    tasks = await scoring.fetch_eligible_team_tasks(
        tenant.db, tenant.organization_id, team_id, period_start, period_end, project_id,
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
