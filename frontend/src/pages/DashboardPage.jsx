import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { useAuth } from "../context/AuthContext";
import { taskApi } from "../api/taskApi";
import { userApi } from "../api/userApi";
import { teamApi } from "../api/teamApi";
import { projectApi } from "../api/projectApi";
import { integrationApi } from "../api/integrationApi";

const initialStats = {
  tasks: [],
  users: [],
  teams: [],
  projects: [],
  integrations: [],
};

function StatCard({ title, value, description, icon, tone = "slate" }) {
  const toneClasses = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-100 text-blue-700",
    green: "bg-green-100 text-green-700",
    amber: "bg-amber-100 text-amber-700",
    purple: "bg-purple-100 text-purple-700",
    teal: "bg-teal-100 text-teal-700",
    indigo: "bg-indigo-100 text-indigo-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>

          {description ? (
            <p className="mt-2 text-xs font-medium text-slate-500">
              {description}
            </p>
          ) : null}
        </div>

        <div
          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
            toneClasses[tone] || toneClasses.slate
          }`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function TasksIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M7.75 3.5a2.25 2.25 0 014.5 0h1A2.75 2.75 0 0116 6.25v8.5A2.75 2.75 0 0113.25 17h-6.5A2.75 2.75 0 014 14.75v-8.5A2.75 2.75 0 016.75 3.5h1zM10 2.75a.75.75 0 00-.75.75h1.5a.75.75 0 00-.75-.75zM8.28 10.22a.75.75 0 00-1.06 1.06l1.25 1.25a.75.75 0 001.06 0l3-3a.75.75 0 10-1.06-1.06L9 10.94l-.72-.72z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 9a3 3 0 100-6 3 3 0 000 6z" />
      <path d="M3.465 14.493A6.98 6.98 0 0110 10a6.98 6.98 0 016.535 4.493.75.75 0 01-.699 1.007H4.164a.75.75 0 01-.699-1.007z" />
    </svg>
  );
}

function TeamsIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M7 8a3 3 0 100-6 3 3 0 000 6zM13.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
      <path d="M2.5 15.5A4.5 4.5 0 017 11h.25a4.5 4.5 0 014.5 4.5.5.5 0 01-.5.5H3a.5.5 0 01-.5-.5zM12.8 16h3.7a.5.5 0 00.5-.5A3.5 3.5 0 0013.5 12c-.32 0-.63.04-.92.13.42.84.67 1.78.67 2.79 0 .38-.03.74-.1 1.08z" />
    </svg>
  );
}

function ProjectsIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M3 5a2 2 0 012-2h3.586A2 2 0 0110 3.586L11.414 5H15a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" />
    </svg>
  );
}

function IntegrationIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M7 3a3 3 0 00-3 3v2H3a2 2 0 000 4h1v2a3 3 0 006 0v-1.25a.75.75 0 00-1.5 0V14a1.5 1.5 0 01-3 0V6a1.5 1.5 0 013 0v1.25a.75.75 0 001.5 0V6a3 3 0 00-3-3zM13 3a3 3 0 00-3 3v1.25a.75.75 0 001.5 0V6a1.5 1.5 0 013 0v8a1.5 1.5 0 01-3 0v-1.25a.75.75 0 00-1.5 0V14a3 3 0 006 0v-2h1a2 2 0 100-4h-1V6a3 3 0 00-3-3z" />
    </svg>
  );
}

function StatusRow({ label, value, total, tone }) {
  const percentage = total > 0 ? Math.round((value / total) * 100) : 0;

  const barClass = {
    slate: "bg-slate-500",
    blue: "bg-blue-500",
    amber: "bg-amber-500",
    green: "bg-green-500",
  };

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-700">{label}</p>
        <p className="text-sm font-bold text-slate-900">
          {value}
          <span className="ml-1 text-xs font-medium text-slate-400">
            {percentage}%
          </span>
        </p>
      </div>

      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${barClass[tone] || barClass.slate}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user } = useAuth();
  const isTeamMember = user?.role === "team_member";

  const [stats, setStats] = useState(initialStats);
  const [isLoading, setIsLoading] = useState(true);

  const taskSummary = useMemo(() => {
    const total = stats.tasks.length;

    const todo = stats.tasks.filter((task) => task.status === "todo").length;

    const inProgress = stats.tasks.filter(
      (task) => task.status === "in_progress"
    ).length;

    const pendingReview = stats.tasks.filter(
      (task) => task.status === "pending_review"
    ).length;

    const done = stats.tasks.filter((task) => task.status === "done").length;

    return {
      total,
      todo,
      inProgress,
      pendingReview,
      done,
    };
  }, [stats.tasks]);

  async function loadDashboardData() {
    try {
      setIsLoading(true);

      if (isTeamMember) {
        const taskData = await taskApi.list();
        setStats({ ...initialStats, tasks: Array.isArray(taskData) ? taskData : [] });
        return;
      }

      const results = await Promise.allSettled([
        taskApi.list(),
        userApi.list(),
        teamApi.list(),
        projectApi.list(),
        integrationApi.accounts(),
      ]);

      const [
        tasksResult,
        usersResult,
        teamsResult,
        projectsResult,
        integrationsResult,
      ] = results;

      setStats({
        tasks:
          tasksResult.status === "fulfilled" && Array.isArray(tasksResult.value)
            ? tasksResult.value
            : [],
        users:
          usersResult.status === "fulfilled" && Array.isArray(usersResult.value)
            ? usersResult.value
            : [],
        teams:
          teamsResult.status === "fulfilled" && Array.isArray(teamsResult.value)
            ? teamsResult.value
            : [],
        projects:
          projectsResult.status === "fulfilled" &&
          Array.isArray(projectsResult.value)
            ? projectsResult.value
            : [],
        integrations:
          integrationsResult.status === "fulfilled" &&
          Array.isArray(integrationsResult.value)
            ? integrationsResult.value
            : [],
      });
    } catch (err) {
      toast.error(err.message || "Unable to load dashboard data.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadDashboardData();
  }, [isTeamMember]);

  return (
    <div className="w-full">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Dashboard</h1>
          <p className="mt-2 text-sm text-slate-600">
            Welcome back, {user?.full_name}. Here is your workspace overview.
          </p>
        </div>

        <button
          type="button"
          onClick={loadDashboardData}
          className="w-fit rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
        >
          Refresh
        </button>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading dashboard...
        </div>
      ) : (
        <>
          <div className={`grid gap-4 sm:grid-cols-2 ${isTeamMember ? "xl:grid-cols-3" : "xl:grid-cols-5"}`}>
            <StatCard
              title="My Tasks"
              value={taskSummary.total}
              description={isTeamMember ? "Tasks assigned to you" : "All assigned and created tasks"}
              icon={<TasksIcon />}
              tone="indigo"
            />

            <StatCard
              title="Pending Review"
              value={taskSummary.pendingReview}
              description="Awaiting manager approval"
              icon={<TasksIcon />}
              tone="amber"
            />

            <StatCard
              title="Completed"
              value={taskSummary.done}
              description="Approved and done"
              icon={<TasksIcon />}
              tone="green"
            />

            {!isTeamMember ? (
              <>
                <StatCard
                  title="Users"
                  value={stats.users.length}
                  description="Admins, managers, and members"
                  icon={<UsersIcon />}
                  tone="blue"
                />

                <StatCard
                  title="Teams"
                  value={stats.teams.length}
                  description="Active workspace teams"
                  icon={<TeamsIcon />}
                  tone="purple"
                />
              </>
            ) : null}
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
              <div className="mb-6 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    Task Status Overview
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Todo, in progress, and completed task distribution.
                  </p>
                </div>

                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  {taskSummary.total} total
                </span>
              </div>

              <div className="space-y-5">
                <StatusRow
                  label="Todo"
                  value={taskSummary.todo}
                  total={taskSummary.total}
                  tone="slate"
                />

                <StatusRow
                  label="In Progress"
                  value={taskSummary.inProgress}
                  total={taskSummary.total}
                  tone="blue"
                />

                <StatusRow
                  label="Pending Review"
                  value={taskSummary.pendingReview}
                  total={taskSummary.total}
                  tone="amber"
                />

                <StatusRow
                  label="Done"
                  value={taskSummary.done}
                  total={taskSummary.total}
                  tone="green"
                />
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900">
                Quick Summary
              </h2>

              <div className="mt-5 space-y-3">
                <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
                  <span className="text-sm font-semibold text-slate-600">
                    Todo
                  </span>
                  <span className="rounded-full bg-slate-200 px-2.5 py-0.5 text-sm font-bold text-slate-900">
                    {taskSummary.todo}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-blue-50 px-4 py-3">
                  <span className="text-sm font-semibold text-blue-700">
                    In Progress
                  </span>
                  <span className="rounded-full bg-blue-200 px-2.5 py-0.5 text-sm font-bold text-blue-900">
                    {taskSummary.inProgress}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-amber-50 px-4 py-3">
                  <span className="text-sm font-semibold text-amber-700">
                    Pending Review
                  </span>
                  <span className="rounded-full bg-amber-200 px-2.5 py-0.5 text-sm font-bold text-amber-900">
                    {taskSummary.pendingReview}
                  </span>
                </div>

                <div className="flex items-center justify-between rounded-xl bg-green-50 px-4 py-3">
                  <span className="text-sm font-semibold text-green-700">
                    Done
                  </span>
                  <span className="rounded-full bg-green-200 px-2.5 py-0.5 text-sm font-bold text-green-900">
                    {taskSummary.done}
                  </span>
                </div>
              </div>
            </section>
          </div>

          {!isTeamMember ? (
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">
                  Latest Projects
                </h2>

                <div className="mt-5 space-y-3">
                  {stats.projects.slice(0, 5).map((project) => (
                    <div
                      key={project.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {project.name}
                        </p>
                        <p className="mt-1 text-xs capitalize text-slate-500">
                          {project.status || "active"}
                        </p>
                      </div>

                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          project.status === "completed"
                            ? "bg-blue-100 text-blue-700"
                            : project.status === "paused"
                            ? "bg-amber-100 text-amber-700"
                            : project.status === "cancelled"
                            ? "bg-red-100 text-red-700"
                            : "bg-teal-100 text-teal-700"
                        }`}
                      >
                        {project.status || "Active"}
                      </span>
                    </div>
                  ))}

                  {!stats.projects.length ? (
                    <p className="rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-500">
                      No projects created yet.
                    </p>
                  ) : null}
                </div>
              </section>

              <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-bold text-slate-900">
                  Connected Integrations
                </h2>

                <div className="mt-5 space-y-3">
                  {stats.integrations.slice(0, 5).map((integration) => (
                    <div
                      key={integration.id}
                      className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          {integration.account_email ||
                            integration.email ||
                            integration.provider ||
                            "Connected Account"}
                        </p>
                        <p className="mt-1 text-xs capitalize text-slate-500">
                          {integration.provider || "Integration"}
                        </p>
                      </div>

                      <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-700">
                        Connected
                      </span>
                    </div>
                  ))}

                  {!stats.integrations.length ? (
                    <p className="rounded-xl bg-slate-50 px-4 py-5 text-sm text-slate-500">
                      No integrations connected yet.
                    </p>
                  ) : null}
                </div>
              </section>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}