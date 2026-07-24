import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";

import { projectApi } from "../api/projectApi";
import { reportApi } from "../api/reportApi";
import { taskRequestApi } from "../api/taskRequestApi";

const STATUS_DOT = {
  active: "bg-emerald-500",
  completed: "bg-blue-500",
  on_hold: "bg-amber-500",
  archived: "bg-slate-400",
};

const TASK_REQUEST_STATUS_CFG = {
  pending: { badge: "bg-amber-100 text-amber-700", bar: "bg-amber-400", label: "Pending" },
  converted: { badge: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-400", label: "Converted" },
  rejected: { badge: "bg-red-100 text-red-700", bar: "bg-red-400", label: "Declined" },
};

function StatusIcon({ status, className }) {
  if (status === "converted") {
    return (
      <svg className={className} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
      </svg>
    );
  }
  if (status === "rejected") {
    return (
      <svg className={className} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.28 7.22a.75.75 0 00-1.06 1.06L8.94 10l-1.72 1.72a.75.75 0 101.06 1.06L10 11.06l1.72 1.72a.75.75 0 101.06-1.06L11.06 10l1.72-1.72a.75.75 0 00-1.06-1.06L10 8.94 8.28 7.22z" clipRule="evenodd" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-13a.75.75 0 00-1.5 0v5c0 .414.336.75.75.75h4a.75.75 0 000-1.5h-3.25V5z" clipRule="evenodd" />
    </svg>
  );
}

function ReportIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm7 1V4l3 3h-2a1 1 0 01-1-1zM6 10a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm0 3a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z" clipRule="evenodd" />
    </svg>
  );
}

