from fastapi import APIRouter, Depends, HTTPException
from fastapi import status as http_status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_errors import AppException, AuthError, ErrorDef
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.tenant import TenantContext, get_tenant_context, require_org_admin, require_org_owner
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.user import UserCreate, UserRead, UserUpdate

router = APIRouter(prefix="/users", tags=["Users"])

_USER_NOT_FOUND = ErrorDef(code="USER_NOT_FOUND", status=http_status.HTTP_404_NOT_FOUND, message="User not found.")
_EMAIL_EXISTS = ErrorDef(code="EMAIL_EXISTS", status=http_status.HTTP_409_CONFLICT, message="A user with this email already exists.")
_CANNOT_DELETE_SELF = ErrorDef(code="CANNOT_DELETE_SELF", status=http_status.HTTP_400_BAD_REQUEST, message="You cannot delete your own account.")


@router.get("/me", response_model=UserRead)
async def read_current_user(current_user: User = Depends(get_current_user)):
    return UserRead.model_validate(current_user)


@router.get("", response_model=list[UserRead])
async def list_users(
    tenant: TenantContext = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db),
):
    """List all active users in the current organization."""
    user_repo = UserRepository(db)
    users = await user_repo.list_by_org(tenant.organization_id)
    return [UserRead.model_validate(u) for u in users]


@router.post("", response_model=UserRead, status_code=http_status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    tenant: TenantContext = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db),
):
    """Create a new user and automatically add them to the current organization."""
    user_repo = UserRepository(db)

    existing = await user_repo.get_by_email(payload.email)
    if existing:
        raise AppException(_EMAIL_EXISTS)

    user = await user_repo.create(payload)

    # Auto-add new user to this organization as a member
    from app.repositories.organization_repository import OrganizationRepository
    from app.core.org_roles import ORG_MEMBER
    org_repo = OrganizationRepository(db)
    await org_repo.add_member(tenant.organization_id, user.id, ORG_MEMBER)
    await db.commit()
    await db.refresh(user)

    return UserRead.model_validate(user)


@router.patch("/{user_id}", response_model=UserRead)
async def update_user(
    user_id: int,
    payload: UserUpdate,
    tenant: TenantContext = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db),
):
    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(user_id)
    if user is None:
        raise AppException(_USER_NOT_FOUND)

    if payload.email and payload.email.lower().strip() != user.email:
        if await user_repo.get_by_email(payload.email):
            raise AppException(_EMAIL_EXISTS)

    updated = await user_repo.update(user, payload)
    return UserRead.model_validate(updated)


@router.delete("/{user_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: int,
    tenant: TenantContext = Depends(require_org_owner),
    db: AsyncSession = Depends(get_db),
):
    if user_id == tenant.user.id:
        raise AppException(_CANNOT_DELETE_SELF)

    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(user_id)
    if user is None:
        raise AppException(_USER_NOT_FOUND)

    await user_repo.delete(user)
    return None
