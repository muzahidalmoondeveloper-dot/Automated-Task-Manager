import asyncio
from datetime import datetime, timezone

from app.core.database import AsyncSessionLocal
from app.core.roles import ADMIN
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserCreate


ADMIN_NAME = "Default Admin"
ADMIN_EMAIL = "admin@example.com"
ADMIN_PASSWORD = "admin12345"


async def seed_admin():
    async with AsyncSessionLocal() as db:
        user_repo = UserRepository(db)

        existing_admin = await user_repo.get_by_email(ADMIN_EMAIL)

        if existing_admin:
            changed = False

            if existing_admin.email_verified_at is None:
                existing_admin.email_verified_at = datetime.now(timezone.utc)
                changed = True

            if existing_admin.last_login_otp_verified_at is None:
                existing_admin.last_login_otp_verified_at = datetime.now(timezone.utc)
                changed = True

            if not existing_admin.is_active:
                existing_admin.is_active = True
                changed = True

            if changed:
                await db.commit()
                print("Existing admin verified and activated.")
            else:
                print("Admin already exists and is already verified.")

            print(f"Email: {ADMIN_EMAIL}")
            print(f"Password: {ADMIN_PASSWORD}")
            return

        admin = await user_repo.create(
            UserCreate(
                full_name=ADMIN_NAME,
                email=ADMIN_EMAIL,
                password=ADMIN_PASSWORD,
                role=ADMIN,
            )
        )

        admin.email_verified_at = datetime.now(timezone.utc)
        admin.last_login_otp_verified_at = datetime.now(timezone.utc)
        admin.is_active = True

        await db.commit()
        await db.refresh(admin)

        print("Default admin created and verified.")
        print(f"Email: {ADMIN_EMAIL}")
        print(f"Password: {ADMIN_PASSWORD}")


if __name__ == "__main__":
    asyncio.run(seed_admin())