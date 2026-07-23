import { useMemo, useState } from "react";
import { useAuth } from "../context/AuthContext";
import DatePicker from "./DatePicker";

// ─── Computation helpers ──────────────────────────────────────────────────────

function getLatestEntry(kpi) {
  if (!kpi.entries?.length) return null;
  return [...kpi.entries].sort((a, b) => b.period_start.localeCompare(a.period_start))[0];
}

function computeProgress(kpi) {
  if (!kpi.reference_value || kpi.reference_value === 0) return null;
  const entry = getLatestEntry(kpi);
  if (entry?.value == null) return 0;
  return Math.min(100, Math.round((entry.value / kpi.reference_value) * 100));
}

function computeStatus(kpi) {
  const pct = computeProgress(kpi);
  if (pct === null) return "In Progress";
  if (pct >= 100) return "Completed";
  if (pct >= 70) return "In Progress";
  if (pct >= 40) return "At Risk";
  return "Overdue";
}

function getAvgProgress(kpis) {
  const vals = kpis.map(computeProgress).filter((p) => p !== null);
  if (!vals.length) return 0;
  return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
}

function fmtDate(val) {
  if (!val) return "N/A";
  try {
    const d = new Date(String(val).includes("T") ? val : val + "T00:00:00");
    return d.toLocaleDateString("en-US", { day: "2-digit", month: "short", year: "numeric" });
  } catch { return String(val); }
}

function stripHtml(html) {
  return html ? html.replace(/<[^>]+>/g, "").trim() : "";
}

const STATUS_COLOR  = { Completed: "#16a34a", "In Progress": "#2563eb", "At Risk": "#d97706", Overdue: "#dc2626" };
const STATUS_BG     = { Completed: "#dcfce7", "In Progress": "#dbeafe", "At Risk": "#fef3c7", Overdue:  "#fee2e2" };
const STATUS_HEALTH = { Completed: "🟢 Excellent", "In Progress": "🟡 On Track", "At Risk": "🟠 Needs Attention", Overdue: "🔴 Critical" };

// ─── SVG helpers ──────────────────────────────────────────────────────────────

