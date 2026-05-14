from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.dependencies import (
    get_current_user,
    require_admin,
    require_admin_or_team_manager,
)
from app.core.roles import ADMIN, TEAM_MANAGER, TEAM_MEMBER
from app.models.team import Team
from app.models.task import Task
from app.models.project import Project
from app.models.user import User
from app.models import TeamMembership
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserCreate, UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["Users"])


@router.get("/me", response_model=UserRead)
async def read_current_user(
    current_user: User = Depends(get_current_user),
):
    return UserRead.model_validate(current_user)


async def get_managed_team_for_user(
    db: AsyncSession,
    manager_id: int,
) -> Team | None:
    result = await db.execute(
        select(Team)
        .where(Team.team_manager_id == manager_id)
        .options(
            selectinload(Team.memberships).selectinload(TeamMembership.user),
            selectinload(Team.team_manager),
        )
    )

    return result.scalar_one_or_none()


async def add_user_to_team_if_missing(
    db: AsyncSession,
    *,
    team_id: int,
    user_id: int,
) -> None:
    existing_result = await db.execute(
        select(TeamMembership).where(
            TeamMembership.team_id == team_id,
            TeamMembership.user_id == user_id,
        )
    )

    existing_membership = existing_result.scalar_one_or_none()

    if existing_membership:
        return

    db.add(
        TeamMembership(
            team_id=team_id,
            user_id=user_id,
        )
    )


@router.get("", response_model=list[UserRead])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_team_manager),
):
    user_repo = UserRepository(db)

    if current_user.role == ADMIN:
        users = await user_repo.list_all()
        return [UserRead.model_validate(user) for user in users]

    managed_team = await get_managed_team_for_user(db, current_user.id)

    if managed_team is None:
        return []

    users = [
        membership.user
        for membership in managed_team.memberships
        if membership.user is not None and membership.user.role == TEAM_MEMBER
    ]

    return [UserRead.model_validate(user) for user in users]


@router.get("/team-managers", response_model=list[UserRead])
async def list_team_managers(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin_or_team_manager),
):
    user_repo = UserRepository(db)
    users = await user_repo.list_by_roles([TEAM_MANAGER])
    return [UserRead.model_validate(user) for user in users]


@router.post("", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_team_manager),
):
    user_repo = UserRepository(db)

    if current_user.role == TEAM_MANAGER and payload.role != TEAM_MEMBER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Team Managers can only create Team Members.",
        )

    existing_user = await user_repo.get_by_email(payload.email)

    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="A user with this email already exists.",
        )

    managed_team = None

    if current_user.role == TEAM_MANAGER:
        managed_team = await get_managed_team_for_user(db, current_user.id)

        if managed_team is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="You are not assigned as manager of any team.",
            )

    user = await user_repo.create(payload)

    if current_user.role == TEAM_MANAGER and managed_team is not None:
        await add_user_to_team_if_missing(
            db,
            team_id=managed_team.id,
            user_id=user.id,
        )

        await db.commit()
        await db.refresh(user)

    return UserRead.model_validate(user)


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if payload.email and payload.email.lower().strip() != user.email:
        existing_user = await user_repo.get_by_email(payload.email)

        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email already exists.",
            )

    updated_user = await user_repo.update(user, payload)
    return UserRead.model_validate(updated_user)


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    if user_id == current_user.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="You cannot delete your own account.",
        )

    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    managed_team_result = await db.execute(
        select(Team).where(Team.team_manager_id == user_id)
    )
    managed_team = managed_team_result.scalar_one_or_none()

    if managed_team:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"This user is the manager of team '{managed_team.name}'. "
                "Reassign the team manager before deleting this user."
            ),
        )

    created_team_result = await db.execute(
        select(Team).where(Team.created_by_id == user_id)
    )
    created_team = created_team_result.scalar_one_or_none()

    if created_team:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"This user created team '{created_team.name}'. "
                "Delete or reassign this team before deleting this user."
            ),
        )

    created_project_result = await db.execute(
        select(Project).where(Project.created_by_id == user_id)
    )
    created_project = created_project_result.scalar_one_or_none()

    if created_project:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"This user created project '{created_project.name}'. "
                "Delete or reassign this project before deleting this user."
            ),
        )

    created_task_result = await db.execute(
        select(Task).where(Task.created_by_id == user_id)
    )
    created_task = created_task_result.scalar_one_or_none()

    if created_task:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"This user created task '{created_task.name}'. "
                "Delete or reassign this task before deleting this user."
            ),
        )

    await user_repo.delete(user)

    return None