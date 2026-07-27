import { useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import DatePicker from "../DatePicker";
import { PERIOD_OPTIONS } from "./scoreboardShared";

/**
 * Shared "Download Report" modal for the Employee and Team Scoreboards.
 * `onGenerate(formValues)` must create the report (via reportApi.createEmployeeReport
 * or reportApi.createTeamReport) and return the created report object.
 */
export default function ReportModal({
  isOpen,
  onClose,
  title = "Download Report",
  subtitle,
  showProjectFilter = false,
  projects = [],
  onGenerate,
}) {
  const navigate = useNavigate();

  const [period, setPeriod] = useState("this_month");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [projectId, setProjectId] = useState("");
  const [includeTaskDetails, setIncludeTaskDetails] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  async function handleSubmit(event) {
    event.preventDefault();
    if (period === "custom" && (!customStart || !customEnd)) {
      toast.error("Select both a start and end date for a custom range.");
      return;
    }

    try {
      setIsGenerating(true);
      const created = await onGenerate({
        period,
        project_id: projectId ? Number(projectId) : null,
        start_date: period === "custom" ? customStart : null,
        end_date: period === "custom" ? customEnd : null,
        include_task_details: includeTaskDetails,
      });
      onClose();
      navigate(`/reports/${created.id}/preview`);
    } catch (err) {
      toast.error(err.message || "Failed to generate report.");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
            {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">Report Period</label>
            <div className="flex flex-wrap gap-1.5">
              {PERIOD_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setPeriod(opt.value)}
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
          </div>

          {period === "custom" && (
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Start date</label>
                <DatePicker name="start" value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">End date</label>
                <DatePicker name="end" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
              </div>
            </div>
          )}

          {showProjectFilter && (
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Project</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                <option value="">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          )}

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={includeTaskDetails}
              onChange={(e) => setIncludeTaskDetails(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300"
            />
            Include task details table
          </label>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isGenerating}
              className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
            >
              {isGenerating ? "Generating..." : "Generate Report"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
