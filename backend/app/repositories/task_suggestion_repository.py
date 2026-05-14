from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.task_suggestion import TaskSuggestion
from app.schemas.task_suggestion import ExtractedTask



class TaskSuggestionRepository:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def list_pending(self, user_id: int) -> list[TaskSuggestion]:
        statement = (
            select(TaskSuggestion)
            .where(TaskSuggestion.created_by_id == user_id)
            .where(TaskSuggestion.status == "pending")
            .order_by(TaskSuggestion.created_at.desc())
        )
        result = await self.db.execute(statement)
        return list(result.scalars().all())

    async def source_already_analyzed(
        self,
        *,
        source_type: str,
        source_id: int,
        created_by_id: int,
    ) -> bool:
        statement = (
            select(func.count(TaskSuggestion.id))
            .where(TaskSuggestion.source_type == source_type)
            .where(TaskSuggestion.source_id == source_id)
            .where(TaskSuggestion.created_by_id == created_by_id)
        )

        result = await self.db.execute(statement)
        count = result.scalar_one()

        return count > 0

    async def get_by_id(self, suggestion_id: int) -> TaskSuggestion | None:
        statement = select(TaskSuggestion).where(TaskSuggestion.id == suggestion_id)
        result = await self.db.execute(statement)
        return result.scalar_one_or_none()

    async def create_many(
        self,
        *,
        source_type: str,
        source_id: int,
        tasks: list[ExtractedTask],
        raw_ai_payload: dict,
        created_by_id: int,
    ) -> list[TaskSuggestion]:
        suggestions = []

        for task in tasks:
            suggestion = TaskSuggestion(
                source_type=source_type,
                source_id=source_id,
                title=task.title,
                description=task.description,
                suggested_start_date=task.suggested_start_date,
                suggested_due_date=task.suggested_due_date,
                suggested_assignee_name=task.suggested_assignee_name,
                suggested_assignee_email=task.suggested_assignee_email,
                suggested_project_name=task.suggested_project_name,
                suggested_team_name=task.suggested_team_name,
                confidence=task.confidence,
                raw_ai_payload=raw_ai_payload,
                created_by_id=created_by_id,
            )

            self.db.add(suggestion)
            suggestions.append(suggestion)

        await self.db.commit()

        for suggestion in suggestions:
            await self.db.refresh(suggestion)

        return suggestions