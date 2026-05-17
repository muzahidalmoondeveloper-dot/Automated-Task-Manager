import logging
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import (
    get_current_user,
    require_admin_or_team_manager,
)
from app.core.roles import ADMIN, TEAM_MANAGER, TEAM_MEMBER
from app.models.notification import Notification
from app.models.task import Task
from app.models.team import Team, TeamMembership
from app.models.user import User
from app.repositories.project_repository import ProjectRepository
from app.repositories.task_repository import TaskRepository
from app.repositories.team_repository import TeamRepository
from app.repositories.user_repository import UserRepository
from app.schemas.project import ProjectRead
from app.schemas.task import (
    AssignBackRequest,
    TaskCreate,
    TaskDetailRead,
    TaskStatusUpdate,
    TaskUpdate,
)
from app.schemas.team import TeamRead
from app.schemas.user import UserRead
from app.worker.tasks.email_tasks import (
    send_due_date_updated_email,
    send_task_approved_email,
    send_task_assigned_back_email,
    send_task_assigned_email,
    send_task_sent_for_review_email,
)

router = APIRouter(prefix="/tasks", tags=["Tasks"])

logger = logging.getLogger("tasks")


# ─── Helpers ──────────────────────────────────────────────────────────────────

def serialize_task(task: Task) -> TaskDetailRead:
    return TaskDetailRead(
        id=task.id,
        name=task.name,
        start_date=task.start_date,
        due_date=task.due_date,
        status=task.status,
        priority=getattr(task, "priority", "medium"),
        assignee_id=task.assignee_id,
        project_id=task.project_id,
        team_id=task.team_id,
        created_by_id=task.created_by_id,
        completed_by_id=task.completed_by_id,
        completed_at=task.completed_at,
        reviewed_by_id=task.reviewed_by_id,
        reviewed_at=task.reviewed_at,
        review_note=task.review_note,
        assignee=UserRead.model_validate(task.assignee) if task.assignee else None,
        project=ProjectRead.model_validate(task.project) if task.project else None,
        team=TeamRead.model_validate(task.team) if task.team else None,
        created_at=task.created_at,
        updated_at=task.updated_at,
    )


async def create_notification(
    *,
    db: AsyncSession,
    user_id: int,
    task_id: int,
    title: str,
    message: str,
    type_: str,
) -> None:
    db.add(
        Notification(
            user_id=user_id,
            task_id=task_id,
            title=title,
            message=message,
            type=type_,
        )
    )


async def _has_unread_notification(
    db: AsyncSession, user_id: int, task_id: int, type_: str
) -> bool:
    result = await db.execute(
        select(Notification).where(
            Notification.user_id == user_id,
            Notification.task_id == task_id,
            Notification.type == type_,
            Notification.is_read == False,  # noqa: E712
        )
    )
    return result.scalar_one_or_none() is not None


async def get_task_or_404(db: AsyncSession, task_id: int) -> Task:
    repository = TaskRepository(db)
    task = await repository.get_by_id(task_id)

    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found.",
        )

    return task


def user_can_manage_task(current_user: User) -> bool:
    return current_user.role in {ADMIN, TEAM_MANAGER}


async def get_task_team(db: AsyncSession, task: Task) -> Team | None:
    result = await db.execute(select(Team).where(Team.id == task.team_id))
    return result.scalar_one_or_none()


def _apply_task_filters(
    tasks: list[Task],
    *,
    status_filter: str | None,
    priority_filter: str | None,
    due_date_from: date | None,
    due_date_to: date | None,
    overdue: bool,
    project_id: int | None,
    team_id: int | None,
    assignee_id: int | None,
) -> list[Task]:
    today = date.today()
    result = tasks

    if status_filter:
        result = [t for t in result if t.status == status_filter]
    if priority_filter:
        result = [t for t in result if getattr(t, "priority", "medium") == priority_filter]
    if project_id:
        result = [t for t in result if t.project_id == project_id]
    if team_id:
        result = [t for t in result if t.team_id == team_id]
    if assignee_id:
        result = [t for t in result if t.assignee_id == assignee_id]
    if due_date_from:
        result = [t for t in result if t.due_date and t.due_date >= due_date_from]
    if due_date_to:
        result = [t for t in result if t.due_date and t.due_date <= due_date_to]
    if overdue:
        result = [
            t for t in result
            if t.due_date and t.due_date < today and t.status not in {"done", "pending_review"}
        ]

    return result


