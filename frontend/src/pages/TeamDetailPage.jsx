import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import DOMPurify from "dompurify";
import LinkedItemsHoverIcon from "../components/LinkedItemsHoverIcon";
import EntityDetailPanel from "../components/EntityDetailPanel";
import DatePicker from "../components/DatePicker";
import CelebrationOverlay from "../components/CelebrationOverlay";
import IconPickerButton from "../components/IconPicker.jsx";
import { RockIconDisplay } from "../utils/rockIcons.jsx";

import { teamApi } from "../api/teamApi";
import { taskApi } from "../api/taskApi";
import { teamNewsApi } from "../api/teamNewsApi";
import { userApi } from "../api/userApi";
import { organizationApi } from "../api/organizationApi";
import { rockApi } from "../api/rockApi";
import { kpiApi } from "../api/kpiApi";
import { useAuth } from "../context/AuthContext";
import { useConfirm } from "../context/ConfirmContext";
import RocksTab from "./RocksTab";
import KPIsTab from "./KPIsTab";
import IssuesTab from "./IssuesTab";
import MeetingsTab from "./MeetingsTab";
import TeamScoreboardTab from "./TeamScoreboardTab";
import RichEditor from "../components/RichEditor";

function stripHtml(html) {
  if (!html) return "";
  const div = document.createElement("div");
  div.innerHTML = DOMPurify.sanitize(html);
  return div.textContent || "";
}

