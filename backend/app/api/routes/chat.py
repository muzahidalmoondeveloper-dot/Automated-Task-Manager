from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.repositories.chat_repository import ChatRepository
from app.schemas.chat import (
    ChatMessageRequest,
    ChatMessageResponse,
    ChatSessionRead,
    ChatSessionWithMessages,
)
from app.services.chat_service import ChatService
from app.services.file_extractor import extract_text, supported

router = APIRouter(prefix="/chat", tags=["Chat"])

FILE_SIZE_LIMIT = 20 * 1024 * 1024  # 20 MB


@router.post("/message", response_model=ChatMessageResponse)
async def send_message(
    payload: ChatMessageRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Send a natural-language message to the AI assistant."""
    if not payload.message or not payload.message.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Message cannot be empty.")

    service = ChatService(db)
    return await service.handle_message(
        user=current_user,
        message=payload.message.strip(),
        session_id=payload.session_id,
    )


@router.post("/upload", response_model=ChatMessageResponse)
async def upload_file_message(
    file: UploadFile = File(...),
    message: str = Form(""),
    session_id: int | None = Form(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Upload a file (PDF, DOCX, TXT, CSV, MD, JSON) and analyse it with the AI assistant."""
    if not supported(file.filename or ""):
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=(
                "Unsupported file type. Supported formats: "
                "PDF, DOCX, TXT, MD, CSV, JSON."
            ),
        )

    content = await file.read()

    if len(content) > FILE_SIZE_LIMIT:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File too large. Maximum size is 20 MB.",
        )

    if not content:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Uploaded file is empty.",
        )

    try:
        file_text = await extract_text(file.filename, content)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE, detail=str(exc))
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Could not extract text from file: {exc}",
        )

    file_context = {
        "filename": file.filename,
        "text": file_text,
        "size_bytes": len(content),
    }

    service = ChatService(db)
    return await service.handle_message(
        user=current_user,
        message=message.strip(),
        session_id=session_id,
        file_context=file_context,
    )


@router.get("/sessions", response_model=list[ChatSessionRead])
async def list_sessions(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """List all chat sessions for the current user."""
    repo = ChatRepository(db)
    return await repo.list_sessions_for_user(current_user.id)


@router.get("/sessions/{session_id}", response_model=ChatSessionWithMessages)
async def get_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Get a chat session with all its messages."""
    repo = ChatRepository(db)
    session = await repo.get_session(session_id)

    if session is None or session.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")

    return ChatSessionWithMessages(
        id=session.id,
        title=session.title,
        created_at=session.created_at,
        updated_at=session.updated_at,
        messages=[
            {
                "id": m.id,
                "session_id": m.session_id,
                "role": m.role,
                "content": m.content,
                "created_at": m.created_at,
            }
            for m in session.messages
        ],
    )


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_session(
    session_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Delete a chat session and all its messages."""
    repo = ChatRepository(db)
    session = await repo.get_session(session_id)

    if session is None or session.user_id != current_user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found.")

    await db.delete(session)
    await db.commit()
    return None
