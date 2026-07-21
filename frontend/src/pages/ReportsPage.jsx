import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { useAuth } from "../context/AuthContext";
import { reportApi } from "../api/reportApi";
import { projectApi } from "../api/projectApi";

const REPORT_TYPES = [
  { value: "weekly", label: "Weekly Project Report" },
  { value: "monthly", label: "Monthly Project Report" },
  { value: "client", label: "Client Project Report" },
];

const STATUS_STYLES = {
  draft: "bg-slate-100 text-slate-600",
  finalized: "bg-blue-100 text-blue-700",
  archived: "bg-slate-200 text-slate-500",
};

const EMPTY_FORM = {
  project_id: "",
  report_type: "monthly",
  title: "",
  period_start: "",
  period_end: "",
};

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
}

export default function ReportsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const canManageReports =
    user?.role === "owner" || user?.role === "admin" || user?.role === "team_manager";

  const [reports, setReports] = useState([]);
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [error, setError] = useState("");

  async function loadData() {
    try {
      setIsLoading(true);
      const [reportsData, projectsData] = await Promise.all([
        reportApi.list(),
        projectApi.list().catch(() => []),
      ]);
      setReports(reportsData);
      setProjects(projectsData);
    } catch (err) {
      toast.error(err.message || "Failed to load reports.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function openCreateModal() {
    setFormData(EMPTY_FORM);
    setError("");
    setIsModalOpen(true);
  }

  function closeModal() {
    setIsModalOpen(false);
  }

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    try {
      setIsSubmitting(true);
      setError("");
      const payload = {
        project_id: Number(formData.project_id),
        report_type: formData.report_type,
        title: formData.title,
        period_start: formData.period_start || null,
        period_end: formData.period_end || null,
      };
      const created = await reportApi.create(payload);
      toast.success("Report created.");
      setIsModalOpen(false);
      navigate(`/reports/${created.id}/edit`);
    } catch (err) {
      setError(err.message || "Failed to create report.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(report) {
    if (!window.confirm(`Delete "${report.title}"? This cannot be undone.`)) return;
    try {
      await reportApi.remove(report.id);
      setReports((current) => current.filter((r) => r.id !== report.id));
      toast.success("Report deleted.");
    } catch (err) {
      toast.error(err.message || "Failed to delete report.");
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Project Reports</h1>
          <p className="mt-1 text-sm text-slate-500">
            Client-facing status reports generated from your project data.
          </p>
        </div>

        {canManageReports ? (
          <button
            type="button"
            onClick={openCreateModal}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            + New Report
          </button>
        ) : null}
      </div>

      {isLoading ? (
        <p className="text-sm text-slate-500">Loading reports...</p>
      ) : reports.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500">
          No reports yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase text-slate-500">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Period</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {reports.map((report) => (
                <tr key={report.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    <button
                      type="button"
                      onClick={() => navigate(`/reports/${report.id}/edit`)}
                      className="hover:underline"
                    >
                      {report.title}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{report.project?.name || "—"}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{report.report_type}</td>
                  <td className="px-4 py-3 text-slate-600">
                    {formatDate(report.period_start)} – {formatDate(report.period_end)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold capitalize ${STATUS_STYLES[report.status] || "bg-slate-100 text-slate-600"}`}>
                      {report.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">v{report.version}</td>
                  <td className="px-4 py-3 text-right">
                    {canManageReports && report.status === "draft" ? (
                      <button
                        type="button"
                        onClick={() => handleDelete(report)}
                        className="text-xs font-semibold text-red-600 hover:underline"
                      >
                        Delete
                      </button>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <h2 className="mb-4 text-xl font-semibold text-slate-900">New Report</h2>

            {error ? (
              <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Project</label>
                <select
                  name="project_id"
                  value={formData.project_id}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Report Type</label>
                <select
                  name="report_type"
                  value={formData.report_type}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {REPORT_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Report Title</label>
                <input
                  name="title"
                  value={formData.title}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Period Start</label>
                  <input
                    name="period_start"
                    type="date"
                    value={formData.period_start}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">Period End</label>
                  <input
                    name="period_end"
                    type="date"
                    value={formData.period_end}
                    onChange={handleChange}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {isSubmitting ? "Creating..." : "Create Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
