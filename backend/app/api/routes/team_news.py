from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.team_news import TeamNews
from app.models.user import User
from app.schemas.team_news import NewsCreate, NewsOut, NewsUpdate

router = APIRouter(prefix="/teams/{team_id}/news", tags=["team-news"])


@router.get("", response_model=list[NewsOut])
async def list_news(
    team_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TeamNews)
        .where(TeamNews.team_id == team_id)
        .order_by(TeamNews.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=NewsOut, status_code=status.HTTP_201_CREATED)
async def create_news(
    team_id: int,
    payload: NewsCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    news = TeamNews(team_id=team_id, **payload.model_dump())
    db.add(news)
    await db.commit()
    await db.refresh(news)
    return news


@router.patch("/{news_id}", response_model=NewsOut)
async def update_news(
    team_id: int,
    news_id: int,
    payload: NewsUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TeamNews).where(TeamNews.id == news_id, TeamNews.team_id == team_id)
    )
    news = result.scalar_one_or_none()
    if not news:
        raise HTTPException(status_code=404, detail="News not found")
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(news, key, value)
    await db.commit()
    await db.refresh(news)
    return news


@router.delete("/{news_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_news(
    team_id: int,
    news_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_current_user),
):
    result = await db.execute(
        select(TeamNews).where(TeamNews.id == news_id, TeamNews.team_id == team_id)
    )
    news = result.scalar_one_or_none()
    if not news:
        raise HTTPException(status_code=404, detail="News not found")
    await db.delete(news)
    await db.commit()
