import { useEffect, useMemo, useRef, useState } from "react";
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

function CumulativeLineChart({ data }) {
  const svgRef = useRef(null);
  const [hoveredIdx, setHoveredIdx] = useState(null);
  const [tooltip, setTooltip] = useState(null);

  const SVG_W = 560, SVG_H = 250;
  const PAD = { l: 44, r: 20, t: 12, b: 34 };
  const W = SVG_W - PAD.l - PAD.r;
  const H = SVG_H - PAD.t - PAD.b;
  const BAR_ZONE = H * 0.28;
  const LINE_ZONE = H - BAR_ZONE;

  const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  const fmtShort = (s) => { const p = s.split("-"); return `${MONTHS[+p[1]-1]} ${+p[2]}`; };
  const fmtFull  = (s) => { const p = s.split("-").map(Number); return `${MONTHS[p[1]-1]} ${p[2]}, ${p[0]}`; };

  const derived = useMemo(() => {
    const n = data.points.length;
    if (!n) return { pts: [], coords: [], bestDay: 0, avgDaily: "0", maxY: 1 };

    const pts = data.points.map((p, i) => ({
      ...p,
      daily: p.cumulative - (i > 0 ? data.points[i - 1].cumulative : 0),
    }));
    const bestDay = Math.max(...pts.map((p) => p.daily));
    const avgDaily = (data.maxCount / n).toFixed(1);
    const maxY = Math.max(data.maxCount, 1);
    const toX = (i) => PAD.l + (n === 1 ? W / 2 : (i / (n - 1)) * W);
    const toY = (v) => PAD.t + LINE_ZONE * (1 - v / maxY);
    const coords = pts.map((p, i) => ({ ...p, x: toX(i), y: toY(p.cumulative) }));
    return { pts, coords, bestDay, avgDaily, maxY };
  }, [data]);

  function buildSmoothPath(pts) {
    if (!pts.length) return "";
    if (pts.length === 1) return `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    let d = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i];
      const cp = (b.x - a.x) * 0.45;
      d += ` C ${(a.x + cp).toFixed(1)} ${a.y.toFixed(1)},${(b.x - cp).toFixed(1)} ${b.y.toFixed(1)},${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
    }
    return d;
  }

  function handleMouseMove(e) {
    const svg = svgRef.current;
    if (!svg || !derived.coords.length) return;
    const rect = svg.getBoundingClientRect();
    const vb = svg.viewBox.baseVal;
    const svgX = (e.clientX - rect.left) * (vb.width / rect.width);
    let nearestIdx = 0, minDist = Infinity;
    derived.coords.forEach((c, i) => {
      const d = Math.abs(c.x - svgX);
      if (d < minDist) { minDist = d; nearestIdx = i; }
    });
    const wrapRect = svg.parentElement?.getBoundingClientRect();
    if (!wrapRect) return;
    setHoveredIdx(nearestIdx);
    setTooltip({ x: e.clientX - wrapRect.left, y: e.clientY - wrapRect.top, ...derived.coords[nearestIdx] });
  }

  if (!data.points.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-14 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-50">
          <svg className="h-6 w-6 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </div>
        <p className="text-sm font-semibold text-slate-500">No completions this week</p>
        <p className="text-xs text-slate-400">Completed tasks will appear here</p>
      </div>
    );
  }

  const { coords, bestDay, avgDaily, maxY, pts } = derived;
  const n = coords.length;
  const lineD = buildSmoothPath(coords);
  const barBaseY = PAD.t + H;
  const maxBarH = BAR_ZONE * 0.82;
  const maxDailyForBar = Math.max(bestDay, 1);
  const barW = Math.min((W / n) * 0.44, 22);
  const areaBaseY = (PAD.t + LINE_ZONE).toFixed(1);
  const areaD = `${lineD} L ${coords[n-1].x.toFixed(1)} ${areaBaseY} L ${coords[0].x.toFixed(1)} ${areaBaseY} Z`;
  const yTicks = [...new Set([0, Math.round(maxY * 0.5), maxY])];
  const hov = hoveredIdx !== null ? coords[hoveredIdx] : null;

  return (
    <div className="relative w-full">
      {/* KPI strip */}
      <div className="mb-5 grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600">This Week</p>
          <p className="mt-1 text-2xl font-bold text-emerald-700">{data.maxCount}</p>
          <p className="text-xs text-emerald-500">tasks completed</p>
        </div>
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Best Day</p>
          <p className="mt-1 text-2xl font-bold text-slate-800">{bestDay}</p>
          <p className="text-xs text-slate-400">in a single day</p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500">Daily Avg</p>
          <p className="mt-1 text-2xl font-bold text-blue-700">{avgDaily}</p>
          <p className="text-xs text-blue-400">tasks per day</p>
        </div>
      </div>

      <svg
        ref={svgRef}
        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
        preserveAspectRatio="none"
        style={{ width: "100%", height: "250px", cursor: "crosshair" }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => { setHoveredIdx(null); setTooltip(null); }}
      >
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#10b981" stopOpacity="0.22" />
            <stop offset="80%" stopColor="#10b981" stopOpacity="0.03" />
            <stop offset="100%" stopColor="#10b981" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#34d399" stopOpacity="0.9" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0.55" />
          </linearGradient>
        </defs>

        {/* Grid lines + Y labels */}
        {yTicks.map((tick) => {
          const y = PAD.t + LINE_ZONE * (1 - tick / maxY);
          return (
            <g key={tick}>
              <line x1={PAD.l} y1={y} x2={PAD.l + W} y2={y}
                stroke={tick === 0 ? "#e2e8f0" : "#f1f5f9"} strokeWidth="1" />
              <text x={PAD.l - 8} y={y + 4} textAnchor="end"
                fill="#94a3b8" fontSize="11" fontFamily="system-ui,sans-serif">
                {tick}
              </text>
            </g>
          );
        })}

        {/* Daily completion bars */}
        {coords.map((c, i) => {
          if (!pts[i].daily) return null;
          const bh = (pts[i].daily / maxDailyForBar) * maxBarH;
          const isHov = hoveredIdx === i;
          return (
            <rect key={i}
              x={c.x - barW / 2} y={barBaseY - bh}
              width={barW} height={bh} rx="3"
              fill={isHov ? "#10b981" : "url(#barGrad)"}
              opacity={hoveredIdx !== null && !isHov ? 0.3 : 1}
              style={{ transition: "opacity 0.15s, fill 0.15s" }}
            />
          );
        })}

        {/* Area fill */}
        <path d={areaD} fill="url(#areaGrad)" />

        {/* Smooth curve */}
        <path d={lineD} fill="none" stroke="#10b981"
          strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {/* Y axis */}
        <line x1={PAD.l} y1={PAD.t} x2={PAD.l} y2={PAD.t + H} stroke="#e2e8f0" strokeWidth="1" />

        {/* X labels */}
        {coords.map((c, i) => (
          <text key={i} x={c.x} y={SVG_H - 8}
            textAnchor="middle" fill="#94a3b8"
            fontSize="10" fontFamily="system-ui,sans-serif">
            {fmtShort(c.date)}
          </text>
        ))}

        {/* Hover crosshair */}
        {hov && (
          <line x1={hov.x} y1={PAD.t} x2={hov.x} y2={PAD.t + H}
            stroke="#10b981" strokeWidth="1" strokeDasharray="4 3" opacity="0.4" />
        )}

        {/* Hover dot */}
        {hov && (
          <>
            <circle cx={hov.x} cy={hov.y} r="9" fill="#10b981" opacity="0.1" />
            <circle cx={hov.x} cy={hov.y} r="5" fill="#10b981" stroke="white" strokeWidth="2.5" />
          </>
        )}
      </svg>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="pointer-events-none absolute z-20 min-w-[160px] rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-xl"
          style={{
            left: tooltip.x > (svgRef.current?.parentElement?.clientWidth ?? 500) * 0.68
              ? tooltip.x - 185 : tooltip.x + 14,
            top: Math.max(4, tooltip.y - 80),
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {fmtFull(tooltip.date)}
          </p>
          <p className="mt-1.5 text-2xl font-bold text-slate-900">{tooltip.cumulative}</p>
          <p className="text-xs font-semibold text-emerald-600">cumulative completed</p>
          {tooltip.daily > 0 && (
            <div className="mt-2 flex items-center gap-1.5 border-t border-slate-100 pt-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400" />
              <p className="text-xs text-slate-500">+{tooltip.daily} on this day</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function PieChart({ segments }) {
  const wrapperRef = useRef(null);
  const [hoveredLabel, setHoveredLabel] = useState(null);
  const [tooltip, setTooltip] = useState(null);

  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const cx = 85, cy = 85, outerR = 70, innerR = 42, POP = 8;

  if (total === 0) {
    return (
      <div className="mt-4 flex justify-center">
        <svg width="170" height="170" viewBox="0 0 170 170">
          <circle cx={cx} cy={cy} r={outerR} fill="#f1f5f9" />
          <circle cx={cx} cy={cy} r={innerR} fill="white" />
          <text x={cx} y={cy + 5} textAnchor="middle" fill="#94a3b8" fontSize="12">
            No data
          </text>
        </svg>
      </div>
    );
  }

  let angle = -Math.PI / 2;
  const slices = segments
    .filter((s) => s.value > 0)
    .map((seg) => {
      const fraction = seg.value / total;
      const startAngle = angle;
      const endAngle = angle + fraction * 2 * Math.PI;
      angle = endAngle;
      const midAngle = (startAngle + endAngle) / 2;

      let path;
      if (fraction >= 0.9999) {
        path = [
          `M ${cx} ${cy - outerR}`,
          `A ${outerR} ${outerR} 0 1 1 ${cx} ${cy + outerR}`,
          `A ${outerR} ${outerR} 0 1 1 ${cx} ${cy - outerR}`,
          `M ${cx} ${cy - innerR}`,
          `A ${innerR} ${innerR} 0 1 0 ${cx} ${cy + innerR}`,
          `A ${innerR} ${innerR} 0 1 0 ${cx} ${cy - innerR}`,
          "Z",
        ].join(" ");
      } else {
        const x1 = cx + outerR * Math.cos(startAngle);
        const y1 = cy + outerR * Math.sin(startAngle);
        const x2 = cx + outerR * Math.cos(endAngle);
        const y2 = cy + outerR * Math.sin(endAngle);
        const ix1 = cx + innerR * Math.cos(endAngle);
        const iy1 = cy + innerR * Math.sin(endAngle);
        const ix2 = cx + innerR * Math.cos(startAngle);
        const iy2 = cy + innerR * Math.sin(startAngle);
        const large = fraction > 0.5 ? 1 : 0;
        path = `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${large} 1 ${x2} ${y2} L ${ix1} ${iy1} A ${innerR} ${innerR} 0 ${large} 0 ${ix2} ${iy2} Z`;
      }
      return { ...seg, path, fraction, midAngle };
    });

  function handleSliceEnter(e, slice) {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHoveredLabel(slice.label);
    setTooltip({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      label: slice.label,
      value: slice.value,
      fraction: slice.fraction,
      color: slice.color,
    });
  }

  function handleSliceMove(e) {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip((prev) =>
      prev ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top } : null
    );
  }

  function handleSliceLeave() {
    setHoveredLabel(null);
    setTooltip(null);
  }

  return (
    <div
      ref={wrapperRef}
      className="relative mt-4 flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-8"
    >
      <div className="shrink-0">
        <svg width="170" height="170" viewBox="0 0 170 170" style={{ overflow: "visible" }}>
          {slices.map((slice) => {
            const isHov = hoveredLabel === slice.label;
            const dx = isHov ? (Math.cos(slice.midAngle) * POP).toFixed(2) : 0;
            const dy = isHov ? (Math.sin(slice.midAngle) * POP).toFixed(2) : 0;
            return (
              <path
                key={slice.label}
                d={slice.path}
                fill={slice.color}
                stroke="white"
                strokeWidth={isHov ? 1.5 : 2}
                transform={`translate(${dx},${dy})`}
                style={{ cursor: "pointer", transition: "transform 0.18s ease" }}
                onMouseEnter={(e) => handleSliceEnter(e, slice)}
                onMouseMove={handleSliceMove}
                onMouseLeave={handleSliceLeave}
              />
            );
          })}
          <text x={cx} y={cy - 6} textAnchor="middle" fill="#0f172a" fontSize="22" fontWeight="700">
            {total}
          </text>
          <text x={cx} y={cy + 13} textAnchor="middle" fill="#94a3b8" fontSize="11">
            total tasks
          </text>
        </svg>
      </div>

      <div className="w-full max-w-[200px] space-y-1.5">
        {segments.map((seg) => (
          <div
            key={seg.label}
            className={`flex cursor-default items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors ${
              hoveredLabel === seg.label ? "bg-slate-50" : ""
            }`}
            onMouseEnter={() => setHoveredLabel(seg.label)}
            onMouseLeave={() => setHoveredLabel(null)}
          >
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-sm transition-transform"
                style={{
                  backgroundColor: seg.color,
                  transform: hoveredLabel === seg.label ? "scale(1.3)" : "scale(1)",
                }}
              />
              <span className="truncate text-sm font-medium text-slate-600">
                {seg.label}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              <span className="text-sm font-bold text-slate-900">{seg.value}</span>
              <span className="w-8 text-right text-xs text-slate-400">
                {total > 0 ? `${Math.round((seg.value / total) * 100)}%` : "—"}
              </span>
            </div>
          </div>
        ))}
      </div>

      {tooltip && (
        <div
          className="pointer-events-none absolute z-20 rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg"
          style={{
            left:
              tooltip.x > (wrapperRef.current?.clientWidth ?? 300) * 0.65
                ? tooltip.x - 148
                : tooltip.x + 12,
            top: Math.max(0, tooltip.y - 56),
          }}
        >
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: tooltip.color }} />
            <p className="text-xs font-semibold text-slate-700">{tooltip.label}</p>
          </div>
          <p className="mt-1 text-sm font-bold text-slate-900">
            {tooltip.value}{" "}
            <span className="text-xs font-medium text-slate-500">
              {tooltip.value === 1 ? "task" : "tasks"}
            </span>
          </p>
          <p className="text-[11px] text-slate-400">
            {Math.round(tooltip.fraction * 100)}% of all tasks
          </p>
        </div>
      )}
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

  const chartSegments = useMemo(
    () => [
      { label: "Todo",           value: taskSummary.todo,          color: "#64748b" },
      { label: "In Progress",    value: taskSummary.inProgress,    color: "#3b82f6" },
      { label: "Pending Review", value: taskSummary.pendingReview, color: "#f59e0b" },
      { label: "Done",           value: taskSummary.done,          color: "#22c55e" },
    ],
    [taskSummary]
  );

  const completionChartData = useMemo(() => {
    // Fixed 7-day window: today and the 6 preceding days
    const allDates = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      allDates.push(d.toISOString().slice(0, 10));
    }

    const startDate = allDates[0];
    const endDate = allDates[6];

    const dateOf = (t) =>
      (t.updated_at || t.due_date || t.created_at || "").slice(0, 10);

    const byDate = {};
    for (const task of stats.tasks.filter((t) => t.status === "done")) {
      const d = dateOf(task);
      if (d >= startDate && d <= endDate) byDate[d] = (byDate[d] || 0) + 1;
    }

    let cum = 0;
    const points = allDates.map((date) => {
      cum += byDate[date] || 0;
      return { date, cumulative: cum };
    });

    if (cum === 0) return { points: [], maxCount: 0 };

    return { points, maxCount: cum };
  }, [stats.tasks]);

  async function loadDashboardData() {
    try {
      setIsLoading(true);

      if (isTeamMember) {
        const taskData = await taskApi.listMy();
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

          <div className="mt-6 grid gap-6 lg:grid-cols-3">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:col-span-2">
              <div className="mb-5">
                <h2 className="text-lg font-bold text-slate-900">
                  Task Completion Progress
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  7-day cumulative view with daily breakdown.
                </p>
              </div>
              <CumulativeLineChart data={completionChartData} />
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-1">
                <h2 className="text-lg font-bold text-slate-900">
                  Task Distribution
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Status breakdown of all tasks.
                </p>
              </div>
              <PieChart segments={chartSegments} />
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