import uuid

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth_errors import AppException, AuthError, ErrorDef
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.org_roles import ORG_MEMBER, ORG_OWNER
from app.core.plan_limits import get_plan_limits
from app.core.security import create_access_token, create_refresh_token, hash_token
from app.core.tenant import (
    TenantContext,
    enforce_member_limit,
    get_tenant_context,
    require_org_admin,
    require_org_owner,
)
from app.core.token_cache import TokenCache, get_token_cache
from app.models.organization import OrganizationMembership
from app.models.project import Project
from app.models.team import Team
from app.models.user import User
from app.repositories.organization_repository import OrganizationRepository
from app.repositories.refresh_token_repository import RefreshTokenRepository
from app.schemas.auth import TokenResponse
from app.schemas.organization import (
    AcceptInvitationRequest,
    InvitationRead,
    InviteMemberRequest,
    MembershipRead,
    OrgUsageRead,
    OrganizationCreate,
    OrganizationRead,
    OrganizationUpdate,
    PlanLimitsRead,
    SubscriptionRead,
    UpdateMemberRoleRequest,
)
from app.schemas.user import UserRead
from app.services.email_service import EmailService
from fastapi import status as http_status
from datetime import datetime, timezone

_SLUG_TAKEN = ErrorDef(
    code="SLUG_TAKEN",
    status=http_status.HTTP_409_CONFLICT,
    message="This organization slug is already taken.",
)
_ALREADY_MEMBER = ErrorDef(
    code="ALREADY_MEMBER",
    status=http_status.HTTP_409_CONFLICT,
    message="User is already a member of this organization.",
)
_CANNOT_REMOVE_OWNER = ErrorDef(
    code="CANNOT_REMOVE_OWNER",
    status=http_status.HTTP_400_BAD_REQUEST,
    message="The organization owner cannot be removed. Transfer ownership first.",
)
_INVITATION_INVALID = ErrorDef(
    code="INVITATION_INVALID",
    status=http_status.HTTP_400_BAD_REQUEST,
    message="Invitation is invalid or has expired.",
)
_INVITATION_ALREADY_ACCEPTED = ErrorDef(
    code="INVITATION_ALREADY_ACCEPTED",
    status=http_status.HTTP_400_BAD_REQUEST,
    message="This invitation has already been accepted.",
)

router = APIRouter(prefix="/organizations", tags=["Organizations"])


async def _issue_org_token_pair(
    user: User,
    org_id: uuid.UUID,
    org_role: str,
    db: AsyncSession,
    token_cache: TokenCache,
) -> TokenResponse:
    access_token, _jti, exp = create_access_token(
        subject=str(user.id),
        extra_claims={"email": user.email, "org_id": str(org_id), "org_role": org_role},
    )
    refresh_str, refresh_hash, refresh_exp = create_refresh_token(subject=str(user.id))
    token_repo = RefreshTokenRepository(db)
    await token_repo.save(
        token_hash=refresh_hash,
        user_id=user.id,
        expires_at=datetime.fromtimestamp(refresh_exp, tz=timezone.utc),
    )
    await db.commit()
    await token_cache.clear_user_access_token_blacklist(str(user.id))
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_str,
        expires_at=exp,
        user=UserRead.model_validate(user),
    )


# ── Create organization ───────────────────────────────────────────────────────

@router.post("", response_model=TokenResponse, status_code=http_status.HTTP_201_CREATED)
async def create_organization(
    payload: OrganizationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    token_cache: TokenCache = Depends(get_token_cache),
):
    """Any authenticated user can create a new organization.
    Returns a new org-scoped token pair so the caller is immediately in context."""
    slug = payload.resolved_slug()
    repo = OrganizationRepository(db)

    if await repo.slug_exists(slug):
        raise AppException(_SLUG_TAKEN)

    org = await repo.create(
        name=payload.name,
        slug=slug,
        owner_id=current_user.id,
        plan="free",
    )
    membership = await repo.add_member(org.id, current_user.id, role=ORG_OWNER)
    await repo.get_or_create_subscription(org.id, plan="free")
    await db.commit()

    return await _issue_org_token_pair(current_user, org.id, ORG_OWNER, db, token_cache)


# ── Read / update / deactivate ────────────────────────────────────────────────

@router.get("/current", response_model=OrganizationRead)
async def get_current_org(tenant: TenantContext = Depends(get_tenant_context)):
    return OrganizationRead.model_validate(tenant.organization)


@router.put("/current", response_model=OrganizationRead)
async def update_current_org(
    payload: OrganizationUpdate,
    tenant: TenantContext = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db),
):
    repo = OrganizationRepository(db)
    data = payload.model_dump(exclude_unset=True)
    org = await repo.update(tenant.organization, data)
    await db.commit()
    await db.refresh(org)
    return OrganizationRead.model_validate(org)


@router.delete("/current", status_code=http_status.HTTP_204_NO_CONTENT)
async def deactivate_current_org(
    tenant: TenantContext = Depends(require_org_owner),
    db: AsyncSession = Depends(get_db),
):
    repo = OrganizationRepository(db)
    await repo.deactivate(tenant.organization)
    await db.commit()


# ── Members ───────────────────────────────────────────────────────────────────