function toXY(cx, cy, r, deg) {
  const rad = (deg - 90) * (Math.PI / 180);
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// ─── SVG Donut Chart ──────────────────────────────────────────────────────────

function DonutChart({ statusGroups }) {
  const data = [
    { label: "Completed",   count: statusGroups.Completed.length,      color: STATUS_COLOR.Completed },
    { label: "In Progress", count: statusGroups["In Progress"].length,  color: STATUS_COLOR["In Progress"] },
    { label: "At Risk",     count: statusGroups["At Risk"].length,      color: STATUS_COLOR["At Risk"] },
    { label: "Overdue",     count: statusGroups.Overdue.length,         color: STATUS_COLOR.Overdue },
  ].filter((d) => d.count > 0);

  const total = data.reduce((s, d) => s + d.count, 0);
  if (!total) return <p style={{ textAlign: "center", color: "#94a3b8", margin: 0 }}>No data.</p>;

  const cx = 90, cy = 90, r = 72, inner = 46;
  let angle = 0;
  const slices = data.map((d) => {
    const sweep = (d.count / total) * 360;
    const start = angle;
    angle += sweep;
    return { ...d, start, end: angle };
  });

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 32, flexWrap: "wrap" }}>
      <svg viewBox="0 0 180 180" width={180} height={180} style={{ flexShrink: 0 }}>
        {slices.map((s, i) => {
          const sweep = s.end - s.start;
          const p1 = toXY(cx, cy, r, s.start);
          const p2 = toXY(cx, cy, r, s.end - 0.3);
          const p3 = toXY(cx, cy, inner, s.end - 0.3);
          const p4 = toXY(cx, cy, inner, s.start);
          const lg = sweep > 180 ? 1 : 0;
          return (
            <path key={i}
              d={`M${p1.x},${p1.y} A${r},${r} 0 ${lg},1 ${p2.x},${p2.y} L${p3.x},${p3.y} A${inner},${inner} 0 ${lg},0 ${p4.x},${p4.y} Z`}
              fill={s.color} />
          );
        })}
        <circle cx={cx} cy={cy} r={inner - 1} fill="white" />
        <text x={cx} y={cy - 8} textAnchor="middle" fontSize="22" fontWeight="bold" fill="#0f172a">{total}</text>
        <text x={cx} y={cy + 11} textAnchor="middle" fontSize="10" fill="#64748b">Total KPIs</text>
      </svg>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data.map((d) => (
          <div key={d.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: d.color, flexShrink: 0 }} />
            <span style={{ fontSize: 13, color: "#475569", minWidth: 90 }}>{d.label}</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b" }}>{d.count}</span>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>({Math.round((d.count / total) * 100)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SVG Bar Chart ────────────────────────────────────────────────────────────

function BarChart({ kpis }) {
  if (!kpis.length) return null;
  const W = 520, H = 190, padL = 38, padB = 46, padT = 16, padR = 10;
  const chartW = W - padL - padR;
  const chartH = H - padB - padT;
  const spacing = chartW / kpis.length;
  const barW = Math.min(38, spacing * 0.6);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxWidth: W, overflow: "visible" }}>
      {[0, 25, 50, 75, 100].map((v) => {
        const y = padT + chartH - (v / 100) * chartH;
        return (
          <g key={v}>
            <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e2e8f0" strokeWidth="1" />
            <text x={padL - 5} y={y + 4} textAnchor="end" fontSize="9" fill="#94a3b8">{v}%</text>
          </g>
        );
      })}
      <line x1={padL} y1={padT + chartH} x2={W - padR} y2={padT + chartH} stroke="#cbd5e1" strokeWidth="1.5" />
      {kpis.map((kpi, i) => {
        const pct = computeProgress(kpi) ?? 0;
        const bH = Math.max(2, (pct / 100) * chartH);
        const x = padL + i * spacing + (spacing - barW) / 2;
        const y = padT + chartH - bH;
        const color = STATUS_COLOR[computeStatus(kpi)];
        const label = kpi.title.length > 11 ? kpi.title.slice(0, 10) + "…" : kpi.title;
        return (
          <g key={kpi.id}>
            <rect x={x} y={y} width={barW} height={bH} fill={color} rx="3" />
            {pct >= 8 && (
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" fontSize="9" fontWeight="600" fill={color}>{pct}%</text>
            )}
            <text x={x + barW / 2} y={padT + chartH + 15} textAnchor="middle" fontSize="8.5" fill="#64748b">{label}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Shared inline style tokens ────────────────────────────────────────────────

const T = {
  table:   { width: "100%", borderCollapse: "collapse", fontSize: 13 },
  th:      { padding: "9px 12px", textAlign: "left", backgroundColor: "#0f4c81", color: "white", fontWeight: 600, fontSize: 12 },
  td:      { padding: "9px 12px", borderBottom: "1px solid #e2e8f0", color: "#334155", fontSize: 13, verticalAlign: "top" },
  tdAlt:   { padding: "9px 12px", borderBottom: "1px solid #e2e8f0", color: "#334155", fontSize: 13, verticalAlign: "top", backgroundColor: "#f8fafc" },
  section: { marginBottom: 36 },
  page:    { padding: "36px 48px", backgroundColor: "white", position: "relative" },
};

// ─── Shared small components ──────────────────────────────────────────────────

function StatusBadge({ status }) {
  return (
    <span style={{ display: "inline-block", padding: "2px 10px", borderRadius: 99, fontSize: 11, fontWeight: 600,
      color: STATUS_COLOR[status], backgroundColor: STATUS_BG[status] }}>
      {status}
    </span>
  );
}

function ProgressBar({ pct }) {
  const color = pct >= 100 ? "#16a34a" : pct >= 70 ? "#2563eb" : pct >= 40 ? "#d97706" : "#dc2626";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ flex: 1, height: 6, backgroundColor: "#e2e8f0", borderRadius: 3, overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", backgroundColor: color, borderRadius: 3 }} />
      </div>
      <span style={{ fontSize: 12, fontWeight: 600, color: "#475569", minWidth: 34, textAlign: "right" }}>{pct}%</span>
    </div>
  );
}

function Heading({ children }) {
  return (
    <div style={{ borderLeft: "4px solid #0f4c81", paddingLeft: 12, marginBottom: 16 }}>
      <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: "#0f172a" }}>{children}</h2>
    </div>
  );
}

function SubHeading({ children }) {
  return (
    <h4 style={{ margin: "0 0 10px", fontSize: 11, fontWeight: 700, color: "#0f4c81",
      textTransform: "uppercase", letterSpacing: 0.6 }}>
      {children}
    </h4>
  );
}

function Footer({ config }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
      padding: "10px 0 0", borderTop: "1px solid #e2e8f0", marginTop: 32, fontSize: 11, color: "#94a3b8" }}>
      <span>Generated by Automated Task Manager · Confidential</span>
      <span>{config.orgName || ""}{config.projectName ? ` · ${config.projectName}` : ""} · KPI Performance Report</span>
    </div>
  );
}

