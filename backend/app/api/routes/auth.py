import time
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from redis.asyncio import Redis
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.access_token_bearer import AccessTokenBearer
from app.core.auth_errors import AuthError, TokenError
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.rate_limiter import RateLimiter, get_rate_limiter
from app.core.redis_client import get_redis
from app.core.roles import TEAM_MEMBER
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_refresh_token,
    hash_token,
    hash_password,
    validate_password_strength,
    verify_password,
)
from app.core.token_cache import TokenCache, get_token_cache
from app.models.user import User
from app.repositories.refresh_token_repository import RefreshTokenRepository
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
    AuthenticatedUserResponse,
    ForgotPasswordRequest,
    LoginPasswordResponse,
    LoginRequest,
    LogoutRequest,
    RefreshTokenRequest,
    ResendOTPRequest,
    ResetPasswordRequest,
    TokenResponse,
    VerifyLoginOTPRequest,
    VerifyRegisterOTPRequest,
)
from app.schemas.user import UserCreate, UserRead
from app.services.auth_security_service import (
    AuthSecurityService,
    get_client_ip,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


async def _issue_token_pair(
    user: User,
    db: AsyncSession,
    token_cache: TokenCache,
) -> TokenResponse:
    """Create access + refresh tokens, persist the refresh token, and return the full response."""
    access_token, _jti, exp = create_access_token(
        subject=str(user.id),
        extra_claims={"email": user.email, "role": user.role},
    )
    refresh_token_str, refresh_hash, refresh_exp = create_refresh_token(subject=str(user.id))

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
        refresh_token=refresh_token_str,
        expires_at=exp,
        token_type="bearer",
        user=UserRead.model_validate(user),
    )


@router.post("/register")
async def register(
    payload: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    rate_limiter: RateLimiter = Depends(get_rate_limiter),
    redis: Redis = Depends(get_redis),
):
    if await rate_limiter.is_rate_limited("register", request):
        raise AuthError.rate_limited()

    pwd_check = validate_password_strength(payload.password)
    if not pwd_check["valid"]:
        raise AuthError.invalid_password(pwd_check["errors"])

    lock_key = f"register_lock:{payload.email.lower().strip()}"
    lock = redis.lock(lock_key, timeout=10)

    try:
        acquired = await lock.acquire(blocking=True, blocking_timeout=5)
        if not acquired:
            raise AuthError.rate_limited("Registration in progress. Please try again.")

        user_repo = UserRepository(db)
        existing_user = await user_repo.get_by_email(payload.email)

        if existing_user:
            if existing_user.email_verified_at is None and not existing_user.is_active:
                security_service = AuthSecurityService(db)
                await security_service.create_and_send_otp(
                    user=existing_user,
                    email=existing_user.email,
                    purpose="register",
                )
                return {
                    "message": "You have already registered. A new OTP has been sent to your email.",
                    "email": existing_user.email,
                }
            raise AuthError.email_exists()

        payload.role = TEAM_MEMBER
        user = await user_repo.create(payload)
        user.email_verified_at = None
        user.is_active = False
        await db.commit()
        await db.refresh(user)

        security_service = AuthSecurityService(db)
        await security_service.create_and_send_otp(user=user, email=user.email, purpose="register")

        return {
            "message": "Registration successful. Please verify the OTP sent to your email.",
            "email": user.email,
        }

    except Exception:
        raise
    finally:
        try:
            await lock.release()
        except Exception:
            pass


@router.post("/register/verify-otp", response_model=TokenResponse)
async def verify_register_otp(
    payload: VerifyRegisterOTPRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    token_cache: TokenCache = Depends(get_token_cache),
    rate_limiter: RateLimiter = Depends(get_rate_limiter),
):
    if await rate_limiter.is_rate_limited("verify_otp", request):
        raise AuthError.rate_limited()

    ip_address = get_client_ip(request)
    security_service = AuthSecurityService(db)

    otp = await security_service.verify_otp(
        email=str(payload.email),
        otp_code=payload.otp_code,
        purpose="register",
        ip_address=ip_address,
    )

    if otp.user_id is None:
        raise AuthError.invalid_otp()

    user = await db.get(User, otp.user_id)
    if user is None:
        raise AuthError.user_not_found()

    user.email_verified_at = datetime.now(timezone.utc)
    user.is_active = True
    await db.commit()
    await db.refresh(user)

    return await _issue_token_pair(user, db, token_cache)