@router.get("/current/members", response_model=list[MembershipRead])
async def list_members(
    tenant: TenantContext = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db),
):
    repo = OrganizationRepository(db)
    rows = await repo.list_members(tenant.organization_id)
    return [
        MembershipRead(
            id=m.id,
            organization_id=m.organization_id,
            user_id=m.user_id,
            role=m.role,
            is_active=m.is_active,
            joined_at=m.joined_at,
            user=UserRead.model_validate(u),
        )
        for m, u in rows
    ]


@router.delete("/current/members/{user_id}", status_code=http_status.HTTP_204_NO_CONTENT)
async def remove_member(
    user_id: int,
    tenant: TenantContext = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db),
):
    if user_id == tenant.organization.owner_id:
        raise AppException(_CANNOT_REMOVE_OWNER)

    repo = OrganizationRepository(db)
    membership = await repo.get_membership(tenant.organization_id, user_id)
    if membership is None or not membership.is_active:
        raise AuthError.user_not_found()

    await repo.remove_member(membership)
    await db.commit()


@router.put("/current/members/{user_id}/role", response_model=MembershipRead)
async def update_member_role(
    user_id: int,
    payload: UpdateMemberRoleRequest,
    tenant: TenantContext = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db),
):
    if user_id == tenant.organization.owner_id and payload.role != ORG_OWNER:
        raise AppException(_CANNOT_REMOVE_OWNER)

    repo = OrganizationRepository(db)
    membership = await repo.get_membership(tenant.organization_id, user_id)
    if membership is None or not membership.is_active:
        raise AuthError.user_not_found()

    updated = await repo.update_member_role(membership, payload.role)
    await db.commit()
    await db.refresh(updated)

    from app.repositories.user_repository import UserRepository
    user_repo = UserRepository(db)
    user = await user_repo.get_by_id(user_id)

    return MembershipRead(
        id=updated.id,
        organization_id=updated.organization_id,
        user_id=updated.user_id,
        role=updated.role,
        is_active=updated.is_active,
        joined_at=updated.joined_at,
        user=UserRead.model_validate(user),
    )


# ── Invitations ───────────────────────────────────────────────────────────────

@router.post(
    "/current/members/invite",
    response_model=InvitationRead,
    status_code=http_status.HTTP_201_CREATED,
)
async def invite_member(
    payload: InviteMemberRequest,
    tenant: TenantContext = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db),
):
    await enforce_member_limit(tenant, db)

    repo = OrganizationRepository(db)
    from app.repositories.user_repository import UserRepository

    # Check if user is already a member
    user_repo = UserRepository(db)
    existing_user = await user_repo.get_by_email(str(payload.email))
    if existing_user:
        existing_membership = await repo.get_membership(tenant.organization_id, existing_user.id)
        if existing_membership and existing_membership.is_active:
            raise AppException(_ALREADY_MEMBER)

    invitation = await repo.create_invitation(
        org_id=tenant.organization_id,
        email=str(payload.email),
        role=payload.role,
        invited_by_id=tenant.user.id,
    )
    await db.commit()
    await db.refresh(invitation)

    # Send invitation email
    email_service = EmailService()
    email_service.send_invitation_email(
        to_email=str(payload.email),
        org_name=tenant.organization.name,
        inviter_name=tenant.user.full_name,
        token=invitation.token,
    )

    return InvitationRead.model_validate(invitation)


@router.get("/current/invitations", response_model=list[InvitationRead])
async def list_pending_invitations(
    tenant: TenantContext = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db),
):
    repo = OrganizationRepository(db)
    invitations = await repo.list_pending_invitations(tenant.organization_id)
    return [InvitationRead.model_validate(i) for i in invitations]


# ── Subscription & Usage ──────────────────────────────────────────────────────

@router.get("/current/subscription", response_model=SubscriptionRead)
async def get_subscription(
    tenant: TenantContext = Depends(require_org_admin),
    db: AsyncSession = Depends(get_db),
):
    repo = OrganizationRepository(db)
    sub = await repo.get_or_create_subscription(tenant.organization_id, tenant.organization.plan)
    await db.commit()
    return SubscriptionRead.model_validate(sub)


@router.get("/current/usage", response_model=OrgUsageRead)
async def get_usage(
    tenant: TenantContext = Depends(get_tenant_context),
    db: AsyncSession = Depends(get_db),
):
    repo = OrganizationRepository(db)
    limits = tenant.plan_limits

    member_count = await repo.count_active_members(tenant.organization_id)

    team_result = await db.execute(
        select(func.count(Team.id)).where(Team.organization_id == tenant.organization_id)
    )
    team_count = team_result.scalar_one() or 0

    project_result = await db.execute(
        select(func.count(Project.id)).where(Project.organization_id == tenant.organization_id)
    )
    project_count = project_result.scalar_one() or 0

    return OrgUsageRead(
        plan=tenant.organization.plan,
        limits=PlanLimitsRead(
            max_members=limits.max_members,
            max_teams=limits.max_teams,
            max_projects=limits.max_projects,
            max_tasks_per_month=limits.max_tasks_per_month,
            has_ai_features=limits.has_ai_features,
            has_integrations=limits.has_integrations,
            has_api_access=limits.has_api_access,
            storage_gb=limits.storage_gb,
        ),
        current_members=member_count,
        current_teams=team_count,
        current_projects=project_count,
    )