def _enqueue_email(task_fn, *args, **kwargs) -> None:
    """Enqueue a Celery email task, logging if Redis is unavailable."""
    try:
        task_fn.delay(*args, **kwargs)
    except Exception as exc:
        logger.error("Failed to enqueue email task %s: %s", task_fn.name, exc)


# ─── My Tasks (all roles) ─────────────────────────────────────────────────────

@router.get("/my", response_model=list[TaskDetailRead])
async def list_my_tasks(
    status_filter: str | None = Query(default=None, alias="status"),
    priority_filter: str | None = Query(default=None, alias="priority"),
    due_date_from: date | None = Query(default=None),
    due_date_to: date | None = Query(default=None),
    overdue: bool = Query(default=False),
    project_id: int | None = Query(default=None),
    team_id: int | None = Query(default=None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repository = TaskRepository(db)
    tasks = await repository.list_for_assignee(current_user.id)

    tasks = _apply_task_filters(
        tasks,
        status_filter=status_filter,
        priority_filter=priority_filter,
        due_date_from=due_date_from,
        due_date_to=due_date_to,
        overdue=overdue,
        project_id=project_id,
        team_id=team_id,
        assignee_id=None,
    )

    return [serialize_task(task) for task in tasks]


# ─── All Tasks (admin / team_manager only) ────────────────────────────────────

@router.get("", response_model=list[TaskDetailRead])
async def list_tasks(
    status_filter: str | None = Query(default=None, alias="status"),
    priority_filter: str | None = Query(default=None, alias="priority"),
    assignee_id: int | None = Query(default=None),
    project_id: int | None = Query(default=None),
    team_id: int | None = Query(default=None),
    due_date_from: date | None = Query(default=None),
    due_date_to: date | None = Query(default=None),
    overdue: bool = Query(default=False),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_team_manager),
):
    repository = TaskRepository(db)
    tasks = await repository.list_all()

    tasks = _apply_task_filters(
        tasks,
        status_filter=status_filter,
        priority_filter=priority_filter,
        due_date_from=due_date_from,
        due_date_to=due_date_to,
        overdue=overdue,
        project_id=project_id,
        team_id=team_id,
        assignee_id=assignee_id,
    )

    return [serialize_task(task) for task in tasks]


# ─── Create task ──────────────────────────────────────────────────────────────

@router.post("", response_model=TaskDetailRead, status_code=status.HTTP_201_CREATED)
async def create_task(
    payload: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_team_manager),
):
    user_repo = UserRepository(db)
    project_repo = ProjectRepository(db)
    team_repo = TeamRepository(db)
    task_repo = TaskRepository(db)

    if payload.assignee_id is not None:
        assignee = await user_repo.get_by_id(payload.assignee_id)
        if assignee is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected assignee is invalid.",
            )

    if payload.project_id is not None:
        project = await project_repo.get_by_id(payload.project_id)
        if project is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected project is invalid.",
            )

    if payload.team_id is not None:
        team = await team_repo.get_by_id(payload.team_id)
        if team is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected team is invalid.",
            )

    task = await task_repo.create(payload, created_by_id=current_user.id)

    # In-app notification + email for new assignee (skip self-assignment)
    if payload.assignee_id and payload.assignee_id != current_user.id:
        await create_notification(
            db=db,
            user_id=payload.assignee_id,
            task_id=task.id,
            title="New task assigned to you",
            message=f"You have been assigned a new task: '{task.name}'.",
            type_="task_assigned",
        )
        await db.commit()

        # Re-fetch the assignee by explicit ID — never use task.assignee here
        # because the ORM identity map can return the wrong user when the Task
        # model has multiple FK columns pointing to User (created_by_id,
        # completed_by_id, reviewed_by_id, assignee_id).
        assignee_user = await UserRepository(db).get_by_id(payload.assignee_id)
        if assignee_user:
            logger.info(
                "Triggering task_assigned email | task_id=%s | assigner_id=%s | assignee_id=%s | recipient=%s",
                task.id, current_user.id, assignee_user.id, assignee_user.email,
            )
            _enqueue_email(
                send_task_assigned_email,
                task.id, assignee_user.id, current_user.id,
            )
        else:
            logger.warning(
                "task_assigned email skipped — assignee not found | task_id=%s | assignee_id=%s",
                task.id, payload.assignee_id,
            )

    return serialize_task(task)