@router.post("/login", response_model=LoginPasswordResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    token_cache: TokenCache = Depends(get_token_cache),
    rate_limiter: RateLimiter = Depends(get_rate_limiter),
):
    if await rate_limiter.is_rate_limited("login", request):
        raise AuthError.rate_limited()

    user_repo = UserRepository(db)
    user = await user_repo.get_by_email(payload.email)

    if user is None or not verify_password(payload.password, user.hashed_password):
        raise AuthError.invalid_credentials()

    if user.email_verified_at is None:
        security_service = AuthSecurityService(db)
        await security_service.create_and_send_otp(user=user, email=user.email, purpose="register")
        return LoginPasswordResponse(
            otp_required=False,
            email_verification_required=True,
            message="Your email is not verified. OTP sent to your email.",
            email=user.email,
        )

    if not user.is_active:
        raise AuthError.account_inactive()

    security_service = AuthSecurityService(db)

    if security_service.login_otp_required(user):
        await security_service.create_and_send_otp(user=user, email=user.email, purpose="login")
        return LoginPasswordResponse(
            otp_required=True,
            email_verification_required=False,
            message="OTP sent to your email.",
            email=user.email,
        )

    token_pair = await _issue_token_pair(user, db, token_cache)

    return LoginPasswordResponse(
        otp_required=False,
        email_verification_required=False,
        message="Login successful.",
        email=user.email,
        access_token=token_pair.access_token,
        refresh_token=token_pair.refresh_token,
        expires_at=token_pair.expires_at,
        token_type="bearer",
        user=token_pair.user,
    )


@router.post("/login/verify-otp", response_model=TokenResponse)
async def verify_login_otp(
    payload: VerifyLoginOTPRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    token_cache: TokenCache = Depends(get_token_cache),
    rate_limiter: RateLimiter = Depends(get_rate_limiter),
):
    if await rate_limiter.is_rate_limited("verify_otp", request):
        raise AuthError.rate_limited()

    ip_address = get_client_ip(request)
    security_service = AuthSecurityService(db)

    otp = await security_service.verify_otp(
        email=str(payload.email),
        otp_code=payload.otp_code,
        purpose="login",
        ip_address=ip_address,
    )

    if otp.user_id is None:
        raise AuthError.invalid_otp()

    user = await db.get(User, otp.user_id)
    if user is None:
        raise AuthError.user_not_found()

    if not user.is_active:
        raise AuthError.account_inactive()

    user.last_login_otp_verified_at = datetime.now(timezone.utc)
    await db.commit()
    await db.refresh(user)

    return await _issue_token_pair(user, db, token_cache)


@router.post("/token-refresh", response_model=TokenResponse)
async def refresh_access_token(
    data: RefreshTokenRequest,
    db: AsyncSession = Depends(get_db),
    token_cache: TokenCache = Depends(get_token_cache),
):
    payload = decode_refresh_token(data.refresh_token)
    if not payload:
        raise TokenError.invalid()

    user_id = payload.get("sub")
    if not user_id:
        raise TokenError.invalid("Invalid user ID in token.")

    token_hash = hash_token(data.refresh_token)
    token_repo = RefreshTokenRepository(db)
    stored = await token_repo.get_by_hash(token_hash)

    if not stored:
        raise TokenError.invalid()

    if stored.is_revoked:
        # Refresh token reuse detected — terminate all sessions for this user
        await token_repo.revoke_all_for_user(int(user_id))
        await token_cache.revoke_all_user_tokens(user_id)
        await db.commit()
        raise TokenError.revoked()

    expires_at = stored.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    if expires_at <= datetime.now(timezone.utc):
        raise TokenError.expired()

    user = await db.get(User, int(user_id))
    if user is None:
        raise AuthError.user_not_found()

    if not user.is_active:
        raise AuthError.account_inactive()

    # Rotate: revoke old token, issue new pair
    await token_repo.revoke(token_hash)

    access_token, _jti, exp = create_access_token(
        subject=str(user.id),
        extra_claims={"email": user.email, "role": user.role},
    )
    new_refresh_str, new_hash, new_exp = create_refresh_token(subject=str(user.id))
    await token_repo.save(
        token_hash=new_hash,
        user_id=user.id,
        expires_at=datetime.fromtimestamp(new_exp, tz=timezone.utc),
    )
    await db.commit()

    return TokenResponse(
        access_token=access_token,
        refresh_token=new_refresh_str,
        expires_at=exp,
        token_type="bearer",
        user=UserRead.model_validate(user),
    )


