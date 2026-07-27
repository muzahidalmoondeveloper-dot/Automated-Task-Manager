import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import DOMPurify from "dompurify";
import RichEditor from "../components/RichEditor";
import LinkedItemsHoverIcon from "../components/LinkedItemsHoverIcon";
import EntityDetailPanel from "../components/EntityDetailPanel";
import DatePicker from "../components/DatePicker";
import toast from "react-hot-toast";
import { rockApi } from "../api/rockApi";
import { noteApi } from "../api/noteApi";
import { kpiApi } from "../api/kpiApi";
import { taskApi } from "../api/taskApi";
import { organizationApi } from "../api/organizationApi";
import { teamApi } from "../api/teamApi";
import { projectApi } from "../api/projectApi";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useConfirm } from "../context/ConfirmContext";
import { RockIconDisplay } from "../utils/rockIcons.jsx";
import IconPickerButton from "../components/IconPicker.jsx";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-indigo-500","bg-violet-500","bg-emerald-500","bg-sky-500",
  "bg-amber-500","bg-rose-500","bg-teal-500","bg-fuchsia-500",
];
function getInitials(name) {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
}
function fmtDate(d) {
  if (!d) return "";
  return new Date(d + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}
function isOverdue(d) {
  if (!d) return false;
  return new Date(d + "T00:00:00") < new Date(new Date().toDateString());
}
function stripHtml(html) {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = DOMPurify.sanitize(html);
  return div.textContent || "";
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  backlog:   { label: "Backlog",    bg: "bg-slate-100",  text: "text-slate-600",   icon: "○"  },
  planned:   { label: "Planned",    bg: "bg-blue-100",   text: "text-blue-700",    icon: "▷"  },
  on_track:  { label: "On-track",   bg: "bg-green-100",  text: "text-green-700",   icon: "⊙"  },
  at_risk:   { label: "At-risk",    bg: "bg-amber-100",  text: "text-amber-700",   icon: "◎"  },
  off_track: { label: "Off-track",  bg: "bg-red-100",    text: "text-red-700",     icon: "⊗"  },
  complete:  { label: "Completed",  bg: "bg-emerald-100",text: "text-emerald-700", icon: "✓"  },
  canceled:  { label: "Canceled",   bg: "bg-slate-100",  text: "text-slate-500",   icon: "⊘"  },
  archived:  { label: "Archived",   bg: "bg-slate-100",  text: "text-slate-400",   icon: "◻"  },
};

// Status options shown in the status picker (archived is set via Archive action, not the dropdown)
const SELECTABLE_STATUSES = ["backlog", "planned", "on_track", "at_risk", "off_track", "complete", "canceled"]
  .map((v) => ({ value: v, ...STATUS_CONFIG[v] }));

const TAB_STATUS_MAP = {
  active:   "on_track",
  backlog:  "backlog",
  planned:  "planned",
  archived: "archived",
};

// ─── Progress circle ──────────────────────────────────────────────────────────

function ProgressCircle({ completed, total }) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const r = 11;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div className="flex items-center gap-2">
      <svg width="28" height="28" viewBox="0 0 28 28">
        <circle cx="14" cy="14" r={r} fill="none" stroke="#e2e8f0" strokeWidth="3" />
        {pct > 0 && (
          <circle cx="14" cy="14" r={r} fill="none" stroke="#0f172a" strokeWidth="3"
            strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
            transform="rotate(-90 14 14)" />
        )}
      </svg>
      <span className="text-xs text-slate-600">
        {completed}/{total} ({pct}%)
      </span>
    </div>
  );
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status, onChange, editable }) {
  const [open, setOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const btnRef = useRef(null);
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.backlog;

  function handleClick() {
    if (!editable) return;
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen((v) => !v);
  }

  return (
    <div className="inline-block">
      <button ref={btnRef} type="button"
        onClick={handleClick}
        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${cfg.bg} ${cfg.text} ${editable ? "cursor-pointer hover:opacity-80" : "cursor-default"}`}>
        <span>{cfg.icon}</span>
        {cfg.label}
        {editable && <span className="opacity-60">⌄</span>}
      </button>
      {open && menuPos && createPortal(
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setOpen(false)} />
          <div className="fixed z-[101] w-36 rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
            style={{ top: menuPos.top, left: menuPos.left }}>
            {SELECTABLE_STATUSES.map((s) => (
              <button key={s.value} type="button"
                onClick={() => { onChange(s.value); setOpen(false); }}
                className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-700 hover:bg-slate-50">
                <span className={s.text}>{s.icon}</span>
                <span className="flex-1 text-left">{s.label}</span>
                {s.value === status && <span className="text-emerald-500 font-bold">✓</span>}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

// ─── Milestone row ────────────────────────────────────────────────────────────

function MilestoneRow({ ms, users, onChange, onDelete, isDragOver, onDragStart, onDragOver, onDrop, onDragEnd }) {
  const owner = users.find((u) => u.id === ms.owner_id);
  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`flex items-center gap-2 rounded-lg border bg-white px-3 py-2 transition-colors ${isDragOver ? "border-indigo-400 bg-indigo-50" : "border-slate-200"}`}
    >
      <span className="shrink-0 cursor-grab text-slate-300 text-lg leading-none select-none active:cursor-grabbing">⠿</span>
      <button type="button"
        onClick={() => onChange({ ...ms, status: ms.status === "complete" ? "pending" : "complete" })}
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs ${
          ms.status === "complete" ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-400 text-slate-400 hover:border-slate-600"
        }`}>
        {ms.status === "complete" ? "✓" : ""}
      </button>
      <input value={ms.title} onChange={(e) => onChange({ ...ms, title: e.target.value })}
        placeholder="Milestone title"
        className="min-w-0 flex-1 border-none text-sm text-slate-700 placeholder:text-slate-400 outline-none" />
      {/* Date */}
      <div className="w-40 shrink-0">
        <DatePicker value={ms.due_date || ""} onChange={(e) => onChange({ ...ms, due_date: e.target.value || null })} />
      </div>
      {/* Owner */}
      <div className="relative shrink-0">
        <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white ${
          owner ? AVATAR_COLORS[owner.id % AVATAR_COLORS.length] : "bg-slate-200 text-slate-500"
        }`}>
          {owner ? getInitials(owner.full_name || owner.email) : "—"}
        </div>
        <select value={ms.owner_id || ""} onChange={(e) => onChange({ ...ms, owner_id: e.target.value ? Number(e.target.value) : null })}
          className="absolute inset-0 w-full opacity-0 cursor-pointer">
          <option value="">Unassigned</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
        </select>
      </div>
      <button type="button" onClick={onDelete} className="shrink-0 text-slate-400 hover:text-red-500 text-lg leading-none">×</button>
    </div>
  );
}

// ─── Links helpers ────────────────────────────────────────────────────────────

const LINK_TYPE_LABELS = { objective: "Objective", rock: "Rock", task: "To-Do", kpi: "KPI" };

function LinkTypeIcon({ type, className = "h-3.5 w-3.5" }) {
  if (type === "objective") return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11zm0-2.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
    </svg>
  );
  if (type === "rock") return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 2L3 7l2.5 11h9L17 7l-7-5z" />
    </svg>
  );
  if (type === "kpi") return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M3 13a1 1 0 011-1h1a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4zM8 9a1 1 0 011-1h1a1 1 0 011 1v8a1 1 0 01-1 1H9a1 1 0 01-1-1V9zM14 5a1 1 0 011-1h1a1 1 0 011 1v12a1 1 0 01-1 1h-1a1 1 0 01-1-1V5z" clipRule="evenodd" />
    </svg>
  );
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
    </svg>
  );
}

// ─── Rock modal ───────────────────────────────────────────────────────────────

function RockModal({ team, users, objectives, teams, projects, currentUser, editing, onClose, onSave, saving, defaultStatus = "backlog" }) {
  const [title, setTitle] = useState(editing?.title || "");
  const [icon, setIcon] = useState(editing?.icon || null);
  const [desc, setDesc] = useState(editing?.description || "");
  const [status, setStatus] = useState(editing?.status || defaultStatus);
  const [ownerId, setOwnerId] = useState(editing ? String(editing.owner?.id || "") : String(currentUser?.id || ""));
  const [teamId, setTeamId] = useState(String(editing?.team_id || team?.id || ""));
  const [objectiveId, setObjectiveId] = useState(editing?.objective_id ? String(editing.objective_id) : "");
  const [projectId, setProjectId] = useState(editing?.project_id ? String(editing.project_id) : "");
  const [dueDate, setDueDate] = useState(editing?.due_date || "");
  const [tags, setTags] = useState(editing?.tags || []);
  const [tagInput, setTagInput] = useState("");
  const [milestones, setMilestones] = useState(
    (editing?.milestones || []).map((m) => ({
      ...m,
      owner_id: m.owner_id ?? m.owner?.id ?? null,
      due_date: m.due_date || "",
    }))
  );
  const [msDragIdx, setMsDragIdx] = useState(null);
  const [msOverIdx, setMsOverIdx] = useState(null);

  const [selectedLinks, setSelectedLinks] = useState(
    (editing?.links || []).map((l) => ({ linked_type: l.linked_type, linked_id: l.linked_id, title: l.title }))
  );
  const [linksOpen, setLinksOpen] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const [linkableItems, setLinkableItems] = useState({ objective: [], rock: [], task: [], kpi: [] });
  const [linkableLoading, setLinkableLoading] = useState(false);
  const linksRef = useRef(null);

  useEffect(() => {
    if (!linksOpen) return;
    function handleOutside(e) {
      if (linksRef.current && !linksRef.current.contains(e.target)) setLinksOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [linksOpen]);

  useEffect(() => {
    setLinkableLoading(true);
    Promise.all([
      organizationApi.listObjectives().catch(() => []),
      rockApi.list(team.id).catch(() => []),
      taskApi.listByTeam(team.id).catch(() => []),
      kpiApi.list(team.id).catch(() => []),
    ]).then(([objectives, rocks, tasks, kpis]) => {
      setLinkableItems({
        objective: (objectives || []).map((o) => ({ id: o.id, title: o.title })),
        rock: (rocks || []).map((r) => ({ id: r.id, title: r.title })),
        task: (tasks || []).map((t) => ({ id: t.id, title: t.name })),
        kpi: (kpis || []).map((k) => ({ id: k.id, title: k.title })),
      });
    }).finally(() => setLinkableLoading(false));
  }, [team.id]);

  function toggleLink(type, item) {
    setSelectedLinks((prev) => {
      const exists = prev.some((l) => l.linked_type === type && l.linked_id === item.id);
      if (exists) return prev.filter((l) => !(l.linked_type === type && l.linked_id === item.id));
      return [...prev, { linked_type: type, linked_id: item.id, title: item.title }];
    });
  }

  function handleMilestoneDrop(toIdx) {
    if (msDragIdx === null || msDragIdx === toIdx) { setMsDragIdx(null); setMsOverIdx(null); return; }
    setMilestones((prev) => {
      const next = [...prev];
      const [moved] = next.splice(msDragIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
    setMsDragIdx(null);
    setMsOverIdx(null);
  }

  function addTag() {
    const t = tagInput.trim();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setTagInput("");
  }

  function addMilestone() {
    setMilestones((prev) => [...prev, { title: "", status: "pending", due_date: "", owner_id: null, sort_order: prev.length }]);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      icon,
      description: desc || null,
      status,
      owner_id: ownerId ? Number(ownerId) : null,
      objective_id: objectiveId ? Number(objectiveId) : null,
      due_date: dueDate || null,
      tags,
      milestones: milestones.map((m, i) => ({
        id: m.id,
        title: m.title,
        status: m.status,
        due_date: m.due_date || null,
        owner_id: m.owner_id || null,
        sort_order: i,
      })),
      project_id: projectId ? Number(projectId) : null,
      team_id: Number(teamId) || team?.id,
      links: selectedLinks,
    });
  }

  const selectedOwner = users.find((u) => String(u.id) === String(ownerId));
  const selectedTeam = (teams || []).find((t) => String(t.id) === String(teamId));
  const selectedProject = (projects || []).find((p) => String(p.id) === String(projectId));
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.backlog;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-6 backdrop-blur-sm">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-bold text-slate-900">{editing ? "Edit Rock" : "Create Rock"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-[1fr_280px] divide-x divide-slate-100 min-h-[500px]">
            {/* Left */}
            <div className="flex flex-col gap-0 p-6 space-y-5">
              {/* Title */}
              <div className="flex items-center gap-3">
                <IconPickerButton value={icon} onChange={setIcon} resetKey={editing?.id ?? "create"} size={20} />
                <input value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="Rock title" required autoFocus
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-base font-medium text-slate-900 placeholder:text-slate-300 outline-none focus:border-slate-400" />
              </div>

              {/* Description */}
              <RichEditor content={desc} onChange={setDesc} placeholder="Describe this Rock." />

              {/* Milestones */}
              <div>
                <div className="mb-3 flex items-center gap-2">
                  <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M3 6a3 3 0 013-3h10a1 1 0 01.8 1.6L14.25 8l2.55 3.4A1 1 0 0116 13H6a1 1 0 00-1 1v3a1 1 0 11-2 0V6z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-semibold text-slate-700">Milestones</span>
                </div>
                {milestones.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-200 px-4 py-5 text-sm text-slate-400 text-center">
                    Add milestones that mark progress.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {milestones.map((ms, i) => (
                      <MilestoneRow key={i} ms={ms} users={users}
                        isDragOver={msOverIdx === i}
                        onDragStart={() => setMsDragIdx(i)}
                        onDragOver={() => setMsOverIdx(i)}
                        onDrop={() => handleMilestoneDrop(i)}
                        onDragEnd={() => { setMsDragIdx(null); setMsOverIdx(null); }}
                        onChange={(updated) => setMilestones((prev) => prev.map((m, idx) => idx === i ? updated : m))}
                        onDelete={() => setMilestones((prev) => prev.filter((_, idx) => idx !== i))} />
                    ))}
                  </div>
                )}
                <button type="button" onClick={addMilestone}
                  className="mt-3 flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800">
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                  </svg>
                  Add milestone
                </button>
              </div>
            </div>

            {/* Right — Settings */}
            <div className="space-y-4 p-5">
              <p className="text-sm font-semibold text-slate-800">Settings</p>

              {/* Teams */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Teams</label>
                <div className="relative">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
                    <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M7 8a3 3 0 100-6 3 3 0 000 6zM13.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                      <path d="M2.5 15.5A4.5 4.5 0 017 11h.25a4.5 4.5 0 014.5 4.5.5.5 0 01-.5.5H3a.5.5 0 01-.5-.5z" />
                    </svg>
                    <span className="flex-1 truncate text-sm text-slate-700">{selectedTeam?.name || team?.name || "—"}</span>
                    <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <select value={teamId} onChange={(e) => setTeamId(e.target.value)}
                    className="absolute inset-0 w-full cursor-pointer opacity-0">
                    {(teams || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Project */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Project</label>
                <div className="relative">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
                    <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
                    </svg>
                    <span className="flex-1 truncate text-sm text-slate-700">{selectedProject?.name || "No project"}</span>
                    <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
                    className="absolute inset-0 w-full cursor-pointer opacity-0">
                    <option value="">No project</option>
                    {(projects || []).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Owner */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Owner</label>
                <div className="relative">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
                    {selectedOwner ? (
                      <>
                        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${AVATAR_COLORS[selectedOwner.id % AVATAR_COLORS.length]}`}>
                          {getInitials(selectedOwner.full_name || selectedOwner.email)}
                        </div>
                        <span className="truncate text-sm text-slate-700">{selectedOwner.full_name || selectedOwner.email}</span>
                      </>
                    ) : <span className="text-sm text-slate-400">Unassigned</span>}
                    <svg className="ml-auto h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer">
                    <option value="">Unassigned</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                  </select>
                </div>
              </div>

              {/* Objective */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Objective</label>
                <div className="relative">
                  <select value={objectiveId} onChange={(e) => setObjectiveId(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:outline-none">
                    <option value="">Select Objective</option>
                    {objectives.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
                  </select>
                  <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Status</label>
                <div className="relative">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-semibold ${statusCfg.bg} ${statusCfg.text}`}>
                      {statusCfg.icon} {statusCfg.label}
                    </span>
                    <svg className="ml-auto h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <select value={status} onChange={(e) => setStatus(e.target.value)}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer">
                    {SELECTABLE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Due date */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Due date</label>
                <DatePicker value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>

              {/* Tags */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Tags</label>
                <div className="rounded-xl border border-slate-200 px-3 py-2">
                  {tags.length > 0 && (
                    <div className="mb-2 flex flex-wrap gap-1">
                      {tags.map((t) => (
                        <span key={t} className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                          {t}
                          <button type="button" onClick={() => setTags((prev) => prev.filter((x) => x !== t))} className="text-slate-400 hover:text-slate-600">×</button>
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input value={tagInput} onChange={(e) => setTagInput(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                      placeholder="Press Enter to add a tag"
                      className="flex-1 border-none text-xs text-slate-600 placeholder:text-slate-400 outline-none" />
                    <button type="button" onClick={addTag} className="text-xs font-medium text-slate-500 hover:text-slate-800">+ Add</button>
                  </div>
                </div>
              </div>

              {/* Links */}
              <div ref={linksRef} className="relative">
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Links</label>
                <button type="button" onClick={() => setLinksOpen((v) => !v)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-left hover:bg-slate-50">
                  {selectedLinks.length > 0 ? (
                    <span className="truncate text-sm font-medium text-slate-900">
                      {selectedLinks.length} item{selectedLinks.length === 1 ? "" : "s"} linked
                    </span>
                  ) : (
                    <span className="text-sm text-slate-400">Select linked items</span>
                  )}
                  <svg className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${linksOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                  </svg>
                </button>
                {selectedLinks.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {selectedLinks.map((link) => (
                      <span key={`${link.linked_type}:${link.linked_id}`}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        <LinkTypeIcon type={link.linked_type} className="h-3 w-3 text-slate-400" />
                        <span className="max-w-[100px] truncate">{link.title}</span>
                        <button type="button" onClick={() => toggleLink(link.linked_type, { id: link.linked_id, title: link.title })}
                          className="ml-0.5 text-slate-400 hover:text-slate-700">×</button>
                      </span>
                    ))}
                  </div>
                )}
                {linksOpen && (
                  <div className="absolute left-0 right-0 z-10 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                    <div className="sticky top-0 border-b border-slate-100 bg-white p-2">
                      <input autoFocus value={linkSearch} onChange={(e) => setLinkSearch(e.target.value)}
                        placeholder="Search…"
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-slate-400" />
                    </div>
                    {linkableLoading ? (
                      <p className="px-3 py-4 text-center text-xs text-slate-400">Loading…</p>
                    ) : (
                      (() => {
                        const q = linkSearch.trim().toLowerCase();
                        const groups = ["objective", "rock", "task", "kpi"].map((type) => ({
                          type,
                          items: (linkableItems[type] || []).filter((item) => !q || item.title.toLowerCase().includes(q)),
                        })).filter((g) => g.items.length > 0);
                        return groups.length === 0 ? (
                          <p className="px-3 py-4 text-center text-xs text-slate-400">No matching items.</p>
                        ) : groups.map((group) => (
                          <div key={group.type} className="py-1.5">
                            <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                              {LINK_TYPE_LABELS[group.type]}
                            </p>
                            {group.items.map((item) => {
                              const isSelected = selectedLinks.some((l) => l.linked_type === group.type && l.linked_id === item.id);
                              return (
                                <button key={item.id} type="button" onClick={() => toggleLink(group.type, item)}
                                  className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${isSelected ? "bg-slate-50 font-medium text-slate-900" : "text-slate-700"}`}>
                                  <LinkTypeIcon type={group.type} className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                                  <span className="truncate">{item.title}</span>
                                  {isSelected && (
                                    <svg className="ml-auto h-3.5 w-3.5 shrink-0 text-slate-900" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                    </svg>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        ));
                      })()
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
            <button type="button" onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60">
              {saving ? "Saving…" : editing ? "Save changes" : "Create Rock"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Rock row ─────────────────────────────────────────────────────────────────

function RockRow({ rock, users, canManage, onEdit, onDelete, onArchive, onStatusChange, onMilestoneToggle, onRockUpdated, noteCount = 0, onNotesPanelClose }) {
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const menuBtnRef = useRef(null);

  function openMenu(e) {
    e.stopPropagation();
    if (menuBtnRef.current) {
      const r = menuBtnRef.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setMenuOpen((v) => !v);
  }
  const completed = rock.milestones.filter((m) => m.status === "complete").length;
  const total = rock.milestones.length;
  const owner = rock.owner;
  const overdue = isOverdue(rock.due_date);

  return (
    <>
      <tr className="group border-b border-slate-100 hover:bg-slate-50/60">
        {/* Expand */}
        <td className="w-8 pl-4 pr-1 py-3">
          {rock.milestones.length > 0 && (
            <button type="button" onClick={() => setExpanded((v) => !v)}
              className="text-slate-400 hover:text-slate-600 transition-transform"
              style={{ transform: expanded ? "rotate(90deg)" : "" }}>
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
              </svg>
            </button>
          )}
        </td>
        {/* Status */}
        <td className="py-3 pr-3 w-36">
          <StatusBadge status={rock.status} editable={canManage} onChange={(s) => onStatusChange(rock, s)} />
        </td>
        {/* Rock name */}
        <td className="py-3 pr-3">
          <div className="flex items-center gap-2">
            <RockIconDisplay iconStr={rock.icon} size={16} />
            <span className="text-sm font-medium text-slate-800">{rock.title}</span>
            {/* NEW badge — shown if created within 7 days */}
            {Date.now() - new Date(rock.created_at).getTime() < 7 * 24 * 60 * 60 * 1000 && (
              <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white">NEW</span>
            )}
            {rock.objective && (
              <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 20 20" fill="currentColor" title={rock.objective.title}>
                <path d="M12.232 4.232a2.5 2.5 0 013.536 3.536l-1.225 1.224a.75.75 0 001.061 1.06l1.224-1.224a4 4 0 00-5.656-5.656l-3 3a4 4 0 00.225 5.865.75.75 0 00.977-1.138 2.5 2.5 0 01-.142-3.667l3-3z" />
                <path d="M11.603 7.963a.75.75 0 00-.977 1.138 2.5 2.5 0 01.142 3.667l-3 3a2.5 2.5 0 01-3.536-3.536l1.225-1.224a.75.75 0 00-1.061-1.06l-1.224 1.224a4 4 0 105.656 5.656l3-3a4 4 0 00-.225-5.865z" />
              </svg>
            )}
            <LinkedItemsHoverIcon links={rock.links} />
          </div>
        </td>
        {/* Progress */}
        <td className="py-3 pr-4 w-40">
          <ProgressCircle completed={completed} total={total} />
        </td>
        {/* Due date */}
        <td className={`py-3 pr-4 w-32 text-sm font-medium ${overdue ? "text-red-500" : "text-slate-600"}`}>
          {fmtDate(rock.due_date) || <span className="text-slate-300">—</span>}
        </td>
        {/* Owner */}
        <td className="py-3 pr-3 w-12">
          {owner ? (
            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white ${AVATAR_COLORS[owner.id % AVATAR_COLORS.length]}`}
              title={owner.full_name || owner.email}>
              {getInitials(owner.full_name || owner.email)}
            </div>
          ) : <span className="text-slate-300">—</span>}
        </td>
        {/* Notes / actions */}
        <td className="py-3 pr-4 w-20">
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => setDetailOpen(true)} title="Notes & details"
              className="relative rounded p-1 text-slate-400 hover:bg-slate-100">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902 1.168.188 2.352.327 3.55.414.28.02.521.18.642.413l1.713 3.293a.75.75 0 001.33 0l1.713-3.293a.647.647 0 01.642-.413 41.102 41.102 0 003.55-.414c1.437-.231 2.43-1.49 2.43-2.902V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0010 2z" clipRule="evenodd" />
              </svg>
              {noteCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
                  {noteCount > 99 ? "99+" : noteCount}
                </span>
              )}
            </button>
            {canManage && (
              <div className="opacity-0 group-hover:opacity-100 transition-opacity">
                <button ref={menuBtnRef} type="button"
                  onClick={openMenu}
                  className="rounded p-1 text-slate-400 hover:bg-slate-100">
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
                  </svg>
                </button>
                {menuOpen && menuPos && createPortal(
                  <>
                    <div className="fixed inset-0 z-[100]" onClick={() => setMenuOpen(false)} />
                    <div className="fixed z-[101] w-36 rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
                      style={{ top: menuPos.top, right: menuPos.right }}>
                      <button type="button" onClick={() => { setMenuOpen(false); onEdit(rock); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                        <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                        </svg>
                        Edit
                      </button>
                      <button type="button"
                        disabled={rock.status !== "complete"}
                        onClick={() => { if (rock.status === "complete") { setMenuOpen(false); onArchive(rock); } }}
                        className={`flex w-full items-center gap-2 px-3 py-2 text-sm transition-colors ${
                          rock.status === "complete"
                            ? "text-slate-700 hover:bg-slate-50 cursor-pointer"
                            : "text-slate-300 cursor-not-allowed"
                        }`}>
                        <svg className={`h-4 w-4 ${rock.status === "complete" ? "text-slate-400" : "text-slate-200"}`} viewBox="0 0 20 20" fill="currentColor">
                          <path d="M2 3a1 1 0 00-1 1v1a1 1 0 001 1h16a1 1 0 001-1V4a1 1 0 00-1-1H2zM2 7.5h16l-1.673 9.535A1 1 0 0115.34 18H4.66a1 1 0 01-.987-.965L2 7.5z" />
                        </svg>
                        Archive
                      </button>
                      <button type="button" onClick={() => { setMenuOpen(false); onDelete(rock); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                        <svg className="h-4 w-4 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4z" clipRule="evenodd" />
                        </svg>
                        Delete
                      </button>
                    </div>
                  </>,
                  document.body
                )}
              </div>
            )}
          </div>
        </td>
      </tr>
      {/* Expanded milestones */}
      {expanded && rock.milestones.map((ms) => {
        const msOwner = ms.owner;
        return (
          <tr key={ms.id} className="bg-slate-50/50 border-b border-slate-100">
            <td colSpan={2} />
            <td className="py-2 pr-3 pl-6">
              <div className="flex items-center gap-2">
                <button type="button"
                  onClick={() => onMilestoneToggle(rock, ms.id)}
                  className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border text-[9px] transition-colors ${
                    ms.status === "complete" ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-400 text-transparent hover:border-indigo-400"
                  }`}>✓</button>
                <span className={`text-xs ${ms.status === "complete" ? "text-slate-400 line-through" : "text-slate-700"}`}>{ms.title}</span>
              </div>
            </td>
            <td colSpan={2} className="py-2 text-xs text-slate-400">{fmtDate(ms.due_date)}</td>
            <td className="py-2">
              {msOwner && (
                <div className={`flex h-6 w-6 items-center justify-center rounded-full text-[9px] font-bold text-white ${AVATAR_COLORS[msOwner.id % AVATAR_COLORS.length]}`}>
                  {getInitials(msOwner.full_name || msOwner.email)}
                </div>
              )}
            </td>
            <td />
          </tr>
        );
      })}

      {detailOpen && (
        <EntityDetailPanel
          entityType="rock"
          entityId={rock.id}
          teamId={rock.team_id}
          title={rock.title}
          statusLabel={STATUS_CONFIG[rock.status]?.label || rock.status}
          createdAt={rock.created_at}
          ownerUser={rock.owner}
          description={rock.description}
          milestones={rock.milestones}
          milestoneUsers={users}
          onMilestonesChange={(newMilestones) => onRockUpdated?.({ ...rock, milestones: newMilestones })}
          onClose={() => { setDetailOpen(false); onNotesPanelClose?.(); }}
        />
      )}
    </>
  );
}

