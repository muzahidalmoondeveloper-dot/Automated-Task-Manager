import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { taskApi } from "../api/taskApi";
import { userApi } from "../api/userApi";
import { projectApi } from "../api/projectApi";
import { teamApi } from "../api/teamApi";
import { useAuth } from "../context/AuthContext";
import { useConfirm, usePrompt } from "../context/ConfirmContext";
import CelebrationOverlay from "../components/CelebrationOverlay";
import DatePicker from "../components/DatePicker";

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "todo",           label: "To Do"          },
  { value: "in_progress",   label: "In Progress"    },
  { value: "pending_review", label: "Pending Review" },
  { value: "done",           label: "Done"           },
];

const TEAM_MEMBER_STATUS_OPTIONS = [
  { value: "todo",         label: "To Do"       },
  { value: "in_progress", label: "In Progress" },
  { value: "done",         label: "Done"        },
];

const PRIORITY_OPTIONS = [
  { value: "high",   label: "High"   },
  { value: "medium", label: "Medium" },
  { value: "low",    label: "Low"    },
];

const initialForm = {
  name: "",
  start_date: "",
  due_date: "",
  assignee_id: "",
  project_id: "",
  team_id: "",
  status: "todo",
  priority: "medium",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(ds) {
  if (!ds) return "";
  return new Date(`${ds}T00:00:00`).toLocaleDateString();
}

function isOverdue(task) {
  if (!task.due_date || task.status === "done" || task.status === "pending_review") return false;
  return new Date(task.due_date) < new Date(new Date().toDateString());
}

function getStatusLabel(s) {
  return STATUS_OPTIONS.find((o) => o.value === s)?.label || s;
}

function StatusBadge({ status }) {
  const classes = {
    done:           "bg-green-100 text-green-700",
    pending_review: "bg-amber-100 text-amber-700",
    in_progress:    "bg-blue-100  text-blue-700",
    todo:           "bg-slate-100 text-slate-600",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${classes[status] || classes.todo}`}>
      {getStatusLabel(status)}
    </span>
  );
}

function PriorityBadge({ priority }) {
  const classes = {
    high:   "bg-red-100   text-red-700",
    medium: "bg-amber-100 text-amber-700",
    low:    "bg-green-100 text-green-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${classes[priority] || classes.medium}`}>
      {priority || "medium"}
    </span>
  );
}

function DueDateCell({ task }) {
  if (!task.due_date) return <span className="text-slate-400">—</span>;
  const overdue = isOverdue(task);
  return (
    <span className={overdue ? "font-semibold text-red-600" : "text-slate-700"}>
      {formatDate(task.due_date)}
      {overdue && <span className="ml-1 text-[10px] font-bold uppercase text-red-500">Overdue</span>}
    </span>
  );
}

function EmptyState({ message, icon = "📋" }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <span className="mb-3 text-4xl">{icon}</span>
      <p className="text-sm text-slate-500">{message}</p>
    </div>
  );
}

function ThreeDotsIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM18 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

