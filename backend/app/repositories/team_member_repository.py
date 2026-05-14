from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.team_member import TeamMember
from app.schemas.team_member import TeamMemberCreate, TeamMemberUpdate


class TeamMemberRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_by_owner(self, owner_user_id: int) -> list[TeamMember]:
        statement = (
            select(TeamMember)
            .where(TeamMember.owner_user_id == owner_user_id)
            .order_by(TeamMember.created_at.desc())
        )

        result = await self.db.execute(statement)
        return list(result.scalars().all())

    async def get_by_id_for_owner(
        self,
        team_member_id: int,
        owner_user_id: int,
    ) -> TeamMember | None:
        statement = select(TeamMember).where(
            TeamMember.id == team_member_id,
            TeamMember.owner_user_id == owner_user_id,
        )

        result = await self.db.execute(statement)
        return result.scalar_one_or_none()

    async def get_by_email_for_owner(
        self,
        email: str,
        owner_user_id: int,
    ) -> TeamMember | None:
        normalized_email = email.lower().strip()

        statement = select(TeamMember).where(
            TeamMember.email == normalized_email,
            TeamMember.owner_user_id == owner_user_id,
        )

        result = await self.db.execute(statement)
        return result.scalar_one_or_none()

    async def create(
        self,
        payload: TeamMemberCreate,
        owner_user_id: int,
    ) -> TeamMember:
        team_member = TeamMember(
            owner_user_id=owner_user_id,
            full_name=payload.full_name.strip(),
            email=payload.email.lower().strip() if payload.email else None,
            aliases=payload.aliases or [],
            role_title=payload.role_title.strip() if payload.role_title else None,
            is_active=payload.is_active,
        )

        self.db.add(team_member)
        await self.db.commit()
        await self.db.refresh(team_member)

        return team_member

    async def update(
        self,
        team_member: TeamMember,
        payload: TeamMemberUpdate,
    ) -> TeamMember:
        update_data = payload.model_dump(exclude_unset=True)

        if "full_name" in update_data and update_data["full_name"] is not None:
            team_member.full_name = update_data["full_name"].strip()

        if "email" in update_data:
            team_member.email = (
                update_data["email"].lower().strip()
                if update_data["email"]
                else None
            )

        if "aliases" in update_data:
            team_member.aliases = update_data["aliases"] or []

        if "role_title" in update_data:
            team_member.role_title = (
                update_data["role_title"].strip()
                if update_data["role_title"]
                else None
            )

        if "is_active" in update_data and update_data["is_active"] is not None:
            team_member.is_active = update_data["is_active"]

        await self.db.commit()
        await self.db.refresh(team_member)

        return team_member

    async def delete(self, team_member: TeamMember) -> None:
        await self.db.delete(team_member)
        await self.db.commit()