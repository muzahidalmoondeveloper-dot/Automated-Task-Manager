import { useRef, useState } from "react";

/**
 * Ring-style donut chart with hover highlighting + tooltip, shared by the
 * Employee and Team scoreboards. `segments` is [{ label, value, color }].
 */
export default function RingChart({ segments, centerLabel = "total tasks" }) {
  const wrapperRef = useRef(null);
  const [hoveredLabel, setHoveredLabel] = useState(null);
  const [tooltip, setTooltip] = useState(null);

  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const cx = 85, cy = 85, r = 62;
  const circumference = 2 * Math.PI * r;
  const GAP = 6;

  if (total === 0) {
    return (
      <div className="flex justify-center">
        <svg width="170" height="170" viewBox="0 0 170 170">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth="18" />
          <text x={cx} y={cy + 5} textAnchor="middle" fill="#94a3b8" fontSize="12">No data</text>
        </svg>
      </div>
    );
  }

  const visibleSegments = segments.filter((s) => s.value > 0);
  let offset = 0;
  const rings = visibleSegments.map((seg) => {
    const fraction = seg.value / total;
    const rawLength = fraction * circumference;
    const gap = visibleSegments.length > 1 ? GAP : 0;
    const segLength = Math.max(rawLength - gap, 1);
    const dashOffset = -offset;
    offset += rawLength;
    const pct = Math.round(fraction * 100);
    return { ...seg, segLength, dashOffset, pct };
  });

  function showTooltip(e, ring) {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    setHoveredLabel(ring.label);
    setTooltip({ x: e.clientX - rect.left, y: e.clientY - rect.top, label: ring.label, value: ring.value, pct: ring.pct, color: ring.color });
  }

  function moveTooltip(e) {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return;
    setTooltip((prev) => (prev ? { ...prev, x: e.clientX - rect.left, y: e.clientY - rect.top } : null));
  }

  function clearHover() {
    setHoveredLabel(null);
    setTooltip(null);
  }

  return (
    <div ref={wrapperRef} className="relative flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-8">
      <svg width="170" height="170" viewBox="0 0 170 170" style={{ overflow: "visible" }}>
        <g transform={`rotate(-90 ${cx} ${cy})`}>
          {rings.map((ring) => {
            const isHov = hoveredLabel === ring.label;
            const dimmed = hoveredLabel !== null && !isHov;
            return (
              <circle
                key={ring.label}
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke={ring.color}
                strokeWidth={isHov ? 22 : 18}
                strokeLinecap="round"
                strokeDasharray={`${ring.segLength} ${circumference - ring.segLength}`}
                strokeDashoffset={ring.dashOffset}
                opacity={dimmed ? 0.35 : 1}
                style={{ cursor: "pointer", transition: "stroke-width 0.15s ease, opacity 0.15s ease" }}
                onMouseEnter={(e) => showTooltip(e, ring)}
                onMouseMove={moveTooltip}
                onMouseLeave={clearHover}
              />
            );
          })}
        </g>
        <text x={cx} y={cy - 6} textAnchor="middle" fill="#0f172a" fontSize="22" fontWeight="700">{total}</text>
        <text x={cx} y={cy + 13} textAnchor="middle" fill="#94a3b8" fontSize="11">{centerLabel}</text>
      </svg>

      <div className="w-full max-w-[240px] space-y-1">
        {visibleSegments.map((seg) => {
          const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
          const isHov = hoveredLabel === seg.label;
          return (
            <div
              key={seg.label}
              onMouseEnter={(e) => showTooltip(e, { ...seg, pct })}
              onMouseMove={moveTooltip}
              onMouseLeave={clearHover}
              className={`flex cursor-default items-center justify-between gap-3 rounded-lg px-2.5 py-2 transition-colors ${isHov ? "bg-slate-50" : ""}`}
            >
              <div className="flex min-w-0 items-center gap-2">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm transition-transform"
                  style={{ backgroundColor: seg.color, transform: isHov ? "scale(1.3)" : "scale(1)" }}
                />
                <span className="truncate text-sm font-medium text-slate-600">{seg.label}</span>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <span className="text-sm font-bold text-slate-900">{seg.value}</span>
                <span className="text-xs text-slate-400">{pct}%</span>
              </div>
            </div>
          );
        })}
      </div>

      {tooltip && (
        <div
          className="pointer-events-none absolute z-20 min-w-[140px] rounded-xl border border-slate-100 bg-white px-4 py-3 shadow-xl"
          style={{
            left: tooltip.x > 140 ? tooltip.x - 155 : tooltip.x + 14,
            top: Math.max(4, tooltip.y - 60),
          }}
        >
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: tooltip.color }} />
            <p className="text-xs font-semibold text-slate-600">{tooltip.label}</p>
          </div>
          <p className="mt-1.5 text-2xl font-bold text-slate-900">{tooltip.value}</p>
          <p className="text-xs text-slate-400">{tooltip.pct}% of total tasks</p>
        </div>
      )}
    </div>
  );
}
