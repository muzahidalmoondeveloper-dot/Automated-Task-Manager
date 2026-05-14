import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.repositories.integration_repository import IntegrationRepository
from app.services.automation_tasks import (
    sync_microsoft_data_for_user,
    analyze_yesterday_sources_for_user,
)

logger = logging.getLogger("automation_scheduler")

scheduler = AsyncIOScheduler()


async def run_daily_ai_task_sync():
    logger.info("========== DAILY AI TASK SYNC START ==========")

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(User.is_active.is_(True))
        )

        users = list(result.scalars().all())

        logger.info("Active users found: %s", len(users))

        for user in users:
            try:
                repository = IntegrationRepository(db)

                microsoft_accounts = await repository.list_accounts_by_provider(
                    user.id,
                    "microsoft",
                )

                if not microsoft_accounts:
                    logger.info(
                        "Skipping user %s. No Microsoft account connected.",
                        user.email,
                    )
                    continue

                logger.info("Running daily sync for user: %s", user.email)

                sync_result = await sync_microsoft_data_for_user(
                    db=db,
                    user=user,
                )

                logger.info(
                    "Microsoft sync result for %s: %s",
                    user.email,
                    sync_result,
                )

                analysis_result = await analyze_yesterday_sources_for_user(
                    db=db,
                    user=user,
                )

                logger.info(
                    "AI analysis result for %s: %s",
                    user.email,
                    analysis_result,
                )

            except Exception as exc:
                logger.exception(
                    "Daily sync failed for user %s: %s",
                    user.email,
                    exc,
                )

    logger.info("========== DAILY AI TASK SYNC END ==========")


def start_scheduler():
    if scheduler.running:
        logger.info("Automation scheduler already running.")
        return

    # TESTING: runs every 1 minute.
    # scheduler.add_job(
    #     run_daily_ai_task_sync,
    #     trigger="interval",
    #     minutes=1,
    #     id="daily_ai_task_sync",
    #     replace_existing=True,
    #     max_instances=1,
    #     coalesce=True,
    # )

    # PRODUCTION: uncomment below and remove the interval job above.
    scheduler.add_job(
        run_daily_ai_task_sync,
        trigger="cron",
        hour=6,
        minute=0,
        id="daily_ai_task_sync",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    scheduler.start()

    logger.info("Automation scheduler started.")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Automation scheduler stopped.")