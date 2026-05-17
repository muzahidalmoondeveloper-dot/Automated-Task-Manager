"""
Automation scheduler — thin enqueuer only.

The APScheduler jobs in this module perform only lightweight database queries
(e.g. finding users with active Microsoft accounts) and then enqueue Celery
tasks.  No email sending, no external API calls, no AI inference runs here.
All heavy work is executed by the Celery worker process.
"""
import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select

from app.core.database import AsyncSessionLocal
from app.models.user import User
from app.repositories.integration_repository import IntegrationRepository

logger = logging.getLogger("automation_scheduler")

scheduler = AsyncIOScheduler()


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _enqueue(task_fn, *args, **kwargs) -> bool:
    """Call .delay() on a Celery task, logging if Redis is unavailable."""
    try:
        task_fn.delay(*args, **kwargs)
        return True
    except Exception as exc:
        logger.error("Failed to enqueue %s: %s", task_fn.name, exc)
        return False


# ─── Scheduler job: in-app due-date notifications ────────────────────────────

async def run_due_date_notifications():
    """Enqueue the Celery task that creates in-app due / overdue notifications."""
    from app.worker.tasks.notification_tasks import run_due_date_notifications_task

    logger.info("Scheduler: enqueuing run_due_date_notifications_task")
    _enqueue(run_due_date_notifications_task)


# ─── Scheduler job: due-date email reminders ─────────────────────────────────

async def run_due_date_email_reminders():
    """Enqueue the Celery task that emails assignees and managers for tasks due today/tomorrow."""
    from app.worker.tasks.notification_tasks import run_due_date_email_reminders_task

    logger.info("Scheduler: enqueuing run_due_date_email_reminders_task")
    _enqueue(run_due_date_email_reminders_task)


# ─── Scheduler job: daily AI task sync ───────────────────────────────────────

async def run_daily_ai_task_sync():
    """
    For each active user with a Microsoft account, enqueue a Celery sync task.

    The Celery sync task fetches emails / calendar / transcripts and then
    auto-chains the AI extraction task once the sync is done.
    """
    from app.worker.tasks.sync_tasks import sync_microsoft_data_task

    logger.info("Scheduler: enqueuing Microsoft sync jobs")

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(User.is_active.is_(True))
        )
        users = list(result.scalars().all())

        logger.info("Active users found: %s", len(users))

        enqueued = 0
        for user in users:
            try:
                repository = IntegrationRepository(db)
                microsoft_accounts = await repository.list_accounts_by_provider(
                    user.id, "microsoft",
                )

                if not microsoft_accounts:
                    logger.info("Skipping user %s — no Microsoft account.", user.email)
                    continue

                if _enqueue(sync_microsoft_data_task, user.id):
                    enqueued += 1
                    logger.info(
                        "Enqueued sync_microsoft_data_task | user_id=%s email=%s",
                        user.id, user.email,
                    )

            except Exception as exc:
                logger.exception(
                    "Failed to enqueue sync for user %s: %s",
                    user.email, exc,
                )

    logger.info("Scheduler: enqueued %s Microsoft sync job(s)", enqueued)


# ─── Scheduler setup ─────────────────────────────────────────────────────────

def start_scheduler():
    if scheduler.running:
        logger.info("Automation scheduler already running.")
        return

    # AI task sync — TESTING: every 5 minutes; PRODUCTION: daily cron at 06:00
    scheduler.add_job(
        run_daily_ai_task_sync,
        trigger="interval",
        minutes=5,
        id="daily_ai_task_sync",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    # In-app due-date notifications — runs every hour
    scheduler.add_job(
        run_due_date_notifications,
        trigger="interval",
        hours=1,
        id="due_date_notifications",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    # Due-date EMAIL reminders — runs daily at 08:00 UTC
    scheduler.add_job(
        run_due_date_email_reminders,
        trigger="cron",
        hour=8,
        minute=0,
        id="due_date_email_reminders",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )

    # PRODUCTION alternative (uncomment to replace the interval job above):
    # scheduler.add_job(
    #     run_daily_ai_task_sync,
    #     trigger="cron",
    #     hour=6, minute=0,
    #     id="daily_ai_task_sync",
    #     replace_existing=True,
    #     max_instances=1,
    #     coalesce=True,
    # )

    scheduler.start()
    logger.info("Automation scheduler started.")


def stop_scheduler():
    if scheduler.running:
        scheduler.shutdown(wait=False)
        logger.info("Automation scheduler stopped.")
