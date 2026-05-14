"""Chat service: intent detection + natural-language task management."""

from __future__ import annotations

import json
import logging
from datetime import date, datetime, timezone
from typing import TYPE_CHECKING

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User
from app.repositories.chat_repository import ChatRepository
from app.repositories.task_repository import TaskRepository
from app.repositories.user_repository import UserRepository
from app.repositories.project_repository import ProjectRepository
from app.repositories.team_repository import TeamRepository
from app.core.roles import TEAM_MEMBER
from app.schemas.chat import ChatAction, ChatMessageResponse
from app.schemas.task import TaskCreate, TaskUpdate
from app.services.llm import get_llm_provider

if TYPE_CHECKING:
    from app.models.chat import ChatMessage, ChatSession

logger = logging.getLogger("chat_service")

# ─── Intent types ────────────────────────────────────────────────────────────

INTENT_CREATE_TASK = "create_task"
INTENT_LIST_TASKS = "list_tasks"
INTENT_UPDATE_TASK = "update_task"
INTENT_DELETE_TASK = "delete_task"
INTENT_ANALYZE_TEXT = "analyze_text"
INTENT_GENERAL = "general"

_INTENT_SYSTEM = """You are an intent classifier for a task management assistant.
Classify the user's message into exactly ONE of these intents:
- create_task: user wants to create one or more tasks (including "create tasks from those", "add those as tasks", "create tasks from the action items above")
- list_tasks: user wants to see, find, or summarise their tasks (e.g. "how many tasks", "show my tasks", "list all tasks")
- update_task: user wants to change or update tasks — including bulk operations like "mark all tasks as done", "set everything to in_progress"
- delete_task: user wants to delete or remove tasks — including bulk operations like "delete all tasks", "remove all tasks", "delete all of task", "please delete all of task"
- analyze_text: user pasted an email, meeting transcript, or document and wants tasks extracted OR wants a summary/analysis of previously shared content
- general: any other question, greeting, or request

IMPORTANT rules:
- "delete all", "delete all tasks", "delete all of task", "remove all" → delete_task
- "mark all as done", "set all to complete", "update all tasks" → update_task
- Always prefer a specific action intent (create/list/update/delete) over "general" when an action word is present.
- Use conversation history to resolve references like "those", "them", "the above", "from the summary", "from the file".

Respond with ONLY a JSON object: {"intent": "<intent>"}"""

# ─── Extraction prompts ───────────────────────────────────────────────────────

_CREATE_TASK_SYSTEM = """You are a task-creation assistant. Extract structured task data from the user's request.

IMPORTANT: If the user references content from earlier in the conversation (e.g. "those action items", "from the summary", "the tasks mentioned above", "create tasks from those"), you MUST look at the Conversation history provided and extract the actual specific tasks from there. Do NOT invent generic placeholder names like "Action Item" — always use the real, specific task names found in the prior conversation.

{users_block}
Return ONLY a JSON object with these fields (use null for unknown):
{{
  "tasks": [
    {{
      "name": "string (required — must be a specific, descriptive task title, never a generic placeholder)",
      "description": "string or null",
      "start_date": "YYYY-MM-DD or null",
      "due_date": "YYYY-MM-DD or null",
      "assignee_name": "string or null — use exact name from the known users list when possible",
      "project_name": "string or null",
      "team_name": "string or null",
      "status": "todo"
    }}
  ]
}}
Today's date: {today}"""

_UPDATE_TASK_SYSTEM = """You are a task-update assistant. Extract the update intent from the user's message.

IMPORTANT: If the user wants to update ALL tasks (e.g. "mark all tasks as done", "set everything to in_progress"), set task_reference to "__ALL__".
Otherwise set task_reference to the specific task ID number or title fragment.

Return ONLY a JSON object:
{
  "task_reference": "string — '__ALL__' for bulk update, or a task ID / title fragment for a specific task",
  "updates": {
    "name": "string or null",
    "status": "todo|in_progress|done|pending_review or null",
    "due_date": "YYYY-MM-DD or null",
    "assignee_name": "string or null"
  }
}"""

