from datetime import date, datetime
from typing import Optional, List

from pydantic import BaseModel


class UserRef(BaseModel):
    id: int
    full_name: Optional[str] = None
    email: str
    model_config = {"from_attributes": True}


class ObjectiveRef(BaseModel):
    id: int
    title: str
    model_config = {"from_attributes": True}


class MilestoneUpsert(BaseModel):
    id: Optional[int] = None
    title: str
    status: str = "pending"
    due_date: Optional[date] = None
    owner_id: Optional[int] = None
    sort_order: int = 0


class MilestoneOut(BaseModel):
    id: int
    title: str
    status: str
    due_date: Optional[date] = None
    sort_order: int
    owner_id: Optional[int] = None
    owner: Optional[UserRef] = None
    model_config = {"from_attributes": True}


class RockCreate(BaseModel):
    title: str
    icon: Optional[str] = None
    description: Optional[str] = None
    status: str = "backlog"
    owner_id: Optional[int] = None
    objective_id: Optional[int] = None
    due_date: Optional[date] = None
    tags: Optional[list] = None
    milestones: Optional[List[MilestoneUpsert]] = None


class RockUpdate(BaseModel):
    title: Optional[str] = None
    icon: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    owner_id: Optional[int] = None
    objective_id: Optional[int] = None
    due_date: Optional[date] = None
    tags: Optional[list] = None
    milestones: Optional[List[MilestoneUpsert]] = None
    is_archived: Optional[bool] = None


class RockOut(BaseModel):
    id: int
    title: str
    icon: Optional[str] = None
    description: Optional[str] = None
    status: str
    is_archived: bool = False
    due_date: Optional[date] = None
    tags: Optional[list] = None
    team_id: int
    owner_id: Optional[int] = None
    objective_id: Optional[int] = None
    owner: Optional[UserRef] = None
    objective: Optional[ObjectiveRef] = None
    milestones: List[MilestoneOut] = []
    created_at: datetime
    model_config = {"from_attributes": True}