# ─── List by project ──────────────────────────────────────────────────────────

@router.get("/project/{project_id}", response_model=list[TaskDetailRead])
async def list_tasks_by_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    project_repo = ProjectRepository(db)
    task_repo = TaskRepository(db)

    project = await project_repo.get_by_id(project_id)

    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Project not found.",
        )

    tasks = await task_repo.list_by_project(project_id)

    if current_user.role in {ADMIN, TEAM_MANAGER}:
        return [serialize_task(task) for task in tasks]

    own_tasks = [task for task in tasks if task.assignee_id == current_user.id]

    return [serialize_task(task) for task in own_tasks]


# ─── List by team ─────────────────────────────────────────────────────────────

@router.get("/team/{team_id}", response_model=list[TaskDetailRead])
async def list_tasks_by_team(
    team_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    team_repo = TeamRepository(db)
    task_repo = TaskRepository(db)

    team = await team_repo.get_by_id(team_id)

    if team is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found.",
        )

    tasks = await task_repo.list_by_team(team_id)

    if current_user.role in {ADMIN, TEAM_MANAGER}:
        return [serialize_task(task) for task in tasks]

    own_tasks = [task for task in tasks if task.assignee_id == current_user.id]

    return [serialize_task(task) for task in own_tasks]


# ─── Get single task ──────────────────────────────────────────────────────────

@router.get("/{task_id}", response_model=TaskDetailRead)
async def get_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    task = await get_task_or_404(db, task_id)

    if current_user.role not in {ADMIN, TEAM_MANAGER} and task.assignee_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own tasks.",
        )

    return serialize_task(task)


# ─── Update task status ───────────────────────────────────────────────────────