_ANALYZE_TEXT_SYSTEM = """You are a task extraction assistant. Read the provided text (and conversation history if given) and extract actionable tasks.

If the user asks to summarise or analyse content from earlier in the conversation, look at the Conversation history to find that content.

{users_block}
Return ONLY a JSON object:
{{
  "tasks": [
    {{
      "name": "string (required, specific and descriptive task title — never a generic placeholder)",
      "description": "string or null",
      "start_date": "YYYY-MM-DD or null",
      "due_date": "YYYY-MM-DD or null",
      "assignee_name": "string or null — use exact name from the known users list when possible",
      "project_name": "string or null",
      "confidence": "low|medium|high"
    }}
  ],
  "summary": "string (1-2 sentence summary of what the text was about)"
}}
Today's date: {today}"""


def _today() -> str:
    return date.today().isoformat()


def _parse_json_safe(text: str) -> dict:
    cleaned = text.strip()
    for prefix in ("```json", "```"):
        if cleaned.startswith(prefix):
            cleaned = cleaned[len(prefix):].strip()
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3].strip()
    return json.loads(cleaned)


class ChatService:
    def __init__(self, db: AsyncSession):
        self._db = db
        self._chat_repo = ChatRepository(db)
        self._task_repo = TaskRepository(db)
        self._user_repo = UserRepository(db)
        self._project_repo = ProjectRepository(db)
        self._team_repo = TeamRepository(db)
        self._llm = get_llm_provider()

    # ─── Public entry point ───────────────────────────────────────────────────

    async def handle_message(
        self,
        *,
        user: User,
        message: str,
        session_id: int | None,
        file_context: dict | None = None,
    ) -> ChatMessageResponse:
        """
        file_context (optional): {"filename": str, "text": str, "size_bytes": int}
        When provided the file content is injected into the LLM prompt and the
        stored user message is prefixed with a [📎 filename] badge.
        """
        # 1. Get or create session
        session = await self._get_or_create_session(user, session_id, message)

        # 2. Build stored message (with file badge when applicable)
        stored_user_message = _build_stored_message(message, file_context)
        user_msg = await self._chat_repo.add_message(session.id, "user", stored_user_message)

        # 3. Build conversation history for context
        history = await self._chat_repo.get_session_messages(session.id, limit=20)
        history_text = self._format_history(history[:-1])

        # 4. Build the effective prompt the LLM will see (file content injected)
        effective_message = _build_llm_prompt(message, file_context)

        # 5. When a file is attached with no explicit instruction, acknowledge it
        #    and ask the user what they want to do — never auto-execute anything.
        actions: list[ChatAction] = []
        if file_context and not message.strip():
            size_kb = round(file_context["size_bytes"] / 1024, 1)
            reply = (
                f"I've received **{file_context['filename']}** ({size_kb} KB). "
                "What would you like me to do with it?\n\n"
                "• **Summarise** the document\n"
                "• **Create tasks** from the content\n"
                "• **Answer questions** about it\n"
                "• **Extract key points or action items**\n\n"
                "Just tell me and I'll get started."
            )
            assistant_msg = await self._chat_repo.add_message(session.id, "assistant", reply)
            if len(history) <= 2 and session.title is None:
                await self._auto_title_session(session, file_context["filename"])
            await self._chat_repo.touch_session(session)
            return ChatMessageResponse(
                session_id=session.id,
                user_message=_msg_read(user_msg),
                assistant_message=_msg_read(assistant_msg),
                actions=[],
            )

        # 6. Detect intent from the user's typed message only — never from file
        #    content — so the file never silently triggers actions on its own.
        intent_input = message if file_context else effective_message
        intent = await self._detect_intent(intent_input, history_text)
        logger.info("Detected intent: %s (file_attached=%s)", intent, bool(file_context))

        # 7. Route to handler (execution uses effective_message so LLM has file text)
        try:
            reply, actions = await self._route(intent, user, effective_message, history_text)
        except Exception as exc:
            logger.exception("Error handling intent %s: %s", intent, exc)
            reply = "I ran into an issue processing that. Could you try rephrasing?"

        # 8. Persist assistant reply
        assistant_msg = await self._chat_repo.add_message(session.id, "assistant", reply)

        # 9. Auto-title session after first exchange
        if len(history) <= 2 and session.title is None:
            title_hint = file_context["filename"] if file_context else message
            await self._auto_title_session(session, title_hint)

        await self._chat_repo.touch_session(session)

        return ChatMessageResponse(
            session_id=session.id,
            user_message=_msg_read(user_msg),
            assistant_message=_msg_read(assistant_msg),
            actions=actions,
        )

    # ─── Session management ───────────────────────────────────────────────────

    async def _get_or_create_session(
        self, user: User, session_id: int | None, first_message: str
    ) -> "ChatSession":
        if session_id:
            session = await self._chat_repo.get_session(session_id)
            if session and session.user_id == user.id:
                return session
        return await self._chat_repo.create_session(user.id)

    async def _auto_title_session(self, session: "ChatSession", message: str) -> None:
        try:
            result = await self._llm.generate_text(
                system_prompt=(
                    "Generate a short (max 6 words) title summarising this chat message. "
                    "Return ONLY the title text, nothing else."
                ),
                user_prompt=message[:300],
                temperature=0.3,
            )
            title = result.text.strip().strip('"').strip("'")[:255]
            if title:
                await self._chat_repo.update_session_title(session, title)
        except Exception:
            pass  # non-critical

    # ─── Intent detection ─────────────────────────────────────────────────────

    async def _detect_intent(self, message: str, history: str) -> str:
        prompt = f"Previous conversation:\n{history}\n\nUser message: {message}" if history else message
        try:
            result = await self._llm.generate_text(
                system_prompt=_INTENT_SYSTEM,
                user_prompt=prompt,
                temperature=0.0,
                response_format="json",
            )
            data = _parse_json_safe(result.text)
            return data.get("intent", INTENT_GENERAL)
        except Exception as exc:
            logger.warning("Intent detection failed: %s", exc)
            return INTENT_GENERAL

    # ─── Router ───────────────────────────────────────────────────────────────

    _TASK_MUTATION_INTENTS = {INTENT_CREATE_TASK, INTENT_UPDATE_TASK, INTENT_DELETE_TASK}

    async def _route(
        self, intent: str, user: User, message: str, history: str
    ) -> tuple[str, list[ChatAction]]:
        if user.role == TEAM_MEMBER and intent in self._TASK_MUTATION_INTENTS:
            return (
                "You don't have permission to create, update, or delete tasks through the assistant. "
                "Please contact your team manager or admin to make task changes.",
                [],
            )
        if intent == INTENT_CREATE_TASK:
            return await self._handle_create_task(user, message, history)
        if intent == INTENT_LIST_TASKS:
            return await self._handle_list_tasks(user, message, history)
        if intent == INTENT_UPDATE_TASK:
            return await self._handle_update_task(user, message, history)
        if intent == INTENT_DELETE_TASK:
            return await self._handle_delete_task(user, message, history)
        if intent == INTENT_ANALYZE_TEXT:
            return await self._handle_analyze_text(user, message, history)
        return await self._handle_general(user, message, history)

    # ─── Create task ──────────────────────────────────────────────────────────

    async def _handle_create_task(
        self, user: User, message: str, history: str = ""
    ) -> tuple[str, list[ChatAction]]:
        users_block = await self._build_users_block()
        system = (
            _CREATE_TASK_SYSTEM
            .replace("{users_block}", users_block)
            .replace("{today}", _today())
        )
        user_prompt = (
            f"Conversation history:\n{history}\n\nUser instruction: {message}"
            if history else message
        )
        result = await self._llm.generate_text(
            system_prompt=system,
            user_prompt=user_prompt,
            temperature=0.1,
            response_format="json",
        )
        data = _parse_json_safe(result.text)
        raw_tasks: list[dict] = data.get("tasks", [])

        if not raw_tasks:
            return "I couldn't extract any tasks from that. Could you be more specific about what needs to be done?", []

        created = []
        actions: list[ChatAction] = []

        for raw in raw_tasks:
            name = (raw.get("name") or "").strip()
            if not name:
                continue

            assignee_id = await self._resolve_user_id(raw.get("assignee_name"), fallback=user.id)
            project_id = await self._resolve_project_id(raw.get("project_name"))
            team_id = await self._resolve_team_id(raw.get("team_name"))

            payload = TaskCreate(
                name=name,
                start_date=_parse_date(raw.get("start_date")),
                due_date=_parse_date(raw.get("due_date")),
                assignee_id=assignee_id,
                project_id=project_id,
                team_id=team_id,
                status=raw.get("status", "todo"),
            )
            task = await self._task_repo.create(payload, created_by_id=user.id)
            created.append(task)
            actions.append(
                ChatAction(
                    type="task_created",
                    label=f'Task created: "{task.name}"',
                    payload={"task_id": task.id, "task_name": task.name},
                )
            )

        if not created:
            return "I understood you want to create tasks but couldn't parse the details. Could you provide more specific task names?", []

        names = ", ".join(f'"{t.name}"' for t in created)
        reply = (
            f"Done! I created {len(created)} task{'s' if len(created) > 1 else ''}: {names}. "
            "You can view and manage them on the Tasks page."
        )
        return reply, actions

    # ─── List tasks ───────────────────────────────────────────────────────────

    async def _handle_list_tasks(
        self, user: User, message: str, history: str = ""
    ) -> tuple[str, list[ChatAction]]:
        from app.core.roles import ADMIN, TEAM_MANAGER

        if user.role in {ADMIN, TEAM_MANAGER}:
            tasks = await self._task_repo.list_all()
        else:
            tasks = await self._task_repo.list_for_assignee(user.id)

        if not tasks:
            return "You have no tasks at the moment.", []

        # Ask LLM to summarise / filter based on the user's query
        task_list_text = "\n".join(
            f"- [{t.id}] {t.name} | status={t.status} | due={t.due_date or 'no date'} "
            f"| assignee={t.assignee.full_name if t.assignee else 'unassigned'}"
            for t in tasks[:50]
        )

        history_block = f"Conversation history:\n{history}\n\n" if history else ""
        result = await self._llm.generate_text(
            system_prompt=(
                "You are a task management assistant. The user has asked about their tasks. "
                "Given the list of tasks below, answer the user's question in a helpful, concise way. "
                "Use bullet points. Reference task IDs in brackets like [42]. "
                "If the user asked for a summary, give a brief overview grouped by status."
            ),
            user_prompt=f"{history_block}User question: {message}\n\nTasks:\n{task_list_text}",
            temperature=0.2,
        )

        actions: list[ChatAction] = [
            ChatAction(type="navigate", label="View all tasks", payload={"path": "/tasks"})
        ]
        return result.text, actions

    # ─── Update task ──────────────────────────────────────────────────────────

    async def _handle_update_task(
        self, user: User, message: str, history: str = ""
    ) -> tuple[str, list[ChatAction]]:
        from app.core.roles import ADMIN, TEAM_MANAGER

        user_prompt = (
            f"Conversation history:\n{history}\n\nUser instruction: {message}"
            if history else message
        )
        result = await self._llm.generate_text(
            system_prompt=_UPDATE_TASK_SYSTEM,
            user_prompt=user_prompt,
            temperature=0.1,
            response_format="json",
        )
        data = _parse_json_safe(result.text)

        ref = (data.get("task_reference") or "").strip()
        updates_raw: dict = data.get("updates", {})

        # Build the update payload from LLM output
        update_payload: dict = {}
        if updates_raw.get("name"):
            update_payload["name"] = updates_raw["name"]
        if updates_raw.get("status"):
            update_payload["status"] = updates_raw["status"]
        if updates_raw.get("due_date"):
            update_payload["due_date"] = _parse_date(updates_raw["due_date"])
        if updates_raw.get("assignee_name"):
            uid = await self._resolve_user_id(updates_raw["assignee_name"])
            if uid:
                update_payload["assignee_id"] = uid

        if not update_payload:
            return "I understood you want to update a task but couldn't determine what to change. Could you be more specific?", []

        # ── Bulk update ───────────────────────────────────────────────────────
        if ref == "__ALL__":
            if user.role in {ADMIN, TEAM_MANAGER}:
                all_tasks = await self._task_repo.list_all()
            else:
                all_tasks = await self._task_repo.list_for_assignee(user.id)

            if not all_tasks:
                return "There are no tasks to update.", []

            count = 0
            actions: list[ChatAction] = []
            for t in all_tasks:
                await self._task_repo.update(t, TaskUpdate(**update_payload))
                count += 1
                actions.append(
                    ChatAction(type="task_updated", label=f'Updated: "{t.name}"', payload={"task_id": t.id})
                )

            changes = ", ".join(f"{k}={v}" for k, v in update_payload.items())
            return (
                f"Done. Updated **{count} task{'s' if count != 1 else ''}**: {changes}.",
                actions,
            )

        # ── Single task update ────────────────────────────────────────────────
        task = None
        if ref.isdigit():
            task = await self._task_repo.get_by_id(int(ref))
        else:
            if user.role in {ADMIN, TEAM_MANAGER}:
                all_tasks = await self._task_repo.list_all()
            else:
                all_tasks = await self._task_repo.list_for_assignee(user.id)

            ref_lower = ref.lower()
            matches = [t for t in all_tasks if ref_lower in t.name.lower()]
            if matches:
                task = matches[0]

        if not task:
            return (
                f'I couldn\'t find a task matching "{ref}". '
                "Please check the Tasks page or provide the task ID.",
                [],
            )

        updated = await self._task_repo.update(task, TaskUpdate(**update_payload))
        changes = ", ".join(f"{k}={v}" for k, v in update_payload.items())
        return f'Updated task "{updated.name}": {changes}.', [
            ChatAction(
                type="task_updated",
                label=f'Task updated: "{updated.name}"',
                payload={"task_id": updated.id},
            )
        ]

    # ─── Delete task ──────────────────────────────────────────────────────────

    async def _handle_delete_task(
        self, user: User, message: str, history: str = ""
    ) -> tuple[str, list[ChatAction]]:
        from app.core.roles import ADMIN, TEAM_MANAGER

        if user.role not in {ADMIN, TEAM_MANAGER}:
            return "Only admins and team managers can delete tasks. Please ask your manager.", []

        user_prompt = (
            f"Conversation history:\n{history}\n\nUser instruction: {message}"
            if history else message
        )
        result = await self._llm.generate_text(
            system_prompt=(
                "Extract what the user wants to delete.\n"
                "- If they want to delete ALL tasks (e.g. 'delete all tasks', 'remove everything', 'delete all of task'), "
                "set task_reference to '__ALL__'.\n"
                "- Otherwise set task_reference to the specific task ID number or title fragment.\n"
                "Use conversation history to resolve vague references like 'that task' or 'those'.\n"
                'Return ONLY JSON: {"task_reference": "string"}'
            ),
            user_prompt=user_prompt,
            temperature=0.0,
            response_format="json",
        )
        data = _parse_json_safe(result.text)
        ref = (data.get("task_reference") or "").strip()

        # ── Bulk delete ───────────────────────────────────────────────────────
        if ref == "__ALL__":
            all_tasks = await self._task_repo.list_all()
            if not all_tasks:
                return "There are no tasks to delete.", []
            count = len(all_tasks)
            for t in all_tasks:
                await self._db.delete(t)
            await self._db.commit()
            return (
                f"Done. All **{count} task{'s' if count != 1 else ''}** have been deleted.",
                [ChatAction(type="task_deleted", label=f"Deleted all {count} tasks", payload={"count": count})],
            )

        # ── Single task delete ────────────────────────────────────────────────
        task = None
        if ref.isdigit():
            task = await self._task_repo.get_by_id(int(ref))
        else:
            if user.role in {ADMIN, TEAM_MANAGER}:
                all_tasks = await self._task_repo.list_all()
            else:
                all_tasks = await self._task_repo.list_for_assignee(user.id)
            ref_lower = ref.lower()
            matches = [t for t in all_tasks if ref_lower in t.name.lower()]
            if matches:
                task = matches[0]

        if not task:
            return (
                f'I couldn\'t find a task matching "{ref}". '
                "Please check the Tasks page or provide the exact task ID.",
                [],
            )

        name = task.name
        await self._task_repo.delete(task)
        return f'Task "{name}" has been deleted.', [
            ChatAction(type="task_deleted", label=f'Deleted: "{name}"', payload={"task_name": name})
        ]

    # ─── Analyze text ─────────────────────────────────────────────────────────

    async def _build_users_block(self) -> str:
        all_users = await self._user_repo.list_all()
        if not all_users:
            return ""
        lines = "\n".join(f"- {u.full_name} <{u.email}>" for u in all_users)
        return f"Known system users (match assignee names to this list):\n{lines}\n\n"

    async def _handle_analyze_text(
        self, user: User, message: str, history: str = ""
    ) -> tuple[str, list[ChatAction]]:
        users_block = await self._build_users_block()
        system = (
            _ANALYZE_TEXT_SYSTEM
            .replace("{users_block}", users_block)
            .replace("{today}", _today())
        )
        user_prompt = (
            f"Conversation history:\n{history}\n\nUser instruction: {message}"
            if history else message
        )
        result = await self._llm.generate_text(
            system_prompt=system,
            user_prompt=user_prompt,
            temperature=0.1,
            response_format="json",
        )
        data = _parse_json_safe(result.text)

        raw_tasks: list[dict] = data.get("tasks", [])
        summary: str = data.get("summary", "")

        if not raw_tasks:
            summary_line = f"\n\nSummary: {summary}" if summary else ""
            return f"I analyzed the text but couldn't find any clear action items.{summary_line}", []

        # Create tasks in the DB
        created = []
        actions: list[ChatAction] = []
        for raw in raw_tasks:
            name = (raw.get("name") or "").strip()
            if not name:
                continue
            assignee_id = await self._resolve_user_id(raw.get("assignee_name"), fallback=user.id)
            project_id = await self._resolve_project_id(raw.get("project_name"))
            team_id = await self._resolve_team_id(raw.get("team_name"))

            payload = TaskCreate(
                name=name,
                start_date=_parse_date(raw.get("start_date")),
                due_date=_parse_date(raw.get("due_date")),
                assignee_id=assignee_id,
                project_id=project_id,
                team_id=team_id,
            )
            task = await self._task_repo.create(payload, created_by_id=user.id)
            created.append(task)
            actions.append(
                ChatAction(
                    type="task_created",
                    label=f'Task created: "{task.name}"',
                    payload={"task_id": task.id, "task_name": task.name},
                )
            )

        summary_line = f"\n\n**Summary:** {summary}" if summary else ""
        reply = (
            f"I extracted **{len(created)} task{'s' if len(created) > 1 else ''}** from the text:{summary_line}\n\n"
            + "\n".join(f"• {t.name}" for t in created)
        )
        return reply, actions

    # ─── General Q&A ─────────────────────────────────────────────────────────

    async def _handle_general(
        self, user: User, message: str, history: str
    ) -> tuple[str, list[ChatAction]]:
        from app.core.roles import ADMIN, TEAM_MANAGER

        if user.role in {ADMIN, TEAM_MANAGER}:
            tasks = await self._task_repo.list_all()
        else:
            tasks = await self._task_repo.list_for_assignee(user.id)

        task_summary = (
            f"The user currently has {len(tasks)} task(s). "
            f"Status breakdown: "
            + ", ".join(
                f"{s}={sum(1 for t in tasks if t.status == s)}"
                for s in ["todo", "in_progress", "pending_review", "done"]
            )
        )

        result = await self._llm.generate_text(
            system_prompt=(
                f"You are a helpful task management assistant for {user.full_name}. "
                f"{task_summary}. "
                "Answer the user's question helpfully and concisely. "
                "You can help with: creating tasks, checking task status, managing workflows, "
                "and general task management advice. "
                "Keep responses under 200 words unless more detail is explicitly requested."
            ),
            user_prompt=(
                f"Conversation so far:\n{history}\n\nUser: {message}" if history else message
            ),
            temperature=0.4,
        )
        return result.text, []

    # ─── Helpers ──────────────────────────────────────────────────────────────

    async def _resolve_user_id(
        self, name: str | None, fallback: int | None = None
    ) -> int | None:
        if not name:
            return fallback
        users = await self._user_repo.list_all()
        name_lower = name.lower()
        for u in users:
            if name_lower in u.full_name.lower() or name_lower in u.email.lower():
                return u.id
        return fallback

    async def _resolve_project_id(self, name: str | None) -> int | None:
        if not name:
            return None
        projects = await self._project_repo.list_all()
        name_lower = name.lower()
        for p in projects:
            if name_lower in p.name.lower():
                return p.id
        return None

    async def _resolve_team_id(self, name: str | None) -> int | None:
        if not name:
            return None
        teams = await self._team_repo.list_all()
        name_lower = name.lower()
        for t in teams:
            if name_lower in t.name.lower():
                return t.id
        return None

    @staticmethod
    def _format_history(messages: list) -> str:
        lines = []
        for m in messages[-10:]:
            role = "User" if m.role == "user" else "Assistant"
            # Allow longer assistant messages so summaries/analyses are fully visible
            limit = 2000 if m.role == "assistant" else 400
            content = m.content[:limit]
            if len(m.content) > limit:
                content += " [...]"
            lines.append(f"{role}: {content}")
        return "\n".join(lines)


