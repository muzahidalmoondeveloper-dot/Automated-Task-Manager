from pydantic import BaseModel, EmailStr, Field
from app.schemas.user import UserRead


class RegisterRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class TokenResponse(BaseModel):
    access_token: str
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
    otp_required: bool = False
    email_verification_required: bool = False
    message: str
    email: str | None = None
    access_token: str | None = None
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