// ─── Report sections ──────────────────────────────────────────────────────────

function CoverPage({ config, kpisCount }) {
  const period = config.periodStart && config.periodEnd
    ? `${fmtDate(config.periodStart)} – ${fmtDate(config.periodEnd)}`
    : "—";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center",
      alignItems: "center", background: "linear-gradient(145deg,#0f4c81 0%,#1e40af 100%)",
      color: "white", padding: 60, textAlign: "center", pageBreakAfter: "always", breakAfter: "page" }}>
      <div style={{ width: 80, height: 80, borderRadius: 20, backgroundColor: "rgba(255,255,255,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 28 }}>
        <svg width="42" height="42" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8">
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
      </div>

      <h1 style={{ margin: "0 0 4px", fontSize: 34, fontWeight: 800, letterSpacing: -0.5 }}>KPI PERFORMANCE REPORT</h1>
      <div style={{ width: 72, height: 3, backgroundColor: "rgba(255,255,255,0.35)", margin: "14px auto 30px" }} />

      <div style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 16, padding: "28px 36px",
        maxWidth: 460, width: "100%", border: "1px solid rgba(255,255,255,0.15)" }}>
        {[
          ["Organization",   config.orgName || "—"],
          ["Project",        config.projectName || "—"],
          ["Department",     config.department || "—"],
          ["Report Type",    "KPI Performance Report"],
          ["Report Period",  period],
          ["Generated By",   config.generatedBy || "—"],
          ["Generated On",   fmtDate(new Date().toISOString().slice(0, 10))],
          ["Total KPIs",     kpisCount],
        ].map(([label, value], i, arr) => (
          <div key={label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "9px 0", borderBottom: i < arr.length - 1 ? "1px solid rgba(255,255,255,0.1)" : "none" }}>
            <span style={{ color: "rgba(255,255,255,0.65)", fontSize: 13 }}>{label}</span>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{value}</span>
          </div>
        ))}
      </div>

      <p style={{ marginTop: 36, color: "rgba(255,255,255,0.4)", fontSize: 12 }}>
        Confidential · Automated Task Manager
      </p>
    </div>
  );
}

