export const PERIOD_OPTIONS = [
  { value: "this_week", label: "This Week" },
  { value: "this_month", label: "This Month" },
  { value: "this_quarter", label: "This Quarter" },
  { value: "this_year", label: "This Year" },
  { value: "custom", label: "Custom" },
];

export const PERFORMANCE_BADGE = {
  Excellent: "bg-emerald-100 text-emerald-700",
  "Very Good": "bg-teal-100 text-teal-700",
  Good: "bg-blue-100 text-blue-700",
  "Needs Improvement": "bg-amber-100 text-amber-700",
  Poor: "bg-red-100 text-red-700",
};

export const SCORE_IMPACT_CFG = {
  completed_early: { label: "Completed Early", badge: "bg-emerald-100 text-emerald-700" },
  completed_on_time: { label: "Completed On Time", badge: "bg-teal-100 text-teal-700" },
  completed_late: { label: "Completed Late", badge: "bg-amber-100 text-amber-700" },
  completed: { label: "Completed", badge: "bg-slate-100 text-slate-700" },
  overdue: { label: "Overdue", badge: "bg-red-100 text-red-700" },
  pending: { label: "Pending", badge: "bg-slate-100 text-slate-600" },
};

export function getInitials(name) {
  return (name || "?")
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function formatDate(dateString) {
  if (!dateString) return "—";
  return new Date(`${dateString}T00:00:00`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** The standard 5-way task-status breakdown used by both the employee and team scoreboards. */
export function taskBreakdownSegments(summary) {
  return [
    { label: "Completed Early", value: summary.completed_before_due, color: "#10b981" },
    { label: "Completed On Time", value: summary.completed_on_due, color: "#3b82f6" },
    { label: "Completed Late", value: summary.completed_after_due, color: "#f59e0b" },
    { label: "Overdue", value: summary.overdue, color: "#ef4444" },
    { label: "Pending", value: summary.pending, color: "#64748b" },
  ];
}

export function StatCard({ label, value, tone = "slate" }) {
  const toneClass = {
    slate: "text-slate-900",
    emerald: "text-emerald-600",
    amber: "text-amber-600",
    red: "text-red-600",
    blue: "text-blue-600",
  }[tone];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm font-medium text-slate-500">{label}</p>
      <p className={`mt-2 text-3xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}