@router.patch("/{task_id}/status", response_model=TaskDetailRead)
async def update_task_status(
    task_id: int,
    payload: TaskStatusUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repository = TaskRepository(db)
    task = await get_task_or_404(db, task_id)

    if current_user.role == TEAM_MEMBER:
        if task.assignee_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You can only update status on tasks assigned to you.",
            )

        if payload.status == "done":
            task.status = "pending_review"
            task.completed_by_id = current_user.id
            task.completed_at = datetime.now(timezone.utc)
            task.reviewed_by_id = None
            task.reviewed_at = None
            task.review_note = None

            team = await get_task_team(db, task)

            if team and team.team_manager_id:
                await create_notification(
                    db=db,
                    user_id=team.team_manager_id,
                    task_id=task.id,
                    title="Task pending review",
                    message=(
                        f"{current_user.full_name} marked '{task.name}' as completed. "
                        "Please review it."
                    ),
                    type_="task_review",
                )

            await db.commit()

            updated_task = await repository.get_by_id(task.id)

            # Email the reviewer: team manager > member's team manager > admin fallback.
            user_repo = UserRepository(db)
            reviewer: User | None = None

            if team and team.team_manager_id:
                # Task has an explicit team — use that team's manager.
                reviewer = await user_repo.get_by_id(team.team_manager_id)
                logger.info(
                    "task_sent_for_review: resolved reviewer from task.team_id=%s | manager_id=%s | reviewer=%s",
                    task.team_id, team.team_manager_id, reviewer.email if reviewer else None,
                )

            if reviewer is None:
                # Task has no team (or manager lookup failed) — try the submitter's
                # own team membership to find their team manager.
                membership_result = await db.execute(
                    select(TeamMembership)
                    .where(TeamMembership.user_id == current_user.id)
                    .limit(1)
                )
                membership = membership_result.scalar_one_or_none()
                if membership:
                    member_team_result = await db.execute(
                        select(Team).where(Team.id == membership.team_id)
                    )
                    member_team = member_team_result.scalar_one_or_none()
                    if member_team and member_team.team_manager_id:
                        reviewer = await user_repo.get_by_id(member_team.team_manager_id)
                        logger.info(
                            "task_sent_for_review: resolved reviewer from submitter membership"
                            " | team_id=%s | manager_id=%s | reviewer=%s",
                            membership.team_id, member_team.team_manager_id,
                            reviewer.email if reviewer else None,
                        )

            if reviewer is None:
                # Last resort — first active admin.
                admin_result = await db.execute(
                    select(User)
                    .where(User.role == ADMIN)
                    .where(User.is_active.is_(True))
                    .limit(1)
                )
                reviewer = admin_result.scalar_one_or_none()
                if reviewer:
                    logger.info(
                        "task_sent_for_review: admin fallback | task_id=%s | admin=%s",
                        task.id, reviewer.email,
                    )

            if reviewer:
                logger.info(
                    "Triggering task_sent_for_review email | task_id=%s | submitter_id=%s | reviewer_id=%s | recipient=%s",
                    updated_task.id, current_user.id, reviewer.id, reviewer.email,
                )
                _enqueue_email(
                    send_task_sent_for_review_email,
                    updated_task.id, current_user.id, reviewer.id,
                )
            else:
                logger.warning(
                    "task_sent_for_review email skipped — no manager or admin found | task_id=%s",
                    task.id,
                )

            return serialize_task(updated_task)

        if payload.status not in {"todo", "in_progress"}:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Team members can only move tasks to Todo, In Progress, or submit Done for review.",
            )

        updated_task = await repository.update(
            task,
            TaskUpdate(status=payload.status),
        )

        return serialize_task(updated_task)

    if current_user.role not in {ADMIN, TEAM_MANAGER}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You are not allowed to update tasks.",
        )

    updated_task = await repository.update(
        task,
        TaskUpdate(status=payload.status),
    )

    return serialize_task(updated_task)


# ─── Approve task ─────────────────────────────────────────────────────────────

@router.post("/{task_id}/approve", response_model=TaskDetailRead)
async def approve_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_team_manager),
):
    repository = TaskRepository(db)
    task = await get_task_or_404(db, task_id)

    if task.status != "pending_review":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending review tasks can be approved.",
        )

    completed_by_id = task.completed_by_id

    task.status = "done"
    task.reviewed_by_id = current_user.id
    task.reviewed_at = datetime.now(timezone.utc)
    task.review_note = "Approved"

    if completed_by_id:
        await create_notification(
            db=db,
            user_id=completed_by_id,
            task_id=task.id,
            title="Task approved",
            message=f"Your task '{task.name}' was approved.",
            type_="task_approved",
        )

    await db.commit()

    updated_task = await repository.get_by_id(task.id)

    # Email the person who submitted the task for review (completed_by, not necessarily current assignee)
    if completed_by_id:
        user_repo = UserRepository(db)
        recipient = await user_repo.get_by_id(completed_by_id)
        if recipient:
            logger.info(
                "Triggering task_approved email | task_id=%s | approver_id=%s | recipient_id=%s | recipient=%s",
                updated_task.id, current_user.id, recipient.id, recipient.email,
            )
            _enqueue_email(
                send_task_approved_email,
                updated_task.id, recipient.id, current_user.id,
            )
        else:
            logger.warning(
                "task_approved email skipped — submitter user not found | task_id=%s | completed_by_id=%s",
                updated_task.id, completed_by_id,
            )

    return serialize_task(updated_task)


# ─── Assign task back ─────────────────────────────────────────────────────────

