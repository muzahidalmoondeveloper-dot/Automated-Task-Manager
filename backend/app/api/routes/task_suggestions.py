import logging
from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_admin_or_team_manager
from app.models.user import User
from app.services.automation_tasks import analyze_yesterday_sources_for_user

router = APIRouter(prefix="/task-suggestions", tags=["Task Automation"])
logger = logging.getLogger("task_suggestions")


@router.post("/sync-yesterday")
async def sync_yesterday_sources(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin_or_team_manager),
):
    """Analyse yesterday's emails and meeting transcripts and create tasks directly."""
    logger.info(
        "Manual sync triggered by user: id=%s email=%s",
        current_user.id,
        current_user.email,
    )

    result = await analyze_yesterday_sources_for_user(db=db, user=current_user)

    return {
        "period": "yesterday",
        "triggered_at": datetime.now(timezone.utc).isoformat(),
        **result,
        "message": (
            f"Analysed {result.get('sources_analyzed', 0)} sources. "
            f"Created {result.get('tasks_created', 0)} tasks automatically."
        ),
    }
