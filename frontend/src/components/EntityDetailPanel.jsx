import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";

import { noteApi } from "../api/noteApi";
import { rockApi } from "../api/rockApi";
import { useAuth } from "../context/AuthContext";
import RichEditor from "./RichEditor";
import DatePicker from "./DatePicker";

const AVATAR_COLORS = [
  "bg-indigo-500", "bg-violet-500", "bg-emerald-500", "bg-sky-500",
  "bg-amber-500", "bg-rose-500", "bg-teal-500", "bg-fuchsia-500",
];

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  return parts.length === 1 ? parts[0][0].toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatDate(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function formatRelative(value) {
  if (!value) return "";
  const diffMs = Date.now() - new Date(value).getTime();
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  if (hours < 1) return "Just now";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} day${days === 1 ? "" : "s"} ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months === 1 ? "" : "s"} ago`;
}

function Avatar({ user, size = "h-8 w-8" }) {
  if (!user) {
    return <div className={`${size} shrink-0 rounded-full border-2 border-dashed border-slate-200`} />;
  }
  return (
    <div
      className={`flex ${size} shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${AVATAR_COLORS[user.id % AVATAR_COLORS.length]}`}
      title={user.full_name || user.email}
    >
      {getInitials(user.full_name || user.email)}
    </div>
  );
}

function MilestoneFormModal({ initial, users, onCancel, onSubmit, isSaving }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [dueDate, setDueDate] = useState(initial?.due_date || "");
  const [ownerId, setOwnerId] = useState(initial?.owner_id ? String(initial.owner_id) : "");

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description: description || null,
      due_date: dueDate || null,
      owner_id: ownerId ? Number(ownerId) : null,
    });
  }

  return createPortal(
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{initial ? "Edit milestone" : "Add milestone"}</h3>
            <p className="mt-0.5 text-xs text-slate-500">Capture milestones without leaving the rock list.</p>
          </div>
          <button type="button" onClick={onCancel} className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Name</label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Name your milestone"
              required
              autoFocus
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
            <RichEditor
              content={description}
              onChange={setDescription}
              placeholder="Add details or context for this milestone"
              minHeight={100}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Completed by</label>
              <DatePicker value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Owner</label>
              <select
                value={ownerId}
                onChange={(e) => setOwnerId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">Unassigned</option>
                {(users || []).map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-1">
            <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {isSaving ? "Saving..." : initial ? "Save milestone" : "Add milestone"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

function MilestoneEditor({ teamId, rockId, milestones, users, onMilestonesChange }) {
  const [formTarget, setFormTarget] = useState(null); // null = closed, "new" = add, milestone object = edit
  const [isSaving, setIsSaving] = useState(false);

  async function persist(updated) {
    try {
      setIsSaving(true);
      const payload = updated.map((m, i) => ({
        id: typeof m.id === "number" ? m.id : undefined,
        title: m.title,
        description: m.description ?? null,
        status: m.status,
        due_date: m.due_date || null,
        owner_id: m.owner_id || null,
        sort_order: i,
      }));
      const updatedRock = await rockApi.update(teamId, rockId, { milestones: payload });
      onMilestonesChange?.(updatedRock.milestones || []);
    } catch (err) {
      toast.error(err.message || "Failed to update milestones.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleToggle(ms) {
    const updated = milestones.map((m) =>
      m.id === ms.id ? { ...m, status: m.status === "complete" ? "pending" : "complete" } : m
    );
    persist(updated);
  }

  function handleDelete(ms) {
    persist(milestones.filter((m) => m.id !== ms.id));
  }

  function handleFormSubmit(values) {
    let updated;
    if (formTarget === "new") {
      updated = [...milestones, { id: `new-${Date.now()}`, status: "pending", ...values }];
    } else {
      updated = milestones.map((m) => (m.id === formTarget.id ? { ...m, ...values } : m));
    }
    setFormTarget(null);
    persist(updated);
  }

  const completed = milestones.filter((m) => m.status === "complete").length;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Milestones</h3>
          <p className="text-xs text-slate-400">{completed}/{milestones.length} complete</p>
        </div>
        <button
          type="button"
          onClick={() => setFormTarget("new")}
          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
        >
          + Add milestone
        </button>
      </div>

      {milestones.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-200 py-4 text-center text-xs text-slate-400">
          No milestones yet.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {milestones.map((ms) => (
            <li key={ms.id} className="flex items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-2">
              <button
                type="button"
                onClick={() => handleToggle(ms)}
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px] transition-colors ${
                  ms.status === "complete" ? "border-indigo-600 bg-indigo-600 text-white" : "border-slate-400 text-transparent hover:border-indigo-400"
                }`}
              >
                ✓
              </button>

              <span className={`flex-1 truncate text-sm ${ms.status === "complete" ? "text-slate-400 line-through" : "text-slate-700"}`}>
                {ms.title}
              </span>
              <span className="shrink-0 text-xs text-slate-400">{formatDate(ms.due_date) || "No due date"}</span>
              <button type="button" onClick={() => setFormTarget(ms)} className="shrink-0 rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                </svg>
              </button>
              <button type="button" onClick={() => handleDelete(ms)} className="shrink-0 rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600">
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482 41.03 41.03 0 00-2.365-.298V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4z" clipRule="evenodd" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}

      {formTarget && (
        <MilestoneFormModal
          initial={formTarget === "new" ? null : formTarget}
          users={users}
          isSaving={isSaving}
          onCancel={() => setFormTarget(null)}
          onSubmit={handleFormSubmit}
        />
      )}
    </div>
  );
}

