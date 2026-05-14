from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.team import Team, TeamMembership
from app.schemas.team import TeamCreate, TeamUpdate
from app.models.task import Task


class TeamRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_all(self) -> list[Team]:
        statement = (
            select(Team)
            .options(
                selectinload(Team.team_manager),
                selectinload(Team.memberships).selectinload(TeamMembership.user),
            )
            .order_by(Team.created_at.desc())
        )
        result = await self.db.execute(statement)
        return list(result.scalars().all())

    async def list_for_manager(self, manager_id: int) -> list[Team]:
        statement = (
            select(Team)
            .where(Team.team_manager_id == manager_id)
            .options(
                selectinload(Team.team_manager),
                selectinload(Team.memberships).selectinload(TeamMembership.user),
            )
            .order_by(Team.name.asc())
        )

        result = await self.db.execute(statement)
        return list(result.scalars().unique().all())

    async def list_for_manager(self, manager_id: int) -> list[Team]:
        statement = (
            select(Team)
            .where(Team.team_manager_id == manager_id)
            .options(
                selectinload(Team.team_manager),
                selectinload(Team.memberships).selectinload(TeamMembership.user),
            )
            .order_by(Team.created_at.desc())
        )
        result = await self.db.execute(statement)
        return list(result.scalars().all())

    async def get_by_id(self, team_id: int) -> Team | None:
        statement = (
            select(Team)
            .where(Team.id == team_id)
            .options(
                selectinload(Team.team_manager),
                selectinload(Team.memberships).selectinload(TeamMembership.user),
            )
        )
        result = await self.db.execute(statement)
        return result.scalar_one_or_none()

    async def create(self, payload: TeamCreate, created_by_id: int) -> Team:
        team = Team(
            name=payload.name.strip(),
            description=payload.description,
            team_manager_id=payload.team_manager_id,
            created_by_id=created_by_id,
        )

        self.db.add(team)
        await self.db.flush()

        member_ids = set(payload.member_ids)
        member_ids.add(payload.team_manager_id)

        for user_id in member_ids:
            self.db.add(
                TeamMembership(
                    team_id=team.id,
                    user_id=user_id,
                )
            )

        await self.db.commit()

        return await self.get_by_id(team.id)

    async def update(self, team: Team, payload: TeamUpdate) -> Team:
        data = payload.model_dump(exclude_unset=True)

        member_ids = data.pop("member_ids", None)

        for key, value in data.items():
            setattr(team, key, value)

        if member_ids is not None:
            await self.db.execute(
                delete(TeamMembership).where(TeamMembership.team_id == team.id)
            )

            final_member_ids = set(member_ids)

            if team.team_manager_id:
                final_member_ids.add(team.team_manager_id)

            for user_id in final_member_ids:
                self.db.add(
                    TeamMembership(
                        team_id=team.id,
                        user_id=user_id,
                    )
                )

        await self.db.commit()

        return await self.get_by_id(team.id)

    async def delete(self, team: Team) -> None:
        await self.db.delete(team)
        await self.db.commit()


    async def list_by_project(self, project_id: int) -> list[Task]:
        statement = (
            select(Task)
            .where(Task.project_id == project_id)
            .options(
                selectinload(Task.assignee),
                selectinload(Task.project),
            )
            .order_by(Task.due_date.asc(), Task.created_at.desc())
        )
        result = await self.db.execute(statement)
        return list(result.scalars().all())