function ExecutiveSummary({ kpis, statusGroups }) {
  const total = kpis.length;
  const withTarget = kpis.filter((k) => k.reference_value);
  const overall = withTarget.length
    ? Math.round(withTarget.reduce((s, k) => s + (computeProgress(k) ?? 0), 0) / withTarget.length)
    : 0;

  const rows = [
    ["Total KPIs",            total],
    ["Completed",             statusGroups.Completed.length],
    ["In Progress",           statusGroups["In Progress"].length],
    ["At Risk",               statusGroups["At Risk"].length],
    ["Overdue",               statusGroups.Overdue.length],
    ["Overall Progress",      `${overall}%`],
    ["Average KPI Progress",  `${getAvgProgress(kpis)}%`],
  ];

  return (
    <div style={T.section}>
      <Heading>Executive Summary</Heading>
      <table style={T.table}>
        <thead><tr><th style={T.th}>Metric</th><th style={T.th}>Value</th></tr></thead>
        <tbody>
          {rows.map(([label, val], i) => (
            <tr key={label}>
              <td style={i % 2 === 0 ? T.td : T.tdAlt}>{label}</td>
              <td style={{ ...(i % 2 === 0 ? T.td : T.tdAlt), fontWeight: 600 }}>{val}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function KPIListTable({ kpis }) {
  return (
    <div style={T.section}>
      <Heading>KPI List</Heading>
      <table style={T.table}>
        <thead>
          <tr>
            {["#", "KPI Name", "Owner", "Group", "Status", "Progress", "Target"].map((h) => (
              <th key={h} style={T.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {kpis.map((kpi, i) => {
            const status = computeStatus(kpi);
            const pct = computeProgress(kpi);
            return (
              <tr key={kpi.id}>
                <td style={i % 2 === 0 ? T.td : T.tdAlt}>{i + 1}</td>
                <td style={{ ...(i % 2 === 0 ? T.td : T.tdAlt), fontWeight: 600 }}>{kpi.title}</td>
                <td style={i % 2 === 0 ? T.td : T.tdAlt}>{kpi.owner?.full_name || "—"}</td>
                <td style={i % 2 === 0 ? T.td : T.tdAlt}>{kpi.kpi_group || "—"}</td>
                <td style={i % 2 === 0 ? T.td : T.tdAlt}><StatusBadge status={status} /></td>
                <td style={{ ...(i % 2 === 0 ? T.td : T.tdAlt), minWidth: 120 }}>
                  {pct !== null ? <ProgressBar pct={pct} /> : <span style={{ color: "#94a3b8" }}>No target set</span>}
                </td>
                <td style={i % 2 === 0 ? T.td : T.tdAlt}>{kpi.reference_value ?? "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function KPIDetailCard({ kpi, index, comment }) {
  const status = computeStatus(kpi);
  const pct = computeProgress(kpi) ?? 0;
  const latest = getLatestEntry(kpi);
  const taskLinks = (kpi.links || []).filter((l) => l.linked_type === "task");

  const timeline = [];
  timeline.push({ date: fmtDate(kpi.created_at), event: "KPI Created" });
  [...(kpi.entries || [])]
    .sort((a, b) => a.period_start.localeCompare(b.period_start))
    .slice(0, 5)
    .forEach((e) => {
      if (e.value != null) timeline.push({ date: fmtDate(e.period_start), event: `Value recorded: ${e.value}` });
    });

  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: 12, overflow: "hidden", marginBottom: 36 }}>
      {/* Card header */}
      <div style={{ backgroundColor: "#0f4c81", color: "white", padding: "14px 20px",
        display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16 }}>
        <div>
          <div style={{ fontSize: 10, opacity: 0.65, letterSpacing: 0.5, marginBottom: 3 }}>KPI {index + 1}</div>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{kpi.title}</h3>
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Two-column body */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24, padding: 20 }}>
        {/* Left: Basic info */}
        <div>
          <SubHeading>Basic Information</SubHeading>
          <table style={{ ...T.table, fontSize: 12 }}>
            <tbody>
              {[
                ["KPI Name",    kpi.title],
                ["Owner",       kpi.owner?.full_name || "—"],
                ["Group",       kpi.kpi_group || "—"],
                ["Target Type", kpi.target_type],
                ["Target",      kpi.reference_value ?? "—"],
                ["Interpolation", kpi.interpolation],
                ["Start Date",  fmtDate(kpi.created_at)],
              ].map(([k, v], i) => (
                <tr key={k}>
                  <td style={{ ...T.td, ...(i % 2 === 1 ? { backgroundColor: "#f8fafc" } : {}), fontWeight: 600, width: "42%", fontSize: 12, padding: "7px 10px" }}>{k}</td>
                  <td style={{ ...T.td, ...(i % 2 === 1 ? { backgroundColor: "#f8fafc" } : {}), fontSize: 12, padding: "7px 10px" }}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {kpi.description && (
            <div style={{ marginTop: 16 }}>
              <SubHeading>Description</SubHeading>
              <p style={{ margin: 0, fontSize: 12, color: "#475569", lineHeight: 1.65 }}>{stripHtml(kpi.description)}</p>
            </div>
          )}
        </div>

        {/* Right: Progress + Health */}
        <div>
          <SubHeading>Progress</SubHeading>
          <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
            {[
              { label: "Target",   value: kpi.reference_value ?? "—", color: "#0f4c81" },
              { label: "Current",  value: latest?.value ?? "—",        color: STATUS_COLOR[status] },
              { label: "Progress", value: `${pct}%`,                   color: STATUS_COLOR[status] },
            ].map((c) => (
              <div key={c.label} style={{ flex: 1, textAlign: "center", padding: "10px 6px",
                border: "1px solid #e2e8f0", borderRadius: 8, backgroundColor: "#f8fafc" }}>
                <div style={{ fontSize: 20, fontWeight: 800, color: c.color }}>{c.value}</div>
                <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>{c.label}</div>
              </div>
            ))}
          </div>
          <ProgressBar pct={pct} />

          <div style={{ marginTop: 16 }}>
            <SubHeading>Performance Health</SubHeading>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#334155" }}>{STATUS_HEALTH[status]}</div>
          </div>

          {/* Linked Rock */}
          <div style={{ marginTop: 16 }}>
            <SubHeading>Linked Rock</SubHeading>
            {kpi.rock ? (
              <div style={{ padding: "10px 12px", backgroundColor: "#eff6ff", border: "1px solid #bfdbfe",
                borderRadius: 8, fontSize: 13, fontWeight: 600, color: "#1d4ed8" }}>
                {kpi.rock.title}
              </div>
            ) : <span style={{ fontSize: 12, color: "#94a3b8" }}>None</span>}
          </div>

          {/* Related Tasks */}
          {taskLinks.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <SubHeading>Related To-Dos</SubHeading>
              <table style={{ ...T.table, fontSize: 12 }}>
                <thead><tr><th style={{ ...T.th, fontSize: 11, padding: "6px 10px" }}>Task</th></tr></thead>
                <tbody>
                  {taskLinks.map((t, i) => (
                    <tr key={t.linked_id}>
                      <td style={{ ...T.td, ...(i % 2 === 1 ? { backgroundColor: "#f8fafc" } : {}), fontSize: 12, padding: "6px 10px" }}>{t.title}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Timeline + Comment row */}
      <div style={{ padding: "0 20px 20px", display: "grid", gridTemplateColumns: comment ? "1fr 1fr" : "1fr", gap: 20 }}>
        <div>
          <SubHeading>Timeline</SubHeading>
          {timeline.length === 0 ? (
            <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>No entries yet.</p>
          ) : (
            <div style={{ position: "relative", paddingLeft: 18 }}>
              <div style={{ position: "absolute", left: 5, top: 6, bottom: 0, width: 2, backgroundColor: "#e2e8f0" }} />
              {timeline.map((item, i) => (
                <div key={i} style={{ marginBottom: 10, position: "relative" }}>
                  <div style={{ position: "absolute", left: -16, top: 4, width: 8, height: 8, borderRadius: "50%",
                    backgroundColor: "#0f4c81", border: "2px solid white", boxShadow: "0 0 0 1.5px #0f4c81" }} />
                  <div style={{ fontSize: 10, color: "#64748b" }}>{item.date}</div>
                  <div style={{ fontSize: 12, fontWeight: 500, color: "#334155" }}>{item.event}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {comment && (
          <div>
            <SubHeading>Manager Comment</SubHeading>
            <div style={{ padding: 14, backgroundColor: "#fefce8", border: "1px solid #fef08a",
              borderRadius: 8, fontSize: 13, color: "#713f12", lineHeight: 1.65 }}>
              {comment}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function OwnerPerformanceTable({ kpis }) {
  const map = {};
  kpis.forEach((k) => {
    const name = k.owner?.full_name || "Unassigned";
    if (!map[name]) map[name] = { kpis: [], pctSum: 0, count: 0 };
    const pct = computeProgress(k);
    map[name].kpis.push(k);
    if (pct !== null) { map[name].pctSum += pct; map[name].count++; }
  });
  const rows = Object.entries(map)
    .map(([name, d]) => ({
      name,
      total: d.kpis.length,
      completed: d.kpis.filter((k) => computeStatus(k) === "Completed").length,
      avg: d.count ? Math.round(d.pctSum / d.count) : 0,
    }))
    .sort((a, b) => b.avg - a.avg);

  return (
    <div style={T.section}>
      <Heading>Owner Performance</Heading>
      <table style={T.table}>
        <thead>
          <tr>
            {["Owner", "KPIs Assigned", "Completed", "Avg Progress"].map((h) => (
              <th key={h} style={T.th}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.name}>
              <td style={i % 2 === 0 ? T.td : T.tdAlt}><strong>{r.name}</strong></td>
              <td style={i % 2 === 0 ? T.td : T.tdAlt}>{r.total}</td>
              <td style={i % 2 === 0 ? T.td : T.tdAlt}>{r.completed}</td>
              <td style={{ ...(i % 2 === 0 ? T.td : T.tdAlt), minWidth: 130 }}><ProgressBar pct={r.avg} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OverallAnalytics({ kpis, statusGroups }) {
  const total = kpis.length;
  const withData = kpis.filter((k) => k.entries?.length > 0).length;
  const totalEntries = kpis.reduce((s, k) => s + (k.entries?.length || 0), 0);
  const totalNotes = kpis.reduce((s, k) => s + k.entries.reduce((es, e) => es + (e.notes?.length || 0), 0), 0);
  const completionRate = total ? Math.round((statusGroups.Completed.length / total) * 100) : 0;

  const stats = [
    ["Total KPIs Tracked",    total],
    ["KPIs With Data",        withData],
    ["Total Entries",         totalEntries],
    ["Notes Added",           totalNotes],
    ["Completion Rate",       `${completionRate}%`],
    ["Avg Progress",          `${getAvgProgress(kpis)}%`],
    ["KPIs With Owner",       kpis.filter((k) => k.owner).length],
    ["KPIs With Linked Items",kpis.filter((k) => k.links?.length > 0).length],
  ];

  return (
    <div style={T.section}>
      <Heading>Overall Analytics</Heading>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        {stats.map(([label, val]) => (
          <div key={label} style={{ padding: "14px 10px", textAlign: "center",
            border: "1px solid #e2e8f0", borderRadius: 10, backgroundColor: "#f8fafc" }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#0f4c81" }}>{val}</div>
            <div style={{ fontSize: 11, color: "#64748b", marginTop: 4 }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function RisksTable({ kpis }) {
  const risks = kpis.filter((k) => ["At Risk", "Overdue"].includes(computeStatus(k)));
  return (
    <div style={T.section}>
      <Heading>Risks</Heading>
      {risks.length === 0 ? (
        <p style={{ margin: 0, fontSize: 14, color: "#16a34a", fontWeight: 500 }}>
          ✓ No at-risk or overdue KPIs identified.
        </p>
      ) : (
        <table style={T.table}>
          <thead>
            <tr>
              {["KPI", "Severity", "Owner", "Progress", "Recommended Action"].map((h) => (
                <th key={h} style={T.th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {risks.map((k, i) => {
              const status = computeStatus(k);
              return (
                <tr key={k.id}>
                  <td style={{ ...(i % 2 === 0 ? T.td : T.tdAlt), fontWeight: 600 }}>{k.title}</td>
                  <td style={i % 2 === 0 ? T.td : T.tdAlt}><StatusBadge status={status} /></td>
                  <td style={i % 2 === 0 ? T.td : T.tdAlt}>{k.owner?.full_name || "—"}</td>
                  <td style={{ ...(i % 2 === 0 ? T.td : T.tdAlt), minWidth: 100 }}><ProgressBar pct={computeProgress(k) ?? 0} /></td>
                  <td style={i % 2 === 0 ? T.td : T.tdAlt}>
                    {status === "Overdue"
                      ? "Immediate review required. Escalate to management."
                      : "Increase update frequency. Assign additional resources if needed."}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function RecommendationsList({ kpis, statusGroups }) {
  const recs = [];
  if (statusGroups.Overdue.length)
    recs.push(`Address ${statusGroups.Overdue.length} overdue KPI(s) immediately: ${statusGroups.Overdue.map((k) => k.title).join(", ")}.`);
  if (statusGroups["At Risk"].length)
    recs.push(`Closely monitor at-risk KPIs: ${statusGroups["At Risk"].map((k) => k.title).join(", ")}.`);
  if (kpis.some((k) => !k.owner))
    recs.push("Assign owners to all unowned KPIs to ensure clear accountability.");
  if (kpis.some((k) => !k.entries?.length))
    recs.push("Ensure all KPIs have at least one recorded entry to enable progress tracking.");
  if (kpis.some((k) => !k.reference_value))
    recs.push("Set reference (target) values for all KPIs to measure performance accurately.");
  recs.push("Conduct weekly KPI reviews to maintain momentum across all teams.");
  recs.push("Review owner workload balance to prevent bottlenecks on high-priority KPIs.");

  return (
    <div style={T.section}>
      <Heading>Recommendations</Heading>
      <ul style={{ margin: 0, paddingLeft: 20 }}>
        {recs.map((r, i) => (
          <li key={i} style={{ marginBottom: 10, fontSize: 13, color: "#334155", lineHeight: 1.65 }}>{r}</li>
        ))}
      </ul>
    </div>
  );
}

function ApprovalSection() {
  return (
    <div style={T.section}>
      <Heading>Approval</Heading>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 40, marginTop: 12 }}>
        {["Project Manager", "Engineering Manager", "Director"].map((role) => (
          <div key={role} style={{ textAlign: "center" }}>
            <div style={{ borderBottom: "1.5px solid #1e293b", marginBottom: 8, height: 52 }} />
            <div style={{ fontSize: 13, fontWeight: 600, color: "#334155" }}>{role}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>Date: ___________</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Full report document ─────────────────────────────────────────────────────

function ReportDocument({ kpis, config, comments }) {
  const statusGroups = useMemo(() => {
    const g = { Completed: [], "In Progress": [], "At Risk": [], Overdue: [] };
    kpis.forEach((k) => g[computeStatus(k)].push(k));
    return g;
  }, [kpis]);

  const docStyle = {
    fontFamily: "'Segoe UI','Helvetica Neue',Arial,sans-serif",
    backgroundColor: "white",
    color: "#1e293b",
    maxWidth: 900,
    margin: "0 auto",
  };

  return (
    <div id="kpi-report-print-area" style={docStyle}>
      {/* Cover */}
      <CoverPage config={config} kpisCount={kpis.length} />

      {/* Page 2 — Executive Summary + Charts */}
      <div style={T.page}>
        <ExecutiveSummary kpis={kpis} statusGroups={statusGroups} />

        <div style={T.section}>
          <Heading>KPI Status Overview</Heading>
          <div style={{ padding: 24, border: "1px solid #e2e8f0", borderRadius: 12, backgroundColor: "#fafafa" }}>
            <DonutChart statusGroups={statusGroups} />
          </div>
        </div>

        <div style={T.section}>
          <Heading>KPI Progress Overview</Heading>
          <div style={{ padding: 20, border: "1px solid #e2e8f0", borderRadius: 12, backgroundColor: "#fafafa", overflowX: "auto" }}>
            <BarChart kpis={kpis} />
          </div>
        </div>
        <Footer config={config} />
      </div>

      {/* Page 3 — KPI List */}
      <div style={{ ...T.page, pageBreakBefore: "always", breakBefore: "page" }}>
        <KPIListTable kpis={kpis} />
        <Footer config={config} />
      </div>

      {/* One page per KPI detail */}
      {kpis.map((kpi, i) => (
        <div key={kpi.id} style={{ ...T.page, pageBreakBefore: "always", breakBefore: "page" }}>
          <Heading>KPI Details</Heading>
          <KPIDetailCard kpi={kpi} index={i} comment={comments[kpi.id] || ""} />
          <Footer config={config} />
        </div>
      ))}

      {/* Analytics + Risks + Recommendations page */}
      <div style={{ ...T.page, pageBreakBefore: "always", breakBefore: "page" }}>
        <OwnerPerformanceTable kpis={kpis} />
        <OverallAnalytics kpis={kpis} statusGroups={statusGroups} />
        <RisksTable kpis={kpis} />
        <RecommendationsList kpis={kpis} statusGroups={statusGroups} />
        <Footer config={config} />
      </div>

      {/* Approval page */}
      <div style={{ ...T.page, pageBreakBefore: "always", breakBefore: "page" }}>
        <ApprovalSection />
        <Footer config={config} />
      </div>
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function KPIReportModal({ kpis, team, onClose }) {
  const { user } = useAuth();

  const [step, setStep] = useState("config");
  const [config, setConfig] = useState({
    orgName: "",
    projectName: "",
    department: "",
    periodStart: "",
    periodEnd: "",
    generatedBy: user?.full_name || "",
  });
  const [selectedIds, setSelectedIds] = useState(() => new Set(kpis.map((k) => k.id)));
  const [comments, setComments] = useState({});
  const [openCommentId, setOpenCommentId] = useState(null);

  const selectedKpis = useMemo(
    () => kpis.filter((k) => selectedIds.has(k.id)),
    [kpis, selectedIds]
  );

  function toggleKpi(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds(selectedIds.size === kpis.length ? new Set() : new Set(kpis.map((k) => k.id)));
  }

  function handlePrint() {
    const el = document.createElement("style");
    el.id = "__kpi_print__";
    el.textContent = `
      @media print {
        body > * { visibility: hidden !important; }
        #kpi-report-print-area { visibility: visible !important; position: fixed !important;
          top: 0; left: 0; width: 100%; background: white; z-index: 999999; }
        #kpi-report-print-area * { visibility: visible !important; }
        @page { size: A4; margin: 10mm; }
      }
    `;
    document.head.appendChild(el);
    window.print();
    setTimeout(() => document.getElementById("__kpi_print__")?.remove(), 2000);
  }

  // ── Preview step ────────────────────────────────────────────────────────────
  if (step === "preview") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-slate-100">
        {/* Preview toolbar */}
        <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-3 shadow-sm">
          <button
            type="button"
            onClick={() => setStep("config")}
            className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M11.78 5.22a.75.75 0 010 1.06L8.06 10l3.72 3.72a.75.75 0 11-1.06 1.06l-4.25-4.25a.75.75 0 010-1.06l4.25-4.25a.75.75 0 011.06 0z" clipRule="evenodd" />
            </svg>
            Back to Config
          </button>

          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500">{selectedKpis.length} KPI{selectedKpis.length !== 1 ? "s" : ""} · Preview</span>
            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 rounded-lg bg-teal-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-teal-700 active:scale-95"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5 4v3H4a2 2 0 00-2 2v3a2 2 0 002 2h1v2a1 1 0 001 1h8a1 1 0 001-1v-2h1a2 2 0 002-2V9a2 2 0 00-2-2h-1V4a1 1 0 00-1-1H6a1 1 0 00-1 1zm2 0h6v3H7V4zm-1 9v-2h8v2H6z" clipRule="evenodd" />
              </svg>
              Print / Download PDF
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50"
            >
              <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
              </svg>
            </button>
          </div>
        </div>

        {/* Scrollable report preview */}
        <div className="flex-1 overflow-y-auto py-8">
          <ReportDocument kpis={selectedKpis} config={config} comments={comments} />
        </div>
      </div>
    );
  }

  // ── Config step ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/50 p-6 backdrop-blur-sm">
      <div className="my-4 w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100">
              <svg className="h-5 w-5 text-teal-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Generate KPI Report</h2>
              <p className="text-xs text-slate-500">Configure then download a professional PDF</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <div className="space-y-6 p-6">
          {/* Report metadata */}
          <div>
            <p className="mb-3 text-sm font-semibold text-slate-700">Report Information</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "orgName",      label: "Organization",  placeholder: "e.g. MonsterOps Ltd." },
                { key: "projectName",  label: "Project",       placeholder: "e.g. Task Management System" },
                { key: "department",   label: "Department",    placeholder: "e.g. Engineering" },
                { key: "generatedBy",  label: "Generated By",  placeholder: "Your full name" },
              ].map(({ key, label, placeholder }) => (
                <div key={key}>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-500">{label}</label>
                  <input
                    value={config[key]}
                    onChange={(e) => setConfig((c) => ({ ...c, [key]: e.target.value }))}
                    placeholder={placeholder}
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100"
                  />
                </div>
              ))}
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Period Start</label>
                <DatePicker value={config.periodStart}
                  onChange={(e) => setConfig((c) => ({ ...c, periodStart: e.target.value }))} />
              </div>
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Period End</label>
                <DatePicker value={config.periodEnd}
                  onChange={(e) => setConfig((c) => ({ ...c, periodEnd: e.target.value }))} />
              </div>
            </div>
          </div>

          {/* KPI selection */}
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-slate-700">Select KPIs to Include</p>
              <button type="button" onClick={toggleAll}
                className="text-xs font-medium text-teal-600 hover:underline">
                {selectedIds.size === kpis.length ? "Deselect All" : "Select All"}
              </button>
            </div>
            <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-200 divide-y divide-slate-100">
              {kpis.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-400">No KPIs available.</p>
              ) : kpis.map((kpi) => {
                const status = computeStatus(kpi);
                const pct = computeProgress(kpi);
                return (
                  <label key={kpi.id} className="flex cursor-pointer items-center gap-3 px-4 py-3 hover:bg-slate-50">
                    <input type="checkbox" checked={selectedIds.has(kpi.id)} onChange={() => toggleKpi(kpi.id)}
                      className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500" />
                    <span className="flex-1 text-sm font-medium text-slate-800 truncate">{kpi.title}</span>
                    {kpi.owner && <span className="shrink-0 text-xs text-slate-500">{kpi.owner.full_name}</span>}
                    <span style={{ color: STATUS_COLOR[status], fontSize: 11, fontWeight: 600, flexShrink: 0 }}>{status}</span>
                    {pct !== null && <span className="shrink-0 text-xs font-semibold text-slate-500">{pct}%</span>}
                  </label>
                );
              })}
            </div>
          </div>

          {/* Manager comments */}
          {selectedIds.size > 0 && (
            <div>
              <p className="mb-3 text-sm font-semibold text-slate-700">
                Manager Comments <span className="font-normal text-slate-400">(optional, per KPI)</span>
              </p>
              <div className="space-y-2">
                {kpis.filter((k) => selectedIds.has(k.id)).map((kpi) => (
                  <div key={kpi.id} className="overflow-hidden rounded-xl border border-slate-200">
                    <button type="button"
                      onClick={() => setOpenCommentId((v) => (v === kpi.id ? null : kpi.id))}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-slate-50">
                      <span className="truncate text-sm font-medium text-slate-700">{kpi.title}</span>
                      <div className="flex shrink-0 items-center gap-2">
                        {comments[kpi.id] && <span className="h-1.5 w-1.5 rounded-full bg-teal-500" />}
                        <svg className={`h-4 w-4 text-slate-400 transition-transform ${openCommentId === kpi.id ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                        </svg>
                      </div>
                    </button>
                    {openCommentId === kpi.id && (
                      <div className="border-t border-slate-100 px-4 py-3">
                        <textarea
                          rows={3}
                          value={comments[kpi.id] || ""}
                          onChange={(e) => setComments((c) => ({ ...c, [kpi.id]: e.target.value }))}
                          placeholder="Add a manager comment for this KPI..."
                          className="w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 outline-none focus:border-teal-500"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 px-6 py-4">
          <span className="text-sm text-slate-400">{selectedIds.size} of {kpis.length} KPIs selected</span>
          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button type="button" disabled={selectedIds.size === 0} onClick={() => setStep("preview")}
              className="rounded-xl bg-teal-600 px-5 py-2 text-sm font-semibold text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50">
              Preview Report →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