/**
 * Slide-over detail panel shared by Rocks, KPIs, Issues, and News. Shows a
 * normalized view (header/owner/description/notes) regardless of which
 * entity type it's displaying; the Milestones section only renders when
 * `milestones` is passed (Rocks only — the other three have no analogous
 * editable sub-list).
 */
export default function EntityDetailPanel({
  entityType,
  entityId,
  teamId,
  title,
  statusLabel,
  createdAt,
  ownerUser,
  ownerLabel = "Owner",
  description,
  milestones,
  milestoneUsers,
  onMilestonesChange,
  onClose,
}) {
  const { user } = useAuth();
  const [notes, setNotes] = useState([]);
  const [isLoadingNotes, setIsLoadingNotes] = useState(true);
  const [draftNote, setDraftNote] = useState("");
  const [isSubmittingNote, setIsSubmittingNote] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadNotes() {
      try {
        setIsLoadingNotes(true);
        const data = await noteApi.list(entityType, entityId);
        if (!cancelled) setNotes(data);
      } catch (err) {
        if (!cancelled) toast.error(err.message || "Failed to load notes.");
      } finally {
        if (!cancelled) setIsLoadingNotes(false);
      }
    }

    loadNotes();
    return () => {
      cancelled = true;
    };
  }, [entityType, entityId]);

  async function handleAddNote() {
    if (!draftNote.trim()) return;
    try {
      setIsSubmittingNote(true);
      const created = await noteApi.create(entityType, entityId, draftNote.trim());
      setNotes((current) => [created, ...current]);
      setDraftNote("");
    } catch (err) {
      toast.error(err.message || "Failed to add note.");
    } finally {
      setIsSubmittingNote(false);
    }
  }

  async function handleDeleteNote(note) {
    try {
      await noteApi.remove(entityType, entityId, note.id);
      setNotes((current) => current.filter((n) => n.id !== note.id));
    } catch (err) {
      toast.error(err.message || "Failed to delete note.");
    }
  }

  const canDelete = (note) => user?.role === "owner" || user?.role === "admin" || note.author_id === user?.id;

  return createPortal(
    <div className="fixed inset-0 z-[200]">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />

      <div className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div>
            <h2 className="text-lg font-bold text-slate-900">
              {entityType === "rock" ? "Rock" : entityType === "kpi" ? "KPI" : entityType === "issue" ? "Issue" : "News"} details
            </h2>
            <p className="mt-1 text-xs text-slate-500">Review information without leaving the list.</p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-900">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-6 px-6 py-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-xl font-bold text-slate-900">{title}</h3>
              {statusLabel && (
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">{statusLabel}</span>
              )}
            </div>
            {createdAt && <p className="mt-1 text-xs text-slate-400">Created {formatRelative(createdAt)} · {formatDate(createdAt)}</p>}
          </div>

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{ownerLabel}</h3>
            {ownerUser ? (
              <div className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                <Avatar user={ownerUser} />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{ownerUser.full_name || ownerUser.email}</p>
                  <p className="truncate text-xs text-slate-400">{ownerUser.email}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-slate-400">Unassigned.</p>
            )}
          </div>

          {milestones !== undefined && (
            <MilestoneEditor teamId={teamId} rockId={entityId} milestones={milestones} users={milestoneUsers} onMilestonesChange={onMilestonesChange} />
          )}

          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Description</h3>
            <p className="whitespace-pre-wrap text-sm text-slate-700">{description || "No description provided."}</p>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Notes</h3>
              <span className="text-xs text-slate-400">{notes.length} note{notes.length === 1 ? "" : "s"}</span>
            </div>

            {isLoadingNotes ? (
              <p className="text-sm text-slate-400">Loading notes...</p>
            ) : notes.length === 0 ? (
              <p className="rounded-lg border border-dashed border-slate-200 py-4 text-center text-xs text-slate-400">
                No notes yet.
              </p>
            ) : (
              <ul className="space-y-3">
                {notes.map((note) => (
                  <li key={note.id} className="flex gap-3">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">
                      {getInitials(note.author_name)}
                    </div>
                    <div className="min-w-0 flex-1 rounded-xl bg-slate-50 px-3 py-2">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-slate-900">{note.author_name || "Unknown"}</p>
                        <span className="shrink-0 text-xs text-slate-400">{formatRelative(note.created_at)}</span>
                      </div>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm text-slate-700">{note.text}</p>
                      {canDelete(note) && (
                        <button
                          type="button"
                          onClick={() => handleDeleteNote(note)}
                          className="mt-1 text-xs font-semibold text-red-500 hover:text-red-700"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3">
              <textarea
                value={draftNote}
                onChange={(e) => setDraftNote(e.target.value)}
                rows={3}
                placeholder="Add context, updates, or reminders..."
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={handleAddNote}
                disabled={isSubmittingNote || !draftNote.trim()}
                className="mt-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {isSubmittingNote ? "Adding..." : "Add note"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
