from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_admin, require_admin_or_team_manager
from app.core.roles import ADMIN, TEAM_MANAGER
from app.models.team import Team
from app.models.user import User
from app.repositories.team_repository import TeamRepository
from app.repositories.user_repository import UserRepository
from app.schemas.team import TeamCreate, TeamDetailRead, TeamRead, TeamUpdate
from app.schemas.user import UserRead

router = APIRouter(prefix="/teams", tags=["Teams"])


def serialize_team(team: Team) -> TeamDetailRead:
    return TeamDetailRead(
        id=team.id,
        name=team.name,
        description=team.description,
        team_manager_id=team.team_manager_id,
        created_by_id=team.created_by_id,
        created_at=team.created_at,
        updated_at=team.updated_at,
        team_manager=UserRead.model_validate(team.team_manager),
        members=[
            UserRead.model_validate(membership.user)
            for membership in team.memberships
            if membership.user is not None
        ],
    )


@router.get("", response_model=list[TeamDetailRead])
async def list_teams(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_team_manager),
):
    repository = TeamRepository(db)

    if current_user.role == ADMIN:
        teams = await repository.list_all()
    elif current_user.role == TEAM_MANAGER:
        all_teams = await repository.list_all()
        teams = [
            team
            for team in all_teams
            if team.team_manager_id == current_user.id
        ]
    else:
        teams = []

    return [serialize_team(team) for team in teams]


@router.post("", response_model=TeamDetailRead, status_code=status.HTTP_201_CREATED)
async def create_team(
    payload: TeamCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    user_repo = UserRepository(db)

    manager = await user_repo.get_by_id(payload.team_manager_id)

    if manager is None or manager.role != TEAM_MANAGER:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Selected team manager is invalid.",
        )


    for member_id in payload.member_ids:
        member = await user_repo.get_by_id(member_id)

        if member is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Invalid member id: {member_id}",
            )

    repository = TeamRepository(db)
    team = await repository.create(payload, created_by_id=current_user.id)

    return serialize_team(team)


@router.get("/{team_id}", response_model=TeamDetailRead)
async def get_team(
    team_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_team_manager),
):
    repository = TeamRepository(db)
    team = await repository.get_by_id(team_id)

    if team is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found.",
        )

    if current_user.role == TEAM_MANAGER and team.team_manager_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only view your own teams.",
        )

    return serialize_team(team)


@router.patch("/{team_id}", response_model=TeamDetailRead)
async def update_team(
    team_id: int,
    payload: TeamUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    repository = TeamRepository(db)
    team = await repository.get_by_id(team_id)

    if team is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found.",
        )

    if current_user.role == TEAM_MANAGER and team.team_manager_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only update your own teams.",
        )

    updated_team = await repository.update(team, payload)

    return serialize_team(updated_team)


@router.delete("/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team(
    team_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    repository = TeamRepository(db)
    team = await repository.get_by_id(team_id)

    if team is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team not found.",
        )

    if current_user.role == TEAM_MANAGER and team.team_manager_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only delete your own teams.",
        )

    await repository.delete(team)
    return None