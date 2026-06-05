from datetime import datetime

from pydantic import BaseModel


class UserRef(BaseModel):
    id: int
    full_name: str | None = None
    email: str
    model_config = {"from_attributes": True}


class NewsCreate(BaseModel):
    title: str
    body: str | None = None
    status: str = "active"
    owner_id: int | None = None


class NewsUpdate(BaseModel):
    title: str | None = None
    body: str | None = None
    status: str | None = None
    owner_id: int | None = None


class NewsOut(BaseModel):
    id: int
    title: str
    body: str | None = None
    status: str
    team_id: int
    owner_id: int | None = None
    owner: UserRef | None = None
    created_at: datetime
    updated_at: datetime
    model_config = {"from_attributes": True}
