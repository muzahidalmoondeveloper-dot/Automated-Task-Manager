import uuid
from datetime import date, datetime
from typing import Optional

from sqlalchemy import Date, DateTime, Float, ForeignKey, Integer, JSON, String, Text, UniqueConstraint, Uuid
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func

from app.core.database import Base


class KPI(Base):
    __tablename__ = "kpis"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    icon: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    team_id: Mapped[int] = mapped_column(Integer, ForeignKey("teams.id", ondelete="CASCADE"), nullable=False)
    owner_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    organization_id: Mapped[Optional[uuid.UUID]] = mapped_column(Uuid(as_uuid=True), ForeignKey("organizations.id", ondelete="CASCADE"), nullable=True, index=True)
    rock_id: Mapped[Optional[int]] = mapped_column(Integer, ForeignKey("rocks.id", ondelete="SET NULL"), nullable=True)
    kpi_group: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    supported_views: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, default=lambda: ["weekly", "monthly", "quarterly", "yearly"])
    interpolation: Mapped[str] = mapped_column(String(50), nullable=False, default="latest_value", server_default="latest_value")
    target_type: Mapped[str] = mapped_column(String(50), nullable=False, default="number", server_default="number")
    formula: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    reference_value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    owner = relationship("User", foreign_keys=[owner_id], lazy="selectin")
    rock = relationship("Rock", foreign_keys=[rock_id], lazy="selectin")
    entries = relationship(
        "KPIEntry",
        back_populates="kpi",
        lazy="selectin",
        order_by="KPIEntry.period_start.desc()",
        cascade="all, delete-orphan",
    )
    links: Mapped[list["KpiLink"]] = relationship(
        "KpiLink",
        back_populates="kpi",
        lazy="selectin",
        cascade="all, delete-orphan",
        order_by="KpiLink.id",
    )


class KPIEntry(Base):
    __tablename__ = "kpi_entries"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    kpi_id: Mapped[int] = mapped_column(Integer, ForeignKey("kpis.id", ondelete="CASCADE"), nullable=False)
    value: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    forecast: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    notes: Mapped[Optional[list]] = mapped_column(JSON, nullable=True, default=list)
    period_start: Mapped[date] = mapped_column(Date, nullable=False)
    period_type: Mapped[str] = mapped_column(String(20), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    kpi = relationship("KPI", back_populates="entries")


class KpiLink(Base):
    __tablename__ = "kpi_links"
    __table_args__ = (
        UniqueConstraint("kpi_id", "linked_type", "linked_id", name="uq_kpi_link"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    kpi_id: Mapped[int] = mapped_column(Integer, ForeignKey("kpis.id", ondelete="CASCADE"), nullable=False, index=True)
    linked_type: Mapped[str] = mapped_column(String(20), nullable=False)
    linked_id: Mapped[int] = mapped_column(Integer, nullable=False)
    title: Mapped[str] = mapped_column(String(500), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    kpi: Mapped["KPI"] = relationship("KPI", back_populates="links")
