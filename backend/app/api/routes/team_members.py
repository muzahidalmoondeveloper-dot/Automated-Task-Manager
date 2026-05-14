from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.repositories.team_member_repository import TeamMemberRepository
from app.schemas.team_member import (
    TeamMemberCreate,
    TeamMemberRead,
    TeamMemberUpdate,
)

router = APIRouter(prefix="/team-members", tags=["Team Members"])


@router.get("", response_model=list[TeamMemberRead])
async def list_team_members(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repository = TeamMemberRepository(db)
    team_members = await repository.list_by_owner(current_user.id)

    return [TeamMemberRead.model_validate(member) for member in team_members]


@router.post(
    "",
    response_model=TeamMemberRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_team_member(
    payload: TeamMemberCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repository = TeamMemberRepository(db)

    if payload.email:
        existing_member = await repository.get_by_email_for_owner(
            email=str(payload.email),
            owner_user_id=current_user.id,
        )

        if existing_member:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A team member with this email already exists.",
            )

    team_member = await repository.create(
        payload=payload,
        owner_user_id=current_user.id,
    )

    return TeamMemberRead.model_validate(team_member)


@router.get("/{team_member_id}", response_model=TeamMemberRead)
async def get_team_member(
    team_member_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repository = TeamMemberRepository(db)

    team_member = await repository.get_by_id_for_owner(
        team_member_id=team_member_id,
        owner_user_id=current_user.id,
    )

    if team_member is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found.",
        )

    return TeamMemberRead.model_validate(team_member)


@router.patch("/{team_member_id}", response_model=TeamMemberRead)
async def update_team_member(
    team_member_id: int,
    payload: TeamMemberUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repository = TeamMemberRepository(db)

    team_member = await repository.get_by_id_for_owner(
        team_member_id=team_member_id,
        owner_user_id=current_user.id,
    )

    if team_member is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found.",
        )

    if payload.email:
        existing_member = await repository.get_by_email_for_owner(
            email=str(payload.email),
            owner_user_id=current_user.id,
        )

        if existing_member and existing_member.id != team_member.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Another team member with this email already exists.",
            )

    updated_member = await repository.update(team_member, payload)

    return TeamMemberRead.model_validate(updated_member)


@router.delete("/{team_member_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_team_member(
    team_member_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    repository = TeamMemberRepository(db)

    team_member = await repository.get_by_id_for_owner(
        team_member_id=team_member_id,
        owner_user_id=current_user.id,
    )

    if team_member is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Team member not found.",
        )

    await repository.delete(team_member)

    return None