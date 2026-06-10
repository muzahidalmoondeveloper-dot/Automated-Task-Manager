import asyncio
import logging
from datetime import datetime, timezone

from app.core.config import get_settings
from app.core.database import AsyncSessionLocal
from app.core.roles import ADMIN
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserCreate

logger = logging.getLogger(__name__)


async def seed_admin() -> None:
    settings = get_settings()

    if not settings.ADMIN_EMAIL or not settings.ADMIN_PASSWORD:
        logger.info("ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin seed.")
        return

    async with AsyncSessionLocal() as db:
        user_repo = UserRepository(db)
        existing = await user_repo.get_by_email(settings.ADMIN_EMAIL)

        if existing:
            changed = False

            if existing.email_verified_at is None:
                existing.email_verified_at = datetime.now(timezone.utc)
                changed = True

            if existing.last_login_otp_verified_at is None:
                existing.last_login_otp_verified_at = datetime.now(timezone.utc)
                changed = True

            if not existing.is_active:
                existing.is_active = True
                changed = True

            if changed:
                await db.commit()
                logger.info("Existing admin account verified and activated.")
            else:
                logger.info("Admin account already exists and is active.")
            return

        admin = await user_repo.create(
            UserCreate(
                full_name=settings.ADMIN_NAME,
                email=settings.ADMIN_EMAIL,
                password=settings.ADMIN_PASSWORD,
                role=ADMIN,
            )
        )

        admin.email_verified_at = datetime.now(timezone.utc)
        admin.last_login_otp_verified_at = datetime.now(timezone.utc)
        admin.is_active = True

        await db.commit()
        await db.refresh(admin)

        logger.info("Default admin created: %s", settings.ADMIN_EMAIL)


if __name__ == "__main__":
    asyncio.run(seed_admin())
