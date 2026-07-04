from datetime import datetime
from typing import Optional

from pydantic import BaseModel, field_validator

LINKABLE_TYPES = {"objective", "rock", "task", "kpi"}


class EntityLinkIn(BaseModel):
    linked_type: str
    linked_id: int
    title: str

    @field_validator("linked_type")
    @classmethod
    def validate_linked_type(cls, v: str) -> str:
        if v not in LINKABLE_TYPES:
            raise ValueError(f"linked_type must be one of: {', '.join(sorted(LINKABLE_TYPES))}")
        return v


class EntityLinkOut(BaseModel):
    linked_type: str
    linked_id: int
    title: str
    model_config = {"from_attributes": True}


class AssigneeRef(BaseModel):
    id: int
    full_name: Optional[str] = None
    email: str

    model_config = {"from_attributes": True}


class IssueCreate(BaseModel):
    title: str
    description: Optional[str] = None
    assignee_id: Optional[int] = None
    timeframe: Optional[str] = "short-term"
    priority: Optional[int] = 0
    links: list[EntityLinkIn] = []


class IssueUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assignee_id: Optional[int] = None
    timeframe: Optional[str] = None
    priority: Optional[int] = None
    team_id: Optional[int] = None
    links: Optional[list[EntityLinkIn]] = None


class IssueOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    team_id: int
    assignee_id: Optional[int] = None
    timeframe: str
    priority: int
    assignee: Optional[AssigneeRef] = None
    links: list[EntityLinkOut] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