// ─── News helpers ─────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-indigo-500", "bg-violet-500", "bg-emerald-500", "bg-sky-500",
  "bg-amber-500", "bg-rose-500", "bg-teal-500", "bg-fuchsia-500",
];

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function formatRelative(dateStr) {
  if (!dateStr) return "";
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── News links (Objective / Rock / To-Do / KPI) ───────────────────────────────

function LinkTypeIcon({ type, className = "h-3.5 w-3.5" }) {
  if (type === "objective") {
    return (
      <svg className={className} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11zm0-2.5a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
      </svg>
    );
  }
  if (type === "rock") {
    return (
      <svg className={className} viewBox="0 0 20 20" fill="currentColor">
        <path d="M10 2L3 7l2.5 11h9L17 7l-7-5z" />
      </svg>
    );
  }
  if (type === "kpi") {
    return (
      <svg className={className} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M3 13a1 1 0 011-1h1a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4zM8 9a1 1 0 011-1h1a1 1 0 011 1v8a1 1 0 01-1 1H9a1 1 0 01-1-1V9zM14 5a1 1 0 011-1h1a1 1 0 011 1v12a1 1 0 01-1 1h-1a1 1 0 01-1-1V5z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
    </svg>
  );
}

const LINK_TYPE_LABELS = {
  objective: "Objective",
  rock: "Rock",
  task: "To-Do",
  kpi: "KPI",
};

function linkKey(link) {
  return `${link.linked_type}:${link.linked_id}`;
}

function NewsModal({ team, teams, users, currentUser, editing, onClose, onSave, saving }) {
  const [title, setTitle] = useState(editing?.title || "");
  const [icon, setIcon] = useState(editing?.icon || null);
  const [body, setBody] = useState(editing?.body || "");
  const [status, setStatus] = useState(editing?.status || "active");
  const [ownerId, setOwnerId] = useState(
    editing ? String(editing.owner_id || "") : String(currentUser?.id || "")
  );
  const [teamId, setTeamId] = useState(String(editing?.team_id || team?.id || ""));

  const [selectedLinks, setSelectedLinks] = useState(
    (editing?.links || []).map((l) => ({ linked_type: l.linked_type, linked_id: l.linked_id, title: l.title }))
  );
  const [linksOpen, setLinksOpen] = useState(false);
  const [linkSearch, setLinkSearch] = useState("");
  const [linkableItems, setLinkableItems] = useState({ objective: [], rock: [], task: [], kpi: [] });
  const [linkableLoading, setLinkableLoading] = useState(false);
  const linksRef = useRef(null);
  const linksLoadedForTeam = useRef(null);

  // Close the links dropdown on outside click.
  useEffect(() => {
    if (!linksOpen) return;
    function handleOutside(e) {
      if (linksRef.current && !linksRef.current.contains(e.target)) setLinksOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [linksOpen]);

  // (Re)load linkable items whenever the selected team changes — Rock/To-Do/KPI
  // are team-scoped, so switching teams invalidates those (Objectives are org-wide).
  useEffect(() => {
    if (!teamId) return;
    if (linksLoadedForTeam.current === teamId) return;
    linksLoadedForTeam.current = teamId;

    // Selected rock/task/kpi links no longer apply once the team changes.
    setSelectedLinks((prev) => prev.filter((l) => l.linked_type === "objective"));

    setLinkableLoading(true);
    Promise.all([
      organizationApi.listObjectives().catch(() => []),
      rockApi.list(teamId).catch(() => []),
      taskApi.listByTeam(teamId).catch(() => []),
      kpiApi.list(teamId).catch(() => []),
    ])
      .then(([objectives, rocks, tasks, kpis]) => {
        setLinkableItems({
          objective: (objectives || []).map((o) => ({ id: o.id, title: o.title })),
          rock: (rocks || []).map((r) => ({ id: r.id, title: r.title })),
          task: (tasks || []).map((t) => ({ id: t.id, title: t.name })),
          kpi: (kpis || []).map((k) => ({ id: k.id, title: k.title })),
        });
      })
      .finally(() => setLinkableLoading(false));
  }, [teamId]);

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
      body: body || "",
      status,
      owner_id: ownerId ? Number(ownerId) : null,
      team_id: Number(teamId),
      links: selectedLinks,
    });
  }

  const selectedOwner = users.find((u) => String(u.id) === String(ownerId));
  const selectedTeam = (teams || []).find((t) => String(t.id) === String(teamId)) || team;

  const linkSearchLower = linkSearch.trim().toLowerCase();
  const visibleGroups = ["objective", "rock", "task", "kpi"]
    .map((type) => ({
      type,
      items: (linkableItems[type] || []).filter((item) =>
        !linkSearchLower || item.title.toLowerCase().includes(linkSearchLower)
      ),
    }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-8 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-bold text-slate-900">
            {editing ? "Edit News" : "Create News"}
          </h2>
          <button type="button" onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid min-h-[300px] grid-cols-[1fr_260px] divide-x divide-slate-100">
            {/* Left: title + rich text body */}
            <div className="flex flex-col gap-4 p-5">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-4">
                <IconPickerButton value={icon} onChange={setIcon} resetKey={editing?.id ?? "create"} size={20} />
                <input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="What happened?"
                  required
                  autoFocus
                  className="flex-1 border-none text-base font-medium text-slate-900 placeholder:text-slate-300 outline-none"
                />
              </div>
              <RichEditor
                content={body}
                onChange={setBody}
                placeholder="Share context, decisions, and next steps."
                minHeight={200}
              />
            </div>

            {/* Right: Settings */}
            <div className="space-y-4 p-5">
              <p className="text-sm font-semibold text-slate-800">Settings</p>

              {/* Team */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Teams</label>
                <div className="relative">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
                    <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M7 8a3 3 0 100-6 3 3 0 000 6zM13.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
                      <path d="M2.5 15.5A4.5 4.5 0 017 11h.25a4.5 4.5 0 014.5 4.5.5.5 0 01-.5.5H3a.5.5 0 01-.5-.5z" />
                    </svg>
                    <span className="truncate text-sm text-slate-700">{selectedTeam?.name || "—"}</span>
                    <svg className="ml-auto h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <select value={teamId} onChange={(e) => setTeamId(e.target.value)}
                    className="absolute inset-0 w-full cursor-pointer opacity-0">
                    {!teams?.some((t) => String(t.id) === teamId) && team && (
                      <option value={team.id}>{team.name}</option>
                    )}
                    {(teams || []).map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
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
                    ) : (
                      <span className="text-sm text-slate-400">Unassigned</span>
                    )}
                    <svg className="ml-auto h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <select value={ownerId} onChange={(e) => setOwnerId(e.target.value)}
                    className="absolute inset-0 w-full cursor-pointer opacity-0">
                    <option value="">Unassigned</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                  </select>
                </div>
              </div>

              {/* Status (only when editing) */}
              {editing && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-500">Status</label>
                  <div className="relative">
                    <select value={status} onChange={(e) => setStatus(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none">
                      <option value="active">Active</option>
                      <option value="archived">Archived</option>
                    </select>
                    <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}

              {/* Links */}
              <div ref={linksRef} className="relative">
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Links</label>
                <button
                  type="button"
                  onClick={() => setLinksOpen((v) => !v)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-left hover:bg-slate-50"
                >
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
                      <span key={linkKey(link)}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                        <LinkTypeIcon type={link.linked_type} className="h-3 w-3 text-slate-400" />
                        <span className="max-w-[120px] truncate">{link.title}</span>
                        <button type="button" onClick={() => toggleLink(link.linked_type, { id: link.linked_id, title: link.title })}
                          className="ml-0.5 text-slate-400 hover:text-slate-700">
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {linksOpen && (
                  <div className="absolute left-0 right-0 z-10 mt-1.5 max-h-72 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                    <div className="sticky top-0 border-b border-slate-100 bg-white p-2">
                      <input
                        autoFocus
                        value={linkSearch}
                        onChange={(e) => setLinkSearch(e.target.value)}
                        placeholder="Search linkable items..."
                        className="w-full rounded-lg border border-slate-200 px-2.5 py-1.5 text-sm outline-none focus:border-slate-400"
                      />
                    </div>

                    {linkableLoading ? (
                      <p className="px-3 py-4 text-center text-xs text-slate-400">Loading...</p>
                    ) : visibleGroups.length === 0 ? (
                      <p className="px-3 py-4 text-center text-xs text-slate-400">No matching items.</p>
                    ) : (
                      visibleGroups.map((group) => (
                        <div key={group.type} className="py-1.5">
                          <p className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                            {LINK_TYPE_LABELS[group.type]}
                          </p>
                          {group.items.map((item) => {
                            const isSelected = selectedLinks.some(
                              (l) => l.linked_type === group.type && l.linked_id === item.id
                            );
                            return (
                              <button
                                key={item.id}
                                type="button"
                                onClick={() => toggleLink(group.type, item)}
                                className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-slate-50 ${
                                  isSelected ? "bg-slate-50 font-medium text-slate-900" : "text-slate-700"
                                }`}
                              >
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
                      ))
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
              {saving ? "Saving…" : editing ? "Save Changes" : "Create News"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function NewsViewModal({ item, canManage, onClose, onEdit }) {
  const owner = item.owner;
  const cleanHtml = DOMPurify.sanitize(item.body || "");

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-8 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-5">
          <div className="min-w-0 pr-4">
            <h2 className="text-lg font-bold text-slate-900">{item.title}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-400">
              {owner && (
                <span>{owner.full_name || owner.email}</span>
              )}
              <span>{formatRelative(item.created_at)}</span>
              {item.status === "archived" && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  Archived
                </span>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {canManage && (
              <button type="button" onClick={onEdit}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50">
                Edit
              </button>
            )}
            <button type="button" onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Rendered body */}
        <div className="px-6 py-6">
          {cleanHtml ? (
            <div
              className="rich-text text-sm text-slate-700"
              dangerouslySetInnerHTML={{ __html: cleanHtml }}
            />
          ) : (
            <p className="text-sm italic text-slate-400">No content added yet.</p>
          )}
        </div>

        {/* Linked items */}
        {item.links && item.links.length > 0 && (
          <div className="border-t border-slate-100 px-6 pb-6 pt-4">
            <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Links
            </p>
            <div className="flex flex-wrap gap-2">
              {item.links.map((link) => (
                <span
                  key={`${link.linked_type}:${link.linked_id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  <LinkTypeIcon type={link.linked_type} className="h-3 w-3 shrink-0 text-slate-400" />
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                    {LINK_TYPE_LABELS[link.linked_type]}
                  </span>
                  <span className="max-w-[200px] truncate">{link.title}</span>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NewsTab({ team, canManage }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [news, setNews] = useState([]);
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("active");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [viewItem, setViewItem] = useState(null);
  const [detailItem, setDetailItem] = useState(null);

  useEffect(() => {
    if (!team?.id) return;
    load();
  }, [team?.id]);

  useEffect(() => {
    if (!openMenuId) return;
    function handle() { setOpenMenuId(null); }
    document.addEventListener("click", handle);
    return () => document.removeEventListener("click", handle);
  }, [openMenuId]);

  async function load() {
    try {
      setLoading(true);
      const [n, u, t] = await Promise.all([
        teamNewsApi.list(team.id),
        userApi.list().catch(() => []),
        teamApi.list().catch(() => []),
      ]);
      setNews(Array.isArray(n) ? n : []);
      setUsers(Array.isArray(u) ? u : []);
      setTeams(Array.isArray(t) ? t : []);
    } catch {
      toast.error("Failed to load news.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(payload) {
    setSaving(true);
    try {
      const { team_id: targetTeamId, ...rest } = payload;
      const movedAway = targetTeamId !== team.id;
      if (editing) {
        const updated = await teamNewsApi.update(team.id, editing.id, { ...rest, team_id: targetTeamId });
        setNews((prev) =>
          movedAway
            ? prev.filter((n) => n.id !== editing.id)
            : prev.map((n) => (n.id === editing.id ? updated : n))
        );
        toast.success(movedAway ? "News updated and moved to another team." : "News updated.");
      } else {
        const created = await teamNewsApi.create(targetTeamId || team.id, rest);
        setNews((prev) => (movedAway ? prev : [created, ...prev]));
        toast.success(movedAway ? "News created under the selected team." : "News created.");
      }
      setShowModal(false);
      setEditing(null);
    } catch (err) {
      toast.error(err.message || "Failed to save news.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(item) {
    if (!(await confirm({ message: `Delete "${item.title}"?`, tone: "danger", confirmLabel: "Delete" }))) return;
    try {
      await teamNewsApi.delete(team.id, item.id);
      setNews((prev) => prev.filter((n) => n.id !== item.id));
      toast.success("News deleted.");
    } catch {
      toast.error("Failed to delete news.");
    }
  }

  const filtered = news.filter((n) =>
    filter === "archived" ? n.status === "archived" : n.status !== "archived"
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-slate-900">News</h2>
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
            New News
          </button>
        )}
      </div>

      {/* Active / Archived filter */}
      <div className="mb-4 flex items-center gap-1">
        {[{ id: "active", label: "Active" }, { id: "archived", label: "Archived" }].map((f) => (
          <button key={f.id} type="button" onClick={() => setFilter(f.id)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
              filter === f.id ? "bg-orange-500 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <svg className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clipRule="evenodd" />
              <path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V7z" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-700">
            {filter === "archived" ? "No archived news" : "No News Yet"}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            Nothing to see here yet.{canManage && filter === "active" ? " Click the button below to create your first News." : ""}
          </p>
          {canManage && filter === "active" && (
            <button type="button" onClick={() => { setEditing(null); setShowModal(true); }}
              className="mt-5 rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
              Create
            </button>
          )}
        </div>
      ) : (
        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          {filtered.map((item) => {
            const owner = item.owner;
            return (
              <div key={item.id}
                className="group flex cursor-pointer items-center gap-3 px-4 py-3.5 hover:bg-slate-50 first:rounded-t-2xl last:rounded-b-2xl"
                onClick={() => setViewItem(item)}>
                {/* Icon */}
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
                  {item.icon ? (
                    <RockIconDisplay iconStr={item.icon} size={16} />
                  ) : (
                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clipRule="evenodd" />
                      <path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V7z" />
                    </svg>
                  )}
                </div>
                {/* Title + plain-text preview */}
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1.5 truncate text-sm font-medium text-slate-900">
                    <span className="truncate">{item.title}</span>
                    <LinkedItemsHoverIcon links={item.links} />
                  </p>
                  {item.body && (
                    <p className="truncate text-xs text-slate-400">{stripHtml(item.body)}</p>
                  )}
                </div>
                {/* Owner avatar */}
                {owner && (
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${AVATAR_COLORS[owner.id % AVATAR_COLORS.length]}`}
                    title={owner.full_name || owner.email}>
                    {getInitials(owner.full_name || owner.email)}
                  </div>
                )}
                {/* Relative time */}
                <span className="shrink-0 text-xs text-slate-400">{formatRelative(item.created_at)}</span>
                {/* Notes & details */}
                <button type="button"
                  onClick={(e) => { e.stopPropagation(); setDetailItem(item); }}
                  title="Notes & details"
                  className="rounded-lg p-1 text-slate-400 opacity-0 transition-opacity hover:bg-slate-100 hover:text-slate-600 group-hover:opacity-100">
                  <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902 1.168.188 2.352.327 3.55.414.28.02.521.18.642.413l1.713 3.293a.75.75 0 001.33 0l1.713-3.293a.647.647 0 01.642-.413 41.102 41.102 0 003.55-.414c1.437-.231 2.43-1.49 2.43-2.902V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0010 2z" clipRule="evenodd" />
                  </svg>
                </button>
                {/* Three-dots */}
                {canManage && (
                  <div className="relative opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={(e) => e.stopPropagation()}>
                    <button type="button"
                      onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === item.id ? null : item.id); }}
                      className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
                      </svg>
                    </button>
                    {openMenuId === item.id && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                        <div className="absolute right-0 top-8 z-20 w-36 rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                          <button type="button"
                            onClick={() => { setOpenMenuId(null); setEditing(item); setShowModal(true); }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                            <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                            </svg>
                            Edit
                          </button>
                          <button type="button"
                            onClick={() => { setOpenMenuId(null); handleDelete(item); }}
                            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                            <svg className="h-4 w-4 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4z" clipRule="evenodd" />
                            </svg>
                            Delete
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {viewItem && (
        <NewsViewModal
          item={viewItem}
          canManage={canManage}
          onClose={() => setViewItem(null)}
          onEdit={() => { setEditing(viewItem); setViewItem(null); setShowModal(true); }}
        />
      )}

      {showModal && (
        <NewsModal
          team={team}
          teams={teams}
          users={users}
          currentUser={user}
          editing={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {detailItem && (
        <EntityDetailPanel
          entityType="news"
          entityId={detailItem.id}
          title={detailItem.title}
          statusLabel={detailItem.status === "archived" ? "Archived" : "Active"}
          createdAt={detailItem.created_at}
          ownerUser={detailItem.owner}
          description={stripHtml(detailItem.body)}
          onClose={() => setDetailItem(null)}
        />
      )}
    </div>
  );
}

const STATUS_OPTIONS = [
  { value: "todo", label: "Todo" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

function formatDate(dateString) {
  if (!dateString) return "";
  return new Date(`${dateString}T00:00:00`).toLocaleDateString();
}

function getStatusLabel(status) {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label || status;
}

function getMonthMatrix(year, monthIndex) {
  const firstDay = new Date(year, monthIndex, 1);
  const firstCalendarDay = new Date(firstDay);
  firstCalendarDay.setDate(firstCalendarDay.getDate() - firstDay.getDay());

  const days = [];

  for (let i = 0; i < 42; i += 1) {
    const current = new Date(firstCalendarDay);
    current.setDate(firstCalendarDay.getDate() + i);
    days.push(current);
  }

  return days;
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getStatusBadgeClass(status) {
  if (status === "done") {
    return "inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700";
  }

  if (status === "in_progress") {
    return "inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700";
  }

  return "inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700";
}

const TEAM_PAGE_TABS = [
  { id: "news",       label: "News"       },
  { id: "rocks",      label: "Rocks"      },
  { id: "kpis",       label: "KPIs"       },
  { id: "todos",      label: "To-Dos"     },
  { id: "issues",     label: "Issues"     },
  { id: "meetings",   label: "Meetings"   },
  { id: "scoreboard", label: "Scoreboard" },
];

function CreateTodoModal({ team, users, editing, onClose, onSave, saving }) {
  const [name, setName] = useState(editing?.name || "");
  const [icon, setIcon] = useState(editing?.icon || null);
  const [assigneeId, setAssigneeId] = useState(
    editing?.assignee_id ? String(editing.assignee_id) : editing?.assignee?.id ? String(editing.assignee.id) : ""
  );
  const [startDate, setStartDate] = useState(editing?.start_date ? editing.start_date.slice(0, 10) : "");
  const [dueDate, setDueDate] = useState(editing?.due_date ? editing.due_date.slice(0, 10) : "");
  const [taskStatus, setTaskStatus] = useState(editing?.status || "todo");
  const [priority, setPriority] = useState(editing?.priority || "medium");

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({
      name: name.trim(),
      icon,
      assignee_id: assigneeId ? Number(assigneeId) : null,
      start_date: startDate || null,
      due_date: dueDate || null,
      status: taskStatus,
      priority,
      team_id: team.id,
    });
  }

  const selectedAssignee = users.find((u) => String(u.id) === String(assigneeId));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-8 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-bold text-slate-900">{editing ? "Edit To-Do" : "Create To-Do"}</h2>
          <button type="button" onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 p-6">
            {/* Task Name */}
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-500">Task Name *</label>
              <div className="flex items-center gap-2">
                <IconPickerButton value={icon} onChange={setIcon} resetKey={editing?.id ?? "create"} size={20} />
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter task name"
                  required
                  autoFocus
                  className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
                />
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
                      <span className="truncate text-sm text-slate-700">{selectedAssignee.full_name || selectedAssignee.email}</span>
                    </>
                  ) : (
                    <span className="text-sm text-slate-400">Unassigned</span>
                  )}
                  <svg className="ml-auto h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                  </svg>
                </div>
                <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}
                  className="absolute inset-0 w-full cursor-pointer opacity-0">
                  <option value="">Unassigned</option>
                  {users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                </select>
              </div>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Start Date</label>
                <DatePicker value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Due Date</label>
                <DatePicker value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
              </div>
            </div>

            {/* Status + Priority */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Status</label>
                <div className="relative">
                  <select value={taskStatus} onChange={(e) => setTaskStatus(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-400 focus:outline-none">
                    <option value="todo">Todo</option>
                    <option value="in_progress">In Progress</option>
                    <option value="done">Done</option>
                  </select>
                  <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Priority</label>
                <div className="relative">
                  <select value={priority} onChange={(e) => setPriority(e.target.value)}
                    className="w-full appearance-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 focus:border-slate-400 focus:outline-none">
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                  </select>
                  <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
            <button type="button" onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={saving || !name.trim()}
              className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60">
              {saving ? "Saving…" : editing ? "Save Changes" : "Create To-Do"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function PlaceholderTab({ title, description, emoji }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
      <span className="mb-3 text-4xl">{emoji}</span>
      <p className="text-sm font-semibold text-slate-700">{title}</p>
      <p className="mt-1 text-sm text-slate-400">{description}</p>
    </div>
  );
}

export default function TeamDetailPage() {
  const { teamId } = useParams();
  const { user } = useAuth();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = searchParams.get("tab") || "news";
  const [team, setTeam] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [calendarDate, setCalendarDate] = useState(new Date());

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [showTodoModal, setShowTodoModal] = useState(false);
  const [todoSaving, setTodoSaving] = useState(false);
  const [todoUsers, setTodoUsers] = useState([]);
  const [editingTodo, setEditingTodo] = useState(null);
  const [celebrationData, setCelebrationData] = useState(null);

  const canManageTasks = user?.role === "owner" || user?.role === "admin" || user?.role === "team_manager";

  const members = useMemo(() => {
    return team?.members || [];
  }, [team]);

  const todoTasks = useMemo(() => {
    return tasks.filter((task) => task.status === "todo");
  }, [tasks]);

  const inProgressTasks = useMemo(() => {
    return tasks.filter((task) => task.status === "in_progress");
  }, [tasks]);

  const doneTasks = useMemo(() => {
    return tasks.filter((task) => task.status === "done");
  }, [tasks]);

  const tasksByDueDate = useMemo(() => {
    return tasks.reduce((acc, task) => {
      if (!task.due_date) return acc;

      if (!acc[task.due_date]) {
        acc[task.due_date] = [];
      }

      acc[task.due_date].push(task);

      return acc;
    }, {});
  }, [tasks]);

  const calendarDays = useMemo(() => {
    return getMonthMatrix(calendarDate.getFullYear(), calendarDate.getMonth());
  }, [calendarDate]);

  async function loadData() {
    if (!teamId) {
      toast.error("Team ID is missing from the URL.");
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError("");

      const [teamData, taskData] = await Promise.all([
        teamApi.getById(teamId),
        taskApi.listByTeam(teamId),
      ]);

      setTeam(teamData);
      setTasks(taskData);
    } catch (err) {
      setError(err.message || "Unable to load team.");
      toast.error(err.message || "Unable to load team.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [teamId]);

  async function openTodoModal(task = null) {
    if (todoUsers.length === 0) {
      try {
        const u = await userApi.list();
        setTodoUsers(Array.isArray(u) ? u : []);
      } catch {
        setTodoUsers([]);
      }
    }
    setEditingTodo(task);
    setShowTodoModal(true);
  }

  async function handleSaveTodo(payload) {
    setTodoSaving(true);
    try {
      if (editingTodo) {
        const updated = await taskApi.update(editingTodo.id, payload);
        setTasks((prev) => prev.map((t) => (t.id === editingTodo.id ? updated : t)));
        toast.success("To-Do updated.");
      } else {
        const created = await taskApi.create(payload);
        setTasks((prev) => [created, ...prev]);
        toast.success("To-Do created.");
      }
      setShowTodoModal(false);
      setEditingTodo(null);
    } catch (err) {
      toast.error(err.message || `Failed to ${editingTodo ? "update" : "create"} to-do.`);
    } finally {
      setTodoSaving(false);
    }
  }

  async function handleDeleteTodo(task) {
    if (!(await confirm({ message: `Delete "${task.name}"? This cannot be undone.`, tone: "danger", confirmLabel: "Delete" }))) return;
    try {
      await taskApi.delete(task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
      toast.success("To-Do deleted.");
    } catch (err) {
      toast.error(err.message || "Failed to delete to-do.");
    }
  }

  async function quickStatusUpdate(task, status) {
    try {
      setError("");

      const updatedTask = await taskApi.updateStatus(task.id, status);

      setTasks((current) =>
        current.map((item) => (item.id === task.id ? updatedTask : item))
      );

      if (updatedTask.status === "done") {
        const isSelf = task.assignee_id === user?.id;
        setCelebrationData({ taskName: updatedTask.name, completedByName: isSelf ? null : (task.assignee?.full_name || null) });
      } else {
        toast.success("Task status updated.");
      }
    } catch (err) {
      toast.error(err.message || "Unable to update task status.");
    }
  }

  function goToPreviousMonth() {
    setCalendarDate(
      new Date(calendarDate.getFullYear(), calendarDate.getMonth() - 1, 1)
    );
  }

  function goToNextMonth() {
    setCalendarDate(
      new Date(calendarDate.getFullYear(), calendarDate.getMonth() + 1, 1)
    );
  }

  function goToToday() {
    setCalendarDate(new Date());
  }

  if (isLoading) {
    return (
      <div className="rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-sm">
        Loading team...
      </div>
    );
  }

  if (error && !team) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!team) {
    return (
      <div className="rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-sm">
        Team not found.
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">{team.name}</h1>

        <p className="mt-2 text-sm text-slate-600">
          {team.description || "No description added."}
        </p>

        <p className="mt-2 text-sm text-slate-500">
          Manager:{" "}
          <span className="font-medium text-slate-700">
            {team.team_manager?.full_name || "No manager"}
          </span>
        </p>
      </div>

      <div className="mb-8 border-b border-slate-200">
        <nav className="flex gap-1">
          {TEAM_PAGE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setSearchParams({ tab: tab.id })}
              className={
                activeTab === tab.id
                  ? "whitespace-nowrap border-b-2 border-slate-900 px-4 py-3 text-sm font-semibold text-slate-900"
                  : "whitespace-nowrap px-4 py-3 text-sm font-semibold text-slate-500 hover:text-slate-900"
              }
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {activeTab === "news" && (
        <NewsTab team={team} canManage={canManageTasks} />
      )}

      {activeTab === "rocks" && (
        <RocksTab team={team} canManage={canManageTasks} />
      )}

      {activeTab === "kpis" && (
        <KPIsTab team={team} canManage={canManageTasks} />
      )}

      {activeTab === "todos" ? (
        <section className="overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
            <h2 className="text-base font-bold text-slate-900">To-Dos</h2>
            {canManageTasks && (
              <button type="button" onClick={() => openTodoModal()}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                </svg>
                New To-Do
              </button>
            )}
          </div>
          <div className="overflow-x-auto xl:overflow-visible">
            <table className="w-full min-w-[1000px] text-sm xl:min-w-0">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="w-12 px-4 py-3 text-left font-semibold text-slate-700" />

                  <th className="min-w-72 px-4 py-3 text-left font-semibold text-slate-700">
                    Task Name
                  </th>

                  <th className="min-w-44 px-4 py-3 text-left font-semibold text-slate-700">
                    Project
                  </th>

                  <th className="min-w-44 px-4 py-3 text-left font-semibold text-slate-700">
                    Assignee
                  </th>

                  <th className="min-w-32 px-4 py-3 text-left font-semibold text-slate-700">
                    Start Date
                  </th>

                  <th className="min-w-32 px-4 py-3 text-left font-semibold text-slate-700">
                    Due Date
                  </th>

                  <th className="min-w-40 px-4 py-3 text-left font-semibold text-slate-700">
                    Status
                  </th>

                  {canManageTasks && (
                    <th className="w-24 px-4 py-3 text-left font-semibold text-slate-700">
                      Actions
                    </th>
                  )}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {tasks.length ? (
                  tasks.map((task) => (
                    <tr key={task.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-4 align-middle">
                        <button
                          type="button"
                          onClick={() =>
                            quickStatusUpdate(
                              task,
                              task.status === "done" ? "todo" : "done"
                            )
                          }
                          className={
                            task.status === "done"
                              ? "flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs text-white"
                              : "flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-slate-400 text-xs text-slate-400 hover:border-slate-900 hover:text-slate-900"
                          }
                          title={
                            task.status === "done"
                              ? "Mark as Todo"
                              : "Mark as Done"
                          }
                        >
                          ✓
                        </button>
                      </td>

                      <td className="px-4 py-4 align-middle">
                        <span className="inline-flex items-center gap-1.5">
                          {task.icon && (
                            <span className="shrink-0 text-slate-400">
                              <RockIconDisplay iconStr={task.icon} size={14} />
                            </span>
                          )}
                          <span
                            className={
                              task.status === "done"
                                ? "font-medium text-slate-500 line-through"
                                : "font-medium text-slate-900"
                            }
                          >
                            {task.name}
                          </span>
                        </span>
                      </td>

                      <td className="px-4 py-4 align-middle text-slate-700">
                        {task.project?.name || "—"}
                      </td>

                      <td className="px-4 py-4 align-middle text-slate-700">
                        {task.assignee?.full_name || "—"}
                      </td>

                      <td className="px-4 py-4 align-middle text-slate-700">
                        {formatDate(task.start_date) || "—"}
                      </td>

                      <td className="px-4 py-4 align-middle text-slate-700">
                        {formatDate(task.due_date) || "—"}
                      </td>

                      <td className="px-4 py-4 align-middle">
                        {canManageTasks ? (
                          <select
                            value={task.status}
                            onChange={(event) =>
                              quickStatusUpdate(task, event.target.value)
                            }
                            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-900 focus:outline-none"
                          >
                            {STATUS_OPTIONS.map((status) => (
                              <option key={status.value} value={status.value}>
                                {status.label}
                              </option>
                            ))}
                          </select>
                        ) : (
                          <span className={getStatusBadgeClass(task.status)}>
                            {getStatusLabel(task.status)}
                          </span>
                        )}
                      </td>

                      {canManageTasks && (
                        <td className="px-4 py-4 align-middle">
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openTodoModal(task)}
                              title="Edit"
                              className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                            >
                              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                              </svg>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTodo(task)}
                              title="Delete"
                              className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                            >
                              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={canManageTasks ? 8 : 7} className="px-4 py-16 text-center">
                      <div className="flex flex-col items-center">
                        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                          <svg className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
                          </svg>
                        </div>
                        <p className="text-sm font-semibold text-slate-700">No To-Dos Yet</p>
                        <p className="mt-1 text-sm text-slate-400">Nothing to see here yet.{canManageTasks ? " Click the button above to create your first to-do." : ""}</p>
                        {canManageTasks && (
                          <button type="button" onClick={() => openTodoModal()}
                            className="mt-4 rounded-xl border border-slate-200 bg-white px-5 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
                            Create
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {showTodoModal && (
        <CreateTodoModal
          team={team}
          users={todoUsers}
          editing={editingTodo}
          onClose={() => { setShowTodoModal(false); setEditingTodo(null); }}
          onSave={handleSaveTodo}
          saving={todoSaving}
        />
      )}

      {activeTab === "issues" && (
        <IssuesTab team={team} canManage={canManageTasks} />
      )}

      {activeTab === "meetings" && (
        <MeetingsTab team={team} canManage={canManageTasks} />
      )}

      {activeTab === "scoreboard" && (
        <TeamScoreboardTab team={team} />
      )}

      {celebrationData && (
        <CelebrationOverlay
          taskName={celebrationData.taskName}
          completedByName={celebrationData.completedByName}
          onDismiss={() => setCelebrationData(null)}
        />
      )}
    </div>
  );
}