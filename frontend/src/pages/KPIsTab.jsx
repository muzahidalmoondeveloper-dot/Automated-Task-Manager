import { useEffect, useRef, useState } from "react";
import DOMPurify from "dompurify";
import RichEditor from "../components/RichEditor";
import toast from "react-hot-toast";
import { kpiApi } from "../api/kpiApi";
import { rockApi } from "../api/rockApi";
import { taskApi } from "../api/taskApi";
import { organizationApi } from "../api/organizationApi";
import { teamApi } from "../api/teamApi";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";

// ─── Avatar helpers ────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "bg-indigo-500","bg-violet-500","bg-emerald-500","bg-sky-500",
  "bg-amber-500","bg-rose-500","bg-teal-500","bg-fuchsia-500",
];
function getInitials(name) {
  if (!name) return "?";
  const p = name.trim().split(/\s+/);
  return p.length === 1 ? p[0][0].toUpperCase() : (p[0][0] + p[p.length - 1][0]).toUpperCase();
}

function timeAgo(iso) {
  const utc = iso && !iso.endsWith("Z") && !iso.includes("+") ? iso + "Z" : iso;
  const diff = (Date.now() - new Date(utc).getTime()) / 1000;
  if (diff < 60) return `${Math.floor(diff)} SECONDS AGO`;
  if (diff < 3600) return `${Math.floor(diff / 60)} MINUTES AGO`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} HOURS AGO`;
  return `${Math.floor(diff / 86400)} DAYS AGO`;
}

// ─── Period helpers ────────────────────────────────────────────────────────────

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function getMonday(d) {
  const dt = new Date(d);
  const day = dt.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  dt.setDate(dt.getDate() + diff);
  dt.setHours(0, 0, 0, 0);
  return dt;
}

function fmtWeekRange(start) {
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  const opts = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString("en-US", opts).toUpperCase()} - ${end.toLocaleDateString("en-US", opts).toUpperCase()}`;
}

function generatePeriods(view, count = 13) {
  const today = new Date();
  const periods = [];

  if (view === "weekly") {
    let start = getMonday(today);
    for (let i = 0; i < count; i++) {
      periods.push({ key: isoDate(start), label: fmtWeekRange(start) });
      start = new Date(start);
      start.setDate(start.getDate() - 7);
    }
  } else if (view === "monthly") {
    for (let i = 0; i < count; i++) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const label = d.toLocaleDateString("en-US", { month: "short", year: "numeric" }).toUpperCase();
      periods.push({ key: isoDate(d), label });
    }
  } else if (view === "quarterly") {
    let q = Math.floor(today.getMonth() / 3);
    let y = today.getFullYear();
    for (let i = 0; i < count; i++) {
      periods.push({ key: isoDate(new Date(y, q * 3, 1)), label: `Q${q + 1} ${y}` });
      q--;
      if (q < 0) { q = 3; y--; }
    }
  } else {
    for (let i = 0; i < count; i++) {
      const y = today.getFullYear() - i;
      periods.push({ key: `${y}-01-01`, label: `${y}` });
    }
  }
  return periods;
}

function nextPeriodLabel(view) {
  const today = new Date();
  if (view === "weekly") {
    const ms = getMonday(today) - today;
    if (ms >= 0) return null;
    const daysLeft = Math.ceil((7 + ms / 86400000));
    return daysLeft <= 0 ? null : `+${daysLeft}d`;
  }
  if (view === "monthly") {
    const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
    const weeks = Math.ceil((nextMonth - today) / (7 * 86400000));
    return weeks > 0 ? `+${weeks}w` : null;
  }
  if (view === "quarterly") {
    const q = Math.floor(today.getMonth() / 3);
    const nextQ = new Date(today.getFullYear(), (q + 1) * 3, 1);
    const weeks = Math.ceil((nextQ - today) / (7 * 86400000));
    return weeks > 0 ? `+${weeks}w` : null;
  }
  // yearly
  const nextYear = new Date(today.getFullYear() + 1, 0, 1);
  const months = Math.ceil((nextYear - today) / (30.44 * 86400000));
  return months > 0 ? `+${months}mo` : null;
}

