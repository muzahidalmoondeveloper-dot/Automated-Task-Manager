from pydantic import BaseModel, EmailStr, Field

from app.schemas.user import UserRead


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_at: int | None
    token_type: str = "bearer"
    user: UserRead


class AuthenticatedUserResponse(BaseModel):
    user: UserRead


class VerifyRegisterOTPRequest(BaseModel):
    email: EmailStr
    otp_code: str = Field(min_length=6, max_length=6)


class VerifyLoginOTPRequest(BaseModel):
    email: EmailStr
    otp_code: str = Field(min_length=6, max_length=6)


class LoginPasswordResponse(BaseModel):
    """Returned by POST /login before any OTP step is complete."""
    otp_required: bool = False
    email_verification_required: bool = False
    message: str
    email: str | None = None
    # Populated only when login completes without OTP
    access_token: str | None = None
    refresh_token: str | None = None
    expires_at: int | None = None
    token_type: str = "bearer"
    user: UserRead | None = None


class ResendOTPRequest(BaseModel):
    email: EmailStr
    purpose: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp_code: str = Field(min_length=6, max_length=6)
    new_password: str = Field(min_length=8, max_length=128)


class RefreshTokenRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str
    logout_all_devices: bool = False
