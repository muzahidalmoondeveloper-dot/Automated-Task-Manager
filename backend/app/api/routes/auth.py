from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import create_access_token, hash_password, verify_password
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import (
    AuthenticatedUserResponse,
    ForgotPasswordRequest,
    LoginPasswordResponse,
    LoginRequest,
    RegisterRequest,
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


def create_user_token_response(user: User) -> TokenResponse:
    access_token = create_access_token(
        subject=str(user.id),
        extra_claims={
            "email": user.email,
            "role": user.role,
        },
    )

    return TokenResponse(
        access_token=access_token,
        user=UserRead.model_validate(user),
    )


@router.post("/register")
async def register(
    payload: UserCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ip_address = get_client_ip(request)
    security_service = AuthSecurityService(db)

    await security_service.check_ip_lock(ip_address)

    user_repo = UserRepository(db)

    existing_user = await user_repo.get_by_email(payload.email)

    if existing_user:
        await security_service.record_failed_attempt(ip_address)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered.",
        )

    user = await user_repo.create(payload)

    user.email_verified_at = None
    user.is_active = False

    await db.commit()
    await db.refresh(user)

    await security_service.create_and_send_otp(
        user=user,
        email=user.email,
        purpose="register",
    )

    return {
        "message": "Registration successful. Please verify the OTP sent to your email.",
        "email": user.email,
    }


@router.post("/register/verify-otp", response_model=TokenResponse)
async def verify_register_otp(
    payload: VerifyRegisterOTPRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ip_address = get_client_ip(request)
    security_service = AuthSecurityService(db)

    otp = await security_service.verify_otp(
        email=str(payload.email),
        otp_code=payload.otp_code,
        purpose="register",
        ip_address=ip_address,
    )

    if otp.user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP user.",
        )

    user = await db.get(User, otp.user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    user.email_verified_at = datetime.now(timezone.utc)
    user.is_active = True

    await db.commit()
    await db.refresh(user)

    return create_user_token_response(user)


@router.post("/login", response_model=LoginPasswordResponse)
async def login(
    payload: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ip_address = get_client_ip(request)
    security_service = AuthSecurityService(db)

    await security_service.check_ip_lock(ip_address)

    user_repo = UserRepository(db)
    user = await user_repo.get_by_email(payload.email)

    if user is None:
        await security_service.record_failed_attempt(ip_address)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not verify_password(payload.password, user.hashed_password):
        await security_service.record_failed_attempt(ip_address)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    if not user.is_active:
        await security_service.record_failed_attempt(ip_address)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive.",
        )

    if user.email_verified_at is None:
        await security_service.create_and_send_otp(
            user=user,
            email=user.email,
            purpose="register",
        )

        return LoginPasswordResponse(
            otp_required=False,
            email_verification_required=True,
            message="Your email is not verified. OTP sent to your email.",
            email=user.email,
            access_token=None,
            token_type="bearer",
            user=None,
        )


    await security_service.reset_failed_attempts(ip_address)

    if security_service.login_otp_required(user):
        await security_service.create_and_send_otp(
            user=user,
            email=user.email,
            purpose="login",
        )

        return LoginPasswordResponse(
            otp_required=True,
            email_verification_required=False,
            message="OTP sent to your email.",
            email=user.email,
            access_token=None,
            token_type="bearer",
            user=None,
        )

    access_token = create_access_token(
        subject=str(user.id),
        extra_claims={
            "email": user.email,
            "role": user.role,
        },
    )

    return LoginPasswordResponse(
        otp_required=False,
        email_verification_required=False,
        message="Login successful.",
        email=user.email,
        access_token=access_token,
        token_type="bearer",
        user=UserRead.model_validate(user),
    )


@router.post("/login/verify-otp", response_model=TokenResponse)
async def verify_login_otp(
    payload: VerifyLoginOTPRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ip_address = get_client_ip(request)
    security_service = AuthSecurityService(db)

    otp = await security_service.verify_otp(
        email=str(payload.email),
        otp_code=payload.otp_code,
        purpose="login",
        ip_address=ip_address,
    )

    if otp.user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP user.",
        )

    user = await db.get(User, otp.user_id)

    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User account is inactive.",
        )

    user.last_login_otp_verified_at = datetime.now(timezone.utc)

    await db.commit()
    await db.refresh(user)

    return create_user_token_response(user)


@router.get("/me", response_model=AuthenticatedUserResponse)
async def get_me(
    current_user: User = Depends(get_current_user),
):
    return AuthenticatedUserResponse(
        user=UserRead.model_validate(current_user),
    )



@router.post("/resend-otp")
async def resend_otp(
    payload: ResendOTPRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ip_address = get_client_ip(request)
    security_service = AuthSecurityService(db)

    await security_service.check_ip_lock(ip_address)

    if payload.purpose not in {"register", "login", "reset_password"}:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP purpose.",
        )

    user_repo = UserRepository(db)
    user = await user_repo.get_by_email(str(payload.email))

    if user is None:
        await security_service.record_failed_attempt(ip_address)
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    if payload.purpose == "register" and user.email_verified_at is not None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email is already verified.",
        )

    if payload.purpose == "login":
        if not user.is_active:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="User account is inactive.",
            )

        if user.email_verified_at is None:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please verify your email first.",
            )

    await security_service.create_and_send_otp(
        user=user,
        email=user.email,
        purpose=payload.purpose,
    )

    return {
        "message": "OTP resent successfully.",
        "email": user.email,
        "purpose": payload.purpose,
    }


@router.post("/forgot-password")
async def forgot_password(
    payload: ForgotPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ip_address = get_client_ip(request)
    security_service = AuthSecurityService(db)

    await security_service.check_ip_lock(ip_address)

    user_repo = UserRepository(db)
    user = await user_repo.get_by_email(str(payload.email))

    if user is not None and user.is_active:
        await security_service.create_and_send_otp(
            user=user,
            email=user.email,
            purpose="reset_password",
        )

    return {
        "message": "If that email is registered, an OTP has been sent.",
        "email": str(payload.email),
    }


@router.post("/reset-password")
async def reset_password(
    payload: ResetPasswordRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ip_address = get_client_ip(request)
    security_service = AuthSecurityService(db)

    otp = await security_service.verify_otp(
        email=str(payload.email),
        otp_code=payload.otp_code,
        purpose="reset_password",
        ip_address=ip_address,
    )

    if otp.user_id is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid OTP.",
        )

    user = await db.get(User, otp.user_id)

    if user is None or not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found.",
        )

    user.hashed_password = hash_password(payload.new_password)

    await db.commit()

    return {"message": "Password reset successful. You can now log in."}