import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";

import { useAuth } from "../context/AuthContext";
import { useConfirm } from "../context/ConfirmContext";
import { reportApi } from "../api/reportApi";
import RichEditor from "../components/RichEditor";
import ThemePicker from "../components/reports/ThemePicker";

const TABS = [
  { id: "overview", label: "Overview" },
  { id: "exec_summary", label: "Exec Summary" },
  { id: "rocks", label: "Rocks" },
  { id: "kpis", label: "KPIs" },
  { id: "milestones", label: "Milestones" },
  { id: "tasks", label: "Tasks" },
  { id: "risks_issues", label: "Risks & Issues" },
  { id: "client_actions", label: "Client Actions" },
  { id: "upcoming_plan", label: "Upcoming Plan" },
  { id: "theme", label: "Theme" },
];

const CONTENT_FIELDS = [
  { key: "executive_summary", label: "Executive Summary" },
  { key: "key_achievement", label: "Key Achievement" },
  { key: "current_challenge", label: "Current Challenge" },
  { key: "next_priority", label: "Next Priority" },
  { key: "client_attention", label: "Client Attention" },
  { key: "final_remarks", label: "Final Remarks" },
];

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

function EmptyState({ label }) {
  return <p className="py-8 text-center text-sm text-slate-400">No {label} available for this reporting period.</p>;
}

