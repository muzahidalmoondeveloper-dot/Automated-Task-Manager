import { useMemo } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const LINE_COLOR = "#0d9488"; // teal-600

const GRANULARITY_OPTIONS = [
  { value: "this_week", label: "Weekly" },
  { value: "this_month", label: "Monthly" },
  { value: "this_quarter", label: "Quarterly" },
  { value: "this_year", label: "Yearly" },
];

function formatDateRange(startStr, endStr) {
  const start = new Date(`${startStr}T00:00:00`);
  const end = new Date(`${endStr}T00:00:00`);
  const opts = { month: "short", day: "numeric" };
  return `${start.toLocaleDateString(undefined, opts)} – ${end.toLocaleDateString(undefined, opts)}`;
}

function TrendTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const point = payload[0].payload;
  if (!point.hasData) return null;

  return (
    <div className="rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-xl">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">{point.label}</p>
      <p className="mt-1 text-2xl font-bold text-slate-900">{point.score}<span className="text-sm font-medium text-slate-400">/100</span></p>
      <div className="mt-2 space-y-1 border-t border-slate-100 pt-2">
        <div className="flex items-center justify-between gap-6 text-xs">
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Completed
          </span>
          <span className="font-semibold text-slate-700">{point.completedTasks ?? "—"}</span>
        </div>
        <div className="flex items-center justify-between gap-6 text-xs">
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" /> Overdue
          </span>
          <span className="font-semibold text-slate-700">{point.overdueTasks ?? "—"}</span>
        </div>
      </div>
    </div>
  );
}

function ScoreDot({ cx, cy, payload, isLast }) {
  if (!payload.hasData) {
    // No task activity recorded for this period yet — a faint placeholder
    // keeps the timeline continuous instead of just vanishing.
    return <circle cx={cx} cy={cy} r={4} fill="white" stroke="#cbd5e1" strokeWidth={1.5} strokeDasharray="2 2" />;
  }
  if (!isLast) {
    return <circle cx={cx} cy={cy} r={4.5} fill="white" stroke={LINE_COLOR} strokeWidth={2} />;
  }
  return (
    <g>
      <circle cx={cx} cy={cy} r={10} fill={LINE_COLOR} opacity={0.15} />
      <circle cx={cx} cy={cy} r={6.5} fill="white" stroke={LINE_COLOR} strokeWidth={3} />
      <text x={cx} y={cy - 16} textAnchor="middle" fill="#0f766e" fontSize="12" fontWeight="700">
        {payload.score}
      </text>
    </g>
  );
}

function EmptyTrendState() {
  return (
    <div className="flex h-[220px] flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50/60">
      <p className="text-sm font-medium text-slate-500">No score history yet</p>
      <p className="text-xs text-slate-400">Scores will appear here once tasks are completed.</p>
    </div>
  );
}

