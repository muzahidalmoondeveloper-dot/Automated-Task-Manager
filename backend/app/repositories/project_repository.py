from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.project import Project
from app.schemas.project import ProjectCreate, ProjectUpdate


class ProjectRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_all(self) -> list[Project]:
        statement = select(Project).order_by(Project.created_at.desc())
        result = await self.db.execute(statement)
        return list(result.scalars().all())

    async def get_by_id(self, project_id: int) -> Project | None:
        statement = select(Project).where(Project.id == project_id)
        result = await self.db.execute(statement)
        return result.scalar_one_or_none()

    async def create(self, payload: ProjectCreate, created_by_id: int) -> Project:
        project = Project(
            name=payload.name.strip(),
            description=payload.description,
            status=payload.status,
            created_by_id=created_by_id,
        )

        self.db.add(project)
        await self.db.commit()
        await self.db.refresh(project)

        return project

    async def update(self, project: Project, payload: ProjectUpdate) -> Project:
        data = payload.model_dump(exclude_unset=True)

        if "name" in data and data["name"]:
            data["name"] = data["name"].strip()

        for key, value in data.items():
            setattr(project, key, value)

        await self.db.commit()
        await self.db.refresh(project)

        return project

    async def delete(self, project: Project) -> None:
        await self.db.delete(project)
        await self.db.commit()