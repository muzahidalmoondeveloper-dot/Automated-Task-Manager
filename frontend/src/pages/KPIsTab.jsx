import { Fragment, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import DOMPurify from "dompurify";
import RichEditor from "../components/RichEditor";
import LinkedItemsHoverIcon from "../components/LinkedItemsHoverIcon";
import EntityDetailPanel from "../components/EntityDetailPanel";
import IconPickerButton from "../components/IconPicker.jsx";
import { RockIconDisplay } from "../utils/rockIcons.jsx";
import toast from "react-hot-toast";
import { kpiApi } from "../api/kpiApi";
import { rockApi } from "../api/rockApi";
import { taskApi } from "../api/taskApi";
import { issueApi } from "../api/issueApi";
import { organizationApi } from "../api/organizationApi";
import { teamApi } from "../api/teamApi";
import { projectApi } from "../api/projectApi";
import { apiClient } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useConfirm } from "../context/ConfirmContext";

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

// Format a Date as YYYY-MM-DD in *local* time. Never use toISOString() here:
// it converts to UTC, which shifts local midnight into the previous day for
// timezones ahead of UTC and produces wrong period keys.
function isoDate(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// ─── Target-type helpers ──────────────────────────────────────────────────────

function formatKpiValue(value, targetType) {
  if (value == null) return null;
  if (targetType === "boolean") return value >= 1 ? "Yes" : "No";
  const rounded = Number.isInteger(value) ? value : Math.round(value * 100) / 100;
  if (targetType === "currency") return `$${rounded.toLocaleString("en-US")}`;
  if (targetType === "percentage") return `${rounded}%`;
  if (targetType === "time") return `${rounded}m`;
  return String(rounded);
}

const STATUS_STYLES = {
  no_data:   { border: "border-slate-300",  text: "text-slate-400",  label: "No data"   },
  on_track:  { border: "border-green-500",  text: "text-green-600",  label: "On track"  },
  at_risk:   { border: "border-amber-500",  text: "text-amber-600",  label: "At risk"   },
  off_track: { border: "border-red-500",    text: "text-red-600",    label: "Off track" },
  snoozed:   { border: "border-slate-300",  text: "text-slate-400",  label: "Snoozed"   },
};

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

function TrendChart({ entries, view, targetType }) {
  // Only chart manually recorded entries of the selected view — interpolated
  // values are display-only and would make the trend misleading.
  const relevant = (entries || []).filter(
    (e) => e.period_type === view && (e.value != null || e.forecast != null)
  );
  if (relevant.length === 0) {
    return <p className="py-12 text-center text-sm text-slate-400">No {view} data yet.</p>;
  }

  const sorted = [...relevant].sort((a, b) => a.period_start.localeCompare(b.period_start));
  const nums = sorted.flatMap((e) => [e.value, e.forecast].filter((v) => v != null));
  const minVal = Math.min(...nums);
  const maxVal = Math.max(...nums);
  const range = maxVal - minVal || 1;

  const W = 460, H = 190, PAD = { top: 16, right: 20, bottom: 44, left: 52 };
  const chartW = W - PAD.left - PAD.right;
  const chartH = H - PAD.top - PAD.bottom;

  const xStep = sorted.length > 1 ? chartW / (sorted.length - 1) : chartW / 2;

  function px(i) { return PAD.left + (sorted.length > 1 ? i * xStep : chartW / 2); }
  function py(v) { return PAD.top + chartH - ((v - minVal) / range) * chartH; }

  function tickLabel(v) {
    const rounded = Math.round(v * 100) / 100;
    if (targetType === "currency") return `$${rounded}`;
    if (targetType === "percentage") return `${rounded}%`;
    if (targetType === "time") return `${rounded}m`;
    return String(rounded);
  }

  const yTicks = 5;
  const yLabels = Array.from({ length: yTicks }, (_, i) => minVal + (range * i) / (yTicks - 1));

  // Connect only recorded actual values (forecast-only periods leave a gap).
  const actualPoints = sorted
    .map((e, i) => ({ e, i }))
    .filter(({ e }) => e.value != null);
  const pathD = actualPoints
    .map(({ e, i }, idx) => `${idx === 0 ? "M" : "L"}${px(i)},${py(e.value)}`)
    .join(" ");

  return (
    <svg width={W} height={H} className="overflow-visible">
      {yLabels.map((v, i) => {
        const y = py(v);
        return (
          <g key={i}>
            <line x1={PAD.left} y1={y} x2={W - PAD.right} y2={y} stroke="#e2e8f0" strokeWidth="1" />
            <text x={PAD.left - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">{tickLabel(v)}</text>
          </g>
        );
      })}
      {actualPoints.length > 1 && (
        <path d={pathD} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinejoin="round" />
      )}
      {sorted.map((e, i) => (
        <g key={e.id ?? `${e.period_start}`}>
          {e.value != null && (
            <circle cx={px(i)} cy={py(e.value)} r="5" fill="white" stroke="#6366f1" strokeWidth="2">
              <title>{`Actual: ${formatKpiValue(e.value, targetType)}`}</title>
            </circle>
          )}
          {e.forecast != null && (
            <circle cx={px(i)} cy={py(e.forecast)} r="4" fill="white" stroke="#f97316" strokeWidth="2" strokeDasharray="2 2">
              <title>{`Forecast: ${formatKpiValue(e.forecast, targetType)}`}</title>
            </circle>
          )}
          <text x={px(i)} y={H - 22} textAnchor="middle" fontSize="10" fill="#94a3b8">
            {new Date(e.period_start + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </text>
        </g>
      ))}
      {/* Legend */}
      <g transform={`translate(${PAD.left}, ${H - 6})`}>
        <circle cx="4" cy="-3" r="4" fill="white" stroke="#6366f1" strokeWidth="2" />
        <text x="12" y="0" fontSize="10" fill="#64748b">Actual</text>
        <circle cx="58" cy="-3" r="3.5" fill="white" stroke="#f97316" strokeWidth="2" strokeDasharray="2 2" />
        <text x="66" y="0" fontSize="10" fill="#64748b">Forecast</text>
      </g>
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
  { value: "no_interpolation", label: "No interpolation" },
  { value: "latest_value",     label: "Latest value" },
  { value: "cumulative",       label: "Cumulative values" },
  { value: "average",          label: "Average" },
];
const TARGET_TYPE_OPTIONS = [
  { value: "number",     label: "Number" },
  { value: "currency",   label: "Currency" },
  { value: "percentage", label: "Percentage" },
  { value: "boolean",    label: "Boolean" },
  { value: "direction",  label: "Direction" },
  { value: "time",       label: "Time" },
];
const FORMULA_OPTIONS = [
  { value: "",         label: "Select formula" },
  { value: "lte",      label: "<=" },
  { value: "gte",      label: ">=" },
  { value: "lt",       label: "<" },
  { value: "gt",       label: ">" },
  { value: "between",  label: "In between" },
  { value: "equals",   label: "Equals" },
];
const VIEW_OPTIONS = ["weekly", "monthly", "quarterly", "yearly"];

function KPIModal({ team, users, rocks, teams, projects, groups, currentUser, editing, onClose, onSave, saving, onGroupCreated }) {
  const [title, setTitle] = useState(editing?.title || "");
  const [icon, setIcon] = useState(editing?.icon || null);
  const [desc, setDesc] = useState(editing?.description || "");
  const [ownerId, setOwnerId] = useState(
    editing ? String(editing.owner?.id || "") : String(currentUser?.id || "")
  );
  const [teamId, setTeamId] = useState(String(editing?.team_id || team?.id || ""));
  const [rockId, setRockId] = useState(editing?.rock_id ? String(editing.rock_id) : "");
  const [projectId, setProjectId] = useState(editing?.project_id ? String(editing.project_id) : "");
  const [kpiGroupId, setKpiGroupId] = useState(editing?.kpi_group_id ? String(editing.kpi_group_id) : "");
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupSearch, setGroupSearch] = useState("");
  const [creatingGroup, setCreatingGroup] = useState(false);
  const groupRef = useRef(null);
  const [supportedViews, setSupportedViews] = useState(
    editing?.supported_views || ["weekly", "monthly", "quarterly", "yearly"]
  );
  // "sum" was replaced by "cumulative" in the interpolation options; map legacy values.
  const [interpolation, setInterpolation] = useState(
    editing?.interpolation === "sum" ? "cumulative" : (editing?.interpolation || "no_interpolation")
  );
  const [targetType, setTargetType] = useState(editing?.target_type || "number");
  // Old formula values (sum/average/last/max) were replaced by comparison operators;
  // fall back to "Select formula" for KPIs saved before the change.
  const [formula, setFormula] = useState(
    FORMULA_OPTIONS.some((o) => o.value === editing?.formula) ? editing.formula : ""
  );
  const [referenceValue, setReferenceValue] = useState(
    editing?.reference_value != null ? String(editing.reference_value) : ""
  );
  const [referenceMax, setReferenceMax] = useState(
    editing?.reference_max != null ? String(editing.reference_max) : ""
  );

  // Rocks and KPI groups are team-scoped: when the KPI is created into another
  // team, offer that team's rocks/groups instead of the current tab's. The
  // current tab's come from props; other teams' are fetched on demand.
  const [foreignRocks, setForeignRocks] = useState({}); // teamId -> rocks[]
  const [foreignGroups, setForeignGroups] = useState({}); // teamId -> groups[]
  const isHomeTeam = String(teamId) === String(team?.id);
  const teamRocks = isHomeTeam ? rocks : (foreignRocks[teamId] || []);
  const teamGroups = isHomeTeam ? (groups || []) : (foreignGroups[teamId] || []);
  useEffect(() => {
    if (String(teamId) === String(team?.id)) return;
    let cancelled = false;
    rockApi.list(Number(teamId))
      .then((r) => {
        if (!cancelled) setForeignRocks((prev) => ({ ...prev, [teamId]: Array.isArray(r) ? r : [] }));
      })
      .catch(() => {
        if (!cancelled) setForeignRocks((prev) => ({ ...prev, [teamId]: [] }));
      });
    kpiApi.listGroups(Number(teamId))
      .then((g) => {
        if (!cancelled) setForeignGroups((prev) => ({ ...prev, [teamId]: Array.isArray(g) ? g : [] }));
      })
      .catch(() => {
        if (!cancelled) setForeignGroups((prev) => ({ ...prev, [teamId]: [] }));
      });
    return () => { cancelled = true; };
  }, [teamId, team?.id]);

  useEffect(() => {
    if (!groupOpen) return;
    function handleOutside(e) {
      if (groupRef.current && !groupRef.current.contains(e.target)) setGroupOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [groupOpen]);

  async function handleCreateGroup(name) {
    setCreatingGroup(true);
    try {
      const group = await kpiApi.createGroup(Number(teamId), { name: name.trim() });
      if (isHomeTeam) {
        onGroupCreated(group);
      } else {
        setForeignGroups((prev) => ({
          ...prev,
          [teamId]: [...(prev[teamId] || []).filter((g) => g.id !== group.id), group],
        }));
      }
      setKpiGroupId(String(group.id));
      setGroupOpen(false);
      setGroupSearch("");
      toast.success(`Group "${group.name}" created.`);
    } catch (err) {
      toast.error(err.message || "Failed to create the group.");
    } finally {
      setCreatingGroup(false);
    }
  }

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
    if (!title.trim() || !rockId) return;
    if (supportedViews.length === 0) {
      toast.error("Select at least one supported view.");
      return;
    }
    const isDirection = targetType === "direction";
    const effectiveFormula = targetType === "boolean" && formula ? "equals" : formula;
    if (effectiveFormula && !isDirection && referenceValue === "") {
      toast.error("A reference value is required when a formula is selected.");
      return;
    }
    if (effectiveFormula === "between") {
      if (referenceMax === "") {
        toast.error("The 'In between' formula needs both a minimum and a maximum.");
        return;
      }
      if (Number(referenceValue) > Number(referenceMax)) {
        toast.error("Minimum cannot be greater than maximum.");
        return;
      }
    }
    onSave({
      title: title.trim(),
      icon,
      description: desc || null,
      owner_id: ownerId ? Number(ownerId) : null,
      rock_id: Number(rockId),
      project_id: projectId ? Number(projectId) : null,
      kpi_group_id: kpiGroupId ? Number(kpiGroupId) : null,
      // Legacy label kept in sync for older consumers (e.g. project overview badge).
      kpi_group: teamGroups.find((g) => String(g.id) === String(kpiGroupId))?.name || null,
      supported_views: supportedViews,
      interpolation,
      target_type: targetType,
      formula: effectiveFormula || null,
      reference_value: !isDirection && referenceValue !== "" ? Number(referenceValue) : null,
      reference_max: effectiveFormula === "between" && referenceMax !== "" ? Number(referenceMax) : null,
      team_id: Number(teamId) || team?.id,
      links: selectedLinks,
    });
  }

  const selectedOwner = users.find((u) => String(u.id) === String(ownerId));
  const selectedRock = teamRocks.find((r) => String(r.id) === String(rockId));
  const selectedTeam = (teams || []).find((t) => String(t.id) === String(teamId));
  const selectedProject = (projects || []).find((p) => String(p.id) === String(projectId));

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
              {/* KPI name with icon picker */}
              <div className="flex items-center gap-3">
                <IconPickerButton value={icon} onChange={setIcon} resetKey={editing?.id ?? "create"} size={20} />
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
                  <select value={teamId}
                    onChange={(e) => {
                      if (e.target.value !== teamId) {
                        setRockId("");      // rocks are team-scoped
                        setKpiGroupId("");  // so are KPI groups
                      }
                      setTeamId(e.target.value);
                    }}
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

              {/* KPI Group — searchable combobox with inline create */}
              <div ref={groupRef} className="relative">
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">KPI group</label>
                <button type="button" onClick={() => setGroupOpen((v) => !v)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-left text-sm hover:bg-slate-50">
                  <span className={kpiGroupId ? "truncate text-slate-900" : "text-slate-400"}>
                    {teamGroups.find((g) => String(g.id) === String(kpiGroupId))?.name || "Select or create a group"}
                  </span>
                  <svg className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${groupOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                  </svg>
                </button>
                {groupOpen && (() => {
                  const q = groupSearch.trim().toLowerCase();
                  const filtered = teamGroups.filter((g) => !q || g.name.toLowerCase().includes(q));
                  const exactMatch = teamGroups.some((g) => g.name.toLowerCase() === q);
                  return (
                    <div className="absolute left-0 right-0 z-20 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                      <div className="flex items-center gap-2 border-b border-slate-100 px-3 py-2">
                        <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
                        </svg>
                        <input autoFocus value={groupSearch} onChange={(e) => setGroupSearch(e.target.value)}
                          placeholder="Search KPI groups..."
                          className="w-full border-none text-sm text-slate-700 placeholder:text-slate-400 outline-none" />
                      </div>
                      <div className="max-h-44 overflow-y-auto py-1">
                        <button type="button"
                          onClick={() => { setKpiGroupId(""); setGroupOpen(false); setGroupSearch(""); }}
                          className={`flex w-full items-center px-3 py-2 text-left text-sm hover:bg-slate-50 ${!kpiGroupId ? "font-medium text-slate-900" : "text-slate-600"}`}>
                          No group
                        </button>
                        {filtered.length === 0 && q ? (
                          <p className="px-3 py-3 text-center text-xs text-slate-400">No KPI groups found.</p>
                        ) : (
                          filtered.map((g) => (
                            <button key={g.id} type="button"
                              onClick={() => { setKpiGroupId(String(g.id)); setGroupOpen(false); setGroupSearch(""); }}
                              className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                                String(g.id) === String(kpiGroupId) ? "bg-slate-50 font-medium text-slate-900" : "text-slate-700"
                              }`}>
                              <span className="truncate">{g.name}</span>
                              {String(g.id) === String(kpiGroupId) && (
                                <svg className="h-3.5 w-3.5 shrink-0 text-slate-900" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                </svg>
                              )}
                            </button>
                          ))
                        )}
                      </div>
                      {q && !exactMatch && (
                        <button type="button" disabled={creatingGroup}
                          onClick={() => handleCreateGroup(groupSearch)}
                          className="flex w-full items-center border-t border-slate-100 px-3 py-2.5 text-left text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-60">
                          {creatingGroup ? "Creating…" : `Create group: "${groupSearch.trim()}"`}
                        </button>
                      )}
                    </div>
                  );
                })()}
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
                  {(targetType === "boolean"
                    ? FORMULA_OPTIONS.filter((o) => o.value === "" || o.value === "equals")
                    : targetType === "direction"
                      ? FORMULA_OPTIONS.filter((o) => o.value !== "between")
                      : FORMULA_OPTIONS
                  ).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
                {targetType === "direction" && (
                  <p className="mt-1 text-[11px] text-slate-400">
                    Direction compares each value to the previous one: &gt;= means it should rise or hold, &lt;= means it should fall or hold.
                  </p>
                )}
              </div>

              {/* Reference value(s) — direction needs none */}
              {targetType !== "direction" && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-500">
                    {formula === "between" ? "Reference range" : "Reference value"}
                  </label>
                  {targetType === "boolean" ? (
                    <select value={referenceValue} onChange={(e) => setReferenceValue(e.target.value)}
                      className="w-full appearance-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400">
                      <option value="">Select target</option>
                      <option value="1">Yes</option>
                      <option value="0">No</option>
                    </select>
                  ) : formula === "between" ? (
                    <div className="flex items-center gap-2">
                      <input type="number" step="any" value={referenceValue}
                        onChange={(e) => setReferenceValue(e.target.value)} placeholder="Min"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-slate-400" />
                      <span className="text-xs text-slate-400">to</span>
                      <input type="number" step="any" value={referenceMax}
                        onChange={(e) => setReferenceMax(e.target.value)} placeholder="Max"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-slate-400" />
                    </div>
                  ) : (
                    <div className="relative">
                      {targetType === "currency" && (
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                      )}
                      <input type="number" step="any" value={referenceValue}
                        onChange={(e) => setReferenceValue(e.target.value)} placeholder="Enter value"
                        className={`w-full rounded-xl border border-slate-200 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-slate-400 ${
                          targetType === "currency" ? "pl-7 pr-3" : "px-3"
                        }`} />
                      {(targetType === "percentage" || targetType === "time") && (
                        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                          {targetType === "percentage" ? "%" : "min"}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Rock (required) */}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Rock *</label>
                <div className="relative">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
                    <span className={`flex-1 truncate text-sm ${selectedRock ? "text-slate-700" : "text-slate-400"}`}>
                      {selectedRock ? selectedRock.title : "Select a Rock"}
                    </span>
                    <svg className="h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <select value={rockId} onChange={(e) => setRockId(e.target.value)} required
                    className="absolute inset-0 w-full opacity-0 cursor-pointer">
                    <option value="">Select a Rock</option>
                    {teamRocks
                      .filter((r) => !r.is_archived && r.status !== "archived")
                      .map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
                    {/* Keep an archived rock selectable only if it's the KPI's current link */}
                    {editing?.rock && teamRocks.some((r) => r.id === editing.rock.id && (r.is_archived || r.status === "archived")) && (
                      <option value={editing.rock.id}>{editing.rock.title} (archived)</option>
                    )}
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

// ─── Edit KPI Group modal ─────────────────────────────────────────────────────

const GROUP_FORMULA_OPTIONS = [
  { value: "sum",     label: "Sum" },
  { value: "average", label: "Average" },
];

function KPIGroupModal({ group, onClose, onSave, saving }) {
  const [name, setName] = useState(group.name);
  const [formula, setFormula] = useState(group.formula || "sum");
  const [collapse, setCollapse] = useState(Boolean(group.collapse_by_default));

  function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) return;
    onSave({ name: name.trim(), formula, collapse_by_default: collapse });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/40 p-8 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-bold text-slate-900">Edit KPI Group</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500">Group name</label>
            <input value={name} onChange={(e) => setName(e.target.value)} required
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400" />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-500">Group formula</label>
            <select value={formula} onChange={(e) => setFormula(e.target.value)}
              className="w-full appearance-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-400">
              {GROUP_FORMULA_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <p className="mt-1 text-[11px] text-slate-400">Controls the aggregate shown on the group's header row.</p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={collapse} onChange={(e) => setCollapse(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 accent-slate-900" />
            Collapse this group by default
          </label>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60">
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── KPI Trend modal ──────────────────────────────────────────────────────────

function TrendModal({ kpi, view, onClose }) {
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
          <TrendChart entries={kpi.entries} view={view} targetType={kpi.target_type} />
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
  const confirm = useConfirm();
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
    const fnum = forecast !== "" ? parseFloat(forecast) : null;
    if ((num != null && !Number.isFinite(num)) || (fnum != null && !Number.isFinite(fnum))) {
      toast.error("Enter a valid number.");
      return;
    }
    if (kpi.target_type === "time" && ((num != null && num < 0) || (fnum != null && fnum < 0))) {
      toast.error("Time values cannot be negative.");
      return;
    }
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
    if (!(await confirm({ message: "Delete this note?", tone: "danger", confirmLabel: "Delete" }))) return;
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
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-y-auto rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-base font-bold text-slate-900">Record KPI value</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="px-6 space-y-4 pb-2">
          {/* Period + KPI name */}
          <div className="rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{period.label}</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-800">{kpi.title}</p>
          </div>

          {/* Value */}
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-800">Value</label>
            {kpi.target_type === "boolean" ? (
              <div className="flex gap-2">
                {[{ v: "1", label: "Yes" }, { v: "0", label: "No" }, { v: "", label: "Not set" }].map((o) => (
                  <button key={o.label} type="button" onClick={() => setValue(o.v)}
                    className={`flex-1 rounded-xl border px-3 py-2.5 text-sm font-semibold transition ${
                      value === o.v
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}>
                    {o.label}
                  </button>
                ))}
              </div>
            ) : (
              <div className="relative">
                {kpi.target_type === "currency" && (
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                )}
                <input type="number" step="any" min={kpi.target_type === "time" ? 0 : undefined}
                  value={value} onChange={(e) => setValue(e.target.value)}
                  placeholder="0"
                  className={`w-full rounded-xl border border-slate-200 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400 ${
                    kpi.target_type === "currency" ? "pl-8 pr-4" : "px-4"
                  }`} />
                {(kpi.target_type === "percentage" || kpi.target_type === "time") && (
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-xs text-slate-400">
                    {kpi.target_type === "percentage" ? "%" : "min"}
                  </span>
                )}
              </div>
            )}
            <p className="mt-1 text-xs text-slate-400">Actual values are stored per {period.type}.</p>
          </div>

          {/* Forecast — not meaningful for yes/no KPIs */}
          {kpi.target_type !== "boolean" && (
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-800">Forecast <span className="font-normal text-slate-400">(optional)</span></label>
              <input type="number" step="any" value={forecast} onChange={(e) => setForecast(e.target.value)}
                placeholder=""
                className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-slate-400" />
              <p className="mt-1 text-xs text-slate-400">Leave blank to remove the forecast number.</p>
            </div>
          )}

          {/* Notes */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800">Notes</span>
              <span className="text-xs font-semibold text-slate-400">{notes.length} {notes.length === 1 ? "NOTE" : "NOTES"}</span>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 max-h-[220px] overflow-y-auto">
              {notes.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-1.5">No notes yet. Capture the first update to get the thread started.</p>
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
              rows={2}
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

function ValueCell({ value, derivedValue, targetType, onClick }) {
  const isDerived = value == null && derivedValue != null;
  const display = value != null
    ? formatKpiValue(value, targetType)
    : isDerived
      ? `≈ ${formatKpiValue(derivedValue, targetType)}`
      : null;
  return (
    <button type="button" onClick={onClick}
      title={isDerived ? "Interpolated from finer-grained values — click to record an actual value" : undefined}
      className={`w-20 rounded border border-dashed border-slate-200 py-0.5 text-center text-sm hover:border-slate-400 hover:bg-slate-50 transition-colors ${
        isDerived ? "italic text-slate-400" : "text-slate-700"
      }`}>
      {display ?? <span className="text-slate-300">—</span>}
    </button>
  );
}

// ─── Quick-create modal (Create Issue / Create To-Do from a KPI) ──────────────

function QuickCreateModal({ heading, placeholder, onCancel, onSubmit, isSaving }) {
  const [title, setTitle] = useState(placeholder || "");

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit(title.trim());
  }

  return createPortal(
    <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/40 px-4 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <h3 className="mb-4 text-lg font-bold text-slate-900">{heading}</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onCancel} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={isSaving} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
              {isSaving ? "Creating..." : "Create"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}

// ─── KPI row actions menu (portal-positioned so it never scrolls/clips) ───────

function KpiActionsMenu({ kpi, teamId, onEdit, onDelete, onToggleSnooze }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const [quickCreate, setQuickCreate] = useState(null); // "issue" | "todo" | null
  const [isSaving, setIsSaving] = useState(false);
  const btnRef = useRef(null);

  function openMenu(e) {
    e.stopPropagation();
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setMenuPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setMenuOpen((v) => !v);
  }

  async function handleQuickCreate(title) {
    try {
      setIsSaving(true);
      if (quickCreate === "issue") {
        await issueApi.create(teamId, {
          title,
          links: [{ linked_type: "kpi", linked_id: kpi.id, title: kpi.title }],
        });
        toast.success("Issue created.");
      } else {
        await taskApi.create({ name: title, team_id: teamId, project_id: kpi.project_id || null });
        toast.success("To-Do created.");
      }
      setQuickCreate(null);
    } catch (err) {
      toast.error(err.message || "Failed to create.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <button ref={btnRef} type="button" onClick={openMenu} title="More actions"
        className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
          <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
        </svg>
      </button>

      {menuOpen && menuPos && createPortal(
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setMenuOpen(false)} />
          <div className="fixed z-[101] w-44 rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
            style={{ top: menuPos.top, right: menuPos.right }}>
            <button type="button" onClick={() => { setMenuOpen(false); onEdit(kpi); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
              </svg>
              Edit
            </button>
            <button type="button" onClick={() => { setMenuOpen(false); setQuickCreate("issue"); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
              </svg>
              Create Issue
            </button>
            <button type="button" onClick={() => { setMenuOpen(false); setQuickCreate("todo"); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
              </svg>
              Create To-Do
            </button>
            <button type="button" onClick={() => { setMenuOpen(false); onToggleSnooze(kpi); }}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
              <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
              {kpi.is_snoozed ? "Unsnooze" : "Snooze"}
            </button>
            <button type="button" onClick={() => { setMenuOpen(false); onDelete(kpi); }}
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

      {quickCreate && (
        <QuickCreateModal
          heading={quickCreate === "issue" ? "Create Issue" : "Create To-Do"}
          placeholder={`${quickCreate === "issue" ? "Issue" : "To-Do"} from KPI: ${kpi.title}`}
          isSaving={isSaving}
          onCancel={() => setQuickCreate(null)}
          onSubmit={handleQuickCreate}
        />
      )}
    </>
  );
}

// ─── KPI row ──────────────────────────────────────────────────────────────────

function KPIRow({ kpi, index, isDragOver, teamId, view, periods, canManage, onEdit, onDelete, onTrend, onEntrySaved, onOpenRecord, onToggleSnooze, onDragStart, onDragOver, onDrop, onDragEnd, onOwnerClick, ownerSelected }) {
  const [detailOpen, setDetailOpen] = useState(false);
  const isNew = Date.now() - new Date(kpi.created_at).getTime() < 7 * 24 * 60 * 60 * 1000;

  const entryMap = {};
  (kpi.entries || []).forEach((e) => {
    if (e.period_type === view) entryMap[e.period_start] = e;
  });
  // Server-computed interpolated values for this view (shown only where no
  // manual value exists; never editable — clicking records a manual value).
  const derivedMap = {};
  (kpi.derived_entries || []).forEach((d) => {
    if (d.period_type === view) derivedMap[d.period_start] = d;
  });

  const status = kpi.statuses?.[view] || "no_data";
  const st = STATUS_STYLES[status] || STATUS_STYLES.no_data;

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
      {/* Status — server-computed; click opens trend */}
      <td className="py-3 pl-2 pr-3 w-16">
        <button type="button" onClick={() => onTrend(kpi)} title={`${st.label} — view trend`}
          className={`flex h-7 w-7 items-center justify-center rounded-full border-2 transition-colors hover:opacity-75 ${st.border} ${st.text}`}>
          {status === "snoozed" ? (
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
            </svg>
          ) : (
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm0-2a6 6 0 100-12 6 6 0 000 12z" clipRule="evenodd" />
            </svg>
          )}
        </button>
      </td>
      {/* KPI name — leading icon is the snooze toggle */}
      <td className="py-3 pr-3">
        <div className="flex items-center gap-2">
          <button type="button"
            onClick={() => canManage && onToggleSnooze(kpi)}
            disabled={!canManage}
            title={kpi.is_snoozed
              ? "Snoozed — click to reactivate this KPI."
              : "Snooze until status becomes at-risk or off-track."}
            className={`group/snooze flex h-6 w-6 shrink-0 items-center justify-center rounded ${
              canManage ? "hover:bg-slate-100" : "cursor-default"
            } ${kpi.is_snoozed ? "text-slate-500" : "text-slate-400"}`}>
            {kpi.is_snoozed ? (
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
              </svg>
            ) : (
              <>
                <svg className={`h-4 w-4 ${canManage ? "group-hover/snooze:hidden" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M12.577 4.878a.75.75 0 01.919-.53l4.78 1.281a.75.75 0 01.531.919l-1.281 4.78a.75.75 0 01-1.449-.387l.81-3.022a19.407 19.407 0 00-5.594 5.203.75.75 0 01-1.139.093L7 10.06l-4.72 4.72a.75.75 0 01-1.06-1.061l5.25-5.25a.75.75 0 011.06 0l3.074 3.073a20.923 20.923 0 015.545-4.931l-3.042-.815a.75.75 0 01-.53-.918z" clipRule="evenodd" />
                </svg>
                {canManage && (
                  <svg className="hidden h-4 w-4 group-hover/snooze:block" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                  </svg>
                )}
              </>
            )}
          </button>
          {kpi.icon && (
            <span className="shrink-0 text-slate-400">
              <RockIconDisplay iconStr={kpi.icon} size={14} />
            </span>
          )}
          <span className="text-sm font-medium text-slate-800">{kpi.title}</span>
          {isNew && <span className="rounded bg-slate-900 px-1.5 py-0.5 text-[10px] font-bold text-white">NEW</span>}
          {kpi.rock && (
            <span className="inline-flex max-w-[160px] items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500"
              title={`Rock: ${kpi.rock.title}`}>
              <svg className="h-2.5 w-2.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                <path d="M10 2L3 7l2.5 11h9L17 7l-7-5z" />
              </svg>
              <span className="truncate">{kpi.rock.title}</span>
            </span>
          )}
          {status === "snoozed" && (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-400">Snoozed</span>
          )}
          <LinkedItemsHoverIcon links={kpi.links} />
        </div>
      </td>
      {/* Owner — click toggles this owner in the filter */}
      <td className="py-3 pr-3 w-16">
        {owner ? (
          <button type="button" onClick={() => onOwnerClick(owner)}
            title={`${owner.full_name || owner.email} — click to filter`}
            className={`flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold text-white transition ${AVATAR_COLORS[owner.id % AVATAR_COLORS.length]} ${
              ownerSelected ? "ring-2 ring-slate-900 ring-offset-2" : "hover:ring-2 hover:ring-slate-300 hover:ring-offset-2"
            }`}>
            {getInitials(owner.full_name || owner.email)}
          </button>
        ) : <span className="text-slate-300">—</span>}
      </td>
      {/* Forecast (current period) */}
      <td className="py-3 pr-4 w-32">
        <div className="flex items-center gap-1.5 flex-wrap">
          <ValueCell
            value={forecastEntry?.value}
            derivedValue={forecastPeriod ? derivedMap[forecastPeriod.key]?.value : null}
            targetType={kpi.target_type}
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
            derivedValue={derivedMap[p.key]?.value}
            targetType={kpi.target_type}
            onClick={() => onOpenRecord(kpi, { ...p, type: view }, entryMap[p.key])}
          />
        </td>
      ))}
      {/* Actions — sticky to the right edge so it stays visible when the
          wide, period-column table scrolls horizontally. */}
      <td className="sticky right-0 z-10 w-16 border-l border-slate-100 bg-white py-3 pr-4 group-hover:bg-slate-50">
        <div className="flex items-center justify-end gap-1">
          <button type="button" onClick={() => setDetailOpen(true)} title="Notes & details"
            className="rounded p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902 1.168.188 2.352.327 3.55.414.28.02.521.18.642.413l1.713 3.293a.75.75 0 001.33 0l1.713-3.293a.647.647 0 01.642-.413 41.102 41.102 0 003.55-.414c1.437-.231 2.43-1.49 2.43-2.902V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0010 2z" clipRule="evenodd" />
            </svg>
          </button>
          {canManage && (
            <KpiActionsMenu kpi={kpi} teamId={teamId} onEdit={onEdit} onDelete={onDelete} onToggleSnooze={onToggleSnooze} />
          )}
        </div>
      </td>

      {detailOpen && (
        <EntityDetailPanel
          entityType="kpi"
          entityId={kpi.id}
          title={kpi.title}
          statusLabel={st.label}
          createdAt={kpi.created_at}
          ownerUser={kpi.owner}
          description={kpi.description}
          onClose={() => setDetailOpen(false)}
        />
      )}
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
  const confirm = useConfirm();
  const [kpis, setKpis] = useState([]);
  const [rocks, setRocks] = useState([]);
  const [teams, setTeams] = useState([]);
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("weekly");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const [trendKpi, setTrendKpi] = useState(null);
  const [recordModal, setRecordModal] = useState(null); // { kpi, period, entry }
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const [ownerFilter, setOwnerFilter] = useState([]); // selected owner user ids
  const [ownerMenuOpen, setOwnerMenuOpen] = useState(false);
  const ownerMenuRef = useRef(null);
  const [rockFilter, setRockFilter] = useState([]); // selected rock ids
  const [rockMenuOpen, setRockMenuOpen] = useState(false);
  const rockMenuRef = useRef(null);
  const [lifeFilter, setLifeFilter] = useState("active"); // active | snoozed
  const [groups, setGroups] = useState([]);
  const [collapsedGroups, setCollapsedGroups] = useState(new Set());
  const [editingGroup, setEditingGroup] = useState(null);
  const [groupSaving, setGroupSaving] = useState(false);
  const [groupMenuId, setGroupMenuId] = useState(null);

  const users = team?.members || [];

  useEffect(() => {
    if (!ownerMenuOpen && !rockMenuOpen) return;
    function handleOutside(e) {
      if (ownerMenuRef.current && !ownerMenuRef.current.contains(e.target)) setOwnerMenuOpen(false);
      if (rockMenuRef.current && !rockMenuRef.current.contains(e.target)) setRockMenuOpen(false);
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [ownerMenuOpen, rockMenuOpen]);

  function toggleOwnerFilter(ownerId) {
    setOwnerFilter((prev) =>
      prev.includes(ownerId) ? prev.filter((id) => id !== ownerId) : [...prev, ownerId]
    );
  }

  function toggleRockFilter(rockId) {
    setRockFilter((prev) =>
      prev.includes(rockId) ? prev.filter((id) => id !== rockId) : [...prev, rockId]
    );
  }

  function handleGroupCreated(group) {
    setGroups((prev) =>
      prev.some((g) => g.id === group.id)
        ? prev
        : [...prev, group].sort((a, b) => a.name.localeCompare(b.name))
    );
  }

  function toggleGroupCollapse(groupId) {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
      return next;
    });
  }

  async function handleSaveGroup(payload) {
    setGroupSaving(true);
    try {
      const updated = await kpiApi.updateGroup(team.id, editingGroup.id, payload);
      setGroups((prev) =>
        prev.map((g) => (g.id === updated.id ? updated : g)).sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingGroup(null);
      toast.success("Group updated.");
    } catch (err) {
      toast.error(err.message || "Failed to update the group.");
    } finally {
      setGroupSaving(false);
    }
  }

  async function handleDeleteGroup(group) {
    setGroupMenuId(null);
    if (!(await confirm({ message: `Delete group "${group.name}"? Its KPIs will be kept and become ungrouped.`, tone: "danger", confirmLabel: "Delete" }))) return;
    try {
      await kpiApi.deleteGroup(team.id, group.id);
      setGroups((prev) => prev.filter((g) => g.id !== group.id));
      setKpis((prev) => prev.map((k) => (k.kpi_group_id === group.id ? { ...k, kpi_group_id: null, kpi_group: null } : k)));
      toast.success("Group deleted. Its KPIs were kept.");
    } catch (err) {
      toast.error(err.message || "Failed to delete the group.");
    }
  }

  async function handleToggleSnooze(kpi) {
    try {
      const updated = await kpiApi.update(team.id, kpi.id, { is_snoozed: !kpi.is_snoozed });
      setKpis((prev) => prev.map((k) => (k.id === kpi.id ? updated : k)));
      toast.success(updated.is_snoozed ? "KPI snoozed. Find it under the Snoozed tab." : "KPI reactivated.");
    } catch {
      toast.error("Failed to update the KPI.");
    }
  }

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
      try {
        const ps = await projectApi.list();
        if (Array.isArray(ps)) setProjects(ps);
      } catch { /* projects optional */ }
      try {
        const gs = await kpiApi.listGroups(team.id);
        if (Array.isArray(gs)) {
          setGroups(gs);
          setCollapsedGroups(new Set(gs.filter((g) => g.collapse_by_default).map((g) => g.id)));
        }
      } catch { /* groups optional */ }
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
    if (!(await confirm({ message: `Delete "${kpi.title}"?`, tone: "danger", confirmLabel: "Delete" }))) return;
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
    const reordered = [...orderedVisible];
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
  // Effective snooze comes from the server-computed status: a snooze breaks
  // as soon as the KPI would be at-risk or off-track, and expires after
  // snoozed_until. Fall back to the raw flag if no status is available.
  const todayKey = isoDate(new Date());
  const isSnoozedNow = (k) => {
    const s = k.statuses?.[view];
    if (s !== undefined) return s === "snoozed";
    return k.is_snoozed && (!k.snoozed_until || k.snoozed_until >= todayKey);
  };

  const viewKpis = kpis.filter((k) =>
    (!k.supported_views || k.supported_views.includes(view)) &&
    (lifeFilter === "snoozed" ? isSnoozedNow(k) : !isSnoozedNow(k))
  );

  // Owners / rocks present in the current view, with how many KPIs each has.
  const ownerOptions = [];
  const rockOptions = [];
  viewKpis.forEach((k) => {
    if (k.owner) {
      const existing = ownerOptions.find((o) => o.id === k.owner.id);
      if (existing) existing.count += 1;
      else ownerOptions.push({ ...k.owner, count: 1 });
    }
    if (k.rock) {
      const existing = rockOptions.find((r) => r.id === k.rock.id);
      if (existing) existing.count += 1;
      else rockOptions.push({ ...k.rock, count: 1 });
    }
  });

  const visibleKpis = viewKpis.filter((k) =>
    (ownerFilter.length === 0 || (k.owner && ownerFilter.includes(k.owner.id))) &&
    (rockFilter.length === 0 || (k.rock && rockFilter.includes(k.rock.id)))
  );

  // Grouped rendering: ungrouped KPIs first, then one section per group.
  const ungroupedKpis = visibleKpis.filter((k) => !k.kpi_group_id);
  const groupSections = groups
    .map((g) => ({ group: g, kpis: visibleKpis.filter((k) => k.kpi_group_id === g.id) }))
    .filter((s) => s.kpis.length > 0);
  const orderedVisible = [...ungroupedKpis, ...groupSections.flatMap((s) => s.kpis)];
  const rowIndexOf = new Map(orderedVisible.map((k, i) => [k.id, i]));

  // Aggregate of a group's recorded values for one period, per group formula.
  function groupAggregate(section, periodKey) {
    const values = section.kpis
      .map((k) => (k.entries || []).find((e) => e.period_type === view && e.period_start === periodKey)?.value)
      .filter((v) => v != null);
    if (values.length === 0) return null;
    const sum = values.reduce((a, b) => a + b, 0);
    const result = section.group.formula === "average" ? sum / values.length : sum;
    return Math.round(result * 100) / 100;
  }

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
        <div className="flex items-center gap-2">
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
        <div className="flex items-center gap-2">
        {/* Active / Snoozed */}
        <div className="flex items-center gap-1">
          {[{ id: "active", label: "Active" }, { id: "snoozed", label: "Snoozed" }].map((f) => (
            <button key={f.id} type="button" onClick={() => setLifeFilter(f.id)}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                lifeFilter === f.id ? "bg-slate-900 text-white" : "text-slate-500 hover:bg-slate-100"
              }`}>
              {f.label}
            </button>
          ))}
        </div>

        {/* Rock filter */}
        <div ref={rockMenuRef} className="relative">
          <button type="button" onClick={() => setRockMenuOpen((v) => !v)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium shadow-sm ${
              rockFilter.length > 0
                ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}>
            Rock{rockFilter.length > 0 ? ` (${rockFilter.length})` : ""}
            <svg className={`h-4 w-4 transition-transform ${rockFilter.length > 0 ? "text-white/70" : "text-slate-400"} ${rockMenuOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
            </svg>
          </button>
          {rockMenuOpen && (
            <div className="absolute right-0 top-full z-30 mt-1.5 w-64 rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
              <button type="button"
                onClick={() => { setRockFilter([]); setRockMenuOpen(false); }}
                className="flex w-full items-center px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                Clear
              </button>
              <div className="my-1 border-t border-slate-100" />
              {rockOptions.length === 0 ? (
                <p className="px-3 py-3 text-center text-xs text-slate-400">No linked Rocks in this view.</p>
              ) : (
                rockOptions.map((r) => {
                  const selected = rockFilter.includes(r.id);
                  return (
                    <button key={r.id} type="button" onClick={() => toggleRockFilter(r.id)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50">
                      <span className="flex w-4 shrink-0 justify-center text-slate-700">
                        {selected && (
                          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                      <svg className="h-3.5 w-3.5 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 2L3 7l2.5 11h9L17 7l-7-5z" />
                      </svg>
                      <span className="flex-1 truncate text-left text-slate-800">{r.title}</span>
                      <span className="shrink-0 text-xs text-slate-400">{r.count}</span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>

        <div ref={ownerMenuRef} className="relative">
          <button type="button" onClick={() => setOwnerMenuOpen((v) => !v)}
            className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-sm font-medium shadow-sm ${
              ownerFilter.length > 0
                ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-700"
                : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}>
            Owner{ownerFilter.length > 0 ? ` (${ownerFilter.length})` : ""}
            <svg className={`h-4 w-4 transition-transform ${ownerFilter.length > 0 ? "text-white/70" : "text-slate-400"} ${ownerMenuOpen ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
            </svg>
          </button>
          {ownerMenuOpen && (
            <div className="absolute right-0 top-full z-30 mt-1.5 w-64 rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
              <button type="button"
                onClick={() => { setOwnerFilter([]); setOwnerMenuOpen(false); }}
                className="flex w-full items-center px-3 py-2 text-sm text-slate-600 hover:bg-slate-50">
                Clear
              </button>
              <div className="my-1 border-t border-slate-100" />
              {ownerOptions.length === 0 ? (
                <p className="px-3 py-3 text-center text-xs text-slate-400">No owners assigned yet.</p>
              ) : (
                ownerOptions.map((o) => {
                  const selected = ownerFilter.includes(o.id);
                  return (
                    <button key={o.id} type="button" onClick={() => toggleOwnerFilter(o.id)}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-sm hover:bg-slate-50">
                      <span className="flex w-4 shrink-0 justify-center text-slate-700">
                        {selected && (
                          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                          </svg>
                        )}
                      </span>
                      <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${AVATAR_COLORS[o.id % AVATAR_COLORS.length]}`}>
                        {getInitials(o.full_name || o.email)}
                      </span>
                      <span className="flex-1 truncate text-left text-slate-800">{o.full_name || o.email}</span>
                      <span className="shrink-0 text-xs text-slate-400">{o.count}</span>
                    </button>
                  );
                })
              )}
            </div>
          )}
        </div>
        </div>
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
          <p className="text-sm font-semibold text-slate-700">
            {ownerFilter.length > 0 || rockFilter.length > 0
              ? "No KPIs match the selected filters"
              : lifeFilter === "snoozed" ? "No snoozed KPIs" : "No KPIs yet"}
          </p>
          <p className="mt-1 text-sm text-slate-400">
            {ownerFilter.length > 0 || rockFilter.length > 0
              ? "Adjust or clear the Owner / Rock filters to see more."
              : lifeFilter === "snoozed"
                ? "Snoozed KPIs will appear here."
                : canManage ? 'Click "+ New KPI" to add one.' : "Nothing here yet."}
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
                <th className="sticky right-0 z-10 w-16 border-l border-slate-200 bg-slate-50 py-3 pr-4" />
              </tr>
            </thead>
            <tbody>
              {(() => {
                const renderRow = (kpi) => {
                  const idx = rowIndexOf.get(kpi.id);
                  return (
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
                      onToggleSnooze={handleToggleSnooze}
                      onDragStart={() => setDragIdx(idx)}
                      onDragOver={() => setOverIdx(idx)}
                      onDrop={() => handleDrop(idx)}
                      onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                      onOwnerClick={(o) => toggleOwnerFilter(o.id)}
                      ownerSelected={Boolean(kpi.owner && ownerFilter.includes(kpi.owner.id))}
                    />
                  );
                };

                return (
                  <>
                    {ungroupedKpis.map(renderRow)}
                    {groupSections.map((section) => {
                      const { group } = section;
                      const isCollapsed = collapsedGroups.has(group.id);
                      return (
                        <Fragment key={`group-${group.id}`}>
                          {/* Group header row */}
                          <tr className="border-b border-slate-100 bg-slate-50/80">
                            <td className="py-3 pl-3 pr-1 w-6" />
                            <td className="py-3 pl-2 pr-3 w-16">
                              <button type="button" onClick={() => toggleGroupCollapse(group.id)}
                                title={isCollapsed ? "Expand group" : "Collapse group"}
                                className="flex h-6 w-6 items-center justify-center rounded text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-transform"
                                style={{ transform: isCollapsed ? "" : "rotate(90deg)" }}>
                                <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                                </svg>
                              </button>
                            </td>
                            <td className="py-3 pr-3" colSpan={2}>
                              <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                                  {group.formula === "average" ? "Avg" : "Sum"}
                                </span>
                                <span className="text-sm font-semibold text-slate-800">{group.name}</span>
                                <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
                                  {section.kpis.length} KPI{section.kpis.length === 1 ? "" : "s"}
                                </span>
                              </div>
                            </td>
                            <td className="py-3 pr-4 w-32 text-sm font-medium text-slate-600">
                              {groupAggregate(section, periods[0]?.key)?.toLocaleString() ?? <span className="text-slate-300">—</span>}
                            </td>
                            {periods.slice(1).map((p) => (
                              <td key={p.key} className="py-3 pr-4 w-28 text-sm font-medium text-slate-600">
                                {groupAggregate(section, p.key)?.toLocaleString() ?? <span className="text-slate-300">—</span>}
                              </td>
                            ))}
                            <td className="py-3 pr-4 w-16">
                              {canManage && (
                                <div className="relative">
                                  <button type="button"
                                    onClick={(e) => { e.stopPropagation(); setGroupMenuId(groupMenuId === group.id ? null : group.id); }}
                                    className="rounded p-1.5 text-slate-400 hover:bg-slate-200 hover:text-slate-600">
                                    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                                      <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
                                    </svg>
                                  </button>
                                  {groupMenuId === group.id && (
                                    <>
                                      <div className="fixed inset-0 z-10" onClick={() => setGroupMenuId(null)} />
                                      <div className="absolute right-0 top-8 z-20 w-40 rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                                        <button type="button"
                                          onClick={() => { setGroupMenuId(null); setEditingGroup(group); }}
                                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                                          Edit group
                                        </button>
                                        <button type="button" onClick={() => handleDeleteGroup(group)}
                                          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                                          Delete group
                                        </button>
                                      </div>
                                    </>
                                  )}
                                </div>
                              )}
                            </td>
                          </tr>
                          {!isCollapsed && section.kpis.map(renderRow)}
                        </Fragment>
                      );
                    })}
                  </>
                );
              })()}
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
          projects={projects}
          groups={groups}
          currentUser={user}
          editing={editing}
          onClose={() => { setShowModal(false); setEditing(null); }}
          onSave={handleSave}
          saving={saving}
          onGroupCreated={handleGroupCreated}
        />
      )}

      {editingGroup && (
        <KPIGroupModal
          group={editingGroup}
          onClose={() => setEditingGroup(null)}
          onSave={handleSaveGroup}
          saving={groupSaving}
        />
      )}

      {trendKpi && (
        <TrendModal kpi={trendKpi} view={view} onClose={() => setTrendKpi(null)} />
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