function ProjectPicker({ projects }) {
  const navigate = useNavigate();
  return (
    <div className="mx-auto max-w-lg rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-900">
        <svg className="h-6 w-6 text-white" viewBox="0 0 20 20" fill="currentColor">
          <path d="M2 6a2 2 0 012-2h4l2 2h6a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
        </svg>
      </div>
      <h1 className="mb-1 text-xl font-bold text-slate-900">Choose a project</h1>
      <p className="mb-6 text-sm text-slate-500">Select a project to view its status and task requests.</p>
      <div className="flex flex-col gap-2">
        {projects.map((project) => (
          <button
            key={project.id}
            type="button"
            onClick={() => navigate(`/client/projects/${project.id}`)}
            className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            {project.name}
            <span className="text-slate-400">→</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function PageMessage({ children }) {
  return (
    <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
      <div className="h-8 w-8 animate-pulse rounded-full bg-slate-200" />
      <p className="text-sm text-slate-500">{children}</p>
    </div>
  );
}

export default function ClientProjectViewPage() {
  const { projectId } = useParams();
  const navigate = useNavigate();

  const [isResolvingProject, setIsResolvingProject] = useState(!projectId);
  const [projects, setProjects] = useState([]);

  const [project, setProject] = useState(null);
  const [isLoadingProject, setIsLoadingProject] = useState(true);
  const [error, setError] = useState("");

  const [reportObjectUrl, setReportObjectUrl] = useState(null);
  const [isLoadingReport, setIsLoadingReport] = useState(true);
  const [reportError, setReportError] = useState("");

  const [taskRequests, setTaskRequests] = useState([]);
  const [isLoadingRequests, setIsLoadingRequests] = useState(true);

  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [requestForm, setRequestForm] = useState({ title: "", description: "" });
  const [isSubmittingRequest, setIsSubmittingRequest] = useState(false);

  // No projectId in the URL — resolve which project(s) this client has access to.
  useEffect(() => {
    if (projectId) return;

    let cancelled = false;
    (async () => {
      try {
        setIsResolvingProject(true);
        const data = await projectApi.list();
        if (cancelled) return;
        setProjects(data);
        if (data.length === 1) {
          navigate(`/client/projects/${data[0].id}`, { replace: true });
        }
      } catch (err) {
        if (!cancelled) toast.error(err.message || "Unable to load your projects.");
      } finally {
        if (!cancelled) setIsResolvingProject(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId, navigate]);

  useEffect(() => {
    if (!projectId) return;

    let cancelled = false;
    (async () => {
      try {
        setIsLoadingProject(true);
        setError("");
        const data = await projectApi.getById(projectId);
        if (!cancelled) setProject(data);
      } catch (err) {
        if (!cancelled) setError(err.message || "Unable to load this project.");
      } finally {
        if (!cancelled) setIsLoadingProject(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  useEffect(() => {
    if (!projectId) return;

    let url = null;
    let cancelled = false;

    (async () => {
      try {
        setIsLoadingReport(true);
        setReportError("");
        const reports = await reportApi.list({
          project_id: projectId,
          report_type: "client",
          status: "finalized",
          is_latest_version: true,
        });
        if (cancelled) return;
        if (!reports.length) {
          setReportError("No client report has been published for this project yet.");
          return;
        }
        const latest = reports[0];
        const blob = await reportApi.fetchPdfBlob(latest.id, { download: false });
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setReportObjectUrl(url);
      } catch (err) {
        if (!cancelled) setReportError(err.message || "Unable to load the project report.");
      } finally {
        if (!cancelled) setIsLoadingReport(false);
      }
    })();

    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [projectId]);

  async function loadTaskRequests() {
    try {
      setIsLoadingRequests(true);
      const data = await taskRequestApi.list(projectId);
      setTaskRequests(data);
    } catch (err) {
      toast.error(err.message || "Unable to load your task requests.");
    } finally {
      setIsLoadingRequests(false);
    }
  }

  useEffect(() => {
    if (!projectId) return;
    loadTaskRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const requestCounts = useMemo(() => {
    return taskRequests.reduce(
      (acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }),
      { pending: 0, converted: 0, rejected: 0 }
    );
  }, [taskRequests]);

  function handleRequestFormChange(event) {
    const { name, value } = event.target;
    setRequestForm((current) => ({ ...current, [name]: value }));
  }

  function openRequestModal() {
    setRequestForm({ title: "", description: "" });
    setIsRequestModalOpen(true);
  }

  async function handleSubmitRequest(event) {
    event.preventDefault();
    if (!requestForm.title.trim()) return;
    try {
      setIsSubmittingRequest(true);
      const created = await taskRequestApi.create(projectId, {
        title: requestForm.title.trim(),
        description: requestForm.description.trim() || null,
      });
      setTaskRequests((current) => [created, ...current]);
      setIsRequestModalOpen(false);
      toast.success("Task request submitted.");
    } catch (err) {
      toast.error(err.message || "Failed to submit task request.");
    } finally {
      setIsSubmittingRequest(false);
    }
  }

  if (!projectId) {
    if (isResolvingProject) {
      return <PageMessage>Loading your projects...</PageMessage>;
    }
    if (projects.length === 0) {
      return (
        <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <p className="text-sm text-slate-500">You don&apos;t have access to any projects yet.</p>
        </div>
      );
    }
    return <ProjectPicker projects={projects} />;
  }

  if (isLoadingProject) {
    return <PageMessage>Loading project...</PageMessage>;
  }

  if (error || !project) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
        {error || "Project not found."}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Hero ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="h-1.5 bg-gradient-to-r from-slate-800 via-slate-600 to-slate-800" />
        <div className="p-6 sm:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{project.name}</h1>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
              <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[project.status] || "bg-slate-400"}`} />
              {project.status}
            </span>
          </div>
          <p className="mt-2 max-w-2xl text-sm text-slate-500">
            {project.description || "No description added for this project yet."}
          </p>
        </div>
      </div>

      {/* ── Report ── */}
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center gap-2.5 border-b border-slate-200 px-6 py-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100">
            <ReportIcon className="h-4 w-4 text-slate-600" />
          </div>
          <h2 className="text-base font-semibold text-slate-900">Project Report</h2>
        </div>
        <div className="h-[70vh] bg-slate-50">
          {isLoadingReport ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-sm text-slate-400">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
              Preparing report...
            </div>
          ) : reportError ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-full bg-slate-200">
                <ReportIcon className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-600">No report available yet</p>
              <p className="max-w-xs text-xs text-slate-400">{reportError}</p>
            </div>
          ) : (
            <iframe src={reportObjectUrl} title="Project report" className="h-full w-full border-0" />
          )}
        </div>
      </section>

      {/* ── Task Requests ── */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Task Requests</h2>
            <p className="mt-0.5 text-xs text-slate-500">Ask for new work to be added to this project.</p>
          </div>
          <button
            type="button"
            onClick={openRequestModal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-slate-800"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" />
            </svg>
            New Task Request
          </button>
        </div>

        {taskRequests.length > 0 ? (
          <div className="mb-5 flex flex-wrap gap-2">
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              {requestCounts.pending} pending
            </span>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
              {requestCounts.converted} converted
            </span>
            {requestCounts.rejected > 0 ? (
              <span className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                {requestCounts.rejected} declined
              </span>
            ) : null}
          </div>
        ) : null}

        {isLoadingRequests ? (
          <p className="text-sm text-slate-500">Loading your task requests...</p>
        ) : taskRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/60 py-12 text-center">
            <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white shadow-sm">
              <svg className="h-5 w-5 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm7 1V4l3 3h-2a1 1 0 01-1-1zM6 10a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm0 3a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-sm font-medium text-slate-600">No task requests yet</p>
            <p className="mt-1 text-xs text-slate-400">Submit a request and your team will review it shortly.</p>
          </div>
        ) : (
          <ul className="space-y-3">
            {taskRequests.map((request) => {
              const cfg = TASK_REQUEST_STATUS_CFG[request.status] || TASK_REQUEST_STATUS_CFG.pending;
              return (
                <li
                  key={request.id}
                  className="flex gap-3 rounded-xl border border-slate-200 p-4 transition hover:border-slate-300 hover:shadow-sm"
                >
                  <span className={`mt-0.5 h-full w-1 shrink-0 rounded-full ${cfg.bar}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-slate-900">{request.title}</p>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.badge}`}>
                        <StatusIcon status={request.status} className="h-3 w-3" />
                        {cfg.label}
                      </span>
                    </div>
                    {request.description ? (
                      <p className="mt-1 text-sm text-slate-500">{request.description}</p>
                    ) : null}
                    <p className="mt-1.5 text-xs text-slate-400">
                      Submitted {new Date(request.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {isRequestModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">New Task Request</h2>
                <p className="mt-1 text-sm text-slate-500">
                  This will be sent to the team managing <span className="font-medium text-slate-700">{project.name}</span>.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRequestModalOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmitRequest} className="space-y-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Title</label>
                <input
                  name="title"
                  value={requestForm.title}
                  onChange={handleRequestFormChange}
                  required
                  placeholder="e.g. Add a new landing page"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Description</label>
                <textarea
                  name="description"
                  value={requestForm.description}
                  onChange={handleRequestFormChange}
                  rows={4}
                  placeholder="Add any details that would help the team scope this request."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setIsRequestModalOpen(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRequest}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
                >
                  {isSubmittingRequest ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
