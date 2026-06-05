from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.tenant import TenantContext, get_tenant_context
from app.models.kpi import KPI, KPIEntry
from app.schemas.kpi import KPICreate, KPIUpdate, KPIOut, KPIEntryUpsert, KPIEntryOut, KPIEntryAddNote, KPIReorderItem, KPINoteUpdate

router = APIRouter(tags=["kpis"])


async def _get_kpi_or_404(db: AsyncSession, team_id: int, kpi_id: int) -> KPI:
    result = await db.execute(
        select(KPI).where(KPI.id == kpi_id, KPI.team_id == team_id)
    )
    kpi = result.scalar_one_or_none()
    if not kpi:
        raise HTTPException(status_code=404, detail="KPI not found")
    return kpi


@router.get("/teams/{team_id}/kpis", response_model=list[KPIOut])
async def list_kpis(
    team_id: int,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    result = await db.execute(
        select(KPI).where(KPI.team_id == team_id).order_by(KPI.sort_order, KPI.created_at.desc())
    )
    return result.scalars().all()


@router.put("/teams/{team_id}/kpis/reorder", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_kpis(
    team_id: int,
    payload: list[KPIReorderItem],
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    for item in payload:
        result = await db.execute(select(KPI).where(KPI.id == item.id, KPI.team_id == team_id))
        kpi = result.scalar_one_or_none()
        if kpi:
            kpi.sort_order = item.sort_order
    await db.commit()


@router.post("/teams/{team_id}/kpis", response_model=KPIOut, status_code=status.HTTP_201_CREATED)
async def create_kpi(
    team_id: int,
    payload: KPICreate,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    kpi = KPI(team_id=team_id, **payload.model_dump())
    db.add(kpi)
    await db.commit()
    await db.refresh(kpi)
    return kpi


@router.patch("/teams/{team_id}/kpis/{kpi_id}", response_model=KPIOut)
async def update_kpi(
    team_id: int,
    kpi_id: int,
    payload: KPIUpdate,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    kpi = await _get_kpi_or_404(db, team_id, kpi_id)
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(kpi, field, value)
    await db.commit()
    await db.refresh(kpi)
    return kpi


@router.delete("/teams/{team_id}/kpis/{kpi_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_kpi(
    team_id: int,
    kpi_id: int,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    kpi = await _get_kpi_or_404(db, team_id, kpi_id)
    await db.delete(kpi)
    await db.commit()


@router.put("/teams/{team_id}/kpis/{kpi_id}/entries", response_model=KPIEntryOut)
async def upsert_entry(
    team_id: int,
    kpi_id: int,
    payload: KPIEntryUpsert,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    await _get_kpi_or_404(db, team_id, kpi_id)
    result = await db.execute(
        select(KPIEntry).where(
            and_(
                KPIEntry.kpi_id == kpi_id,
                KPIEntry.period_start == payload.period_start,
                KPIEntry.period_type == payload.period_type,
            )
        )
    )
    entry = result.scalar_one_or_none()
    if entry:
        entry.value = payload.value
        entry.forecast = payload.forecast
    else:
        entry = KPIEntry(
            kpi_id=kpi_id,
            value=payload.value,
            forecast=payload.forecast,
            notes=[],
            period_start=payload.period_start,
            period_type=payload.period_type,
        )
        db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return entry


@router.post("/teams/{team_id}/kpis/{kpi_id}/entries/{entry_id}/notes", response_model=KPIEntryOut)
async def add_entry_note(
    team_id: int,
    kpi_id: int,
    entry_id: int,
    payload: KPIEntryAddNote,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    from datetime import datetime as dt
    result = await db.execute(
        select(KPIEntry).where(KPIEntry.id == entry_id, KPIEntry.kpi_id == kpi_id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    notes = list(entry.notes or [])
    notes.append({
        "text": payload.text,
        "created_at": dt.utcnow().isoformat(),
        "author_id": tenant.user.id,
        "author_name": tenant.user.full_name or tenant.user.email,
    })
    entry.notes = notes
    await db.commit()
    await db.refresh(entry)
    return entry


@router.patch("/teams/{team_id}/kpis/{kpi_id}/entries/{entry_id}/notes/{note_idx}", response_model=KPIEntryOut)
async def edit_entry_note(
    team_id: int,
    kpi_id: int,
    entry_id: int,
    note_idx: int,
    payload: KPINoteUpdate,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    result = await db.execute(
        select(KPIEntry).where(KPIEntry.id == entry_id, KPIEntry.kpi_id == kpi_id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    notes = list(entry.notes or [])
    if note_idx < 0 or note_idx >= len(notes):
        raise HTTPException(status_code=404, detail="Note not found")
    notes[note_idx] = {**notes[note_idx], "text": payload.text}
    entry.notes = notes
    await db.commit()
    await db.refresh(entry)
    return entry


@router.delete("/teams/{team_id}/kpis/{kpi_id}/entries/{entry_id}/notes/{note_idx}", response_model=KPIEntryOut)
async def delete_entry_note(
    team_id: int,
    kpi_id: int,
    entry_id: int,
    note_idx: int,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    result = await db.execute(
        select(KPIEntry).where(KPIEntry.id == entry_id, KPIEntry.kpi_id == kpi_id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    notes = list(entry.notes or [])
    if note_idx < 0 or note_idx >= len(notes):
        raise HTTPException(status_code=404, detail="Note not found")
    notes.pop(note_idx)
    entry.notes = notes
    await db.commit()
    await db.refresh(entry)
    return entry


@router.delete("/teams/{team_id}/kpis/{kpi_id}/entries/{entry_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_entry(
    team_id: int,
    kpi_id: int,
    entry_id: int,
    db: AsyncSession = Depends(get_db),
    tenant: TenantContext = Depends(get_tenant_context),
):
    result = await db.execute(
        select(KPIEntry).where(KPIEntry.id == entry_id, KPIEntry.kpi_id == kpi_id)
    )
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Entry not found")
    await db.delete(entry)
    await db.commit()
