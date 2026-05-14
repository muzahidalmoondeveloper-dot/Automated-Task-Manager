import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import toast from "react-hot-toast";

import { teamApi } from "../api/teamApi";
import { taskApi } from "../api/taskApi";
import { useAuth } from "../context/AuthContext";

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

export default function TeamDetailPage() {
  const { teamId } = useParams();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("overview");
  const [team, setTeam] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [calendarDate, setCalendarDate] = useState(new Date());

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const canManageTasks = user?.role === "admin" || user?.role === "team_manager";

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
    setActiveTab("overview");
  }, [teamId]);

  async function quickStatusUpdate(task, status) {
    try {
      setError("");

      const updatedTask = await taskApi.updateStatus(task.id, status);

      setTasks((current) =>
        current.map((item) => (item.id === task.id ? updatedTask : item))
      );

      toast.success("Task status updated.");
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

      <div className="mb-6 border-b border-slate-200">
        <nav className="flex gap-6 overflow-x-auto">
          {["overview", "members", "all works", "calendar"].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
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

      {activeTab === "overview" ? (
        <section className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Members</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">
                {members.length}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-slate-500">All Works</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">
                {tasks.length}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-slate-500">In Progress</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">
                {inProgressTasks.length}
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-medium text-slate-500">Done</p>
              <p className="mt-3 text-3xl font-bold text-slate-900">
                {doneTasks.length}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Work Summary
            </h2>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Todo</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {todoTasks.length}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">In Progress</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {inProgressTasks.length}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 p-4">
                <p className="text-sm text-slate-500">Done</p>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  {doneTasks.length}
                </p>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "members" ? (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-slate-900">
              Team Members
            </h2>
          </div>

          <div className="divide-y divide-slate-200">
            {members.map((member) => (
              <div
                key={member.id}
                className="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div>
                  <h3 className="font-medium text-slate-900">
                    {member.full_name}
                  </h3>
                  <p className="text-sm text-slate-500">{member.email}</p>
                </div>

                <span className="w-fit rounded-full bg-slate-100 px-3 py-1 text-xs font-medium capitalize text-slate-700">
                  {member.role?.replace("_", " ")}
                </span>
              </div>
            ))}

            {!members.length ? (
              <div className="p-6 text-sm text-slate-500">
                No members found in this team.
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {activeTab === "all works" ? (
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
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-8 text-center text-sm text-slate-500"
                    >
                      No works found in this team.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
                    <div key={day} className="border-r border-slate-200 p-3">
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
                            onClick={() =>
                              quickStatusUpdate(
                                task,
                                task.status === "done" ? "todo" : "done"
                              )
                            }
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
    </div>
  );
}