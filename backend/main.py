from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pathlib import Path

from sqlalchemy import text

from app.core.config import get_settings
from app.core.database import engine, Base
from app.api.routes import auth, users, teams, projects, tasks, integrations, task_suggestions
from app.api.routes import chat, notifications
from app.api.routes import organization  # noqa: F401
from app.api.routes import team_news
from app.api.routes import rocks
from app.api.routes import kpi
from app.api.routes import issues
import app.models.issue  # noqa: F401  — register Issue
import app.models.chat  # noqa: F401  — register models for auto table creation
import app.models.email_notification_log  # noqa: F401  — register EmailNotificationLog
import app.models.org_value  # noqa: F401  — register OrgValue
import app.models.objective  # noqa: F401  — register Objective
import app.models.org_role  # noqa: F401  — register OrgRole
import app.models.team_news  # noqa: F401  — register TeamNews
import app.models.rock  # noqa: F401  — register Rock, Milestone
import app.models.kpi  # noqa: F401  — register KPI, KPIEntry
from contextlib import asynccontextmanager
import logging
from app.services.automation_scheduler import start_scheduler, stop_scheduler
from seed_admin import seed_admin

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await conn.execute(text(
            "ALTER TABLE imported_emails ADD COLUMN IF NOT EXISTS tasks_extracted BOOLEAN NOT NULL DEFAULT FALSE"
        ))
        await conn.execute(text(
            "ALTER TABLE meeting_transcripts ADD COLUMN IF NOT EXISTS tasks_extracted BOOLEAN NOT NULL DEFAULT FALSE"
        ))
        await conn.execute(text(
            "ALTER TABLE tasks ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'medium'"
        ))
        await conn.execute(text(
            "ALTER TABLE rocks ADD COLUMN IF NOT EXISTS icon VARCHAR(200)"
        ))
        await conn.execute(text(
            "ALTER TABLE rocks ADD COLUMN IF NOT EXISTS is_archived BOOLEAN NOT NULL DEFAULT FALSE"
        ))
        await conn.execute(text(
            "ALTER TABLE kpi_entries ADD COLUMN IF NOT EXISTS forecast DOUBLE PRECISION"
        ))
        await conn.execute(text(
            "ALTER TABLE kpi_entries ADD COLUMN IF NOT EXISTS notes JSONB DEFAULT '[]'"
        ))
        await conn.execute(text(
            "ALTER TABLE kpis ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0"
        ))
        await conn.execute(text(
            "ALTER TABLE kpi_entries ALTER COLUMN value DROP NOT NULL"
        ))

    await seed_admin()

    start_scheduler()

    yield

    stop_scheduler()

    await engine.dispose()


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)

app = FastAPI(
    title=settings.APP_NAME,
    version="0.1.0",
    openapi_url=f"{settings.API_PREFIX}/openapi.json",
    docs_url=f"{settings.API_PREFIX}/docs",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.API_PREFIX)
app.include_router(users.router, prefix=settings.API_PREFIX)
app.include_router(teams.router, prefix=settings.API_PREFIX)
app.include_router(projects.router, prefix=settings.API_PREFIX)
app.include_router(tasks.router, prefix=settings.API_PREFIX)
app.include_router(integrations.router, prefix=settings.API_PREFIX)
app.include_router(task_suggestions.router, prefix=settings.API_PREFIX)
app.include_router(chat.router, prefix=settings.API_PREFIX)
app.include_router(notifications.router, prefix=settings.API_PREFIX)
app.include_router(organization.router, prefix=settings.API_PREFIX)
app.include_router(team_news.router, prefix=settings.API_PREFIX)
app.include_router(rocks.router, prefix=settings.API_PREFIX)
app.include_router(kpi.router, prefix=settings.API_PREFIX)
app.include_router(issues.router, prefix=settings.API_PREFIX)

@app.get("/health")
async def health_check():
    return {"status": "ok"}


FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"

if FRONTEND_DIST.exists():
    app.mount(
        "/assets",
        StaticFiles(directory=FRONTEND_DIST / "assets"),
        name="assets",
    )

    @app.get("/{full_path:path}")
    async def serve_react_app(full_path: str):
        if full_path.startswith("api") or full_path in {"health", "docs", "openapi.json"}:
            return {"detail": "Not Found"}
        index_file = FRONTEND_DIST / "index.html"
        return FileResponse(index_file)
else:
    @app.get("/")
    async def root():
        return {"message": "Welcome to the Automated Task Manager API"}
