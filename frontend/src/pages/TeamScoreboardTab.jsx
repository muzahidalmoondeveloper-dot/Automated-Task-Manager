import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { teamApi } from "../api/teamApi";
import { projectApi } from "../api/projectApi";
import { reportApi } from "../api/reportApi";
import DatePicker from "../components/DatePicker";
import RingChart from "../components/scoreboard/RingChart";
import ScoreTrendCard from "../components/scoreboard/ScoreTrendCard";
import ReportModal from "../components/scoreboard/ReportModal";
import {
  PERIOD_OPTIONS,
  PERFORMANCE_BADGE,
  getInitials,
  taskBreakdownSegments,
  StatCard,
} from "../components/scoreboard/scoreboardShared";

export default function TeamScoreboardTab({ team }) {
  const navigate = useNavigate();

  const [period, setPeriod] = useState("this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [projectId, setProjectId] = useState("");

  const [projects, setProjects] = useState([]);

  const [data, setData] = useState(null);
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
    if (!team?.id) return;
    if (period === "custom" && (!customStart || !customEnd)) return;

    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        setError("");
        const scoreboard = await teamApi.getScoreboard(team.id, queryParams);
        if (!cancelled) setData(scoreboard);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load this team's scoreboard.");
          toast.error(err.message || "Unable to load this team's scoreboard.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [team?.id, queryParams, period, customStart, customEnd]);

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

  const { summary, score, members, trend, previous_trend: previousTrend, insights } = data;
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
      {/* ── Team score header ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <p className="text-sm font-medium text-slate-500">Team Score</p>
            <p className="mt-1 text-xs text-slate-400">
              {new Date(data.period_start).toLocaleDateString()} – {new Date(data.period_end).toLocaleDateString()}
            </p>
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

      {/* ── Breakdown + insights ── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Task Breakdown</h2>
          <p className="mb-4 mt-0.5 text-sm text-slate-500">Status breakdown for this period.</p>
          <RingChart segments={taskBreakdownSegments(summary)} />
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Team Insights</h2>
          {insights.length === 0 ? (
            <p className="text-sm text-slate-400">Not enough task activity yet for insights.</p>
          ) : (
            <ul className="space-y-2">
              {insights.map((line, i) => (
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
        previousTrend={previousTrend}
        period={period}
        onPeriodChange={setPeriod}
        changeFromPrevious={score.change_from_previous}
      />

      {/* ── Member ranking ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">Member Ranking</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-50">
              <tr className="border-b border-slate-200">
                <th className="w-14 px-4 py-3 text-left font-semibold text-slate-700">Rank</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Member</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Score</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Assigned</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Completed</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">On-Time</th>
                <th className="px-4 py-3 text-right font-semibold text-slate-700">Overdue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {members.length ? (
                members.map((m) => (
                  <tr
                    key={m.user_id}
                    onClick={() => navigate(`/users/${m.user_id}/scoreboard`)}
                    className="cursor-pointer hover:bg-slate-50/70"
                  >
                    <td className="px-4 py-3 align-middle font-semibold text-slate-500">#{m.rank}</td>
                    <td className="px-4 py-3 align-middle">
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-xs font-bold text-white">
                          {getInitials(m.full_name)}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-900">{m.full_name}</p>
                          <p className="text-xs capitalize text-slate-400">{m.role.replace("_", " ")}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right align-middle">
                      {m.has_data ? (
                        <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${PERFORMANCE_BADGE[m.performance_level] || PERFORMANCE_BADGE.Poor}`}>
                          {m.rounded_score}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">No data</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right align-middle text-slate-600">{m.total_assigned}</td>
                    <td className="px-4 py-3 text-right align-middle text-slate-600">{m.total_completed}</td>
                    <td className="px-4 py-3 text-right align-middle text-slate-600">{m.on_time_rate}%</td>
                    <td className="px-4 py-3 text-right align-middle">
                      <span className={m.overdue > 0 ? "font-semibold text-red-600" : "text-slate-600"}>{m.overdue}</span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                    This team does not currently have any members.
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
        title="Download Team Report"
        subtitle={`Generate a performance PDF for ${team.name}.`}
        onGenerate={(formValues) => reportApi.createTeamReport({ team_id: team.id, ...formValues })}
      />
    </div>
  );
}
