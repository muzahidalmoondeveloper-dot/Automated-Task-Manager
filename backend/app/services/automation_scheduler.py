import logging
from datetime import date, timedelta

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.database import AsyncSessionLocal
from app.models.notification import Notification
from app.models.task import Task
from app.models.team import Team
from app.models.user import User
from app.repositories.integration_repository import IntegrationRepository
from app.services.automation_tasks import (
    sync_microsoft_data_for_user,
    analyze_yesterday_sources_for_user,
)
from app.services.email_service import email_service

logger = logging.getLogger("automation_scheduler")

scheduler = AsyncIOScheduler()


# ─── In-app due-date notifications ────────────────────────────────────────────

async def run_due_date_notifications():
    """Send due-soon (≤3 days) and overdue in-app notifications, deduplicating by type per task."""
    today = date.today()
    due_soon_cutoff = today + timedelta(days=3)

    logger.info("========== DUE DATE NOTIFICATIONS START ==========")

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Task)
            .where(Task.assignee_id.isnot(None))
            .where(Task.due_date.isnot(None))
            .where(Task.status.notin_(["done", "pending_review"]))
        )
        tasks = list(result.scalars().all())

        logger.info("Tasks checked for due dates: %s", len(tasks))

        for task in tasks:
            if task.due_date < today:
                notify_type = "task_overdue"
                title = "Task overdue"
                message = f"Your task '{task.name}' is overdue (was due {task.due_date})."
            elif today <= task.due_date <= due_soon_cutoff:
                notify_type = "task_due_soon"
                title = "Task due soon"
                message = f"Your task '{task.name}' is due on {task.due_date}."
            else:
                continue

            # Deduplicate: skip if an unread notification of this type already exists
            existing = await db.execute(
                select(Notification).where(
                    Notification.user_id == task.assignee_id,
                    Notification.task_id == task.id,
                    Notification.type == notify_type,
                    Notification.is_read == False,  # noqa: E712
                )
            )
            if existing.scalar_one_or_none() is not None:
                continue

            db.add(
                Notification(
                    user_id=task.assignee_id,
                    task_id=task.id,
                    title=title,
                    message=message,
                    type=notify_type,
                )
            )
            logger.info(
                "Queued %s notification for user_id=%s task_id=%s",
                notify_type, task.assignee_id, task.id,
            )

        await db.commit()

    logger.info("========== DUE DATE NOTIFICATIONS END ==========")


# ─── Due-date email reminders ─────────────────────────────────────────────────

async def run_due_date_email_reminders():
    """
    Daily job: email the assignee and team manager for tasks due today or tomorrow.

    Skips tasks that are already done. Uses deduplication in EmailNotificationLog
    to avoid sending the same reminder twice per due-date window.
    """
    today = date.today()
    tomorrow = today + timedelta(days=1)

    logger.info("========== DUE DATE EMAIL REMINDERS START ==========")

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Task)
            .where(Task.assignee_id.isnot(None))
            .where(Task.due_date.isnot(None))
            .where(Task.status != "done")
            .where(Task.due_date.in_([today, tomorrow]))
            .options(
                selectinload(Task.assignee),
                selectinload(Task.project),
                selectinload(Task.team),
            )
        )
        tasks = list(result.scalars().all())

        logger.info("Tasks due today/tomorrow requiring reminders: %s", len(tasks))

        for task in tasks:
            window = "today" if task.due_date == today else "tomorrow"

            # ── Email assignee ──────────────────────────────────────
            if task.assignee:
                await email_service.send_due_date_reminder(
                    db,
                    task=task,
                    recipient=task.assignee,
                    window=window,
                    role_label="assignee",
                )

            # ── Email team manager ──────────────────────────────────
            if task.team_id:
                team_result = await db.execute(
                    select(Team).where(Team.id == task.team_id)
                )
                team = team_result.scalar_one_or_none()

                if team and team.team_manager_id:
                    manager_result = await db.execute(
                        select(User).where(User.id == team.team_manager_id)
                    )
                    manager = manager_result.scalar_one_or_none()

                    if manager and (not task.assignee or manager.id != task.assignee_id):
                        await email_service.send_due_date_reminder(
                            db,
                            task=task,
                            recipient=manager,
                            window=window,
                            role_label="manager",
                        )

    logger.info("========== DUE DATE EMAIL REMINDERS END ==========")


# ─── Daily AI task sync ───────────────────────────────────────────────────────

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

    # Due-date EMAIL reminders — runs daily at 08:00
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

    # PRODUCTION alternatives (uncomment to replace the interval jobs above):
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
