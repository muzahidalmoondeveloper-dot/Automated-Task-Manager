import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";

import { scoreboardApi } from "../api/scoreboardApi";
import { projectApi } from "../api/projectApi";
import { reportApi } from "../api/reportApi";
import DatePicker from "../components/DatePicker";
import RingChart from "../components/scoreboard/RingChart";
import ScoreTrendCard from "../components/scoreboard/ScoreTrendCard";
import ReportModal from "../components/scoreboard/ReportModal";
import {
  PERIOD_OPTIONS,
  PERFORMANCE_BADGE,
  SCORE_IMPACT_CFG,
  getInitials,
  formatDate,
  taskBreakdownSegments,
  StatCard,
} from "../components/scoreboard/scoreboardShared";

export default function UserScoreboardPage() {
  const { userId } = useParams();
  const navigate = useNavigate();

  const [period, setPeriod] = useState("this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [projectId, setProjectId] = useState("");

  const [projects, setProjects] = useState([]);

  const [data, setData] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);

  useEffect(() => {
    projectApi.list()
      .then(setProjects)
      .catch(() => {
        // Non-fatal — filters are optional; the scoreboard still loads without them.
      });
  }, []);

  const queryParams = useMemo(() => {
    const params = { period, project_id: projectId || undefined };
    if (period === "custom") {
      params.start_date = customStart || undefined;
      params.end_date = customEnd || undefined;
    }
    return params;
  }, [period, projectId, customStart, customEnd]);

  useEffect(() => {
    if (period === "custom" && (!customStart || !customEnd)) return;

    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        setError("");
        const [scoreboard, taskList] = await Promise.all([
          scoreboardApi.get(userId, queryParams),
          scoreboardApi.getTasks(userId, queryParams),
        ]);
        if (cancelled) return;
        setData(scoreboard);
        setTasks(taskList);
      } catch (err) {
        if (!cancelled) setError(err.message || "Unable to load this scoreboard.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, queryParams, period, customStart, customEnd]);

  if (isLoading && !data) {
    return <div className="rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-sm">Loading scoreboard...</div>;
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!data) return null;

  const { employee, summary, score, explanation, trend } = data;
  const changeArrow = score.change_from_previous == null
    ? null
    : score.change_from_previous > 0
    ? "▲"
    : score.change_from_previous < 0
    ? "▼"
    : "•";
  const changeTone = score.change_from_previous == null
    ? "text-slate-400"
    : score.change_from_previous > 0
    ? "text-emerald-600"
    : score.change_from_previous < 0
    ? "text-red-600"
    : "text-slate-400";

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={() => navigate("/users")}
        className="text-sm font-medium text-slate-500 hover:text-slate-900"
      >
        ← Back to Users
      </button>

      {/* ── Header ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-indigo-500 text-lg font-bold text-white">
              {getInitials(employee.full_name)}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{employee.full_name}</h1>
              <p className="mt-0.5 text-sm text-slate-500 capitalize">
                {employee.role.replace("_", " ")}
                {employee.teams.length ? ` · ${employee.teams.join(", ")}` : ""}
              </p>
            </div>
          </div>

          {score.has_data ? (
            <div className="text-right">
              <p className="text-4xl font-bold text-slate-900">{score.rounded_score}<span className="text-lg text-slate-400">/100</span></p>
              <div className="mt-1 flex items-center justify-end gap-2">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${PERFORMANCE_BADGE[score.performance_level] || PERFORMANCE_BADGE.Poor}`}>
                  {score.performance_level}
                </span>
                {changeArrow && (
                  <span className={`text-xs font-semibold ${changeTone}`}>
                    {changeArrow} {Math.abs(score.change_from_previous)} vs last period
                  </span>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-slate-300 px-4 py-3 text-sm text-slate-400">
              No task activity this period
            </div>
          )}
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        {PERIOD_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setPeriod(opt.value)}
            className={
              period === opt.value
                ? "rounded-lg bg-slate-900 px-3 py-1.5 text-sm font-semibold text-white"
                : "rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            }
          >
            {opt.label}
          </button>
        ))}

        {period === "custom" && (
          <div className="flex items-center gap-2">
            <DatePicker name="start" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
            <span className="text-sm text-slate-400">to</span>
            <DatePicker name="end" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
          </div>
        )}

        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="">All Projects</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setIsReportModalOpen(true)}
          className="ml-auto rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
        >
          Download Report
        </button>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatCard label="Total Assigned" value={summary.total_assigned} />
        <StatCard label="Total Completed" value={summary.total_completed} tone="emerald" />
        <StatCard label="Completed Before Due" value={summary.completed_before_due} tone="emerald" />
        <StatCard label="Completed On Due" value={summary.completed_on_due} tone="blue" />
        <StatCard label="Completed After Due" value={summary.completed_after_due} tone="amber" />
        <StatCard label="Currently Overdue" value={summary.overdue} tone="red" />
        <StatCard label="Pending" value={summary.pending} />
        <StatCard label="Completion Rate" value={`${summary.completion_rate}%`} />
        <StatCard label="On-Time Rate" value={`${summary.on_time_rate}%`} />
      </div>

      {/* ── Score explanation + donut ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Task Breakdown</h2>
          <p className="mb-4 mt-0.5 text-sm text-slate-500">Status breakdown for this period.</p>
          <RingChart segments={taskBreakdownSegments(summary)} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Why this score?</h2>
          {explanation.length === 0 ? (
            <p className="text-sm text-slate-400">Not enough task activity yet to explain a score.</p>
          ) : (
            <ul className="space-y-2">
              {explanation.map((line, i) => (
                <li key={i} className="flex items-start gap-2 text-sm text-slate-600">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-400" />
                  {line}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Trend ── */}
      <ScoreTrendCard
        trend={trend}
        period={period}
        onPeriodChange={setPeriod}
        changeFromPrevious={score.change_from_previous}
      />

      {/* ── Task table ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Task Details</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Task</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Project</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Priority</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Due Date</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Completed</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Score Impact</th>
                <th className="w-16 px-4 py-3 text-right font-semibold text-slate-700" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {tasks.length ? (
                tasks.map((task) => {
                  const cfg = SCORE_IMPACT_CFG[task.score_impact] || SCORE_IMPACT_CFG.pending;
                  return (
                    <tr key={task.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 align-middle font-medium text-slate-900">{task.name}</td>
                      <td className="px-4 py-3 align-middle text-slate-600">{task.project_name || "—"}</td>
                      <td className="px-4 py-3 align-middle capitalize text-slate-600">{task.priority}</td>
                      <td className="px-4 py-3 align-middle text-slate-600">{formatDate(task.due_date)}</td>
                      <td className="px-4 py-3 align-middle text-slate-600">
                        {task.completed_at ? new Date(task.completed_at).toLocaleDateString() : "—"}
                      </td>
                      <td className="px-4 py-3 align-middle">
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.badge}`}>
                          {cfg.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right align-middle">
                        {task.project_id ? (
                          <button
                            type="button"
                            onClick={() => navigate(`/projects/${task.project_id}`)}
                            className="text-xs font-semibold text-slate-500 hover:text-slate-900"
                          >
                            Open
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                    No tasks in this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <ReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        title="Download Employee Report"
        subtitle={`Generate a performance PDF for ${employee.full_name}.`}
        showProjectFilter
        projects={projects}
        onGenerate={(formValues) => reportApi.createEmployeeReport({ employee_id: Number(userId), ...formValues })}
      />
    </div>
  );
}
