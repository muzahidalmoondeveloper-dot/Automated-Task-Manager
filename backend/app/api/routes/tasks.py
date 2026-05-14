from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
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
from app.models.team import Team
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

router = APIRouter(prefix="/tasks", tags=["Tasks"])


def serialize_task(task: Task) -> TaskDetailRead:
    return TaskDetailRead(
        id=task.id,
        name=task.name,
        start_date=task.start_date,
        due_date=task.due_date,
        status=task.status,
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


@router.get("", response_model=list[TaskDetailRead])
async def list_tasks(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repository = TaskRepository(db)

    if current_user.role in {ADMIN, TEAM_MANAGER}:
        tasks = await repository.list_all()
    else:
        tasks = await repository.list_for_assignee(current_user.id)

    return [serialize_task(task) for task in tasks]


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

    return serialize_task(task)


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

    task.status = "done"
    task.reviewed_by_id = current_user.id
    task.reviewed_at = datetime.now(timezone.utc)
    task.review_note = "Approved"

    if task.completed_by_id:
        await create_notification(
            db=db,
            user_id=task.completed_by_id,
            task_id=task.id,
            title="Task approved",
            message=f"Your task '{task.name}' was approved.",
            type_="task_approved",
        )

    await db.commit()

    updated_task = await repository.get_by_id(task.id)

    return serialize_task(updated_task)


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

    return serialize_task(updated_task)


@router.patch("/{task_id}", response_model=TaskDetailRead)
async def update_task(
    task_id: int,
    payload: TaskUpdate,
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

    if payload.team_id is not None:
        team_repo = TeamRepository(db)
        team = await team_repo.get_by_id(payload.team_id)

        if team is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Selected team is invalid.",
            )

    updated_task = await repository.update(task, payload)

    return serialize_task(updated_task)


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