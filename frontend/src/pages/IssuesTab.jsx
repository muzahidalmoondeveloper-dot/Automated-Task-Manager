import { useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
import toast from "react-hot-toast";
import LinkedItemsHoverIcon from "../components/LinkedItemsHoverIcon";
import EntityDetailPanel from "../components/EntityDetailPanel";
import IconPickerButton from "../components/IconPicker.jsx";
import { RockIconDisplay } from "../utils/rockIcons.jsx";
import { issueApi } from "../api/issueApi";
import { rockApi } from "../api/rockApi";
import { kpiApi } from "../api/kpiApi";
import { taskApi } from "../api/taskApi";
import { organizationApi } from "../api/organizationApi";
import { teamApi } from "../api/teamApi";
import { projectApi } from "../api/projectApi";
import { useAuth } from "../context/AuthContext";
import { useConfirm } from "../context/ConfirmContext";
import RichEditor from "../components/RichEditor";

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

function stripHtml(html) {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = DOMPurify.sanitize(html);
  return div.textContent || "";
}

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// ─── Priority config ──────────────────────────────────────────────────────────

const PRIORITY_COLORS = [
  "bg-indigo-500 text-white",
  "bg-slate-400 text-white",
  "bg-yellow-400 text-slate-900",
  "bg-orange-400 text-white",
  "bg-red-500 text-white",
  "bg-red-700 text-white",
];

const PRIORITY_LABELS = ["None", "Low", "Medium", "High", "Urgent", "Critical"];

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

// ─── Issue modal ──────────────────────────────────────────────────────────────

const TIMEFRAME_OPTIONS = [
  { value: "short-term", label: "Short-term" },
  { value: "long-term",  label: "Long-term"  },
  { value: "archived",   label: "Archived"   },
];

function IssueModal({ team, users, teams, projects, editing, onClose, onSave, saving }) {
  const [title, setTitle]       = useState(editing?.title || "");
  const [icon, setIcon]         = useState(editing?.icon || null);
  const [desc, setDesc]         = useState(editing?.description || "");
  const [assigneeId, setAssigneeId] = useState(
    editing?.assignee?.id ? String(editing.assignee.id) : ""
  );
  const [teamId, setTeamId] = useState(String(editing?.team_id || team?.id || ""));
  const [projectId, setProjectId] = useState(editing?.project_id ? String(editing.project_id) : "");
  const [timeframe, setTimeframe] = useState(editing?.timeframe || "short-term");
  const [priority, setPriority]   = useState(editing?.priority ?? 0);

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

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      icon,
      description: desc || null,
      assignee_id: assigneeId ? Number(assigneeId) : null,
      project_id: projectId ? Number(projectId) : null,
      timeframe,
      priority,
      team_id: Number(teamId) || team?.id,
      links: selectedLinks,
    });
  }

  const selectedAssignee = users.find((u) => String(u.id) === String(assigneeId));
  const selectedTeam = (teams || []).find((t) => String(t.id) === String(teamId));
  const selectedProject = (projects || []).find((p) => String(p.id) === String(projectId));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-6 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl my-8">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-bold text-slate-900">
            {editing ? "Edit Issue" : "Create Issue"}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-[1fr_260px] divide-x divide-slate-100">
            {/* Left — title + description */}
            <div className="flex flex-col gap-4 p-6">
              <div className="flex items-center gap-3">
                <IconPickerButton value={icon} onChange={setIcon} resetKey={editing?.id ?? "create"} size={20} />
                <input value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="Describe the issue" required autoFocus
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-base font-medium text-slate-900 placeholder:text-slate-300 outline-none focus:border-slate-400" />
              </div>
              <RichEditor
                content={desc}
                onChange={setDesc}
                placeholder="Add context or acceptance criteria for this issue."
              />
            </div>

            {/* Right — Settings */}
            <div className="space-y-5 p-5">
              <p className="text-sm font-semibold text-slate-800">Settings</p>

              {/* Teams */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Teams</label>
                <div className="relative">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
                    <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M7 8a3 3 0 100-6 3 3 0 000 6zM13.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM1.615 16.428a1.224 1.224 0 01-.569-1.175 6.002 6.002 0 0111.908 0c.058.467-.172.92-.57 1.174A9.953 9.953 0 017 17a9.953 9.953 0 01-5.385-1.572zM14.5 15.99a9.9 9.9 0 011.5.01v-.001a6.002 6.002 0 00-6.5-5.998 7.5 7.5 0 014.5 5.89 2.5 2.5 0 00.5.099z" />
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

              {/* Assignee */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Assignee</label>
                <div className="relative">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
                    {selectedAssignee ? (
                      <>
                        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${AVATAR_COLORS[selectedAssignee.id % AVATAR_COLORS.length]}`}>
                          {getInitials(selectedAssignee.full_name || selectedAssignee.email)}
                        </div>
                        <span className="flex-1 truncate text-sm text-slate-700">
                          {selectedAssignee.full_name || selectedAssignee.email}
                        </span>
                      </>
                    ) : (
                      <span className="flex-1 text-sm text-slate-400">Unassigned</span>
                    )}
                    <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}
                    className="absolute inset-0 w-full cursor-pointer opacity-0">
                    <option value="">Unassigned</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Timeframe */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Timeframe</label>
                <div className="relative">
                  <div className="flex items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5">
                    <span className="text-sm text-slate-700">
                      {TIMEFRAME_OPTIONS.find((o) => o.value === timeframe)?.label}
                    </span>
                    <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <select value={timeframe} onChange={(e) => setTimeframe(e.target.value)}
                    className="absolute inset-0 w-full cursor-pointer opacity-0">
                    {TIMEFRAME_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Priority */}
              <div>
                <label className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                  Priority
                  <svg className="h-3.5 w-3.5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
                  </svg>
                </label>
                <div className="flex gap-1.5">
                  {[0, 1, 2, 3, 4, 5].map((p) => (
                    <button key={p} type="button" onClick={() => setPriority(p)}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg text-sm font-semibold transition-all ${
                        priority === p
                          ? PRIORITY_COLORS[p]
                          : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                      }`}>
                      {p}
                    </button>
                  ))}
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
              className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60">
              {saving ? "Saving…" : editing ? "Save changes" : "Create Issue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Issue row ────────────────────────────────────────────────────────────────

function IssueRow({ issue, canManage, onEdit, onDelete, onArchive }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const preview = stripHtml(issue.description);
  const assignee = issue.assignee;

  return (
    <div className="group flex items-start gap-4 border-b border-slate-100 px-5 py-4 last:border-b-0 hover:bg-slate-50/60 transition-colors">
      {/* Priority badge */}
      <div className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold ${PRIORITY_COLORS[issue.priority] || PRIORITY_COLORS[0]}`}>
        {issue.priority}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1.5 text-sm font-semibold text-slate-900 leading-snug">
          {issue.icon && (
            <span className="shrink-0 text-slate-400">
              <RockIconDisplay iconStr={issue.icon} size={14} />
            </span>
          )}
          {issue.title}
          <LinkedItemsHoverIcon links={issue.links} />
        </p>
        {preview && (
          <p className="mt-0.5 line-clamp-2 text-xs text-slate-400">{preview}</p>
        )}
        <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
          <span>{fmtDate(issue.created_at)}</span>
          {issue.timeframe === "archived" && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500 font-medium">Archived</span>
          )}
        </div>
      </div>

      {/* Assignee */}
      {assignee ? (
        <div className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${AVATAR_COLORS[assignee.id % AVATAR_COLORS.length]}`}
          title={assignee.full_name || assignee.email}>
          {getInitials(assignee.full_name || assignee.email)}
        </div>
      ) : (
        <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 border-dashed border-slate-200" />
      )}

      {/* Actions */}
      <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
        <button type="button" onClick={() => setDetailOpen(true)} title="Notes & details"
          className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902 1.168.188 2.352.327 3.55.414.28.02.521.18.642.413l1.713 3.293a.75.75 0 001.33 0l1.713-3.293a.647.647 0 01.642-.413 41.102 41.102 0 003.55-.414c1.437-.231 2.43-1.49 2.43-2.902V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0010 2z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Manager actions */}
      {canManage && (
        <div className="flex shrink-0 items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5">
          {issue.timeframe !== "archived" && (
            <button type="button" onClick={() => onArchive(issue)} title="Archive"
              className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 3a1 1 0 00-1 1v1a1 1 0 001 1h16a1 1 0 001-1V4a1 1 0 00-1-1H2zM2 7.5h16l-1.673 9.535A1 1 0 0115.34 18H4.66a1 1 0 01-.987-.965L2 7.5z" />
              </svg>
            </button>
          )}
          <button type="button" onClick={() => onEdit(issue)} title="Edit"
            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
            </svg>
          </button>
          <button type="button" onClick={() => onDelete(issue)} title="Delete"
            className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      )}

      {detailOpen && (
        <EntityDetailPanel
          entityType="issue"
          entityId={issue.id}
          title={issue.title}
          statusLabel={issue.timeframe === "archived" ? "Archived" : issue.status ? issue.status.replace("_", " ") : "Open"}
          createdAt={issue.created_at}
          ownerUser={issue.assignee}
          ownerLabel="Assignee"
          description={preview}
          onClose={() => setDetailOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyState({ onCreate, canManage }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
        <svg className="h-7 w-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.25 6.087c0-.355.186-.676.401-.959.221-.29.349-.634.349-1.003 0-1.036-1.007-1.875-2.25-1.875s-2.25.84-2.25 1.875c0 .369.128.713.349 1.003.215.283.401.604.401.959v0a.64.64 0 01-.657.643 48.39 48.39 0 01-4.163-.3c.186 1.613.293 3.25.315 4.907a.656.656 0 01-.658.663v0c-.355 0-.676-.186-.959-.401a1.647 1.647 0 00-1.003-.349c-1.036 0-1.875 1.007-1.875 2.25s.84 2.25 1.875 2.25c.369 0 .713-.128 1.003-.349.283-.215.604-.401.959-.401v0c.31 0 .555.26.532.57a48.039 48.039 0 01-.642 5.056c1.518.19 3.058.309 4.616.354a.64.64 0 00.657-.643v0c0-.355-.186-.676-.401-.959a1.647 1.647 0 01-.349-1.003c0-1.035 1.008-1.875 2.25-1.875 1.243 0 2.25.84 2.25 1.875 0 .369-.128.713-.349 1.003-.215.283-.401.604-.401.959v0c0 .333.277.599.61.58a48.1 48.1 0 005.427-.63 48.05 48.05 0 00.582-4.717.532.532 0 00-.533-.57v0c-.355 0-.676.186-.959.401-.29.221-.634.349-1.003.349-1.035 0-1.875-1.007-1.875-2.25s.84-2.25 1.875-2.25c.37 0 .713.128 1.003.349.283.215.604.401.959.401v0a.656.656 0 00.658-.663 48.422 48.422 0 00-.37-5.36c-1.886.342-3.81.574-5.766.689a.578.578 0 01-.61-.58v0z" />
        </svg>
      </div>
      <p className="text-base font-semibold text-slate-800">No Issues Yet</p>
      <p className="mt-1 max-w-xs text-sm text-slate-400">
        Nothing to see here yet. Click the button below to create your first Issue.
      </p>
      {canManage && (
        <button type="button" onClick={onCreate}
          className="mt-6 rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
          Create
        </button>
      )}
    </div>
  );
}

// ─── IssuesTab ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "short-term", label: "Short term" },
  { id: "long-term",  label: "Long term"  },
  { id: "archived",   label: "Archived"   },
];

export default function IssuesTab({ team, canManage }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [issues, setIssues]     = useState([]);
  const [teams, setTeams]       = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab]           = useState("short-term");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing]   = useState(null);
  const [saving, setSaving]     = useState(false);

  const users = team?.members || [];

  useEffect(() => {
    if (!team?.id) return;
    load(tab);
  }, [team?.id, tab]);

  async function load(timeframe) {
    setLoading(true);
    try {
      const data = await issueApi.list(team.id, timeframe);
      setIssues(Array.isArray(data) ? data : []);
      try {
        const ts = await teamApi.list();
        if (Array.isArray(ts)) setTeams(ts);
      } catch { /* teams optional */ }
      try {
        const ps = await projectApi.list();
        if (Array.isArray(ps)) setProjects(ps);
      } catch { /* projects optional */ }
    } catch {
      toast.error("Failed to load issues.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(payload) {
    const { team_id: targetTeamId, ...issuePayload } = payload;
    const createTeamId = targetTeamId || team.id;
    setSaving(true);
    try {
      if (editing) {
        const updated = await issueApi.update(team.id, editing.id, payload);
        setIssues((prev) => {
          if (updated.team_id !== team.id) return prev.filter((i) => i.id !== editing.id);
          const inCurrentTab = updated.timeframe === tab;
          if (!inCurrentTab) return prev.filter((i) => i.id !== editing.id);
          return prev.map((i) => (i.id === editing.id ? updated : i));
        });
        toast.success("Issue updated.");
      } else {
        const created = await issueApi.create(createTeamId, issuePayload);
        if (created.team_id === team.id && created.timeframe === tab) {
          setIssues((prev) => [created, ...prev]);
        }
        toast.success("Issue created.");
      }
      setShowModal(false);
      setEditing(null);
    } catch {
      toast.error("Failed to save issue.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(issue) {
    if (!(await confirm({ message: `Delete "${issue.title}"?`, tone: "danger", confirmLabel: "Delete" }))) return;
    try {
      await issueApi.delete(team.id, issue.id);
      setIssues((prev) => prev.filter((i) => i.id !== issue.id));
      toast.success("Issue deleted.");
    } catch {
      toast.error("Failed to delete issue.");
    }
  }

  async function handleArchive(issue) {
    try {
      const updated = await issueApi.update(team.id, issue.id, { timeframe: "archived" });
      setIssues((prev) => prev.filter((i) => i.id !== issue.id));
      toast.success("Issue archived.");
    } catch {
      toast.error("Failed to archive issue.");
    }
  }

  function openCreate() { setEditing(null); setShowModal(true); }
  function openEdit(issue) { setEditing(issue); setShowModal(true); }

  return (
    <div>
      {/* Header */}
      <div className="mb-1 flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Team</p>
      </div>
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold text-slate-900">Issues</h2>
          <button type="button" className="rounded-full p-1 text-slate-400 hover:bg-slate-100">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        {canManage && (
          <button type="button" onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            New Issue
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-5 flex items-center gap-1">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setTab(t.id)}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              tab === t.id
                ? "bg-orange-500 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100" />
          ))}
        </div>
      ) : issues.length === 0 ? (
        <EmptyState onCreate={openCreate} canManage={canManage} />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          {issues.map((issue) => (
            <IssueRow
              key={issue.id}
              issue={issue}
              canManage={canManage}
              onEdit={openEdit}
              onDelete={handleDelete}
              onArchive={handleArchive}
            />
          ))}
        </div>
      )}

      {showModal && (
        <IssueModal
          team={team}
          users={users}
          teams={teams}
          projects={projects}
          editing={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </div>
  );
}
