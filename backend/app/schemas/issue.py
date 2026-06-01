from datetime import datetime
from typing import Optional

from pydantic import BaseModel


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


class IssueUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    assignee_id: Optional[int] = None
    timeframe: Optional[str] = None
    priority: Optional[int] = None


class IssueOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    team_id: int
    assignee_id: Optional[int] = None
    timeframe: str
    priority: int
    assignee: Optional[AssigneeRef] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