# ─── File context helpers ─────────────────────────────────────────────────────

def _build_stored_message(message: str, file_context: dict | None) -> str:
    """What gets saved to the database as the user's message."""
    if not file_context:
        return message
    badge = f"[📎 {file_context['filename']}]"
    return f"{badge}\n\n{message}".strip() if message.strip() else badge


def _build_llm_prompt(message: str, file_context: dict | None) -> str:
    """What gets sent to the LLM (includes raw file text)."""
    if not file_context:
        return message
    file_block = (
        f"[ATTACHED FILE: {file_context['filename']}]\n"
        f"{file_context['text']}\n"
        f"[END OF FILE]"
    )
    user_part = message.strip() or "Please analyse this file and extract any actionable tasks."
    return f"{file_block}\n\n[USER MESSAGE]\n{user_part}"


# ─── Serialisation helper ─────────────────────────────────────────────────────

def _msg_read(msg: "ChatMessage"):
    from app.schemas.chat import ChatMessageRead

    return ChatMessageRead(
        id=msg.id,
        session_id=msg.session_id,
        role=msg.role,
        content=msg.content,
        created_at=msg.created_at,
    )


def _parse_date(value: str | None) -> date | None:
    if not value:
        return None
    try:
        return date.fromisoformat(str(value))
    except (ValueError, TypeError):
        return None