// ─── Trend SVG chart ──────────────────────────────────────────────────────────

function TrendChart({ entries }) {
  if (!entries || entries.length === 0) {
    return <p className="py-12 text-center text-sm text-slate-400">No data yet.</p>;
  }

  const sorted = [...entries].sort((a, b) => a.period_start.localeCompare(b.period_start));
  const values = sorted.map((e) => e.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const W = 460, H = 180, PAD = { top: 16, right: 20, bottom: 32, left: 48 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const xStep = sorted.length > 1 ? chartW / (sorted.length - 1) : chartW / 2;

  function px(i) { return PAD.left + (sorted.length > 1 ? i * xStep : chartW / 2); }
  function py(v) { return PAD.top + chartH - ((v - minVal) / range) * chartH; }

  const yTicks = 5;
  const yLabels = Array.from({ length: yTicks }, (_, i) => {
    const v = minVal + (range * i) / (yTicks - 1);
    return Math.round(v);
  });

  const pathD = sorted.map((e, i) => `${i === 0 ? "M" : "L"}${px(i)},${py(e.value)}`).join(" ");

  return (
    <svg width={W} height={H} className="overflow-visible">
      {/* Y-axis grid + labels */}
      {yLabels.map((v, i) => {
        const y = py(v);
        return (
          <g key={i}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#e2e8f0" strokeWidth="1" />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize="11" fill="#94a3b8">{v}</text>
          </g>
        );
      })}
      {/* Line */}
      {sorted.length > 1 && (
        <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinejoin="round" />
      )}
      {/* Dots */}
      {sorted.map((e, i) => (
        <g key={e.id}>
          <circle cx={px(i)} cy={py(e.value)} r="5" fill="white" stroke="#6366f1" strokeWidth="2" />
          <text x={px(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#94a3b8">
            {new Date(e.period_start + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </text>
        </g>
      ))}
    </svg>
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

// ─── KPI Modal ────────────────────────────────────────────────────────────────

const INTERPOLATION_OPTIONS = [
  { value: "latest_value", label: "Latest value" },
  { value: "sum",          label: "Sum" },
  { value: "average",      label: "Average" },
];
const TARGET_TYPE_OPTIONS = [
  { value: "number",     label: "Number" },
  { value: "percentage", label: "Percentage" },
  { value: "currency",   label: "Currency" },
  { value: "boolean",    label: "Yes / No" },
];
const FORMULA_OPTIONS = [
  { value: "",           label: "Select formula" },
  { value: "sum",        label: "Sum of entries" },
  { value: "average",    label: "Average of entries" },
  { value: "last",       label: "Last entry" },
  { value: "max",        label: "Max entry" },
];
const VIEW_OPTIONS = ["weekly", "monthly", "quarterly", "yearly"];

function KPIModal({ team, users, rocks, teams, currentUser, editing, onClose, onSave, saving }) {
  const [title, setTitle] = useState(editing?.title || "");
  const [desc, setDesc] = useState(editing?.description || "");
  const [ownerId, setOwnerId] = useState(
    editing ? String(editing.owner?.id || "") : String(currentUser?.id || "")
  );
  const [teamId, setTeamId] = useState(String(editing?.team_id || team?.id || ""));
  const [rockId, setRockId] = useState(editing?.rock_id ? String(editing.rock_id) : "");
  const [kpiGroup, setKpiGroup] = useState(editing?.kpi_group || "");
  const [supportedViews, setSupportedViews] = useState(
    editing?.supported_views || ["weekly", "monthly", "quarterly", "yearly"]
  );
  const [interpolation, setInterpolation] = useState(editing?.interpolation || "latest_value");
  const [targetType, setTargetType] = useState(editing?.target_type || "number");
  const [formula, setFormula] = useState(editing?.formula || "");
  const [referenceValue, setReferenceValue] = useState(
    editing?.reference_value != null ? String(editing.reference_value) : ""
  );

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
    ]).then(([objectives, rockList, tasks, kpiList]) => {
      setLinkableItems({
        objective: (objectives || []).map((o) => ({ id: o.id, title: o.title })),
        rock: (rockList || []).map((r) => ({ id: r.id, title: r.title })),
        task: (tasks || []).map((t) => ({ id: t.id, title: t.name })),
        kpi: (kpiList || []).map((k) => ({ id: k.id, title: k.title })),
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

  function toggleView(v) {
    setSupportedViews((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v]
    );
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      description: desc || null,
      owner_id: ownerId ? Number(ownerId) : null,
      rock_id: rockId ? Number(rockId) : null,
      kpi_group: kpiGroup || null,
      supported_views: supportedViews,
      interpolation,
      target_type: targetType,
      formula: formula || null,
      reference_value: referenceValue !== "" ? Number(referenceValue) : null,
      team_id: Number(teamId) || team?.id,
      links: selectedLinks,
    });
  }

  const selectedOwner = users.find((u) => String(u.id) === String(ownerId));
  const selectedRock = rocks.find((r) => String(r.id) === String(rockId));
  const selectedTeam = (teams || []).find((t) => String(t.id) === String(teamId));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-6 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl my-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-bold text-slate-900">{editing ? "Edit KPI" : "Create KPI"}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-[1fr_260px] divide-x divide-slate-100">
            {/* Left */}
            <div className="flex flex-col gap-5 p-6">
              {/* KPI name with trend icon */}
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.577 4.878a.75.75 0 01.919-.53l4.78 1.281a.75.75 0 01.531.919l-1.281 4.78a.75.75 0 01-1.449-.387l.81-3.022a19.407 19.407 0 00-5.594 5.203.75.75 0 01-1.139.093L7 10.06l-4.72 4.72a.75.75 0 01-1.06-1.061l5.25-5.25a.75.75 0 011.06 0l3.074 3.073a20.923 20.923 0 015.545-4.931l-3.042-.815a.75.75 0 01-.53-.918z" clipRule="evenodd" />
                  </svg>
                </div>
                <input value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="Name this KPI" required autoFocus
                  className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-base font-medium text-slate-900 placeholder:text-slate-300 outline-none focus:border-slate-400" />
              </div>

              {/* Description */}
              <RichEditor content={desc} onChange={setDesc} placeholder="Describe how this KPI is measured." />
            </div>

            {/* Right — Settings */}
            <div className="space-y-4 overflow-y-auto p-5" style={{ maxHeight: "70vh" }}>
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

              {/* KPI Group */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">KPI group</label>
                <div className="relative">
                  <input value={kpiGroup} onChange={(e) => setKpiGroup(e.target.value)}
                    placeholder="Select or create a group"
                    className="w-full appearance-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-slate-400" />
                </div>
              </div>

              {/* Supported views */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Supported views</label>
                <div className="grid grid-cols-2 gap-2 rounded-xl border border-slate-200 p-3">
                  {VIEW_OPTIONS.map((v) => (
                    <label key={v} className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
                      <input type="checkbox" checked={supportedViews.includes(v)} onChange={() => toggleView(v)}
                        className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                      {v.charAt(0).toUpperCase() + v.slice(1)}
                    </label>
                  ))}
                </div>
              </div>

              {/* Interpolation */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Interpolation</label>
                <select value={interpolation} onChange={(e) => setInterpolation(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400">
                  {INTERPOLATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* Target type */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Target type</label>
                <select value={targetType} onChange={(e) => setTargetType(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400">
                  {TARGET_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* Formula */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Formula</label>
                <select value={formula} onChange={(e) => setFormula(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400">
                  {FORMULA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              {/* Reference value */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Reference value</label>
                <input type="number" value={referenceValue} onChange={(e) => setReferenceValue(e.target.value)}
                  placeholder="Enter value"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-slate-400" />
              </div>

              {/* Rock (optional) */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Rock (optional)</label>
                <div className="relative">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
                    <span className="flex-1 truncate text-sm text-slate-700">{selectedRock ? selectedRock.title : "No Rock"}</span>
                    <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <select value={rockId} onChange={(e) => setRockId(e.target.value)}
                    className="absolute inset-0 w-full opacity-0 cursor-pointer">
                    <option value="">No Rock</option>
                    {rocks.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
                  </select>
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
              {saving ? "Saving…" : editing ? "Save changes" : "Create KPI"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── KPI Trend modal ──────────────────────────────────────────────────────────

function TrendModal({ kpi, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-6">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-base font-bold text-slate-900">KPI trend</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {kpi.rock && (
          <div className="mx-6 mb-4 rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Rock</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800">{kpi.rock.title}</p>
          </div>
        )}

        <div className="px-6 pb-6 overflow-x-auto">
          <TrendChart entries={kpi.entries} />
        </div>

        <div className="flex justify-end border-t border-slate-100 px-6 py-4">
          <button type="button" onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Record value modal ───────────────────────────────────────────────────────

function RecordValueModal({ kpi, period, entry, teamId, onClose, onSaved }) {
  const [value, setValue] = useState(entry?.value != null ? String(entry.value) : "");
  const [forecast, setForecast] = useState(entry?.forecast != null ? String(entry.forecast) : "");
  const [noteText, setNoteText] = useState("");
  const [notes, setNotes] = useState(entry?.notes || []);
  const [saving, setSaving] = useState(false);
  const [addingNote, setAddingNote] = useState(false);
  const [editingNoteIdx, setEditingNoteIdx] = useState(null);
  const [editNoteText, setEditNoteText] = useState("");

  // Keep a ref to the live entry id so note ops work after the entry is created
  const entryRef = useRef(entry);
  useEffect(() => { entryRef.current = entry; }, [entry]);

  async function handleSave() {
    const num = value !== "" ? parseFloat(value) : null;
    setSaving(true);
    try {
      const saved = await kpiApi.upsertEntry(teamId, kpi.id, {
        value: num,
        forecast: forecast !== "" ? parseFloat(forecast) : null,
        period_start: period.key,
        period_type: period.type,
      });
      onSaved(kpi.id, saved);
      toast.success("Value saved.");
    } catch {
      toast.error("Failed to save value.");
    } finally {
      setSaving(false);
    }
  }

  async function handleAddNote() {
    if (!noteText.trim()) return;
    setAddingNote(true);
    try {
      let liveEntry = entryRef.current;
      if (!liveEntry) {
        const num = value !== "" ? parseFloat(value) : null;
        liveEntry = await kpiApi.upsertEntry(teamId, kpi.id, {
          value: num,
          forecast: forecast !== "" ? parseFloat(forecast) : null,
          period_start: period.key,
          period_type: period.type,
        });
        onSaved(kpi.id, liveEntry);
        entryRef.current = liveEntry;
      }
      const updated = await kpiApi.addNote(teamId, kpi.id, liveEntry.id, noteText.trim());
      setNotes(updated.notes || []);
      onSaved(kpi.id, updated);
      setNoteText("");
    } catch {
      toast.error("Failed to add note.");
    } finally {
      setAddingNote(false);
    }
  }

  async function handleEditNote(idx) {
    if (!editNoteText.trim()) return;
    const liveEntry = entryRef.current;
    if (!liveEntry) return;
    try {
      const updated = await kpiApi.editNote(teamId, kpi.id, liveEntry.id, idx, editNoteText.trim());
      setNotes(updated.notes || []);
      onSaved(kpi.id, updated);
      setEditingNoteIdx(null);
    } catch {
      toast.error("Failed to edit note.");
    }
  }

  async function handleDeleteNote(idx) {
    if (!confirm("Delete this note?")) return;
    const liveEntry = entryRef.current;
    if (!liveEntry) return;
    try {
      const updated = await kpiApi.deleteNote(teamId, kpi.id, liveEntry.id, idx);
      setNotes(updated.notes || []);
      onSaved(kpi.id, updated);
    } catch {
      toast.error("Failed to delete note.");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 backdrop-blur-sm p-6">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-base font-bold text-slate-900">Record KPI value</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="px-6 space-y-5 pb-2">
          {/* Period + KPI name */}
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{period.label}</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800">{kpi.title}</p>
          </div>

          {/* Value */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-800">Value</label>
            <input type="number" value={value} onChange={(e) => setValue(e.target.value)}
              placeholder="0"
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400" />
            <p className="mt-1 text-xs text-slate-400">Actual values are stored per {period.type}.</p>
          </div>

          {/* Forecast */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-800">Forecast <span className="font-normal text-slate-400">(optional)</span></label>
            <input type="number" value={forecast} onChange={(e) => setForecast(e.target.value)}
              placeholder=""
              className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400" />
            <p className="mt-1 text-xs text-slate-400">Leave blank to remove the forecast number.</p>
          </div>

          {/* Notes */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800">Notes</span>
              <span className="text-xs font-semibold text-slate-400">{notes.length} {notes.length === 1 ? "NOTE" : "NOTES"}</span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 h-[220px] overflow-y-auto">
              {notes.length === 0 ? (
                <p className="text-sm text-slate-400 text-center">No notes yet. Capture the first update to get the thread started.</p>
              ) : (
                <div className="space-y-4">
                  {notes.map((n, i) => (
                    <div key={i} className="flex items-start gap-3">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${AVATAR_COLORS[(n.author_id || i) % AVATAR_COLORS.length]}`}>
                        {getInitials(n.author_name || "?")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="text-sm font-semibold text-slate-800">{n.author_name || "Unknown"}</span>
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{timeAgo(n.created_at)}</span>
                        </div>
                        {editingNoteIdx === i ? (
                          <div className="mt-1">
                            <textarea value={editNoteText} onChange={(e) => setEditNoteText(e.target.value)} rows={2}
                              className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-slate-400 resize-none" />
                            <div className="mt-1.5 flex gap-3">
                              <button type="button" onClick={() => handleEditNote(i)}
                                className="text-xs font-semibold text-indigo-600 hover:underline">Save</button>
                              <button type="button" onClick={() => setEditingNoteIdx(null)}
                                className="text-xs text-slate-400 hover:underline">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="mt-0.5 text-sm text-slate-600 whitespace-pre-wrap">{n.text}</p>
                            <div className="mt-1 flex gap-3">
                              <button type="button"
                                onClick={() => { setEditingNoteIdx(i); setEditNoteText(n.text); }}
                                className="text-xs text-slate-400 hover:text-slate-700 hover:underline">Edit</button>
                              <button type="button" onClick={() => handleDeleteNote(i)}
                                className="text-xs text-slate-400 hover:text-red-500 hover:underline">Delete</button>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)}
              placeholder={`Add context or assumptions for this ${period.type}'s value`}
              rows={3}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-slate-400 resize-none" />
            <div className="mt-2 flex justify-end">
              <button type="button" onClick={handleAddNote}
                disabled={addingNote || !noteText.trim()}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
                {addingNote ? "Adding…" : "Add note"}
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4 mt-2">
          <button type="button" onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={saving}
            className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60">
            {saving ? "Saving…" : "Save value"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Value cell (click to open modal) ────────────────────────────────────────

function ValueCell({ value, onClick }) {
  return (
    <button type="button" onClick={onClick}
      className="w-20 rounded border border-dashed border-slate-200 py-0.5 text-center text-sm text-slate-700 hover:border-slate-400 hover:bg-slate-50 transition-colors">
      {value != null ? value : <span className="text-slate-300">—</span>}
    </button>
  );
}

// ─── KPI row ──────────────────────────────────────────────────────────────────

function KPIRow({ kpi, index, isDragOver, teamId, view, periods, canManage, onEdit, onDelete, onTrend, onEntrySaved, onOpenRecord, onDragStart, onDragOver, onDrop, onDragEnd }) {
  const isNew = Date.now() - new Date(kpi.created_at).getTime() < 7 * 24 * 60 * 60 * 1000;

  const entryMap = {};
  (kpi.entries || []).forEach((e) => {
    if (e.period_type === view) entryMap[e.period_start] = e;
  });

  const forecastPeriod = periods[0];
  const forecastEntry = forecastPeriod ? entryMap[forecastPeriod.key] : null;
  const forecastBadge = nextPeriodLabel(view);
  const forecastNoteCount = (forecastEntry?.notes || []).length;

  const owner = kpi.owner;

  return (
    <tr
      draggable
      onDragStart={onDragStart}
      onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`group border-b border-slate-100 transition-colors ${isDragOver ? "bg-indigo-50" : "hover:bg-slate-50/60"}`}
    >
      {/* Drag handle */}
      <td className="py-3 pl-3 pr-1 w-6">
        <span className="cursor-grab select-none text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity text-base leading-none">⠿</span>
      </td>
      {/* Status — click opens trend */}
      <td className="py-3 pl-2 pr-3 w-16">
        <button type="button" onClick={() => onTrend(kpi)} title="View trend"
          className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-slate-300 text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-colors">
          <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z" clipRule="evenodd" />
          </svg>
        </button>
      </td>
      {/* KPI name */}
      <td className="py-3 pr-3">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M12.577 4.878a.75.75 0 01.919-.53l4.78 1.281a.75.75 0 01.531.919l-1.281 4.78a.75.75 0 01-1.449-.387l.81-3.022a19.407 19.407 0 00-5.594 5.203.75.75 0 01-1.139.093L7 10.06l-4.72 4.72a.75.75 0 01-1.06-1.061l5.25-5.25a.75.75 0 011.06 0l3.074 3.073a20.923 20.923 0 015.545-4.931l-3.042-.815a.75.75 0 01-.53-.918z" clipRule="evenodd" />
          </svg>
          <span className="text-sm font-medium text-slate-800">{kpi.title}</span>
          {isNew && <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white">NEW</span>}
        </div>
      </td>
      {/* Owner */}
      <td className="py-3 pr-3 w-16">
        {owner ? (
          <div className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white ${AVATAR_COLORS[owner.id % AVATAR_COLORS.length]}`}
            title={owner.full_name || owner.email}>
            {getInitials(owner.full_name || owner.email)}
          </div>
        ) : <span className="text-slate-300">—</span>}
      </td>
      {/* Forecast (current period) */}
      <td className="py-3 pr-4 w-32">
        <div className="flex items-center gap-1.5 flex-wrap">
          <ValueCell
            value={forecastEntry?.value}
            onClick={() => onOpenRecord(kpi, { ...forecastPeriod, type: view }, forecastEntry)}
          />
          {forecastBadge && (
            <span className="text-[10px] font-semibold text-orange-500">{forecastBadge}</span>
          )}
          {forecastNoteCount > 0 && (
            <div className="flex items-center gap-0.5 rounded-full bg-slate-900 px-1.5 py-0.5 leading-none">
              <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path d="M2 5c0-1.1.9-2 2-2h12a2 2 0 012 2v8a2 2 0 01-2 2H6l-4 4V5z" />
              </svg>
              <span className="text-[10px] font-bold text-white">{forecastNoteCount}</span>
            </div>
          )}
        </div>
      </td>
      {/* Historical period cells (skip index 0 = forecast) */}
      {periods.slice(1).map((p) => (
        <td key={p.key} className="py-3 pr-4 w-28">
          <ValueCell
            value={entryMap[p.key]?.value}
            onClick={() => onOpenRecord(kpi, { ...p, type: view }, entryMap[p.key])}
          />
        </td>
      ))}
      {/* Actions */}
      <td className="py-3 pr-4 w-16">
        {canManage && (
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button type="button" onClick={() => onEdit(kpi)} title="Edit KPI"
              className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
              </svg>
            </button>
            <button type="button" onClick={() => onDelete(kpi)} title="Delete KPI"
              className="rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}

// ─── KPIsTab ──────────────────────────────────────────────────────────────────

const VIEW_TABS = [
  { id: "weekly",    label: "Weekly"    },
  { id: "monthly",   label: "Monthly"   },
  { id: "quarterly", label: "Quarterly" },
  { id: "yearly",    label: "Yearly"    },
];

export default function KPIsTab({ team, canManage }) {
  const { user } = useAuth();
  const [kpis, setKpis] = useState([]);
  const [rocks, setRocks] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("weekly");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [trendKpi, setTrendKpi] = useState(null);
  const [recordModal, setRecordModal] = useState(null); // { kpi, period, entry }
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);

  const users = team?.members || [];

  useEffect(() => {
    if (!team?.id) return;
    load();
  }, [team?.id]);

  async function load() {
    setLoading(true);
    try {
      const data = await kpiApi.list(team.id);
      setKpis(Array.isArray(data) ? data : []);
      try {
        const r = await apiClient.get(`/teams/${team.id}/rocks`);
        setRocks(Array.isArray(r) ? r : []);
      } catch { /* rocks optional */ }
      try {
        const ts = await teamApi.list();
        if (Array.isArray(ts)) setTeams(ts);
      } catch { /* teams optional */ }
    } catch {
      toast.error("Failed to load KPIs.");
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(payload) {
    const { team_id: targetTeamId, ...kpiPayload } = payload;
    const createTeamId = targetTeamId || team.id;
    setSaving(true);
    try {
      if (editing) {
        const updated = await kpiApi.update(team.id, editing.id, payload);
        if (updated.team_id !== team.id) {
          setKpis((prev) => prev.filter((k) => k.id !== editing.id));
        } else {
          setKpis((prev) => prev.map((k) => (k.id === editing.id ? updated : k)));
        }
        toast.success("KPI updated.");
      } else {
        const created = await kpiApi.create(createTeamId, kpiPayload);
        if (created.team_id === team.id) {
          setKpis((prev) => [created, ...prev]);
        }
        toast.success("KPI created.");
      }
      setShowModal(false);
      setEditing(null);
    } catch {
      toast.error("Failed to save KPI.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(kpi) {
    if (!confirm(`Delete "${kpi.title}"?`)) return;
    try {
      await kpiApi.delete(team.id, kpi.id);
      setKpis((prev) => prev.filter((k) => k.id !== kpi.id));
      toast.success("KPI deleted.");
    } catch {
      toast.error("Failed to delete KPI.");
    }
  }

  function handleDrop(toIdx) {
    if (dragIdx === null || dragIdx === toIdx) { setDragIdx(null); setOverIdx(null); return; }
    const reordered = [...visibleKpis];
    const [moved] = reordered.splice(dragIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const ordered = reordered.map((k, i) => ({ ...k, sort_order: i }));
    const idToOrder = Object.fromEntries(ordered.map((k) => [k.id, k.sort_order]));
    setKpis((prev) =>
      prev.map((k) => idToOrder[k.id] !== undefined ? { ...k, sort_order: idToOrder[k.id] } : k)
        .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    );
    setDragIdx(null);
    setOverIdx(null);
    kpiApi.reorder(team.id, ordered.map((k) => ({ id: k.id, sort_order: k.sort_order })))
      .catch(() => toast.error("Failed to save order."));
  }

  function handleEntrySaved(kpiId, newEntry) {
    setKpis((prev) => prev.map((k) => {
      if (k.id !== kpiId) return k;
      const existing = k.entries.find(
        (e) => e.period_start === newEntry.period_start && e.period_type === newEntry.period_type
      );
      const entries = existing
        ? k.entries.map((e) => (e.id === existing.id ? newEntry : e))
        : [newEntry, ...k.entries];
      return { ...k, entries };
    }));
    if (trendKpi?.id === kpiId) {
      setTrendKpi((prev) => {
        if (!prev) return prev;
        const existing = prev.entries.find(
          (e) => e.period_start === newEntry.period_start && e.period_type === newEntry.period_type
        );
        const entries = existing
          ? prev.entries.map((e) => (e.id === existing.id ? newEntry : e))
          : [newEntry, ...prev.entries];
        return { ...prev, entries };
      });
    }
  }

  const periods = generatePeriods(view);
  const visibleKpis = kpis.filter((k) =>
    !k.supported_views || k.supported_views.includes(view)
  );

  return (
    <div>
      {/* Header */}
      <div className="mb-1 flex items-center gap-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">Team</p>
      </div>
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold text-slate-900">KPIs</h2>
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
            New KPI
          </button>
        )}
      </div>

      {/* View tabs + Owner filter */}
      <div className="mb-5 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {VIEW_TABS.map((tab) => (
            <button key={tab.id} type="button" onClick={() => setView(tab.id)}
              className={`rounded-full px-4 py-1.5 text-sm font-semibold transition ${
                view === tab.id ? "bg-orange-500 text-white" : "text-slate-600 hover:bg-slate-100"
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
        <button type="button"
          className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 shadow-sm">
          Owner
          <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
          </svg>
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100" />)}
        </div>
      ) : visibleKpis.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-20 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
            <svg className="h-7 w-7" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M12.577 4.878a.75.75 0 01.919-.53l4.78 1.281a.75.75 0 01.531.919l-1.281 4.78a.75.75 0 01-1.449-.387l.81-3.022a19.407 19.407 0 00-5.594 5.203.75.75 0 01-1.139.093L7 10.06l-4.72 4.72a.75.75 0 01-1.06-1.061l5.25-5.25a.75.75 0 011.06 0l3.074 3.073a20.923 20.923 0 015.545-4.931l-3.042-.815a.75.75 0 01-.53-.918z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-slate-700">No KPIs yet</p>
          <p className="mt-1 text-sm text-slate-400">
            {canManage ? 'Click "+ New KPI" to add one.' : "Nothing here yet."}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm" style={{ minWidth: `${400 + periods.length * 112}px` }}>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-400">
                <th className="py-3 pl-3 pr-1 w-6" />
                <th className="py-3 pl-2 pr-3 text-left w-16">Status</th>
                <th className="py-3 pr-3 text-left">KPI</th>
                <th className="py-3 pr-3 text-left w-16">Owner</th>
                <th className="py-3 pr-4 text-left w-32">Forecast</th>
                {periods.slice(1).map((p) => (
                  <th key={p.key} className="py-3 pr-4 text-left w-28 whitespace-nowrap">{p.label}</th>
                ))}
                <th className="py-3 pr-4 w-16" />
              </tr>
            </thead>
            <tbody>
              {visibleKpis.map((kpi, idx) => (
                <KPIRow
                  key={kpi.id}
                  kpi={kpi}
                  index={idx}
                  isDragOver={overIdx === idx}
                  teamId={team.id}
                  view={view}
                  periods={periods}
                  canManage={canManage}
                  onEdit={(k) => { setEditing(k); setShowModal(true); }}
                  onDelete={handleDelete}
                  onTrend={(k) => setTrendKpi(k)}
                  onEntrySaved={handleEntrySaved}
                  onOpenRecord={(kpi, period, entry) => setRecordModal({ kpi, period, entry })}
                  onDragStart={() => setDragIdx(idx)}
                  onDragOver={() => setOverIdx(idx)}
                  onDrop={() => handleDrop(idx)}
                  onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <KPIModal
          team={team}
          users={users}
          rocks={rocks}
          teams={teams}
          currentUser={user}
          editing={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={handleSave}
          saving={saving}
        />
      )}

      {trendKpi && (
        <TrendModal kpi={trendKpi} onClose={() => setTrendKpi(null)} />
      )}

      {recordModal && (
        <RecordValueModal
          kpi={recordModal.kpi}
          period={recordModal.period}
          entry={recordModal.entry}
          teamId={team.id}
          onClose={() => setRecordModal(null)}
          onSaved={(kpiId, entry) => {
            handleEntrySaved(kpiId, entry);
            setRecordModal((prev) => prev ? { ...prev, entry } : null);
          }}
        />
      )}
    </div>
  );
}
