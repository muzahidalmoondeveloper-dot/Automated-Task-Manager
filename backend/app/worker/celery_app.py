import logging

from celery import Celery
from celery.signals import task_failure, task_prerun, task_success

from app.core.config import settings

logger = logging.getLogger("celery.app")

celery_app = Celery(
    "task_manager",
    broker=settings.celery_broker,
    backend=settings.celery_backend,
    include=[
        "app.worker.tasks.email_tasks",
        "app.worker.tasks.sync_tasks",
        "app.worker.tasks.notification_tasks",
    ],
)

celery_app.conf.update(
    # Serialisation
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],

    # Time zone
    timezone="UTC",
    enable_utc=True,

    # Reliability: only ACK after the task completes, so a crashed worker
    # puts the task back on the queue.
    task_acks_late=True,
    task_reject_on_worker_lost=True,

    # Keep workers from prefetching many tasks at once — important for
    # long-running sync/AI jobs.
    worker_prefetch_multiplier=1,

    # Track STARTED state so the result backend shows in-progress tasks.
    task_track_started=True,

    # Time limits: soft sends SIGTERM so the task can clean up; hard SIGKILL.
    task_soft_time_limit=300,   # 5 minutes
    task_time_limit=600,        # 10 minutes

    # Result TTL: keep results for 24 hours then auto-delete.
    result_expires=86400,

    # Route tasks to named queues.
    task_routes={
        "app.worker.tasks.email_tasks.*": {"queue": "emails"},
        "app.worker.tasks.sync_tasks.*": {"queue": "sync"},
        "app.worker.tasks.notification_tasks.*": {"queue": "notifications"},
    },
    task_default_queue="default",
)


# ─── Celery signals for structured logging ────────────────────────────────────

@task_prerun.connect
def on_task_prerun(task_id, task, args, kwargs, **_):
    logger.info(
        "CELERY START | task=%s | id=%s | args=%s | kwargs=%s",
        task.name, task_id, args, kwargs,
    )


@task_success.connect
def on_task_success(sender, result, **_):
    logger.info("CELERY SUCCESS | task=%s", sender.name)


@task_failure.connect
def on_task_failure(task_id, exception, traceback, sender, **_):
    logger.error(
        "CELERY FAILURE | task=%s | id=%s | error=%s",
        sender.name, task_id, exception,
    )