@router.post("/logout")
async def logout(
    logout_request: LogoutRequest,
    token_payload: dict = Depends(AccessTokenBearer()),
    db: AsyncSession = Depends(get_db),
    token_cache: TokenCache = Depends(get_token_cache),
):
    jti = token_payload.get("jti")
    exp = token_payload.get("exp")
    user_id = token_payload.get("sub")

    if not jti or not exp or not user_id:
        raise TokenError.invalid("Invalid token payload.")

    token_repo = RefreshTokenRepository(db)

    if logout_request.logout_all_devices:
        await token_repo.revoke_all_for_user(int(user_id))
        await token_cache.revoke_all_user_tokens(user_id)
    else:
        refresh_payload = decode_refresh_token(logout_request.refresh_token)
        if not refresh_payload:
            raise TokenError.invalid("Refresh token is invalid.")

        if refresh_payload.get("sub") != user_id:
            raise TokenError.invalid("Token mismatch.")

        refresh_hash = hash_token(logout_request.refresh_token)
        stored = await token_repo.get_by_hash(refresh_hash)

        if not stored:
            raise TokenError.invalid()

        if stored.is_revoked:
            raise TokenError.invalid("Refresh token already revoked.")

        await token_repo.revoke(refresh_hash)

    await db.commit()

    ttl = max(0, int(exp) - int(time.time()))
    await token_cache.blacklist_access_token(jti, ttl)

    return {"message": "Logged out successfully."}


@router.get("/me", response_model=AuthenticatedUserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    return AuthenticatedUserResponse(user=UserRead.model_validate(current_user))


@router.post("/resend-otp")
async def resend_otp(
    payload: ResendOTPRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    rate_limiter: RateLimiter = Depends(get_rate_limiter),
):
    if await rate_limiter.is_rate_limited("resend_otp", request):
        raise AuthError.rate_limited()

    if payload.purpose not in {"register", "login", "reset_password"}:
        raise AuthError.otp_purpose_invalid()

    user_repo = UserRepository(db)
    user = await user_repo.get_by_email(str(payload.email))

    if user is None:
        raise AuthError.user_not_found()

    if payload.purpose == "register" and user.email_verified_at is not None:
        raise AuthError.email_already_verified()

    if payload.purpose == "login":
        if not user.is_active:
            raise AuthError.account_inactive()
        if user.email_verified_at is None:
            raise AuthError.email_not_verified()

    security_service = AuthSecurityService(db)
    await security_service.create_and_send_otp(user=user, email=user.email, purpose=payload.purpose)

    return {"message": "OTP resent successfully.", "email": user.email, "purpose": payload.purpose}


@router.post("/forgot-password")
async def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
    rate_limiter: RateLimiter = Depends(get_rate_limiter),
):
    if await rate_limiter.is_rate_limited("forgot_password", request):
        raise AuthError.rate_limited()

    user_repo = UserRepository(db)
    user = await user_repo.get_by_email(str(payload.email))

    if user is not None and user.is_active:
        security_service = AuthSecurityService(db)
        await security_service.create_and_send_otp(user=user, email=user.email, purpose="reset_password")

    # Always return the same response to prevent user enumeration
    return {"message": "If that email is registered, an OTP has been sent.", "email": str(payload.email)}


@router.post("/reset-password")
async def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    pwd_check = validate_password_strength(payload.new_password)
    if not pwd_check["valid"]:
        raise AuthError.invalid_password(pwd_check["errors"])

    ip_address = get_client_ip(request)
    security_service = AuthSecurityService(db)

    otp = await security_service.verify_otp(
        email=str(payload.email),
        otp_code=payload.otp_code,
        purpose="reset_password",
        ip_address=ip_address,
    )

    if otp.user_id is None:
        raise AuthError.invalid_otp()

    user = await db.get(User, otp.user_id)
    if user is None or not user.is_active:
        raise AuthError.user_not_found()

    user.hashed_password = hash_password(payload.new_password)
    await db.commit()

    return {"message": "Password reset successful. You can now log in."}
