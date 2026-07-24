"""Employee Scoreboard scoring engine.

Pure, stateless calculation over `Task` rows — nothing here is persisted.
Every scoreboard view (current period, previous period, trend) is computed
fresh on request so it always reflects the latest task data, including any
retroactive corrections a manager makes.

Score model (100 points): 35% task completion rate, 40% on-time completion
rate, 25% overdue-task performance. See the source feature spec for the full
rationale; the notable interpretation made here is that a task counts as
"completed" once `completed_at` is set (the employee submitted it for
review), not only once a manager gives final approval — that approval delay
is outside the employee's control and scoring on it would be unfair.
"""

from __future__ import annotations

import calendar
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.task import Task

PERFORMANCE_LEVELS = (
    (90, "Excellent"),
    (80, "Very Good"),
    (70, "Good"),
    (60, "Needs Improvement"),
    (0, "Poor"),
)

_COMPLETION_WEIGHT = 0.35
_ON_TIME_WEIGHT = 0.40
_OVERDUE_WEIGHT = 0.25


def performance_level(score: float) -> str:
    for threshold, label in PERFORMANCE_LEVELS:
        if score >= threshold:
            return label
    return "Poor"


def _today() -> date:
    return datetime.now(timezone.utc).date()


def resolve_period(
    period: str, start_date: date | None, end_date: date | None
) -> tuple[date, date]:
    """Returns (period_start, period_end), inclusive, for the given named period."""
    today = _today()

    if period == "custom":
        if not start_date or not end_date:
            raise ValueError("start_date and end_date are required for a custom period.")
        if end_date < start_date:
            raise ValueError("end_date cannot be before start_date.")
        return start_date, end_date

    if period == "this_week":
        start = today - timedelta(days=today.weekday())
        return start, start + timedelta(days=6)

    if period == "this_month":
        last_day = calendar.monthrange(today.year, today.month)[1]
        return date(today.year, today.month, 1), date(today.year, today.month, last_day)

    if period == "this_quarter":
        quarter_start_month = ((today.month - 1) // 3) * 3 + 1
        end_month = quarter_start_month + 2
        last_day = calendar.monthrange(today.year, end_month)[1]
        return date(today.year, quarter_start_month, 1), date(today.year, end_month, last_day)

    if period == "this_year":
        return date(today.year, 1, 1), date(today.year, 12, 31)

    raise ValueError(f"Unknown period: {period}")


def _shift_months(d: date, months: int) -> date:
    """Returns the date `months` calendar months before/after `d`, clamped to
    the target month's last day (so e.g. Mar 31 - 1 month -> Feb 28/29)."""
    total = d.year * 12 + (d.month - 1) + months
    year, month = divmod(total, 12)
    month += 1
    last_day = calendar.monthrange(year, month)[1]
    return date(year, month, min(d.day, last_day))


def previous_period(period: str, period_start: date, period_end: date) -> tuple[date, date]:
    """The prior period *of the same kind* — a true previous calendar month/
    quarter/year, not just a fixed day-count shift (months/quarters/years
    vary in length, so a naive shift drifts). Weeks and custom ranges are
    fixed-length, so a day-count shift is exact for them."""
    if period == "this_month":
        prev_start = _shift_months(period_start, -1)
        last_day = calendar.monthrange(prev_start.year, prev_start.month)[1]
        return prev_start, date(prev_start.year, prev_start.month, last_day)

    if period == "this_quarter":
        prev_start = _shift_months(period_start, -3)
        end_year, end_month = prev_start.year, prev_start.month + 2
        if end_month > 12:
            end_month -= 12
            end_year += 1
        last_day = calendar.monthrange(end_year, end_month)[1]
        return prev_start, date(end_year, end_month, last_day)

    if period == "this_year":
        return date(period_start.year - 1, 1, 1), date(period_start.year - 1, 12, 31)

    # this_week / custom: fixed-length window, a simple day-count shift is exact.
    length = (period_end - period_start).days + 1
    prev_end = period_start - timedelta(days=1)
    prev_start = prev_end - timedelta(days=length - 1)
    return prev_start, prev_end


def trailing_periods(
    period: str, period_start: date, period_end: date, count: int = 6
) -> list[tuple[date, date]]:
    """Returns `count` consecutive periods of the same kind ending with the
    given period, oldest first — used for the live-computed trend line."""
    windows = [(period_start, period_end)]
    for _ in range(count - 1):
        windows.append(previous_period(period, *windows[-1]))
    return list(reversed(windows))


async def fetch_eligible_tasks(
    db: AsyncSession,
    org_id,
    employee_id: int,
    period_start: date,
    period_end: date,
    project_id: int | None = None,
    team_id: int | None = None,
) -> list[Task]:
    """Tasks assigned to this employee that are "eligible" for this period,
    per the fairness rule: a task counts only if its completion, due date,
    or (due-date-less) creation falls within or before the period end —
    future tasks with no activity yet are never penalized."""
    period_end_dt = datetime.combine(period_end, datetime.max.time(), tzinfo=timezone.utc)
    period_start_dt = datetime.combine(period_start, datetime.min.time(), tzinfo=timezone.utc)
    today = _today()
    # Only the period that actually includes "now" carries forward tasks that
    # became overdue before it started — a past, already-closed period should
    # only reflect what was due/completed within its own window, not today's
    # overdue state (otherwise a stale overdue task would haunt every period
    # forever).
    is_current_period = period_end >= today

    stmt = select(Task).options(selectinload(Task.project)).where(
        Task.organization_id == org_id,
        Task.assignee_id == employee_id,
    )
    if project_id is not None:
        stmt = stmt.where(Task.project_id == project_id)
    if team_id is not None:
        stmt = stmt.where(Task.team_id == team_id)

    result = await db.execute(stmt)
    all_tasks = list(result.scalars().all())

    eligible = []
    for task in all_tasks:
        completed_in_range = (
            task.completed_at is not None
            and period_start_dt <= task.completed_at <= period_end_dt
        )
        due_in_range = task.due_date is not None and period_start <= task.due_date <= period_end
        no_due_created_in_range = (
            task.due_date is None
            and task.created_at is not None
            and period_start_dt <= task.created_at <= period_end_dt
        )
        carried_over_overdue = (
            is_current_period
            and task.completed_at is None
            and task.status != "done"
            and task.due_date is not None
            and task.due_date < period_start
            and task.due_date < today
        )
        if completed_in_range or due_in_range or no_due_created_in_range or carried_over_overdue:
            eligible.append(task)

    return eligible


async def fetch_eligible_team_tasks(
    db: AsyncSession,
    org_id,
    team_id: int,
    period_start: date,
    period_end: date,
    project_id: int | None = None,
) -> list[Task]:
    """Same eligibility rule as `fetch_eligible_tasks`, but pools every
    member's tasks for the team instead of scoping to one assignee — used
    for the team-wide (not per-member) scoreboard total."""
    period_end_dt = datetime.combine(period_end, datetime.max.time(), tzinfo=timezone.utc)
    period_start_dt = datetime.combine(period_start, datetime.min.time(), tzinfo=timezone.utc)
    today = _today()
    is_current_period = period_end >= today

    stmt = select(Task).options(selectinload(Task.project)).where(
        Task.organization_id == org_id,
        Task.team_id == team_id,
    )
    if project_id is not None:
        stmt = stmt.where(Task.project_id == project_id)

    result = await db.execute(stmt)
    all_tasks = list(result.scalars().all())

    eligible = []
    for task in all_tasks:
        completed_in_range = (
            task.completed_at is not None
            and period_start_dt <= task.completed_at <= period_end_dt
        )
        due_in_range = task.due_date is not None and period_start <= task.due_date <= period_end
        no_due_created_in_range = (
            task.due_date is None
            and task.created_at is not None
            and period_start_dt <= task.created_at <= period_end_dt
        )
        carried_over_overdue = (
            is_current_period
            and task.completed_at is None
            and task.status != "done"
            and task.due_date is not None
            and task.due_date < period_start
            and task.due_date < today
        )
        if completed_in_range or due_in_range or no_due_created_in_range or carried_over_overdue:
            eligible.append(task)

    return eligible


def score_impact_label(task, today: date) -> str:
    if task.completed_at is not None:
        if task.due_date is None:
            return "completed"
        completed_date = task.completed_at.date()
        if completed_date < task.due_date:
            return "completed_early"
        if completed_date == task.due_date:
            return "completed_on_time"
        return "completed_late"
    if task.due_date is not None and task.due_date < today and task.status != "done":
        return "overdue"
    return "pending"


@dataclass
class ScoreboardResult:
    has_data: bool
    total_assigned: int = 0
    total_completed: int = 0
    completed_before_due: int = 0
    completed_on_due: int = 0
    completed_after_due: int = 0
    completed_no_due_date: int = 0
    overdue: int = 0
    pending: int = 0
    completion_rate: float = 0.0
    on_time_rate: float = 0.0
    completion_score: float = 0.0
    on_time_score: float = 0.0
    overdue_score: float = 0.0
    total_score: float = 0.0
    rounded_score: int = 0
    performance_level: str = ""
    task_breakdown: dict[str, int] = field(default_factory=dict)


def compute_scoreboard(tasks: list[Task]) -> ScoreboardResult:
    today = _today()
    total_assigned = len(tasks)

    if total_assigned == 0:
        return ScoreboardResult(has_data=False)

    completed_before_due = 0
    completed_on_due = 0
    completed_after_due = 0
    completed_no_due_date = 0
    overdue = 0
    pending = 0

    for task in tasks:
        is_completed = task.completed_at is not None
        if is_completed:
            if task.due_date is None:
                completed_no_due_date += 1
            else:
                completed_date = task.completed_at.date()
                if completed_date < task.due_date:
                    completed_before_due += 1
                elif completed_date == task.due_date:
                    completed_on_due += 1
                else:
                    completed_after_due += 1
        else:
            if task.due_date is not None and task.due_date < today and task.status != "done":
                overdue += 1
            else:
                pending += 1

    total_completed = completed_before_due + completed_on_due + completed_after_due + completed_no_due_date
    on_time_eligible = completed_before_due + completed_on_due + completed_after_due

    completion_rate = (total_completed / total_assigned) * 100
    # No due-dated completions to judge on-time-ness — don't unfairly penalize.
    on_time_rate = (
        ((completed_before_due + completed_on_due) / on_time_eligible) * 100
        if on_time_eligible > 0
        else 100.0
    )
    overdue_pct = (overdue / total_assigned) * 100
    overdue_performance_rate = 100 - overdue_pct

    completion_score = completion_rate * _COMPLETION_WEIGHT
    on_time_score = on_time_rate * _ON_TIME_WEIGHT
    overdue_score = overdue_performance_rate * _OVERDUE_WEIGHT
    total_score = max(0.0, min(100.0, completion_score + on_time_score + overdue_score))
    rounded_score = round(total_score)

    return ScoreboardResult(
        has_data=True,
        total_assigned=total_assigned,
        total_completed=total_completed,
        completed_before_due=completed_before_due,
        completed_on_due=completed_on_due,
        completed_after_due=completed_after_due,
        completed_no_due_date=completed_no_due_date,
        overdue=overdue,
        pending=pending,
        completion_rate=round(completion_rate, 1),
        on_time_rate=round(on_time_rate, 1),
        completion_score=round(completion_score, 2),
        on_time_score=round(on_time_score, 2),
        overdue_score=round(overdue_score, 2),
        total_score=round(total_score, 2),
        rounded_score=rounded_score,
        performance_level=performance_level(total_score),
        task_breakdown={
            "completed_before_due": completed_before_due,
            "completed_on_due": completed_on_due,
            "completed_after_due": completed_after_due,
            "pending": pending,
            "overdue": overdue,
        },
    )


def build_explanation(current: ScoreboardResult, previous: ScoreboardResult | None) -> list[str]:
    """Rule-based, human-readable bullets explaining the score — no extra
    infrastructure, just strings generated from the already-computed counts."""
    if not current.has_data:
        return []

    bullets: list[str] = []

    on_time_completed = current.completed_before_due + current.completed_on_due
    if on_time_completed > 0:
        bullets.append(f"{on_time_completed} task{'s' if on_time_completed != 1 else ''} completed on time.")
    if current.completed_after_due > 0:
        bullets.append(f"{current.completed_after_due} task{'s' if current.completed_after_due != 1 else ''} completed after the due date.")
    if current.overdue > 0:
        bullets.append(f"{current.overdue} task{'s' if current.overdue != 1 else ''} currently overdue.")
    elif current.total_assigned > 0:
        bullets.append("No overdue tasks right now.")

    if previous and previous.has_data:
        resolved_overdue = max(0, previous.overdue - current.overdue)
        if resolved_overdue > 0:
            bullets.append(f"{resolved_overdue} previously overdue task{'s' if resolved_overdue != 1 else ''} resolved.")

    return bullets


def build_team_insights(
    current: ScoreboardResult,
    previous: ScoreboardResult | None,
    member_results: list[tuple[str, "ScoreboardResult"]],
    overdue_alert_threshold: int = 5,
) -> list[str]:
    """Rule-based, team-level bullets (spec §11) generated only from already-
    computed numbers — no separate insights infrastructure."""
    if not current.has_data:
        return []

    bullets: list[str] = []
    bullets.append(f"The team completed {current.completion_rate:.0f}% of assigned tasks this period.")

    if previous and previous.has_data:
        on_time_delta = current.on_time_rate - previous.on_time_rate
        if abs(on_time_delta) >= 1:
            direction = "improved" if on_time_delta > 0 else "declined"
            bullets.append(f"On-time completion {direction} by {abs(on_time_delta):.0f} points compared with last period.")

    overloaded = [name for name, r in member_results if r.has_data and r.overdue > overdue_alert_threshold]
    if overloaded:
        bullets.append(
            f"{len(overloaded)} member{'s' if len(overloaded) != 1 else ''} currently "
            f"{'have' if len(overloaded) != 1 else 'has'} more than {overdue_alert_threshold} overdue tasks."
        )

    if current.overdue == 0 and current.total_assigned > 0:
        bullets.append("No overdue tasks across the team right now.")

    return bullets
