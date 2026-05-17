"""
Celery tasks for Microsoft data sync and AI task extraction.

Workflow enqueued by the scheduler:
  1. sync_microsoft_data_task(user_id)   — fetch emails / calendar / transcripts
  2. analyze_sources_task(user_id)        — AI extraction → create tasks
     (auto-chained at the end of step 1)
"""
import asyncio
import logging

from app.worker.celery_app import celery_app
from app.worker.database import WorkerSession
from app.repositories.user_repository import UserRepository
from app.services.automation_tasks import (
    analyze_yesterday_sources_for_user,
    sync_microsoft_data_for_user,
)

logger = logging.getLogger("celery.sync_tasks")


# ─── 1. Microsoft data sync ───────────────────────────────────────────────────

@celery_app.task(
    bind=True,
    name="app.worker.tasks.sync_tasks.sync_microsoft_data_task",
    max_retries=2,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
)
def sync_microsoft_data_task(self, user_id: int):
    result = asyncio.run(_do_sync_microsoft(user_id))
    logger.info(
        "sync_microsoft_data done | user_id=%s | emails=%s events=%s transcripts=%s",
        user_id,
        result.get("emails_imported", 0),
        result.get("calendar_events_imported", 0),
        result.get("transcripts_imported", 0),
    )
    # Chain: after sync completes, kick off AI extraction.
    analyze_sources_task.delay(user_id)


async def _do_sync_microsoft(user_id: int) -> dict:
    async with WorkerSession() as db:
        user = await UserRepository(db).get_by_id(user_id)
        if not user:
            logger.warning("sync_microsoft_data: user not found | user_id=%s", user_id)
            return {}
        return await sync_microsoft_data_for_user(db=db, user=user)


# ─── 2. AI task extraction ────────────────────────────────────────────────────

@celery_app.task(
    bind=True,
    name="app.worker.tasks.sync_tasks.analyze_sources_task",
    max_retries=2,
    autoretry_for=(Exception,),
    retry_backoff=True,
    retry_backoff_max=300,
    retry_jitter=True,
)
def analyze_sources_task(self, user_id: int):
    result = asyncio.run(_do_analyze_sources(user_id))
    logger.info(
        "analyze_sources done | user_id=%s | sources=%s tasks_created=%s",
        user_id,
        result.get("sources_analyzed", 0),
        result.get("tasks_created", 0),
    )


async def _do_analyze_sources(user_id: int) -> dict:
    async with WorkerSession() as db:
        user = await UserRepository(db).get_by_id(user_id)
        if not user:
            logger.warning("analyze_sources: user not found | user_id=%s", user_id)
            return {}
        return await analyze_yesterday_sources_for_user(db=db, user=user)
