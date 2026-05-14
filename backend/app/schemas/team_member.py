from datetime import datetime

from pydantic import BaseModel, EmailStr, Field


class TeamMemberBase(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)
    email: EmailStr | None = None
    aliases: list[str] | None = None
    role_title: str | None = Field(default=None, max_length=255)
    is_active: bool = True


class TeamMemberCreate(TeamMemberBase):
    pass


class TeamMemberUpdate(BaseModel):
    full_name: str | None = Field(default=None, min_length=1, max_length=255)
    email: EmailStr | None = None
    aliases: list[str] | None = None
    role_title: str | None = Field(default=None, max_length=255)
    is_active: bool | None = None


class TeamMemberRead(TeamMemberBase):
    id: int
    owner_user_id: int
    created_at: datetime
    updated_at: datetime

    model_config = {
        "from_attributes": True,
    }