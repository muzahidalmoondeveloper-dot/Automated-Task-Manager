from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.task import Task
from app.schemas.task import TaskCreate, TaskUpdate


class TaskRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_all(self) -> list[Task]:
        statement = (
            select(Task)
            .options(
                selectinload(Task.assignee),
                selectinload(Task.project),
                selectinload(Task.team),
            )
            .order_by(Task.due_date.asc(), Task.created_at.desc())
        )
        result = await self.db.execute(statement)
        return list(result.scalars().all())

    async def list_for_assignee(self, user_id: int) -> list[Task]:
        statement = (
            select(Task)
            .where(Task.assignee_id == user_id)
            .options(
                selectinload(Task.assignee),
                selectinload(Task.project),
                selectinload(Task.team),
            )
            .order_by(Task.due_date.asc(), Task.created_at.desc())
        )
        result = await self.db.execute(statement)
        return list(result.scalars().all())

    async def list_by_project(self, project_id: int) -> list[Task]:
        statement = (
            select(Task)
            .where(Task.project_id == project_id)
            .options(
                selectinload(Task.assignee),
                selectinload(Task.project),
                selectinload(Task.team),
            )
            .order_by(Task.due_date.asc(), Task.created_at.desc())
        )
        result = await self.db.execute(statement)
        return list(result.scalars().all())

    async def list_by_team(self, team_id: int) -> list[Task]:
        statement = (
            select(Task)
            .where(Task.team_id == team_id)
            .options(
                selectinload(Task.assignee),
                selectinload(Task.project),
                selectinload(Task.team),
            )
            .order_by(Task.due_date.asc(), Task.created_at.desc())
        )
        result = await self.db.execute(statement)
        return list(result.scalars().all())

    async def get_by_id(self, task_id: int) -> Task | None:
        statement = (
            select(Task)
            .where(Task.id == task_id)
            .options(
                selectinload(Task.assignee),
                selectinload(Task.project),
                selectinload(Task.team),
            )
        )
        result = await self.db.execute(statement)
        return result.scalar_one_or_none()

    async def create(self, payload: TaskCreate, created_by_id: int) -> Task:
        task = Task(
            name=payload.name.strip(),
            start_date=payload.start_date,
            due_date=payload.due_date,
            status=payload.status,
            assignee_id=payload.assignee_id,
            project_id=payload.project_id,
            team_id=payload.team_id,
            created_by_id=created_by_id,
        )

        self.db.add(task)
        await self.db.commit()

        return await self.get_by_id(task.id)

    async def update(self, task: Task, payload: TaskUpdate) -> Task:
        data = payload.model_dump(exclude_unset=True)

        if "name" in data and data["name"]:
            data["name"] = data["name"].strip()

        for key, value in data.items():
            setattr(task, key, value)

        await self.db.commit()

        return await self.get_by_id(task.id)

    async def delete(self, task: Task) -> None:
        await self.db.delete(task)
        await self.db.commit()