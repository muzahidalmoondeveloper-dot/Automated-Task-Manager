import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { scoreboardApi } from "../api/scoreboardApi";
import DatePicker from "../components/DatePicker";
import {
  PERIOD_OPTIONS,
  PERFORMANCE_BADGE,
  getInitials,
} from "../components/scoreboard/scoreboardShared";

const VIEW_OPTIONS = [
  { value: "team", label: "Team" },
  { value: "employee", label: "Employee" },
  { value: "manager", label: "Manager" },
];

export default function OrganizationScoreboardPage() {
  const navigate = useNavigate();

  const [view, setView] = useState("employee");
  const [period, setPeriod] = useState("this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");

  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  const queryParams = useMemo(() => {
    const params = { period };
    if (period === "custom") {
      params.start_date = customStart || undefined;
      params.end_date = customEnd || undefined;
    }
    return params;
  }, [period, customStart, customEnd]);

  useEffect(() => {
    if (period === "custom" && (!customStart || !customEnd)) return;

    let cancelled = false;
    (async () => {
      try {
        setIsLoading(true);
        setError("");
        const fetcher =
          view === "team" ? scoreboardApi.getTeamRankings
          : view === "manager" ? scoreboardApi.getManagerRankings
          : scoreboardApi.getOrganization;
        const result = await fetcher(queryParams);
        if (!cancelled) setData(result);
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Unable to load the scoreboard.");
          toast.error(err.message || "Unable to load the scoreboard.");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [view, queryParams]);

  const employeeRows = data?.employees || [];
  const teamRows = data?.teams || [];
  const managerRows = data?.managers || [];

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Scoreboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Rankings by performance score for the selected period.
        </p>
      </div>

      {/* Filters */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">View</label>
          <div className="inline-flex rounded-lg border border-slate-200 bg-slate-100 p-1">
            {VIEW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setView(opt.value)}
                className={`rounded-md px-4 py-1.5 text-sm font-medium transition ${
                  view === opt.value
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-500">Date Range</label>
          <div className="flex flex-wrap items-center gap-2">
            {PERIOD_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPeriod(opt.value)}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                  period === opt.value
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {period === "custom" && (
          <div className="mt-3 grid grid-cols-2 gap-3 sm:max-w-md">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">Start date</label>
              <DatePicker value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-500">End date</label>
              <DatePicker value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Ranking table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          {view === "employee" && (
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="w-14 px-4 py-3 text-left font-semibold text-slate-700">Rank</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Employee</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Manager</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Team</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Score</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Performance Level</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Completed Tasks</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">On-Time Rate</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Overdue Tasks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {isLoading ? (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-400">Loading scoreboard...</td></tr>
                ) : employeeRows.length ? (
                  employeeRows.map((row) => (
                    <tr key={row.user_id} onClick={() => navigate(`/users/${row.user_id}/scoreboard`)} className="cursor-pointer hover:bg-slate-50/70">
                      <td className="px-4 py-3 align-middle font-semibold text-slate-500">#{row.rank}</td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-500 text-xs font-bold text-white">
                            {getInitials(row.full_name)}
                          </div>
                          <div className="min-w-0">
                            <p className="truncate font-medium text-slate-900">{row.full_name}</p>
                            <p className="text-xs capitalize text-slate-400">{row.role.replace("_", " ")}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle text-slate-600">{row.manager_name || "—"}</td>
                      <td className="px-4 py-3 align-middle text-slate-600">{row.team_name || "—"}</td>
                      <td className="px-4 py-3 text-right align-middle font-semibold text-slate-900">{row.has_data ? row.rounded_score : "—"}</td>
                      <td className="px-4 py-3 align-middle">
                        {row.has_data ? (
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${PERFORMANCE_BADGE[row.performance_level] || PERFORMANCE_BADGE.Poor}`}>
                            {row.performance_level}
                          </span>
                        ) : <span className="text-xs text-slate-400">No data</span>}
                      </td>
                      <td className="px-4 py-3 text-right align-middle text-slate-600">{row.total_completed}</td>
                      <td className="px-4 py-3 text-right align-middle text-slate-600">{row.on_time_rate}%</td>
                      <td className="px-4 py-3 text-right align-middle">
                        <span className={row.overdue > 0 ? "font-semibold text-red-600" : "text-slate-600"}>{row.overdue}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">No employees match the selected period.</td></tr>
                )}
              </tbody>
            </table>
          )}

          {view === "team" && (
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="w-14 px-4 py-3 text-left font-semibold text-slate-700">Rank</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Team</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Manager</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Members</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Score</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Performance Level</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Completed Tasks</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">On-Time Rate</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Overdue Tasks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {isLoading ? (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-400">Loading scoreboard...</td></tr>
                ) : teamRows.length ? (
                  teamRows.map((row) => (
                    <tr key={row.team_id} onClick={() => navigate(`/teams/${row.team_id}?tab=scoreboard`)} className="cursor-pointer hover:bg-slate-50/70">
                      <td className="px-4 py-3 align-middle font-semibold text-slate-500">#{row.rank}</td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-teal-500 text-xs font-bold text-white">
                            {getInitials(row.team_name)}
                          </div>
                          <p className="truncate font-medium text-slate-900">{row.team_name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 align-middle text-slate-600">{row.manager_name || "—"}</td>
                      <td className="px-4 py-3 text-right align-middle text-slate-600">{row.member_count}</td>
                      <td className="px-4 py-3 text-right align-middle font-semibold text-slate-900">{row.has_data ? row.rounded_score : "—"}</td>
                      <td className="px-4 py-3 align-middle">
                        {row.has_data ? (
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${PERFORMANCE_BADGE[row.performance_level] || PERFORMANCE_BADGE.Poor}`}>
                            {row.performance_level}
                          </span>
                        ) : <span className="text-xs text-slate-400">No data</span>}
                      </td>
                      <td className="px-4 py-3 text-right align-middle text-slate-600">{row.total_completed}</td>
                      <td className="px-4 py-3 text-right align-middle text-slate-600">{row.on_time_rate}%</td>
                      <td className="px-4 py-3 text-right align-middle">
                        <span className={row.overdue > 0 ? "font-semibold text-red-600" : "text-slate-600"}>{row.overdue}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">No teams match the selected period.</td></tr>
                )}
              </tbody>
            </table>
          )}

          {view === "manager" && (
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="w-14 px-4 py-3 text-left font-semibold text-slate-700">Rank</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Manager</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Teams</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Employees</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Score</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700">Performance Level</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Completed Tasks</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">On-Time Rate</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700">Overdue Tasks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {isLoading ? (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-400">Loading scoreboard...</td></tr>
                ) : managerRows.length ? (
                  managerRows.map((row) => (
                    <tr key={row.manager_id} onClick={() => navigate(`/users/${row.manager_id}/scoreboard`)} className="cursor-pointer hover:bg-slate-50/70">
                      <td className="px-4 py-3 align-middle font-semibold text-slate-500">#{row.rank}</td>
                      <td className="px-4 py-3 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-xs font-bold text-white">
                            {getInitials(row.manager_name)}
                          </div>
                          <p className="truncate font-medium text-slate-900">{row.manager_name}</p>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right align-middle text-slate-600">{row.team_count}</td>
                      <td className="px-4 py-3 text-right align-middle text-slate-600">{row.employee_count}</td>
                      <td className="px-4 py-3 text-right align-middle font-semibold text-slate-900">{row.has_data ? row.rounded_score : "—"}</td>
                      <td className="px-4 py-3 align-middle">
                        {row.has_data ? (
                          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${PERFORMANCE_BADGE[row.performance_level] || PERFORMANCE_BADGE.Poor}`}>
                            {row.performance_level}
                          </span>
                        ) : <span className="text-xs text-slate-400">No data</span>}
                      </td>
                      <td className="px-4 py-3 text-right align-middle text-slate-600">{row.total_completed}</td>
                      <td className="px-4 py-3 text-right align-middle text-slate-600">{row.on_time_rate}%</td>
                      <td className="px-4 py-3 text-right align-middle">
                        <span className={row.overdue > 0 ? "font-semibold text-red-600" : "text-slate-600"}>{row.overdue}</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr><td colSpan={9} className="px-4 py-10 text-center text-sm text-slate-500">No managers match the selected period.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