@router.post("/{task_id}/assign-back", response_model=TaskDetailRead)
async def assign_task_back(
    task_id: int,
    payload: AssignBackRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_team_manager),
):
    repository = TaskRepository(db)
    task = await get_task_or_404(db, task_id)

    if task.status != "pending_review":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only pending review tasks can be assigned back.",
        )

    note = payload.note or "Assigned back for more work."

    task.status = "in_progress"
    task.reviewed_by_id = current_user.id
    task.reviewed_at = datetime.now(timezone.utc)
    task.review_note = note

    if task.assignee_id:
        await create_notification(
            db=db,
            user_id=task.assignee_id,
            task_id=task.id,
            title="Task assigned back",
            message=f"Your task '{task.name}' was assigned back. Reason: {note}",
            type_="task_assigned_back",
        )

    await db.commit()

    updated_task = await repository.get_by_id(task.id)

    # Email the assignee with manager feedback
    if updated_task.assignee:
        logger.info(
            "Triggering task_assigned_back email | task_id=%s | manager_id=%s | assignee_id=%s | recipient=%s",
            updated_task.id, current_user.id, updated_task.assignee.id, updated_task.assignee.email,
        )
        _enqueue_email(
            send_task_assigned_back_email,
            updated_task.id, updated_task.assignee.id, current_user.id, note,
        )
    else:
        logger.warning(
            "task_assigned_back email skipped — no assignee on task | task_id=%s",
            updated_task.id,
        )

    return serialize_task(updated_task)


# ─── Update task details ──────────────────────────────────────────────────────

@router.patch("/{task_id}", response_model=TaskDetailRead)
async def update_task(
    task_id: int,
    payload: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_team_manager),
):
    repository = TaskRepository(db)
    task = await repository.get_by_id(task_id)

    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found.",
        )

    if payload.team_id is not None:
        team_repo = TeamRepository(db)
        team = await team_repo.get_by_id(payload.team_id)

        if team is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected team is invalid.",
            )

    old_assignee_id = task.assignee_id
    old_due_date = task.due_date

    updated_task = await repository.update(task, payload)

    new_assignee_id = payload.assignee_id
    assignee_changed = (
        new_assignee_id is not None
        and new_assignee_id != old_assignee_id
    )

    # Notify new assignee when assignee changes (skip self-assignment)
    if assignee_changed and new_assignee_id != current_user.id:
        await create_notification(
            db=db,
            user_id=new_assignee_id,
            task_id=updated_task.id,
            title="Task assigned to you",
            message=f"You have been assigned task: '{updated_task.name}'.",
            type_="task_assigned",
        )
        await db.commit()

        # Always re-fetch by explicit ID — task.assignee can resolve to the wrong
        # user when SQLAlchemy's identity map is populated with the assigner.
        new_assignee_user = await UserRepository(db).get_by_id(new_assignee_id)
        if new_assignee_user:
            logger.info(
                "Triggering task_assigned email (reassign) | task_id=%s | assigner_id=%s | assignee_id=%s | recipient=%s",
                updated_task.id, current_user.id, new_assignee_user.id, new_assignee_user.email,
            )
            _enqueue_email(
                send_task_assigned_email,
                updated_task.id, new_assignee_user.id, current_user.id,
            )
        else:
            logger.warning(
                "task_assigned email skipped — new assignee not found | task_id=%s | assignee_id=%s",
                updated_task.id, new_assignee_id,
            )

    # Email current assignee when only the due date changes
    if (
        not assignee_changed
        and old_due_date != updated_task.due_date
        and updated_task.assignee
    ):
        _enqueue_email(
            send_due_date_updated_email,
            updated_task.id,
            updated_task.assignee.id,
            current_user.id,
            str(old_due_date) if old_due_date else None,
        )

    return serialize_task(updated_task)


# ─── Delete task ──────────────────────────────────────────────────────────────

@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_or_team_manager),
):
    repository = TaskRepository(db)
    task = await repository.get_by_id(task_id)

    if task is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found.",
        )

    await repository.delete(task)

    return None