export default function ScoreTrendCard({
  trend,
  previousTrend = null,
  period,
  onPeriodChange,
  changeFromPrevious = null,
}) {
  const chartData = useMemo(() => {
    return trend.map((p, i) => ({
      index: i,
      label: p.period_label,
      range: formatDateRange(p.period_start, p.period_end),
      score: p.has_data ? p.rounded_score : null,
      prevScore: previousTrend?.[i]?.has_data ? previousTrend[i].rounded_score : null,
      completedTasks: p.completed_tasks,
      overdueTasks: p.overdue_tasks,
      hasData: p.has_data,
    }));
  }, [trend, previousTrend]);

  const usablePoints = trend.filter((p) => p.has_data);
  const currentScore = usablePoints.length ? usablePoints[usablePoints.length - 1].rounded_score : null;
  const averageScore = usablePoints.length
    ? Math.round(usablePoints.reduce((sum, p) => sum + p.rounded_score, 0) / usablePoints.length)
    : null;

  let trendPct = null;
  if (currentScore !== null && changeFromPrevious !== null) {
    const previousScore = currentScore - changeFromPrevious;
    trendPct = previousScore > 0
      ? Math.round((changeFromPrevious / previousScore) * 100)
      : (changeFromPrevious > 0 ? 100 : 0);
  }

  const hasAnyData = usablePoints.length > 0;
  const sparseData = usablePoints.length > 0 && usablePoints.length < 2;
  const lastDataIndex = [...chartData].reverse().findIndex((p) => p.hasData);
  const lastIndex = lastDataIndex === -1 ? -1 : chartData.length - 1 - lastDataIndex;

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
      {/* ── Header ── */}
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Score Trend</h2>
          <p className="mt-0.5 text-sm text-slate-500">Performance over time</p>
        </div>

        {onPeriodChange && (
          <div className="flex flex-wrap gap-1.5">
            {GRANULARITY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onPeriodChange(opt.value)}
                className={
                  period === opt.value
                    ? "rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white"
                    : "rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                }
              >
                {opt.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── KPI summary ── */}
      <div className="mb-6 grid grid-cols-3 gap-3 sm:gap-4">
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500">Current Score</p>
          <p className="mt-1 text-2xl font-bold text-indigo-700">{currentScore ?? "—"}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Average Score</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{averageScore ?? "—"}</p>
        </div>
        <div className={`rounded-xl border px-4 py-3 ${
          trendPct === null ? "border-slate-200 bg-slate-50" : trendPct >= 0 ? "border-emerald-100 bg-emerald-50" : "border-red-100 bg-red-50"
        }`}>
          <p className={`text-[10px] font-bold uppercase tracking-widest ${
            trendPct === null ? "text-slate-500" : trendPct >= 0 ? "text-emerald-600" : "text-red-600"
          }`}>
            Trend
          </p>
          <p className={`mt-1 text-2xl font-bold ${
            trendPct === null ? "text-slate-800" : trendPct >= 0 ? "text-emerald-700" : "text-red-700"
          }`}>
            {trendPct === null ? "—" : `${trendPct > 0 ? "+" : ""}${trendPct}%`}
          </p>
        </div>
      </div>

      {/* ── Chart or empty state ── */}
      {!hasAnyData ? (
        <EmptyTrendState />
      ) : (
        <>
          <div className="-mx-2 h-[320px] w-[calc(100%+1rem)] sm:h-[380px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData}
                margin={{ top: 28, right: 20, left: 0, bottom: 12 }}
              >
                <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />

                <XAxis
                  dataKey="label"
                  axisLine={{ stroke: "#cbd5e1" }}
                  tickLine={false}
                  tick={{ fill: "#475569", fontSize: 12 }}
                  angle={-15}
                  textAnchor="end"
                  height={40}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, 100]}
                  ticks={[0, 20, 40, 60, 80, 100]}
                  axisLine={{ stroke: "#cbd5e1" }}
                  tickLine={false}
                  tick={{ fill: "#475569", fontSize: 12 }}
                  width={36}
                />

                <Tooltip content={<TrendTooltip />} cursor={{ stroke: "#cbd5e1", strokeDasharray: "4 3" }} />

                {previousTrend && (
                  <Line
                    type="monotone"
                    dataKey="prevScore"
                    stroke="#94a3b8"
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    connectNulls={false}
                    isAnimationActive={false}
                    name="Previous period"
                  />
                )}

                <Line
                  type="monotone"
                  dataKey="score"
                  stroke={LINE_COLOR}
                  strokeWidth={3}
                  connectNulls={false}
                  isAnimationActive={false}
                  dot={(props) => <ScoreDot key={props.payload.index} {...props} isLast={props.payload.index === lastIndex} />}
                  activeDot={{ r: 7, fill: "white", stroke: LINE_COLOR, strokeWidth: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {sparseData && (
            <p className="mt-2 text-center text-xs text-slate-400">
              Your trend line will build up as more periods are recorded.
            </p>
          )}

          {previousTrend && (
            <div className="mt-3 flex items-center justify-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-0.5 w-4 rounded-full" style={{ backgroundColor: LINE_COLOR }} /> This period
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="16" height="2"><line x1="0" y1="1" x2="16" y2="1" stroke="#94a3b8" strokeWidth="2" strokeDasharray="4 3" /></svg>
                Previous period
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}