// ─── RocksTab ─────────────────────────────────────────────────────────────────

const TABS = [
  { id: "active",   label: "Active"   },
  { id: "backlog",  label: "Backlog"  },
  { id: "planned",  label: "Planned"  },
  { id: "archived", label: "Archived" },
];

export default function RocksTab({ team, canManage }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [rocks, setRocks] = useState([]);
  const [objectives, setObjectives] = useState([]);
  const [teams, setTeams] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("active");
  const users = team?.members || [];
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [noteCounts, setNoteCounts] = useState({});

  useEffect(() => {
    if (!team?.id) return;
    load();
  }, [team?.id]);

  async function load() {
    try {
      setLoading(true);
      const r = await rockApi.list(team.id);
      setRocks(Array.isArray(r) ? r : []);
      noteApi.counts("rock", (r || []).map((rock) => rock.id))
        .then(setNoteCounts)
        .catch(() => {});
      try {
        const objs = await apiClient.get("/organization/objectives");
        if (Array.isArray(objs)) setObjectives(objs);
      } catch { /* objectives optional */ }
      try {
        const ts = await teamApi.list();
        if (Array.isArray(ts)) setTeams(ts);
      } catch { /* teams optional */ }
      try {
        const ps = await projectApi.list();
        if (Array.isArray(ps)) setProjects(ps);
      } catch { /* projects optional */ }
    } catch {
      toast.error("Failed to load rocks.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(payload) {
    const { team_id: targetTeamId, ...rockPayload } = payload;
    const createTeamId = targetTeamId || team.id;
    setSaving(true);
    try {
      if (editing) {
        const updated = await rockApi.update(team.id, editing.id, payload);
        if (updated.team_id !== team.id) {
          setRocks((prev) => prev.filter((r) => r.id !== editing.id));
        } else {
          setRocks((prev) => prev.map((r) => (r.id === editing.id ? updated : r)));
        }
        toast.success("Rock updated.");
      } else {
        const created = await rockApi.create(createTeamId, rockPayload);
        if (created.team_id === team.id) {
          setRocks((prev) => [created, ...prev]);
        }
        toast.success("Rock created.");
      }
      setShowModal(false);
      setEditing(null);
    } catch {
      toast.error("Failed to save rock.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(rock) {
    if (!(await confirm({ message: `Delete "${rock.title}"?`, tone: "danger", confirmLabel: "Delete" }))) return;
    try {
      await rockApi.delete(team.id, rock.id);
      setRocks((prev) => prev.filter((r) => r.id !== rock.id));
      toast.success("Rock deleted.");
    } catch {
      toast.error("Failed to delete rock.");
    }
  }

  async function handleArchive(rock) {
    try {
      const updated = await rockApi.update(team.id, rock.id, { is_archived: true });
      setRocks((prev) => prev.map((r) => (r.id === rock.id ? updated : r)));
      toast.success("Rock archived.");
    } catch {
      toast.error("Failed to archive rock.");
    }
  }

  async function handleStatusChange(rock, newStatus) {
    try {
      const updated = await rockApi.update(team.id, rock.id, { status: newStatus });
      setRocks((prev) => prev.map((r) => (r.id === rock.id ? updated : r)));
    } catch {
      toast.error("Failed to update status.");
    }
  }

  async function handleMilestoneToggle(rock, milestoneId) {
    const updatedMilestones = rock.milestones.map((m) => ({
      id: m.id,
      title: m.title,
      status: m.id === milestoneId ? (m.status === "complete" ? "pending" : "complete") : m.status,
      due_date: m.due_date || null,
      owner_id: m.owner_id ?? m.owner?.id ?? null,
      sort_order: m.sort_order,
    }));
    try {
      const updated = await rockApi.update(team.id, rock.id, { milestones: updatedMilestones });
      setRocks((prev) => prev.map((r) => (r.id === rock.id ? updated : r)));
    } catch {
      toast.error("Failed to update milestone.");
    }
  }

  const ACTIVE_STATUSES = new Set(["on_track", "at_risk", "off_track", "complete", "canceled"]);
  const filtered = rocks.filter((r) => {
    if (activeTab === "archived") return r.is_archived;
    if (r.is_archived) return false;
    if (activeTab === "active")  return ACTIVE_STATUSES.has(r.status);
    if (activeTab === "backlog") return r.status === "backlog";
    if (activeTab === "planned") return r.status === "planned";
    return false;
  });

  return (
    <div>
      {/* Header */}
      <div className="mb-1 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Team</p>
        </div>
      </div>
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold text-slate-900">Rocks</h2>
          <button type="button" className="rounded-full p-1 text-slate-400 hover:bg-slate-100">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        {canManage && (
          <button type="button" onClick={() => { setEditing(null); setShowModal(true); }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            New Rock
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-5 flex items-center gap-1 border-b border-slate-200 pb-0">
        {TABS.map((tab) => (
          <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition mb-[-1px] ${
              activeTab === tab.id
                ? "bg-orange-500 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1,2,3].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <svg className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10.868 2.884c-.321-.772-1.415-.772-1.736 0l-1.83 4.401-4.753.381c-.833.067-1.171 1.107-.536 1.651l3.62 3.102-1.106 4.637c-.194.813.691 1.456 1.405 1.02L10 15.591l4.069 2.485c.713.436 1.598-.207 1.404-1.02l-1.106-4.637 3.62-3.102c.635-.544.297-1.584-.536-1.65l-4.752-.382-1.831-4.401z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-700">No {TABS.find((t) => t.id === activeTab)?.label} Rocks</p>
          <p className="mt-1 text-sm text-slate-400">
            {canManage ? "Click \"+ New Rock\" to add one." : "Nothing here yet."}
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="w-8 pl-4 pr-1 py-3" />
                <th className="py-3 pr-3 text-left w-36">Status</th>
                <th className="py-3 pr-3 text-left">Rock</th>
                <th className="py-3 pr-4 text-left w-40">Progress</th>
                <th className="py-3 pr-4 text-left w-32">Due Date</th>
                <th className="py-3 pr-3 w-12">
                  <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M7 8a3 3 0 100-6 3 3 0 000 6zM13.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                    <path d="M2.5 15.5A4.5 4.5 0 017 11h.25a4.5 4.5 0 014.5 4.5.5.5 0 01-.5.5H3a.5.5 0 01-.5-.5z" />
                  </svg>
                </th>
                <th className="py-3 pr-4 text-left w-20">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((rock) => (
                <RockRow key={rock.id} rock={rock} users={users} canManage={canManage}
                  onEdit={(r) => { setEditing(r); setShowModal(true); }}
                  onDelete={handleDelete}
                  onArchive={handleArchive}
                  onStatusChange={handleStatusChange}
                  onMilestoneToggle={handleMilestoneToggle}
                  onRockUpdated={(updated) => setRocks((prev) => prev.map((r) => (r.id === updated.id ? updated : r)))}
                  noteCount={noteCounts[rock.id] || 0}
                  onNotesPanelClose={() => noteApi.counts("rock", rocks.map((r) => r.id)).then(setNoteCounts).catch(() => {})} />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <RockModal
          team={team}
          users={users}
          objectives={objectives}
          teams={teams}
          projects={projects}
          currentUser={user}
          editing={editing}
          defaultStatus={TAB_STATUS_MAP[activeTab]}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
}
