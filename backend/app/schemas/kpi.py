from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class KPIEntryUpsert(BaseModel):
    value: Optional[float] = None
    forecast: Optional[float] = None
    period_start: date
    period_type: str


class KPIEntryAddNote(BaseModel):
    text: str


class KPINoteUpdate(BaseModel):
    text: str


class KPIReorderItem(BaseModel):
    id: int
    sort_order: int


class KPIEntryOut(BaseModel):
    id: int
    kpi_id: int
    value: Optional[float] = None
    forecast: Optional[float] = None
    notes: Optional[list] = []
    period_start: date
    period_type: str
    created_at: datetime

    model_config = {"from_attributes": True}


class OwnerRef(BaseModel):
    id: int
    full_name: Optional[str] = None
    email: str

    model_config = {"from_attributes": True}


class RockRef(BaseModel):
    id: int
    title: str

    model_config = {"from_attributes": True}


class KPICreate(BaseModel):
    title: str
    description: Optional[str] = None
    icon: Optional[str] = None
    owner_id: Optional[int] = None
    rock_id: Optional[int] = None
    kpi_group: Optional[str] = None
    supported_views: Optional[list] = ["weekly", "monthly", "quarterly", "yearly"]
    interpolation: Optional[str] = "latest_value"
    target_type: Optional[str] = "number"
    formula: Optional[str] = None
    reference_value: Optional[float] = None


class KPIUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None
    owner_id: Optional[int] = None
    rock_id: Optional[int] = None
    kpi_group: Optional[str] = None
    supported_views: Optional[list] = None
    interpolation: Optional[str] = None
    target_type: Optional[str] = None
    formula: Optional[str] = None
    reference_value: Optional[float] = None


class KPIOut(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    icon: Optional[str] = None
    team_id: int
    owner_id: Optional[int] = None
    rock_id: Optional[int] = None
    kpi_group: Optional[str] = None
    supported_views: Optional[list] = None
    interpolation: str
    target_type: str
    formula: Optional[str] = None
    reference_value: Optional[float] = None
    owner: Optional[OwnerRef] = None
    rock: Optional[RockRef] = None
    entries: list[KPIEntryOut] = []
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