function getMonthMatrix(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const start = new Date(first);
  start.setDate(start.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function toDateInputValue(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ─── Task card for mobile ─────────────────────────────────────────────────────

function TaskCard({ task, canManageTasks, isTeamMember, user, onEdit, onDelete, onStatusChange, onApprove, onAssignBack, reviewActionTaskId }) {
  const overdue = isOverdue(task);

  return (
    <div className={`rounded-xl border bg-white p-4 shadow-sm ${overdue ? "border-red-200" : "border-slate-200"}`}>
      <div className="flex items-start justify-between gap-2">
        <p className={`text-sm font-semibold leading-tight ${task.status === "done" ? "text-slate-400 line-through" : "text-slate-900"}`}>
          {task.name}
        </p>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <StatusBadge status={task.status} />
          <PriorityBadge priority={task.priority} />
        </div>
      </div>

      {task.review_note && (
        <p className="mt-2 rounded-lg bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
          Note: {task.review_note}
        </p>
      )}

      <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-500">
        {task.assignee && <p><span className="font-medium">Assignee:</span> {task.assignee.full_name}</p>}
        {task.project  && <p><span className="font-medium">Project:</span>  {task.project.name}</p>}
        {task.team     && <p><span className="font-medium">Team:</span>     {task.team.name}</p>}
        <p>
          <span className="font-medium">Start: </span>
          {task.start_date ? formatDate(task.start_date) : "—"}
        </p>
        <p>
          <span className="font-medium">Due: </span>
          {task.due_date ? (
            <span className={overdue ? "font-semibold text-red-600" : ""}>
              {formatDate(task.due_date)}{overdue && " ⚠"}
            </span>
          ) : "—"}
        </p>
      </div>

      {/* Actions */}
      {canManageTasks && task.status === "pending_review" ? (
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => onApprove(task)} disabled={reviewActionTaskId === task.id}
            className="flex-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60">
            Approve
          </button>
          <button type="button" onClick={() => onAssignBack(task)} disabled={reviewActionTaskId === task.id}
            className="flex-1 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-60">
            Assign Back
          </button>
        </div>
      ) : canManageTasks ? (
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={() => onEdit(task)}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
            Edit
          </button>
          <button type="button" onClick={() => onDelete(task)}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
            Delete
          </button>
        </div>
      ) : isTeamMember && task.assignee_id === user?.id && task.status !== "pending_review" && task.status !== "done" ? (
        <div className="mt-3">
          <select value={task.status} onChange={(e) => onStatusChange(task, e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs">
            {TEAM_MEMBER_STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      ) : null}
    </div>
  );
}

// ─── Filters bar ──────────────────────────────────────────────────────────────

function FiltersBar({ filters, onChange, onReset, isActive, extraFilters = null }) {
  return (
    <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {/* Search */}
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Search</label>
          <input
            value={filters.search || ""}
            onChange={(e) => onChange("search", e.target.value)}
            placeholder="Task name…"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-900"
          />
        </div>

        {/* Status */}
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Status</label>
          <select value={filters.status || "all"} onChange={(e) => onChange("status", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-900">
            <option value="all">All statuses</option>
            {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Priority */}
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Priority</label>
          <select value={filters.priority || "all"} onChange={(e) => onChange("priority", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-900">
            <option value="all">All priorities</option>
            {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {extraFilters}

        {/* Overdue toggle */}
        <div className="flex items-end">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
            <input
              type="checkbox"
              checked={filters.overdue || false}
              onChange={(e) => onChange("overdue", e.target.checked)}
              className="h-4 w-4 rounded border-slate-400 accent-red-500"
            />
            Overdue only
          </label>
        </div>

        {/* Reset */}
        <div className="flex items-end">
          <button type="button" onClick={onReset} disabled={!isActive}
            className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50">
            Reset filters
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Task table row (module-level so the reference is stable across renders) ──
// Keeping this inside TasksPage would create a new function on every render,
// making React treat it as a new component type and remount all rows — which
// destroys the focused button and scrolls the page to the top.

function TaskTableRow({
  task,
  reviewActionId,
  canManageTasks,
  isTeamMember,
  userId,
  onQuickStatus,
  onApprove,
  onAssignBack,
  onToggleMenu,
}) {
  const canChange = canManageTasks || (
    isTeamMember &&
    task.assignee_id === userId &&
    task.status !== "pending_review" &&
    task.status !== "done"
  );

  const statusOpts = canManageTasks
    ? STATUS_OPTIONS
    : (task.status === "pending_review" || task.status === "done")
      ? STATUS_OPTIONS.filter((o) => o.value === task.status)
      : TEAM_MEMBER_STATUS_OPTIONS;

  return (
    <tr className="hover:bg-slate-50/70">
      {/* Check circle */}
      <td className="px-4 py-4 align-middle">
        <button
          type="button"
          disabled={task.status === "pending_review" || (!canManageTasks && task.assignee_id !== userId)}
          onClick={() => onQuickStatus(task, task.status === "done" ? "todo" : "done")}
          className={
            task.status === "done"
              ? "flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs text-white"
              : task.status === "pending_review"
              ? "flex h-5 w-5 cursor-not-allowed items-center justify-center rounded-full border border-amber-400 text-xs text-amber-500"
              : "flex h-5 w-5 items-center justify-center rounded-full border border-slate-400 text-xs text-slate-400 hover:border-slate-900 hover:text-slate-900"
          }
        >✓</button>
      </td>

      {/* Name */}
      <td className="px-4 py-4 align-middle">
        <span className={task.status === "done" ? "font-medium text-slate-400 line-through" : "font-medium text-slate-900"}>
          {task.name}
        </span>
        {task.review_note && <p className="mt-1 text-xs text-amber-600">Note: {task.review_note}</p>}
      </td>

      {/* Priority */}
      <td className="px-4 py-4 align-middle"><PriorityBadge priority={task.priority} /></td>

      {/* Project */}
      <td className="px-4 py-4 align-middle text-slate-700">{task.project?.name || "—"}</td>

      {/* Assignee */}
      <td className="px-4 py-4 align-middle text-slate-700">{task.assignee?.full_name || "—"}</td>

      {/* Team */}
      <td className="px-4 py-4 align-middle text-slate-700">{task.team?.name || "—"}</td>

      {/* Start date */}
      <td className="px-4 py-4 align-middle text-slate-700">
        {task.start_date ? formatDate(task.start_date) : <span className="text-slate-400">—</span>}
      </td>

      {/* Due date */}
      <td className="px-4 py-4 align-middle"><DueDateCell task={task} /></td>

      {/* Status */}
      <td className="px-4 py-4 align-middle">
        {canChange ? (
          <select
            value={task.status}
            onChange={(e) => onQuickStatus(task, e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-900 focus:outline-none"
          >
            {statusOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        ) : (
          <StatusBadge status={task.status} />
        )}
      </td>

      {/* Actions */}
      {canManageTasks && (
        <td className="px-4 py-4 text-right align-middle">
          {task.status === "pending_review" ? (
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => onApprove(task)} disabled={reviewActionId === task.id}
                className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60">
                Approve
              </button>
              <button type="button" onClick={() => onAssignBack(task)} disabled={reviewActionId === task.id}
                className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-60">
                Assign Back
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => onToggleMenu(e, task.id)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
            >
              <ThreeDotsIcon />
            </button>
          )}
        </td>
      )}
    </tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TasksPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const prompt = usePrompt();

  const canManageTasks = user?.role === "owner" || user?.role === "admin" || user?.role === "team_manager";
  const isTeamMember   = user?.role === "team_member";

  // Primary view tab
  const [primaryTab, setPrimaryTab] = useState("my_tasks");

  // Secondary view (within My Tasks)
  const [myViewMode, setMyViewMode] = useState("list");

  // Secondary view (within All Tasks)
  const [viewMode, setViewMode] = useState("list");

  // Data
  const [myTasks,  setMyTasks]  = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [users,    setUsers]    = useState([]);
  const [projects, setProjects] = useState([]);
  const [teams,    setTeams]    = useState([]);

  // Loading / error
  const [myTasksLoading,  setMyTasksLoading]  = useState(true);
  const [allTasksLoading, setAllTasksLoading] = useState(false);
  const [myTasksError,    setMyTasksError]    = useState("");
  const [allTasksError,   setAllTasksError]   = useState("");

  // My Tasks filters
  const [myFilters, setMyFilters] = useState({ search: "", status: "all", priority: "all", overdue: false });

  // All Tasks filters
  const [allFilters, setAllFilters] = useState({
    search: "", status: "all", priority: "all", assignee: "all",
    project: "all", team: "all", overdue: false, dueDateFrom: "", dueDateTo: "",
  });

  // Form / modal state (shared)
  const [formData,       setFormData]       = useState(initialForm);
  const [editingTaskId,  setEditingTaskId]  = useState(null);
  const [isModalOpen,    setIsModalOpen]    = useState(false);
  const [isSubmitting,   setIsSubmitting]   = useState(false);
  const [formError,      setFormError]      = useState("");
  const [openMenuId,     setOpenMenuId]     = useState(null);
  const [menuPos,        setMenuPos]        = useState(null);
  const [reviewActionId, setReviewActionId] = useState(null);
  const [celebrationData,setCelebrationData]= useState(null);

  // Calendar
  const [calDate, setCalDate] = useState(new Date());

  const isEditing = editingTaskId !== null;

  // ─── Data loading ───────────────────────────────────────────────────────────

  async function loadMyTasks() {
    setMyTasksLoading(true);
    setMyTasksError("");
    try {
      const data = await taskApi.listMy();
      setMyTasks(data);
    } catch (err) {
      setMyTasksError(err.message || "Unable to load your tasks.");
    } finally {
      setMyTasksLoading(false);
    }
  }

  async function loadAllTasks() {
    setAllTasksLoading(true);
    setAllTasksError("");
    try {
      const data = await taskApi.list();
      setAllTasks(data);
    } catch (err) {
      setAllTasksError(err.message || "Unable to load all tasks.");
    } finally {
      setAllTasksLoading(false);
    }
  }

  async function loadFilterData() {
    try {
      const [userData, projectData, teamData] = await Promise.all([
        userApi.list(),
        projectApi.list(),
        teamApi.list(),
      ]);
      setUsers(userData);
      setProjects(projectData);
      setTeams(teamData);
    } catch {
      // non-critical
    }
  }

  useEffect(() => {
    loadMyTasks();
    if (canManageTasks) {
      loadAllTasks();
      loadFilterData();
    }
  }, []);  // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Filter logic ───────────────────────────────────────────────────────────

  function applyFilters(tasks, filters, { includeAssignee = false, includeProject = false, includeTeam = false } = {}) {
    const q = (filters.search || "").trim().toLowerCase();
    const today = new Date(new Date().toDateString());

    return tasks.filter((t) => {
      if (q) {
        const text = [t.name, t.project?.name, t.assignee?.full_name, t.team?.name].filter(Boolean).join(" ").toLowerCase();
        if (!text.includes(q)) return false;
      }
      if (filters.status && filters.status !== "all" && t.status !== filters.status) return false;
      if (filters.priority && filters.priority !== "all" && (t.priority || "medium") !== filters.priority) return false;
      if (includeAssignee && filters.assignee && filters.assignee !== "all" && String(t.assignee_id) !== filters.assignee) return false;
      if (includeProject  && filters.project  && filters.project  !== "all" && String(t.project_id)  !== filters.project)  return false;
      if (includeTeam     && filters.team     && filters.team     !== "all" && String(t.team_id)     !== filters.team)     return false;
      if (filters.dueDateFrom && t.due_date && t.due_date < filters.dueDateFrom) return false;
      if (filters.dueDateTo   && t.due_date && t.due_date > filters.dueDateTo)   return false;
      if (filters.overdue && !(t.due_date && new Date(t.due_date) < today && t.status !== "done" && t.status !== "pending_review")) return false;
      return true;
    });
  }

  const filteredMyTasks = useMemo(() => applyFilters(myTasks, myFilters), [myTasks, myFilters]);

  const filteredAllTasks = useMemo(
    () => applyFilters(allTasks, allFilters, { includeAssignee: true, includeProject: true, includeTeam: true }),
    [allTasks, allFilters]
  );

  const groupedMyByStatus = useMemo(() =>
    STATUS_OPTIONS.reduce((acc, s) => { acc[s.value] = filteredMyTasks.filter((t) => t.status === s.value); return acc; }, {}),
    [filteredMyTasks]
  );

  const myTasksByDueDate = useMemo(() =>
    filteredMyTasks.reduce((acc, t) => {
      if (!t.due_date) return acc;
      (acc[t.due_date] = acc[t.due_date] || []).push(t);
      return acc;
    }, {}),
    [filteredMyTasks]
  );

  const groupedByStatus = useMemo(() =>
    STATUS_OPTIONS.reduce((acc, s) => { acc[s.value] = filteredAllTasks.filter((t) => t.status === s.value); return acc; }, {}),
    [filteredAllTasks]
  );

  const tasksByDueDate = useMemo(() =>
    filteredAllTasks.reduce((acc, t) => {
      if (!t.due_date) return acc;
      (acc[t.due_date] = acc[t.due_date] || []).push(t);
      return acc;
    }, {}),
    [filteredAllTasks]
  );

  const [myCalDate, setMyCalDate] = useState(new Date());
  const myCalDays = useMemo(() => getMonthMatrix(myCalDate.getFullYear(), myCalDate.getMonth()), [myCalDate]);

  const calDays = useMemo(() => getMonthMatrix(calDate.getFullYear(), calDate.getMonth()), [calDate]);

  // ─── Filter options (for All Tasks dropdowns) ───────────────────────────────

  const assigneeOptions = useMemo(() => {
    const map = new Map();
    allTasks.forEach((t) => { if (t.assignee_id && t.assignee?.full_name) map.set(String(t.assignee_id), t.assignee.full_name); });
    users.forEach((u) => map.set(String(u.id), u.full_name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [allTasks, users]);

  const projectOptions = useMemo(() => {
    const map = new Map();
    allTasks.forEach((t) => { if (t.project_id && t.project?.name) map.set(String(t.project_id), t.project.name); });
    projects.forEach((p) => map.set(String(p.id), p.name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [allTasks, projects]);

  const teamOptions = useMemo(() => {
    const map = new Map();
    allTasks.forEach((t) => { if (t.team_id && t.team?.name) map.set(String(t.team_id), t.team.name); });
    teams.forEach((t) => map.set(String(t.id), t.name));
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [allTasks, teams]);

  const assignees = useMemo(() => users.filter((u) => ["owner", "admin", "team_manager", "team_member"].includes(u.role)), [users]);

  // ─── Helpers ────────────────────────────────────────────────────────────────

  function updateTaskInLists(updated) {
    setMyTasks((p) => p.map((t) => (t.id === updated.id ? updated : t)));
    setAllTasks((p) => p.map((t) => (t.id === updated.id ? updated : t)));
  }

  function removeTaskFromLists(id) {
    setMyTasks((p) => p.filter((t) => t.id !== id));
    setAllTasks((p) => p.filter((t) => t.id !== id));
  }

  function getStatusOptionsForTask(task) {
    if (canManageTasks) return STATUS_OPTIONS;
    if (task.status === "pending_review" || task.status === "done") return STATUS_OPTIONS.filter((o) => o.value === task.status);
    return TEAM_MEMBER_STATUS_OPTIONS;
  }

  function canChangeStatus(task) {
    if (canManageTasks) return true;
    return isTeamMember && task.assignee_id === user?.id && task.status !== "pending_review" && task.status !== "done";
  }

  // ─── Actions ────────────────────────────────────────────────────────────────

  function handleChange(e) {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
  }

  function resetForm() {
    setFormData(initialForm);
    setEditingTaskId(null);
    setFormError("");
  }

  function openCreateModal() {
    resetForm();
    setOpenMenuId(null);
    setIsModalOpen(true);
  }

  function closeModal() {
    resetForm();
    setIsModalOpen(false);
  }

  function handleEdit(task) {
    setOpenMenuId(null);
    setEditingTaskId(task.id);
    setFormData({
      name:        task.name || "",
      start_date:  task.start_date || "",
      due_date:    task.due_date || "",
      assignee_id: task.assignee_id ? String(task.assignee_id) : "",
      project_id:  task.project_id  ? String(task.project_id)  : "",
      team_id:     task.team_id     ? String(task.team_id)     : "",
      status:      task.status || "todo",
      priority:    task.priority || "medium",
    });
    setFormError("");
    setIsModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setIsSubmitting(true);
    setFormError("");
    try {
      const payload = {
        name:        formData.name,
        start_date:  formData.start_date || null,
        due_date:    formData.due_date   || null,
        // New tasks are created unassigned; they land in the team's To-Do list.
        assignee_id: isEditing && formData.assignee_id ? Number(formData.assignee_id) : null,
        project_id:  formData.project_id  ? Number(formData.project_id)  : null,
        team_id:     formData.team_id     ? Number(formData.team_id)     : null,
        status:      formData.status,
        priority:    formData.priority,
      };

      if (isEditing) {
        const updated = await taskApi.update(editingTaskId, payload);
        updateTaskInLists(updated);
        toast.success("Task updated.");
      } else {
        const created = await taskApi.create(payload);
        if (created.assignee_id === user?.id) setMyTasks((p) => [created, ...p]);
        setAllTasks((p) => [created, ...p]);
        toast.success("Task created.");
      }
      closeModal();
    } catch (err) {
      setFormError(err.message || "Unable to save task.");
      toast.error(err.message || "Unable to save task.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(task) {
    setOpenMenuId(null);
    if (!(await confirm({ message: `Delete "${task.name}"?`, tone: "danger", confirmLabel: "Delete" }))) return;
    try {
      await taskApi.delete(task.id);
      removeTaskFromLists(task.id);
      if (editingTaskId === task.id) closeModal();
      toast.success("Task deleted.");
    } catch (err) {
      toast.error(err.message || "Unable to delete task.");
    }
  }

  async function quickStatusUpdate(task, newStatus) {
    setOpenMenuId(null);
    try {
      const updated = await taskApi.updateStatus(task.id, newStatus);
      updateTaskInLists(updated);
      if (updated.status === "done") {
        const isSelf = task.assignee_id === user?.id;
        setCelebrationData({ taskName: updated.name, completedByName: isSelf ? null : (task.assignee?.full_name || null) });
      } else {
        toast.success("Status updated.");
      }
    } catch (err) {
      toast.error(err.message || "Unable to update status.");
    }
  }

  async function approveTask(task) {
    setReviewActionId(task.id);
    setOpenMenuId(null);
    try {
      const updated = await taskApi.approve(task.id);
      updateTaskInLists(updated);
      setCelebrationData({ taskName: updated.name, completedByName: task.assignee?.full_name || null });
    } catch (err) {
      toast.error(err.message || "Unable to approve task.");
    } finally {
      setReviewActionId(null);
    }
  }

  async function assignBackTask(task) {
    const note = await prompt({
      title: "Assign Back",
      message: "Reason for assigning back (optional):",
      confirmLabel: "Assign Back",
      multiline: true,
    });
    if (note === null) return;
    setReviewActionId(task.id);
    setOpenMenuId(null);
    try {
      const updated = await taskApi.assignBack(task.id, { note: note || "Assigned back for more work." });
      updateTaskInLists(updated);
      toast.success("Task assigned back.");
    } catch (err) {
      toast.error(err.message || "Unable to assign back.");
    } finally {
      setReviewActionId(null);
    }
  }

  // ─── My Tasks filter change ──────────────────────────────────────────────────
  function setMyFilter(key, val) { setMyFilters((p) => ({ ...p, [key]: val })); }
  function resetMyFilters() { setMyFilters({ search: "", status: "all", priority: "all", overdue: false }); }
  const myFiltersActive = myFilters.search || myFilters.status !== "all" || myFilters.priority !== "all" || myFilters.overdue;

  // ─── All Tasks filter change ─────────────────────────────────────────────────
  function setAllFilter(key, val) { setAllFilters((p) => ({ ...p, [key]: val })); }
  function resetAllFilters() {
    setAllFilters({ search: "", status: "all", priority: "all", assignee: "all", project: "all", team: "all", overdue: false, dueDateFrom: "", dueDateTo: "" });
  }
  const allFiltersActive = allFilters.search || allFilters.status !== "all" || allFilters.priority !== "all" ||
    allFilters.assignee !== "all" || allFilters.project !== "all" || allFilters.team !== "all" ||
    allFilters.overdue || allFilters.dueDateFrom || allFilters.dueDateTo;

  // ─── Menu helpers ────────────────────────────────────────────────────────────

  function handleMenuToggle(e, taskId) {
    e.stopPropagation();
    if (openMenuId === taskId) {
      setOpenMenuId(null);
      setMenuPos(null);
    } else {
      const rect = e.currentTarget.getBoundingClientRect();
      setMenuPos({ top: rect.bottom + 4, right: window.innerWidth - rect.right });
      setOpenMenuId(taskId);
    }
  }

  const openMenuTask = useMemo(() => {
    if (!openMenuId) return null;
    return myTasks.find((t) => t.id === openMenuId) || allTasks.find((t) => t.id === openMenuId) || null;
  }, [openMenuId, myTasks, allTasks]);

  useEffect(() => {
    if (!openMenuId) return;
    const close = () => { setOpenMenuId(null); setMenuPos(null); };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openMenuId]);

  // ─── Tabs ────────────────────────────────────────────────────────────────────

  const primaryTabs = [
    { key: "my_tasks",  label: "My Tasks"  },
    ...(canManageTasks ? [{ key: "all_tasks", label: "All Tasks" }] : []),
  ];

  const viewModes = [
    { key: "list",     label: "List"     },
    { key: "board",    label: "Board"    },
    { key: "calendar", label: "Calendar" },
  ];

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="w-full">
      {/* Page header */}
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Tasks</h1>
          <p className="mt-1 text-sm text-slate-500">Create, assign, and track project tasks.</p>
        </div>
        {canManageTasks && (
          <button type="button" onClick={openCreateModal}
            className="w-fit rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
            + Add Task
          </button>
        )}
      </div>

      {/* Primary tabs */}
      <div className="mb-6 border-b border-slate-200">
        <nav className="flex gap-1">
          {primaryTabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => { setPrimaryTab(tab.key); setOpenMenuId(null); }}
              className={
                primaryTab === tab.key
                  ? "border-b-2 border-slate-900 px-4 pb-3 pt-1 text-sm font-semibold text-slate-900"
                  : "px-4 pb-3 pt-1 text-sm font-semibold text-slate-500 hover:text-slate-900"
              }
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* ── MY TASKS ─────────────────────────────────────────────────────────── */}
      {primaryTab === "my_tasks" && (
        <>
          {/* View mode toggle */}
          <div className="mb-5 flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm w-fit">
            {viewModes.map((vm) => (
              <button
                key={vm.key}
                type="button"
                onClick={() => setMyViewMode(vm.key)}
                className={
                  myViewMode === vm.key
                    ? "rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white"
                    : "rounded-lg px-4 py-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900"
                }
              >
                {vm.label}
              </button>
            ))}
          </div>

          {/* ── LIST ── */}
          {myViewMode === "list" && (
            <>
              <FiltersBar
                filters={myFilters}
                onChange={setMyFilter}
                onReset={resetMyFilters}
                isActive={myFiltersActive}
              />

              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  Showing <span className="font-semibold text-slate-900">{filteredMyTasks.length}</span> of{" "}
                  <span className="font-semibold text-slate-900">{myTasks.length}</span> tasks
                </p>
                <button type="button" onClick={loadMyTasks}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                  Refresh
                </button>
              </div>

              {myTasksLoading ? (
                <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">Loading your tasks…</div>
              ) : myTasksError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{myTasksError}</div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1100px] text-sm">
                        <thead className="bg-slate-50">
                          <tr className="border-b border-slate-200">
                            <th className="w-10 px-4 py-3" />
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">Task Name</th>
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">Priority</th>
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">Project</th>
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">Team</th>
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">Start Date</th>
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">Due Date</th>
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                            <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {filteredMyTasks.length ? filteredMyTasks.map((task) => (
                            <tr key={task.id} className="hover:bg-slate-50/70">
                              <td className="px-4 py-4 align-middle">
                                <button type="button"
                                  disabled={task.status === "pending_review"}
                                  onClick={() => quickStatusUpdate(task, task.status === "done" ? "todo" : "done")}
                                  className={
                                    task.status === "done"
                                      ? "flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-xs text-white"
                                      : task.status === "pending_review"
                                      ? "flex h-5 w-5 cursor-not-allowed items-center justify-center rounded-full border border-amber-400 text-amber-500"
                                      : "flex h-5 w-5 items-center justify-center rounded-full border border-slate-400 text-slate-400 hover:border-slate-900"
                                  }>✓</button>
                              </td>
                              <td className="px-4 py-4 align-middle">
                                <span className={task.status === "done" ? "font-medium text-slate-400 line-through" : "font-medium text-slate-900"}>
                                  {task.name}
                                </span>
                                {task.review_note && <p className="mt-1 text-xs text-amber-600">Note: {task.review_note}</p>}
                              </td>
                              <td className="px-4 py-4 align-middle"><PriorityBadge priority={task.priority} /></td>
                              <td className="px-4 py-4 align-middle text-slate-700">{task.project?.name || "—"}</td>
                              <td className="px-4 py-4 align-middle text-slate-700">{task.team?.name || "—"}</td>
                              <td className="px-4 py-4 align-middle text-slate-700">
                                {task.start_date ? formatDate(task.start_date) : <span className="text-slate-400">—</span>}
                              </td>
                              <td className="px-4 py-4 align-middle"><DueDateCell task={task} /></td>
                              <td className="px-4 py-4 align-middle">
                                {canChangeStatus(task) ? (
                                  <select value={task.status} onChange={(e) => quickStatusUpdate(task, e.target.value)}
                                    className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:border-slate-900 focus:outline-none">
                                    {getStatusOptionsForTask(task).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                  </select>
                                ) : (
                                  <StatusBadge status={task.status} />
                                )}
                              </td>
                              <td className="px-4 py-4 text-right align-middle">
                                {canManageTasks && (
                                  task.status === "pending_review" ? (
                                    <div className="flex justify-end gap-2">
                                      <button type="button" onClick={() => approveTask(task)} disabled={reviewActionId === task.id}
                                        className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60">
                                        Approve
                                      </button>
                                      <button type="button" onClick={() => assignBackTask(task)} disabled={reviewActionId === task.id}
                                        className="rounded-lg border border-amber-300 px-3 py-2 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-60">
                                        Assign Back
                                      </button>
                                    </div>
                                  ) : (
                                    <button type="button" onClick={(e) => handleMenuToggle(e, task.id)}
                                      className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
                                      <ThreeDotsIcon />
                                    </button>
                                  )
                                )}
                              </td>
                            </tr>
                          )) : (
                            <tr>
                              <td colSpan={9}>
                                <EmptyState message={myFiltersActive ? "No tasks match your filters." : "No tasks assigned to you yet."} />
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Mobile cards */}
                  <div className="space-y-3 md:hidden">
                    {filteredMyTasks.length ? filteredMyTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        canManageTasks={false}
                        isTeamMember={isTeamMember}
                        user={user}
                        onStatusChange={quickStatusUpdate}
                        onApprove={approveTask}
                        onAssignBack={assignBackTask}
                        reviewActionTaskId={reviewActionId}
                      />
                    )) : (
                      <EmptyState message={myFiltersActive ? "No tasks match your filters." : "No tasks assigned to you yet."} />
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {/* ── BOARD ── */}
          {myViewMode === "board" && (
            myTasksLoading ? (
              <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">Loading…</div>
            ) : (
              <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {STATUS_OPTIONS.map((s) => (
                  <div key={s.value} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h2 className="mb-4 text-sm font-semibold text-slate-700">
                      {s.label}
                      <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
                        {groupedMyByStatus[s.value]?.length || 0}
                      </span>
                    </h2>
                    <div className="space-y-3">
                      {groupedMyByStatus[s.value]?.map((task) => (
                        <div key={task.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                          <h3 className={task.status === "done" ? "text-sm font-medium text-slate-400 line-through" : "text-sm font-medium text-slate-900"}>
                            {task.name}
                          </h3>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <StatusBadge status={task.status} />
                            <PriorityBadge priority={task.priority} />
                          </div>
                          <p className="mt-2 text-xs text-slate-500">Project: {task.project?.name || "—"}</p>
                          <p className="mt-1 text-xs text-slate-500">Team: {task.team?.name || "—"}</p>
                          <p className="mt-1 text-xs"><DueDateCell task={task} /></p>
                          {task.review_note && (
                            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{task.review_note}</p>
                          )}
                          {canChangeStatus(task) && task.status !== "pending_review" && task.status !== "done" && (
                            <div className="mt-3">
                              <select value={task.status} onChange={(e) => quickStatusUpdate(task, e.target.value)}
                                className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-700 focus:border-slate-900 focus:outline-none">
                                {getStatusOptionsForTask(task).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                              </select>
                            </div>
                          )}
                        </div>
                      ))}
                      {!groupedMyByStatus[s.value]?.length && (
                        <p className="rounded-xl bg-white px-4 py-5 text-sm text-slate-400">No tasks here.</p>
                      )}
                    </div>
                  </div>
                ))}
              </section>
            )
          )}

          {/* ── CALENDAR ── */}
          {myViewMode === "calendar" && (
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setMyCalDate(new Date(myCalDate.getFullYear(), myCalDate.getMonth() - 1, 1))}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">‹</button>
                  <button type="button" onClick={() => setMyCalDate(new Date())}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">Today</button>
                  <button type="button" onClick={() => setMyCalDate(new Date(myCalDate.getFullYear(), myCalDate.getMonth() + 1, 1))}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">›</button>
                </div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {myCalDate.toLocaleString("default", { month: "long", year: "numeric" })}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[700px]">
                  <div className="grid grid-cols-7 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                    {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
                      <div key={d} className="border-r border-slate-200 p-3">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {myCalDays.map((day) => {
                      const key = toDateInputValue(day);
                      const dayTasks = myTasksByDueDate[key] || [];
                      const isCurrent = day.getMonth() === myCalDate.getMonth();
                      return (
                        <div key={key} className={`min-h-28 border-r border-b border-slate-200 p-2 ${isCurrent ? "" : "bg-slate-50 text-slate-400"}`}>
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-semibold">{day.getDate()}</span>
                            {dayTasks.length > 0 && (
                              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">{dayTasks.length}</span>
                            )}
                          </div>
                          <div className="space-y-1">
                            {dayTasks.slice(0, 3).map((task) => (
                              <div key={task.id}
                                className={
                                  task.status === "pending_review" ? "block w-full truncate rounded bg-amber-100 px-2 py-1 text-left text-xs font-medium text-amber-900"
                                  : task.status === "done" ? "block w-full truncate rounded bg-green-100 px-2 py-1 text-left text-xs font-medium text-green-900 line-through"
                                  : "block w-full truncate rounded bg-teal-100 px-2 py-1 text-left text-xs font-medium text-teal-900"
                                }
                              >{task.name}</div>
                            ))}
                            {dayTasks.length > 3 && <p className="text-xs text-slate-500">+{dayTasks.length - 3} more</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* ── ALL TASKS ────────────────────────────────────────────────────────── */}
      {primaryTab === "all_tasks" && canManageTasks && (
        <>
          {/* View mode toggle (List / Board / Calendar) */}
          <div className="mb-5 flex items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 shadow-sm w-fit">
            {viewModes.map((vm) => (
              <button
                key={vm.key}
                type="button"
                onClick={() => setViewMode(vm.key)}
                className={
                  viewMode === vm.key
                    ? "rounded-lg bg-slate-900 px-4 py-1.5 text-sm font-semibold text-white"
                    : "rounded-lg px-4 py-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900"
                }
              >
                {vm.label}
              </button>
            ))}
          </div>

          {viewMode === "list" && (
            <>
              <FiltersBar
                filters={allFilters}
                onChange={setAllFilter}
                onReset={resetAllFilters}
                isActive={allFiltersActive}
                extraFilters={
                  <>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Assignee</label>
                      <select value={allFilters.assignee} onChange={(e) => setAllFilter("assignee", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-900">
                        <option value="all">All assignees</option>
                        {assigneeOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Project</label>
                      <select value={allFilters.project} onChange={(e) => setAllFilter("project", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-900">
                        <option value="all">All projects</option>
                        {projectOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Team</label>
                      <select value={allFilters.team} onChange={(e) => setAllFilter("team", e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-900">
                        <option value="all">All teams</option>
                        {teamOptions.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Due From</label>
                      <DatePicker value={allFilters.dueDateFrom} onChange={(e) => setAllFilter("dueDateFrom", e.target.value)} />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">Due To</label>
                      <DatePicker value={allFilters.dueDateTo} onChange={(e) => setAllFilter("dueDateTo", e.target.value)} />
                    </div>
                  </>
                }
              />

              <div className="mb-4 flex items-center justify-between">
                <p className="text-sm text-slate-500">
                  Showing <span className="font-semibold text-slate-900">{filteredAllTasks.length}</span> of{" "}
                  <span className="font-semibold text-slate-900">{allTasks.length}</span> tasks
                </p>
                <button type="button" onClick={loadAllTasks}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50">
                  Refresh
                </button>
              </div>

              {allTasksLoading ? (
                <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">Loading tasks…</div>
              ) : allTasksError ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{allTasksError}</div>
              ) : (
                <>
                  {/* Desktop table */}
                  <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[1100px] text-sm">
                        <thead className="bg-slate-50">
                          <tr className="border-b border-slate-200">
                            <th className="w-10 px-4 py-3" />
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">Task Name</th>
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">Priority</th>
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">Project</th>
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">Assignee</th>
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">Team</th>
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">Start Date</th>
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">Due Date</th>
                            <th className="px-4 py-3 text-left font-semibold text-slate-700">Status</th>
                            <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                          {filteredAllTasks.length ? filteredAllTasks.map((task) => (
                            <TaskTableRow
                              key={task.id}
                              task={task}
                              reviewActionId={reviewActionId}
                              canManageTasks={canManageTasks}
                              isTeamMember={isTeamMember}
                              userId={user?.id}
                              onQuickStatus={quickStatusUpdate}
                              onApprove={approveTask}
                              onAssignBack={assignBackTask}
                              onToggleMenu={handleMenuToggle}
                            />
                          )) : (
                            <tr>
                              <td colSpan={10}>
                                <EmptyState message={allFiltersActive ? "No tasks match your filters." : "No tasks yet. Create one above."} />
                              </td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Mobile cards */}
                  <div className="space-y-3 md:hidden">
                    {filteredAllTasks.length ? filteredAllTasks.map((task) => (
                      <TaskCard
                        key={task.id}
                        task={task}
                        canManageTasks={canManageTasks}
                        isTeamMember={isTeamMember}
                        user={user}
                        onEdit={handleEdit}
                        onDelete={handleDelete}
                        onStatusChange={quickStatusUpdate}
                        onApprove={approveTask}
                        onAssignBack={assignBackTask}
                        reviewActionTaskId={reviewActionId}
                      />
                    )) : (
                      <EmptyState message={allFiltersActive ? "No tasks match your filters." : "No tasks yet."} />
                    )}
                  </div>
                </>
              )}
            </>
          )}

          {/* ── BOARD view ─────────────────────────────────────────────────── */}
          {viewMode === "board" && (
            allTasksLoading ? (
              <div className="rounded-2xl bg-white p-8 text-center text-sm text-slate-500 shadow-sm">Loading…</div>
            ) : (
              <section className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
                {STATUS_OPTIONS.map((s) => (
                  <div key={s.value} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <h2 className="mb-4 text-sm font-semibold text-slate-700">
                      {s.label}
                      <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
                        {groupedByStatus[s.value]?.length || 0}
                      </span>
                    </h2>
                    <div className="space-y-3">
                      {groupedByStatus[s.value]?.map((task) => (
                        <div key={task.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className={task.status === "done" ? "text-sm font-medium text-slate-400 line-through" : "text-sm font-medium text-slate-900"}>
                              {task.name}
                            </h3>
                          </div>
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            <StatusBadge status={task.status} />
                            <PriorityBadge priority={task.priority} />
                          </div>
                          <p className="mt-2 text-xs text-slate-500">Project: {task.project?.name || "—"}</p>
                          <p className="mt-1 text-xs text-slate-500">Assignee: {task.assignee?.full_name || "—"}</p>
                          <p className="mt-1 text-xs text-slate-500">Team: {task.team?.name || "—"}</p>
                          <p className="mt-1 text-xs"><DueDateCell task={task} /></p>
                          {task.review_note && (
                            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-700">{task.review_note}</p>
                          )}
                          {task.status === "pending_review" ? (
                            <div className="mt-3 flex gap-2">
                              <button type="button" onClick={() => approveTask(task)} disabled={reviewActionId === task.id}
                                className="flex-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-60">
                                Approve
                              </button>
                              <button type="button" onClick={() => assignBackTask(task)} disabled={reviewActionId === task.id}
                                className="flex-1 rounded-lg border border-amber-300 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-50 disabled:opacity-60">
                                Assign Back
                              </button>
                            </div>
                          ) : (
                            <div className="mt-3 flex gap-2">
                              <button type="button" onClick={() => handleEdit(task)}
                                className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50">
                                Edit
                              </button>
                              <button type="button" onClick={() => handleDelete(task)}
                                className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50">
                                Delete
                              </button>
                            </div>
                          )}
                        </div>
                      ))}
                      {!groupedByStatus[s.value]?.length && (
                        <p className="rounded-xl bg-white px-4 py-5 text-sm text-slate-400">No tasks here.</p>
                      )}
                    </div>
                  </div>
                ))}
              </section>
            )
          )}

          {/* ── CALENDAR view ──────────────────────────────────────────────── */}
          {viewMode === "calendar" && (
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() - 1, 1))}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">‹</button>
                  <button type="button" onClick={() => setCalDate(new Date())}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">Today</button>
                  <button type="button" onClick={() => setCalDate(new Date(calDate.getFullYear(), calDate.getMonth() + 1, 1))}
                    className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50">›</button>
                </div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {calDate.toLocaleString("default", { month: "long", year: "numeric" })}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <div className="min-w-[700px]">
                  <div className="grid grid-cols-7 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                    {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((d) => (
                      <div key={d} className="border-r border-slate-200 p-3">{d}</div>
                    ))}
                  </div>
                  <div className="grid grid-cols-7">
                    {calDays.map((day) => {
                      const key = toDateInputValue(day);
                      const dayTasks = tasksByDueDate[key] || [];
                      const isCurrent = day.getMonth() === calDate.getMonth();
                      return (
                        <div key={key} className={`min-h-28 border-r border-b border-slate-200 p-2 ${isCurrent ? "" : "bg-slate-50 text-slate-400"}`}>
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-sm font-semibold">{day.getDate()}</span>
                            {dayTasks.length > 0 && (
                              <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">{dayTasks.length}</span>
                            )}
                          </div>
                          <div className="space-y-1">
                            {dayTasks.slice(0, 3).map((task) => (
                              <button key={task.id} type="button" onClick={() => handleEdit(task)}
                                className={
                                  task.status === "pending_review" ? "block w-full truncate rounded bg-amber-100 px-2 py-1 text-left text-xs font-medium text-amber-900"
                                  : task.status === "done" ? "block w-full truncate rounded bg-green-100 px-2 py-1 text-left text-xs font-medium text-green-900 line-through"
                                  : "block w-full truncate rounded bg-teal-100 px-2 py-1 text-left text-xs font-medium text-teal-900"
                                }
                              >{task.name}</button>
                            ))}
                            {dayTasks.length > 3 && <p className="text-xs text-slate-500">+{dayTasks.length - 3} more</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {/* Fixed-position three-dot dropdown — escapes overflow:hidden clipping */}
      {openMenuTask && menuPos && (
        <div
          className="fixed z-50 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg"
          style={{ top: menuPos.top, right: menuPos.right }}
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" onClick={() => { setMenuPos(null); handleEdit(openMenuTask); }}
            className="block w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50">
            Edit
          </button>
          <button type="button" onClick={() => { setMenuPos(null); handleDelete(openMenuTask); }}
            className="block w-full px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50">
            Delete
          </button>
        </div>
      )}

      {/* Celebration overlay */}
      {celebrationData && (
        <CelebrationOverlay
          taskName={celebrationData.taskName}
          completedByName={celebrationData.completedByName}
          onDismiss={() => setCelebrationData(null)}
        />
      )}

      {/* ── Task modal ───────────────────────────────────────────────────────── */}
      {canManageTasks && isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{isEditing ? "Edit Task" : "Create Task"}</h2>
                <p className="mt-1 text-sm text-slate-500">{isEditing ? "Update this task's details." : "Create a new task. A team can be assigned now or later."}</p>
              </div>
              <button type="button" onClick={closeModal}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100">✕</button>
            </div>

            {formError && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{formError}</div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Task name *</label>
                <input name="name" value={formData.name} onChange={handleChange} required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Priority</label>
                  <select name="priority" value={formData.priority} onChange={handleChange}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    {PRIORITY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Status</label>
                  <select name="status" value={formData.status} onChange={handleChange}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Start date</label>
                  <DatePicker name="start_date" value={formData.start_date} onChange={handleChange} />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Due date</label>
                  <DatePicker name="due_date" value={formData.due_date} onChange={handleChange} />
                </div>
              </div>

              {/* Assignee is set later (e.g. when editing) — new tasks land
                  unassigned in the selected team's To-Do list. */}
              {isEditing && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Assignee</label>
                  <select name="assignee_id" value={formData.assignee_id} onChange={handleChange}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                    <option value="">Select assignee</option>
                    {assignees.map((a) => <option key={a.id} value={a.id}>{a.full_name} — {a.role}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Project</label>
                <select name="project_id" value={formData.project_id} onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="">Select project</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Team</label>
                <select name="team_id" value={formData.team_id} onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm">
                  <option value="">Select team</option>
                  {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={closeModal}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
                <button type="submit" disabled={isSubmitting}
                  className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60">
                  {isSubmitting ? "Saving…" : isEditing ? "Update Task" : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
