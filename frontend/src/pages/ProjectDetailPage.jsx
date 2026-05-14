import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";

import { projectApi } from "../api/projectApi";
import { taskApi } from "../api/taskApi";
import { userApi } from "../api/userApi";
import { teamApi } from "../api/teamApi";
import { useAuth } from "../context/AuthContext";

const STATUS_OPTIONS = [
  { value: "todo", label: "Todo" },
  { value: "in_progress", label: "In Progress" },
  { value: "done", label: "Done" },
];

const initialForm = {
  name: "",
  start_date: "",
  due_date: "",
  assignee_id: "",
  team_id: "",
  status: "todo",
};

function formatDate(dateString) {
  if (!dateString) return "";
  return new Date(`${dateString}T00:00:00`).toLocaleDateString();
}

function getStatusLabel(status) {
  return STATUS_OPTIONS.find((item) => item.value === status)?.label || status;
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

function ThreeDotsIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM18 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("overview");

  const [project, setProject] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);

  const [formData, setFormData] = useState(initialForm);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState(null);

  const [calendarDate, setCalendarDate] = useState(new Date());

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [error, setError] = useState("");

  const isEditing = editingTaskId !== null;
  const canManageTasks = user?.role === "admin" || user?.role === "team_manager";

  const assignees = useMemo(() => {
    return users.filter((item) =>
      ["admin", "team_manager", "team_member"].includes(item.role)
    );
  }, [users]);

  const projectMembers = useMemo(() => {
    const map = new Map();

    tasks.forEach((task) => {
      if (task.assignee) {
        map.set(task.assignee.id, task.assignee);
      }
    });

    return Array.from(map.values());
  }, [tasks]);

  const groupedByStatus = useMemo(() => {
    return STATUS_OPTIONS.reduce((acc, status) => {
      acc[status.value] = tasks.filter((task) => task.status === status.value);
      return acc;
    }, {});
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

  const doneTaskCount = useMemo(() => {
    return tasks.filter((task) => task.status === "done").length;
  }, [tasks]);

  const inProgressTaskCount = useMemo(() => {
    return tasks.filter((task) => task.status === "in_progress").length;
  }, [tasks]);

  const todoTaskCount = useMemo(() => {
    return tasks.filter((task) => task.status === "todo").length;
  }, [tasks]);

  async function loadData() {
    try {
      setIsLoading(true);
      setError("");

      const requests = [
        projectApi.getById(projectId),
        taskApi.listByProject(projectId),
      ];

      if (canManageTasks) {
        requests.push(userApi.list());
        requests.push(teamApi.list());
      }

      const result = await Promise.all(requests);

      setProject(result[0]);
      setTasks(result[1]);

      if (canManageTasks) {
        setUsers(result[2]);
        setTeams(result[3]);
      }
    } catch (err) {
      setError(err.message || "Unable to load project.");
      toast.error(err.message || "Unable to load project.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    resetForm();
    setActiveTab("overview");
  }, [projectId, canManageTasks]);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function resetForm() {
    setFormData(initialForm);
    setEditingTaskId(null);
    setError("");
  }

  function openCreateModal() {
    resetForm();
    setOpenActionMenuId(null);
    setIsTaskModalOpen(true);
  }

  function closeTaskModal() {
    resetForm();
    setIsTaskModalOpen(false);
  }

  function handleEdit(task) {
    setOpenActionMenuId(null);
    setEditingTaskId(task.id);

    setFormData({
      name: task.name || "",
      start_date: task.start_date || "",
      due_date: task.due_date || "",
      assignee_id: task.assignee_id ? String(task.assignee_id) : "",
      team_id: task.team_id ? String(task.team_id) : "",
      status: task.status || "todo",
    });

    setError("");
    setIsTaskModalOpen(true);
  }

  function toggleActionMenu(taskId) {
    setOpenActionMenuId((current) => (current === taskId ? null : taskId));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setError("");

      const payload = {
        name: formData.name,
        start_date: formData.start_date,
        due_date: formData.due_date,
        assignee_id: formData.assignee_id ? Number(formData.assignee_id) : null,
        project_id: Number(projectId),
        team_id: formData.team_id ? Number(formData.team_id) : null,
        status: formData.status,
      };

      if (isEditing) {
        const updatedTask = await taskApi.update(editingTaskId, payload);

        setTasks((current) =>
          current.map((task) =>
            task.id === editingTaskId ? updatedTask : task
          )
        );

        toast.success("Task updated successfully.");
      } else {
        const createdTask = await taskApi.create(payload);

        setTasks((current) => [createdTask, ...current]);

        toast.success("Task created successfully.");
      }

      closeTaskModal();
    } catch (err) {
      setError(err.message || "Unable to save task.");
      toast.error(err.message || "Unable to save task.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(task) {
    setOpenActionMenuId(null);

    const confirmed = window.confirm(`Delete ${task.name}?`);

    if (!confirmed) return;

    try {
      setError("");

      await taskApi.delete(task.id);

      setTasks((current) => current.filter((item) => item.id !== task.id));

      if (editingTaskId === task.id) {
        closeTaskModal();
      }

      toast.success("Task deleted successfully.");
    } catch (err) {
      setError(err.message || "Unable to delete task.");
      toast.error(err.message || "Unable to delete task.");
    }
  }

  async function quickStatusUpdate(task, status) {
    try {
      setOpenActionMenuId(null);
      setError("");

      const updatedTask = await taskApi.updateStatus(task.id, status);

      setTasks((current) =>
        current.map((item) => (item.id === task.id ? updatedTask : item))
      );

      toast.success("Task status updated.");
    } catch (err) {
      setError(err.message || "Unable to update task status.");
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
        Loading project...
      </div>
    );
  }

  if (error && !project) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!project) {
    return (
      <div className="rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-sm">
        Project not found.
      </div>
    );
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-slate-900">
              {project.name}
            </h1>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium capitalize text-slate-700">
              {project.status}
            </span>
          </div>

          <p className="mt-2 text-sm text-slate-600">
            {project.description || "No description added."}
          </p>
        </div>

        {canManageTasks ? (
          <button
            type="button"
            onClick={openCreateModal}
            className="w-fit rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            + Add Task
          </button>
        ) : null}
      </div>

      <div className="mb-6 border-b border-slate-200">
        <nav className="flex gap-6 overflow-x-auto">
          {["overview", "list", "board", "calendar"].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActiveTab(tab);
                setOpenActionMenuId(null);
              }}
              className={
                activeTab === tab
                  ? "whitespace-nowrap border-b-2 border-slate-900 pb-3 text-sm font-semibold capitalize text-slate-900"
                  : "whitespace-nowrap pb-3 text-sm font-semibold capitalize text-slate-500 hover:text-slate-900"
              }
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <main>
        {activeTab === "overview" ? (
          <section className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-slate-500">Members</p>
                <p className="mt-3 text-3xl font-bold text-slate-900">
                  {projectMembers.length}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-slate-500">Tasks</p>
                <p className="mt-3 text-3xl font-bold text-slate-900">
                  {tasks.length}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-slate-500">
                  In Progress
                </p>
                <p className="mt-3 text-3xl font-bold text-slate-900">
                  {inProgressTaskCount}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <p className="text-sm font-medium text-slate-500">Done</p>
                <p className="mt-3 text-3xl font-bold text-slate-900">
                  {doneTaskCount}
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Project Members
              </h2>

              <div className="mt-4 flex flex-wrap gap-2">
                {projectMembers.map((member) => (
                  <span
                    key={member.id}
                    className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700"
                  >
                    {member.full_name}
                  </span>
                ))}

                {!projectMembers.length ? (
                  <p className="text-sm text-slate-500">
                    No members assigned through tasks yet.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-slate-900">
                Task Summary
              </h2>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Todo</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {todoTaskCount}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">In Progress</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {inProgressTaskCount}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-500">Done</p>
                  <p className="mt-2 text-2xl font-bold text-slate-900">
                    {doneTaskCount}
                  </p>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {activeTab === "list" ? (
          <section className="overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto xl:overflow-visible">
              <table className="w-full min-w-[1000px] text-sm xl:min-w-0">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="w-12 px-4 py-3 text-left font-semibold text-slate-700" />

                    <th className="min-w-72 px-4 py-3 text-left font-semibold text-slate-700">
                      Task Name
                    </th>

                    <th className="min-w-44 px-4 py-3 text-left font-semibold text-slate-700">
                      Assignee
                    </th>

                    <th className="min-w-44 px-4 py-3 text-left font-semibold text-slate-700">
                      Team
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

                    {canManageTasks ? (
                      <th className="w-16 px-4 py-3 text-right font-semibold text-slate-700">
                        Actions
                      </th>
                    ) : null}
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
                          <span
                            className={
                              task.status === "done"
                                ? "font-medium text-slate-500 line-through"
                                : "font-medium text-slate-900"
                            }
                          >
                            {task.name}
                          </span>
                        </td>

                        <td className="px-4 py-4 align-middle text-slate-700">
                          {task.assignee?.full_name || "—"}
                        </td>

                        <td className="px-4 py-4 align-middle text-slate-700">
                          {task.team?.name || "—"}
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
                                <option
                                  key={status.value}
                                  value={status.value}
                                >
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

                        {canManageTasks ? (
                          <td className="relative px-4 py-4 text-right align-middle">
                            <button
                              type="button"
                              onClick={() => toggleActionMenu(task.id)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                              title="Task actions"
                            >
                              <ThreeDotsIcon />
                            </button>

                            {openActionMenuId === task.id ? (
                              <div className="absolute right-4 top-12 z-20 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    handleEdit(task);
                                  }}
                                  className="block w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  Edit
                                </button>

                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    handleDelete(task);
                                  }}
                                  className="block w-full px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                                >
                                  Delete
                                </button>
                              </div>
                            ) : null}
                          </td>
                        ) : null}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={canManageTasks ? 8 : 7}
                        className="px-4 py-8 text-center text-sm text-slate-500"
                      >
                        No tasks found in this project.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}

        {activeTab === "board" ? (
          <section className="grid gap-4 md:grid-cols-3">
            {STATUS_OPTIONS.map((status) => (
              <div
                key={status.value}
                className="rounded-2xl border border-slate-200 bg-slate-50 p-4"
              >
                <h2 className="mb-4 text-sm font-semibold text-slate-700">
                  {status.label}
                  <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-xs text-slate-500">
                    {groupedByStatus[status.value]?.length || 0}
                  </span>
                </h2>

                <div className="space-y-3">
                  {groupedByStatus[status.value]?.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <h3 className="font-medium text-slate-900">
                        {task.name}
                      </h3>

                      <p className="mt-2 text-xs text-slate-500">
                        Assignee: {task.assignee?.full_name || "No assignee"}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Team: {task.team?.name || "No team"}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Start: {formatDate(task.start_date) || "—"}
                      </p>

                      <p className="mt-1 text-xs text-slate-500">
                        Due: {formatDate(task.due_date) || "—"}
                      </p>

                      <div className="mt-3">
                        <label className="mb-1 block text-xs font-medium text-slate-500">
                          Status
                        </label>

                        <select
                          value={task.status}
                          onChange={(event) =>
                            quickStatusUpdate(task, event.target.value)
                          }
                          className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs"
                        >
                          {STATUS_OPTIONS.map((statusOption) => (
                            <option
                              key={statusOption.value}
                              value={statusOption.value}
                            >
                              {statusOption.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      {canManageTasks ? (
                        <div className="mt-4 flex gap-2">
                          <button
                            type="button"
                            onClick={() => handleEdit(task)}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => handleDelete(task)}
                            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50"
                          >
                            Delete
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ))}

                  {!groupedByStatus[status.value]?.length ? (
                    <p className="rounded-xl bg-white px-4 py-5 text-sm text-slate-500">
                      No tasks
                    </p>
                  ) : null}
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {activeTab === "calendar" ? (
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={goToPreviousMonth}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
                >
                  ‹
                </button>

                <button
                  type="button"
                  onClick={goToToday}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
                >
                  Today
                </button>

                <button
                  type="button"
                  onClick={goToNextMonth}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
                >
                  ›
                </button>
              </div>

              <h2 className="text-lg font-semibold text-slate-900">
                {calendarDate.toLocaleString("default", {
                  month: "long",
                  year: "numeric",
                })}
              </h2>
            </div>

            <div className="overflow-x-auto">
              <div className="min-w-[900px]">
                <div className="grid grid-cols-7 border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(
                    (day) => (
                      <div
                        key={day}
                        className="border-r border-slate-200 p-3"
                      >
                        {day}
                      </div>
                    )
                  )}
                </div>

                <div className="grid grid-cols-7">
                  {calendarDays.map((day) => {
                    const dateKey = toDateInputValue(day);
                    const dayTasks = tasksByDueDate[dateKey] || [];
                    const isCurrentMonth =
                      day.getMonth() === calendarDate.getMonth();

                    return (
                      <div
                        key={dateKey}
                        className={
                          isCurrentMonth
                            ? "min-h-32 border-r border-b border-slate-200 p-2"
                            : "min-h-32 border-r border-b border-slate-200 bg-slate-50 p-2 text-slate-400"
                        }
                      >
                        <div className="mb-2 flex items-center justify-between">
                          <span className="text-sm font-semibold">
                            {day.getDate()}
                          </span>

                          {dayTasks.length ? (
                            <span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs font-semibold text-white">
                              {dayTasks.length}
                            </span>
                          ) : null}
                        </div>

                        <div className="space-y-1">
                          {dayTasks.slice(0, 3).map((task) => (
                            <button
                              key={task.id}
                              type="button"
                              onClick={() => canManageTasks && handleEdit(task)}
                              className="block w-full truncate rounded bg-teal-100 px-2 py-1 text-left text-xs font-medium text-teal-900"
                              title={task.name}
                            >
                              {task.name}
                            </button>
                          ))}

                          {dayTasks.length > 3 ? (
                            <p className="text-xs text-slate-500">
                              +{dayTasks.length - 3} more
                            </p>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        ) : null}
      </main>

      {canManageTasks && isTaskModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {isEditing ? "Edit Task" : "Create Task"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  This task will be created under{" "}
                  <span className="font-medium text-slate-700">
                    {project.name}
                  </span>
                  .
                </p>
              </div>

              <button
                type="button"
                onClick={closeTaskModal}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                ✕
              </button>
            </div>

            {error ? (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Task name
                </label>

                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Start date
                  </label>

                  <input
                    name="start_date"
                    type="date"
                    value={formData.start_date}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Due date
                  </label>

                  <input
                    name="due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Assignee
                </label>

                <select
                  name="assignee_id"
                  value={formData.assignee_id}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select assignee</option>

                  {assignees.map((assignee) => (
                    <option key={assignee.id} value={assignee.id}>
                      {assignee.full_name} — {assignee.role}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Team
                </label>

                <select
                  name="team_id"
                  value={formData.team_id}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select team</option>

                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>

                {!teams.length ? (
                  <p className="mt-1 text-xs text-red-500">
                    Create a team first from Teams page.
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Status
                </label>

                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {STATUS_OPTIONS.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeTaskModal}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting
                    ? "Saving..."
                    : isEditing
                    ? "Update Task"
                    : "Create Task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}