export default function ReportEditPage() {
  const confirm = useConfirm();
  const { reportId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const canManage = user?.role === "owner" || user?.role === "admin" || user?.role === "team_manager";

  const [report, setReport] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");
  const [content, setContent] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRegenerating, setIsRegenerating] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);

  const isLocked = report?.status === "finalized";

  async function loadReport() {
    try {
      setIsLoading(true);
      const data = await reportApi.get(reportId);
      setReport(data);
      setContent(data.content || {});
    } catch (err) {
      toast.error(err.message || "Failed to load report.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadReport();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  function handleContentChange(key, value) {
    setContent((current) => ({ ...current, [key]: value }));
  }

  async function handleSaveDraft() {
    try {
      setIsSaving(true);
      const updated = await reportApi.update(reportId, { content });
      setReport(updated);
      setContent(updated.content || {});
      toast.success("Report saved.");
    } catch (err) {
      toast.error(err.message || "Failed to save report.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRegenerate() {
    try {
      setIsRegenerating(true);
      const updated = await reportApi.regenerate(reportId);
      setReport(updated);
      toast.success("Report data refreshed from the project.");
    } catch (err) {
      toast.error(err.message || "Failed to regenerate report data.");
    } finally {
      setIsRegenerating(false);
    }
  }

  async function handlePreview() {
    navigate(`/reports/${reportId}/preview`);
  }

  async function handleFinalize() {
    const ok = await confirm({
      message: "Finalize this report? It will be locked and a PDF will be generated.",
      confirmLabel: "Finalize",
    });
    if (!ok) return;
    try {
      setIsFinalizing(true);
      const updated = await reportApi.finalize(reportId);
      setReport(updated);
      toast.success("Report finalized.");
    } catch (err) {
      toast.error(err.message || "Failed to finalize report.");
    } finally {
      setIsFinalizing(false);
    }
  }

  async function handleNewVersion() {
    try {
      setIsCreatingVersion(true);
      const newVersion = await reportApi.newVersion(reportId);
      toast.success(`Draft v${newVersion.version} created.`);
      navigate(`/reports/${newVersion.id}/edit`);
    } catch (err) {
      toast.error(err.message || "Failed to create a new version.");
    } finally {
      setIsCreatingVersion(false);
    }
  }

  async function handleToggleTeamVisible(event) {
    const team_visible = event.target.checked;
    try {
      const updated = await reportApi.update(reportId, { team_visible });
      setReport(updated);
    } catch (err) {
      toast.error(err.message || "Failed to update visibility.");
    }
  }

  async function handleDownload() {
    try {
      const blob = await reportApi.fetchPdfBlob(reportId, { download: true });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${report.title}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(err.message || "PDF download failed. Please try again.");
    }
  }

  if (isLoading) {
    return <div className="p-8 text-sm text-slate-500">Loading report...</div>;
  }

  if (!report) {
    return <div className="p-8 text-sm text-red-600">Report not found.</div>;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{report.title}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {report.project?.name} · {formatDate(report.period_start)} – {formatDate(report.period_end)} ·{" "}
            <span className="capitalize">{report.status}</span> (v{report.version})
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {!isLocked && canManage ? (
            <>
              <button
                type="button"
                onClick={handleSaveDraft}
                disabled={isSaving}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {isSaving ? "Saving..." : "Save Draft"}
              </button>
              <button
                type="button"
                onClick={handleFinalize}
                disabled={isFinalizing}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {isFinalizing ? "Finalizing..." : "Finalize Report"}
              </button>
            </>
          ) : null}

          {isLocked && canManage ? (
            <button
              type="button"
              onClick={handleNewVersion}
              disabled={isCreatingVersion}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              {isCreatingVersion ? "Creating..." : "Create New Version"}
            </button>
          ) : null}

          <button
            type="button"
            onClick={handlePreview}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Preview PDF
          </button>

          {isLocked ? (
            <button
              type="button"
              onClick={handleDownload}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Download PDF
            </button>
          ) : null}
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={
              activeTab === tab.id
                ? "border-b-2 border-slate-900 px-3 py-2 text-sm font-semibold text-slate-900"
                : "px-3 py-2 text-sm font-medium text-slate-500 hover:text-slate-900"
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Rocks", value: report.rock_snapshots.length },
            { label: "KPIs", value: report.kpi_snapshots.length },
            { label: "Milestones", value: report.milestone_snapshots.length },
            { label: "Tasks", value: report.task_snapshots.length },
            { label: "Risks", value: report.risk_snapshots.length },
            { label: "Issues", value: report.issue_snapshots.length },
            { label: "Client Actions", value: report.client_actions.length },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl border border-slate-200 p-4">
              <p className="text-xs font-semibold uppercase text-slate-400">{stat.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900">{stat.value}</p>
            </div>
          ))}

          {canManage ? (
            <div className="col-span-full flex flex-wrap items-center gap-4">
              {!isLocked ? (
                <button
                  type="button"
                  onClick={handleRegenerate}
                  disabled={isRegenerating}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  {isRegenerating ? "Refreshing..." : "Regenerate data from project"}
                </button>
              ) : null}

              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={report.team_visible}
                  disabled={isLocked}
                  onChange={handleToggleTeamVisible}
                  className="h-4 w-4 rounded border-slate-300 disabled:opacity-60"
                />
                Team members can view and download this report
              </label>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === "exec_summary" ? (
        <div className="space-y-6">
          {CONTENT_FIELDS.map((field) => (
            <div key={field.key}>
              <label className="mb-1 block text-sm font-medium text-slate-700">{field.label}</label>
              <RichEditor
                content={content[field.key] || ""}
                onChange={(html) => handleContentChange(field.key, html)}
                minHeight={100}
              />
            </div>
          ))}
        </div>
      ) : null}

      {activeTab === "rocks" ? (
        report.rock_snapshots.length === 0 ? (
          <EmptyState label="Rocks" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs font-semibold uppercase text-slate-400">
              <tr>
                <th className="py-2">Title</th>
                <th className="py-2">Owner</th>
                <th className="py-2">Status</th>
                <th className="py-2">Progress</th>
                <th className="py-2">Due Date</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.rock_snapshots.map((rock) => (
                <tr key={rock.id}>
                  <td className="py-2 font-medium text-slate-900">{rock.title}</td>
                  <td className="py-2 text-slate-600">{rock.owner_name || "—"}</td>
                  <td className="py-2 capitalize text-slate-600">{rock.status.replace("_", " ")}</td>
                  <td className="py-2 text-slate-600">{rock.progress_pct}%</td>
                  <td className="py-2 text-slate-600">{formatDate(rock.due_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : null}

      {activeTab === "kpis" ? (
        report.kpi_snapshots.length === 0 ? (
          <EmptyState label="KPI data" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs font-semibold uppercase text-slate-400">
              <tr>
                <th className="py-2">KPI</th>
                <th className="py-2">Target</th>
                <th className="py-2">Actual</th>
                <th className="py-2">Trend</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.kpi_snapshots.map((kpi) => (
                <tr key={kpi.id}>
                  <td className="py-2 font-medium text-slate-900">{kpi.name}</td>
                  <td className="py-2 text-slate-600">{kpi.target_value ?? "—"}</td>
                  <td className="py-2 text-slate-600">{kpi.actual_value ?? "—"}</td>
                  <td className="py-2 capitalize text-slate-600">{kpi.trend}</td>
                  <td className="py-2 capitalize text-slate-600">{kpi.status.replace("_", " ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : null}

      {activeTab === "milestones" ? (
        report.milestone_snapshots.length === 0 ? (
          <EmptyState label="Milestones" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs font-semibold uppercase text-slate-400">
              <tr>
                <th className="py-2">Milestone</th>
                <th className="py-2">Status</th>
                <th className="py-2">Planned End</th>
                <th className="py-2">Forecast End</th>
                <th className="py-2">Delay (days)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.milestone_snapshots.map((m) => (
                <tr key={m.id}>
                  <td className="py-2 font-medium text-slate-900">{m.title}</td>
                  <td className="py-2 capitalize text-slate-600">{m.status}</td>
                  <td className="py-2 text-slate-600">{formatDate(m.planned_end_date)}</td>
                  <td className="py-2 text-slate-600">{formatDate(m.forecast_end_date)}</td>
                  <td className="py-2 text-slate-600">{m.delay_days ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : null}

      {activeTab === "tasks" ? (
        report.task_snapshots.length === 0 ? (
          <EmptyState label="tasks" />
        ) : (
          <table className="w-full text-left text-sm">
            <thead className="text-xs font-semibold uppercase text-slate-400">
              <tr>
                <th className="py-2">Task</th>
                <th className="py-2">Assignee</th>
                <th className="py-2">Status</th>
                <th className="py-2">Due Date</th>
                <th className="py-2">Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {report.task_snapshots.map((task) => (
                <tr key={task.id}>
                  <td className="py-2 font-medium text-slate-900">{task.name}</td>
                  <td className="py-2 text-slate-600">{task.assignee_name || "Unassigned"}</td>
                  <td className="py-2 capitalize text-slate-600">{task.status.replace("_", " ")}</td>
                  <td className="py-2 text-slate-600">{formatDate(task.due_date)}</td>
                  <td className="py-2 text-slate-600">
                    {task.is_overdue ? <span className="mr-1 text-red-600">Overdue</span> : null}
                    {task.is_blocked ? <span className="text-amber-600">Blocked</span> : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      ) : null}

      {activeTab === "risks_issues" ? (
        <div className="space-y-8">
          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase text-slate-400">Risks</h3>
            {report.risk_snapshots.length === 0 ? (
              <p className="text-sm text-slate-400">No active risks were identified.</p>
            ) : (
              <ul className="space-y-2">
                {report.risk_snapshots.map((risk) => (
                  <li key={risk.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                    <p className="font-medium text-slate-900">{risk.title}</p>
                    <p className="text-slate-500">
                      Severity: {risk.severity} · Likelihood: {risk.likelihood} · Owner: {risk.owner_name || "—"}
                    </p>
                    {risk.mitigation_plan ? <p className="mt-1 text-slate-600">{risk.mitigation_plan}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold uppercase text-slate-400">Issues</h3>
            {report.issue_snapshots.length === 0 ? (
              <p className="text-sm text-slate-400">No issues to report.</p>
            ) : (
              <ul className="space-y-2">
                {report.issue_snapshots.map((issue) => (
                  <li key={issue.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                    <p className="font-medium text-slate-900">{issue.title}</p>
                    <p className="text-slate-500">
                      Status: {issue.status} · Owner: {issue.owner_name || "—"} · Target: {formatDate(issue.target_resolution_date)}
                    </p>
                    {issue.resolution_plan ? <p className="mt-1 text-slate-600">{issue.resolution_plan}</p> : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

      {activeTab === "client_actions" ? (
        report.client_actions.length === 0 ? (
          <EmptyState label="client actions" />
        ) : (
          <ul className="space-y-2">
            {report.client_actions.map((action) => (
              <li key={action.id} className="rounded-lg border border-slate-200 p-3 text-sm">
                <p className="font-medium text-slate-900">{action.title}</p>
                <p className="text-slate-500">
                  Due: {formatDate(action.due_date)} · Priority: {action.priority} · Status: {action.status}
                </p>
              </li>
            ))}
          </ul>
        )
      ) : null}

      {activeTab === "upcoming_plan" ? (
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Upcoming Plan Notes</label>
          <RichEditor
            content={content.upcoming_plan_notes || ""}
            onChange={(html) => handleContentChange("upcoming_plan_notes", html)}
            minHeight={140}
          />
        </div>
      ) : null}

      {activeTab === "theme" ? (
        <ThemePicker
          reportId={reportId}
          selectedThemeId={report.theme?.id}
          disabled={isLocked || !canManage}
          onThemeApplied={(updated) => setReport(updated)}
        />
      ) : null}
    </div>
  );
}
