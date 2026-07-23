import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { projectApi } from "../api/projectApi";
import { teamApi } from "../api/teamApi";
import { userApi } from "../api/userApi";
import { taskSuggestionApi } from "../api/taskSuggestionApi";
import DatePicker from "../components/DatePicker";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function formatDate(dateString) {
  if (!dateString) return "—";

  return new Date(`${dateString}T00:00:00`).toLocaleDateString();
}

function formatRole(role) {
  return (role || "user").replace("_", " ");
}

function getConfidenceClass(confidence) {
  if (confidence === "high") {
    return "bg-green-100 text-green-700";
  }

  if (confidence === "medium") {
    return "bg-amber-100 text-amber-700";
  }

  if (confidence === "low") {
    return "bg-red-100 text-red-700";
  }

  return "bg-slate-100 text-slate-700";
}

function getSourceClass(sourceType) {
  if (sourceType === "email") {
    return "bg-blue-100 text-blue-700";
  }

  if (sourceType === "transcript") {
    return "bg-purple-100 text-purple-700";
  }

  return "bg-slate-100 text-slate-700";
}

function StatCard({ title, value, description, icon, tone = "slate" }) {
  const toneClasses = {
    slate: "bg-slate-100 text-slate-700",
    blue: "bg-blue-100 text-blue-700",
    green: "bg-green-100 text-green-700",
    amber: "bg-amber-100 text-amber-700",
    purple: "bg-purple-100 text-purple-700",
    indigo: "bg-indigo-100 text-indigo-700",
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">{title}</p>
          <p className="mt-3 text-3xl font-bold text-slate-900">{value}</p>
          <p className="mt-2 text-xs font-medium text-slate-500">
            {description}
          </p>
        </div>

        <div
          className={cx(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            toneClasses[tone] || toneClasses.slate
          )}
        >
          {icon}
        </div>
      </div>
    </div>
  );
}

function SparklesIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 2a.75.75 0 01.72.54l.63 2.17a5.75 5.75 0 003.94 3.94l2.17.63a.75.75 0 010 1.44l-2.17.63a5.75 5.75 0 00-3.94 3.94l-.63 2.17a.75.75 0 01-1.44 0l-.63-2.17a5.75 5.75 0 00-3.94-3.94l-2.17-.63a.75.75 0 010-1.44l2.17-.63a5.75 5.75 0 003.94-3.94l.63-2.17A.75.75 0 0110 2z" />
    </svg>
  );
}

function EmailIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M2.5 5.5A2.5 2.5 0 015 3h10a2.5 2.5 0 012.5 2.5v9A2.5 2.5 0 0115 17H5a2.5 2.5 0 01-2.5-2.5v-9zm2.1-.3a.75.75 0 00-.2 1.04l4.02 4.35a2.25 2.25 0 003.16 0l4.02-4.35a.75.75 0 00-1.1-1.02l-4.02 4.35a.75.75 0 01-.96 0L5.64 5.22a.75.75 0 00-1.04-.02z" />
    </svg>
  );
}

function MeetingIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M4 4.5A2.5 2.5 0 016.5 2h4A2.5 2.5 0 0113 4.5v1.25l2.88-1.44A1.25 1.25 0 0117.7 5.43v9.14a1.25 1.25 0 01-1.82 1.12L13 14.25v1.25A2.5 2.5 0 0110.5 18h-4A2.5 2.5 0 014 15.5v-11z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M16.704 5.29a1 1 0 010 1.42l-7.25 7.25a1 1 0 01-1.42 0L3.296 9.22a1 1 0 011.414-1.414l4.034 4.033 6.543-6.543a1 1 0 011.417-.006z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function SyncIcon({ spinning = false }) {
  return (
    <svg
      className={cx("h-5 w-5", spinning && "animate-spin")}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path d="M15.312 6.343A6.5 6.5 0 004.99 5.06l-.49.49V3.75a.75.75 0 00-1.5 0v3.6c0 .414.336.75.75.75h3.6a.75.75 0 000-1.5H5.56l.49-.49a5 5 0 018.91 2.43.75.75 0 001.48-.26 6.47 6.47 0 00-1.128-1.937zM4.688 13.657A6.5 6.5 0 0015.01 14.94l.49-.49v1.8a.75.75 0 001.5 0v-3.6a.75.75 0 00-.75-.75h-3.6a.75.75 0 000 1.5h1.79l-.49.49a5 5 0 01-8.91-2.43.75.75 0 00-1.48.26 6.47 6.47 0 001.128 1.937z" />
    </svg>
  );
}

function EmptyState({ onSync, isSyncing }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-100 text-indigo-700">
        <SparklesIcon />
      </div>

      <h2 className="mt-5 text-xl font-bold text-slate-900">
        No pending suggestions
      </h2>

      <p className="mx-auto mt-2 max-w-md text-sm text-slate-500">
        Sync yesterday’s emails and meeting transcripts to generate new AI task
        suggestions.
      </p>

      <button
        type="button"
        onClick={onSync}
        disabled={isSyncing}
        className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <SyncIcon spinning={isSyncing} />
        {isSyncing ? "Syncing..." : "Sync Yesterday"}
      </button>
    </div>
  );
}

export default function TaskSuggestionsPage() {
  const [suggestions, setSuggestions] = useState([]);
  const [projects, setProjects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);

  const [approvalData, setApprovalData] = useState({});
  const [expandedSuggestionId, setExpandedSuggestionId] = useState(null);
  const [selectedSuggestion, setSelectedSuggestion] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [confidenceFilter, setConfidenceFilter] = useState("all");

  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [actionId, setActionId] = useState(null);

  const pendingSuggestions = useMemo(() => {
    return suggestions.filter((suggestion) => suggestion.status === "pending");
  }, [suggestions]);

  const filteredSuggestions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return pendingSuggestions.filter((suggestion) => {
      const searchableText = [
        suggestion.title,
        suggestion.description,
        suggestion.source_type,
        suggestion.confidence,
        suggestion.suggested_assignee_name,
        suggestion.suggested_assignee_email,
        suggestion.suggested_project_name,
        suggestion.suggested_team_name,
        suggestion.suggested_start_date,
        suggestion.suggested_due_date,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchableText.includes(query);

      const matchesSource =
        sourceFilter === "all" || suggestion.source_type === sourceFilter;

      const matchesConfidence =
        confidenceFilter === "all" ||
        suggestion.confidence === confidenceFilter;

      return matchesSearch && matchesSource && matchesConfidence;
    });
  }, [pendingSuggestions, searchQuery, sourceFilter, confidenceFilter]);

  const summary = useMemo(() => {
    return {
      total: pendingSuggestions.length,
      email: pendingSuggestions.filter(
        (suggestion) => suggestion.source_type === "email"
      ).length,
      transcript: pendingSuggestions.filter(
        (suggestion) => suggestion.source_type === "transcript"
      ).length,
      high: pendingSuggestions.filter(
        (suggestion) => suggestion.confidence === "high"
      ).length,
    };
  }, [pendingSuggestions]);

  const hasActiveFilters =
    searchQuery || sourceFilter !== "all" || confidenceFilter !== "all";

  async function loadData() {
    try {
      setIsLoading(true);

      const [suggestionData, projectData, teamData, userData] =
        await Promise.all([
          taskSuggestionApi.list(),
          projectApi.list(),
          teamApi.list(),
          userApi.list(),
        ]);

      setSuggestions(suggestionData);
      setProjects(projectData);
      setTeams(teamData);
      setUsers(userData);
    } catch (err) {
      toast.error(err.message || "Unable to load suggestions.");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleSyncYesterday() {
    try {
      setIsSyncing(true);

      const result = await taskSuggestionApi.syncYesterday();

      toast.success(result.message || "Yesterday's sources analyzed.");

      await loadData();
    } catch (err) {
      toast.error(err.message || "Unable to sync yesterday's sources.");
    } finally {
      setIsSyncing(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function updateApprovalData(suggestionId, field, value) {
    setApprovalData((current) => ({
      ...current,
      [suggestionId]: {
        ...current[suggestionId],
        [field]: value,
      },
    }));
  }

  function resetFilters() {
    setSearchQuery("");
    setSourceFilter("all");
    setConfidenceFilter("all");
  }

  function openConvertModal(suggestion) {
    setSelectedSuggestion(suggestion);
  }

  function closeConvertModal() {
    setSelectedSuggestion(null);
  }

  function getApprovalValue(suggestion, field) {
    const data = approvalData[suggestion.id] || {};

    if (data[field]) {
      return data[field];
    }

    if (field === "start_date") {
      return suggestion.suggested_start_date || "";
    }

    if (field === "due_date") {
      return suggestion.suggested_due_date || "";
    }

    return "";
  }

  async function handleApprove(suggestion) {
    const data = approvalData[suggestion.id] || {};

    const payload = {
      project_id: Number(data.project_id),
      team_id: Number(data.team_id),
      assignee_id: Number(data.assignee_id),
      start_date: data.start_date || suggestion.suggested_start_date,
      due_date: data.due_date || suggestion.suggested_due_date,
      status: "todo",
    };

    if (
      !payload.project_id ||
      !payload.team_id ||
      !payload.assignee_id ||
      !payload.start_date ||
      !payload.due_date
    ) {
      toast.error(
        "Please select project, team, assignee, start date, and due date."
      );
      return;
    }

    try {
      setActionId(suggestion.id);

      await taskSuggestionApi.approve(suggestion.id, payload);

      toast.success("Task created from suggestion.");

      setSelectedSuggestion(null);

      await loadData();
    } catch (err) {
      toast.error(err.message || "Unable to approve suggestion.");
    } finally {
      setActionId(null);
    }
  }

  async function handleReject(suggestion) {
    try {
      setActionId(suggestion.id);

      await taskSuggestionApi.reject(suggestion.id);

      toast.success("Suggestion rejected.");

      setSelectedSuggestion(null);

      await loadData();
    } catch (err) {
      toast.error(err.message || "Unable to reject suggestion.");
    } finally {
      setActionId(null);
    }
  }

  return (
    <div className="w-full">
      <div className="mb-8 overflow-hidden rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-6 text-white shadow-sm">
        <div className="flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-indigo-100 ring-1 ring-white/10">
              <SparklesIcon />
              AI-powered task creation
            </div>

            <h1 className="text-3xl font-extrabold tracking-tight">
              AI Task Suggestions
            </h1>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">
              Review tasks extracted from emails and meeting transcripts, assign
              ownership, then create clean actionable tasks with one click.
            </p>
          </div>

          <button
            type="button"
            onClick={handleSyncYesterday}
            disabled={isSyncing}
            className="inline-flex w-fit items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-bold text-slate-950 shadow-sm hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <SyncIcon spinning={isSyncing} />
            {isSyncing ? "Syncing Yesterday..." : "Sync Yesterday"}
          </button>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Pending Suggestions"
          value={summary.total}
          description="Ready for review"
          icon={<SparklesIcon />}
          tone="indigo"
        />

        <StatCard
          title="From Emails"
          value={summary.email}
          description="Extracted from inbox"
          icon={<EmailIcon />}
          tone="blue"
        />

        <StatCard
          title="From Meetings"
          value={summary.transcript}
          description="Extracted from transcripts"
          icon={<MeetingIcon />}
          tone="purple"
        />

        <StatCard
          title="High Confidence"
          value={summary.high}
          description="Most reliable suggestions"
          icon={<CheckIcon />}
          tone="green"
        />
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr_1fr_auto]">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Search
            </label>

            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by task, assignee, project, team..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-900"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Source
            </label>

            <select
              value={sourceFilter}
              onChange={(event) => setSourceFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-900"
            >
              <option value="all">All sources</option>
              <option value="email">Email</option>
              <option value="transcript">Transcript</option>
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Confidence
            </label>

            <select
              value={confidenceFilter}
              onChange={(event) => setConfidenceFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-900"
            >
              <option value="all">All confidence</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={resetFilters}
              disabled={!hasActiveFilters}
              className="w-full rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 lg:w-auto"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
          <p className="text-sm text-slate-500">
            Showing{" "}
            <span className="font-semibold text-slate-900">
              {filteredSuggestions.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-slate-900">
              {pendingSuggestions.length}
            </span>{" "}
            pending suggestions
          </p>

          {hasActiveFilters ? (
            <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              Filters active
            </p>
          ) : null}
        </div>
      </div>

      {isLoading ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading AI suggestions...
        </div>
      ) : null}

      {!isLoading && !pendingSuggestions.length ? (
        <EmptyState onSync={handleSyncYesterday} isSyncing={isSyncing} />
      ) : null}

      {!isLoading && pendingSuggestions.length ? (
        <section className="space-y-4">
          {filteredSuggestions.map((suggestion) => {
            const isExpanded = expandedSuggestionId === suggestion.id;
            const isBusy = actionId === suggestion.id;

            return (
              <article
                key={suggestion.id}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
              >
                <div className="border-b border-slate-100 bg-slate-50/70 px-5 py-4">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
                    <div className="min-w-0">
                      <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span
                          className={cx(
                            "rounded-full px-3 py-1 text-xs font-bold capitalize",
                            getConfidenceClass(suggestion.confidence)
                          )}
                        >
                          {suggestion.confidence || "unknown"} confidence
                        </span>

                        <span
                          className={cx(
                            "rounded-full px-3 py-1 text-xs font-bold capitalize",
                            getSourceClass(suggestion.source_type)
                          )}
                        >
                          {suggestion.source_type || "source"}
                        </span>
                      </div>

                      <h2 className="text-lg font-bold text-slate-900">
                        {suggestion.title}
                      </h2>

                      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                        {suggestion.description || "No description."}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedSuggestionId((current) =>
                          current === suggestion.id ? null : suggestion.id
                        )
                      }
                      className="w-fit rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {isExpanded ? "Hide Details" : "Review Details"}
                    </button>
                  </div>
                </div>

                <div className="p-5">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Assignee
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {suggestion.suggested_assignee_name || "Unknown"}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Project
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {suggestion.suggested_project_name || "Unknown"}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Team
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {suggestion.suggested_team_name || "Unknown"}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-400">
                        Dates
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-900">
                        {formatDate(suggestion.suggested_start_date)} -{" "}
                        {formatDate(suggestion.suggested_due_date)}
                      </p>
                    </div>
                  </div>

                  {isExpanded ? (
                    <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-4">
                      <h3 className="text-sm font-bold text-slate-900">
                        AI reasoning checklist
                      </h3>

                      <div className="mt-3 grid gap-3 text-sm text-slate-600 sm:grid-cols-2">
                        <p>
                          <span className="font-semibold text-slate-900">
                            Suggested email:
                          </span>{" "}
                          {suggestion.suggested_assignee_email || "Not found"}
                        </p>

                        <p>
                          <span className="font-semibold text-slate-900">
                            Source:
                          </span>{" "}
                          {suggestion.source_type || "Unknown"}
                        </p>

                        <p>
                          <span className="font-semibold text-slate-900">
                            Start:
                          </span>{" "}
                          {formatDate(suggestion.suggested_start_date)}
                        </p>

                        <p>
                          <span className="font-semibold text-slate-900">
                            Due:
                          </span>{" "}
                          {formatDate(suggestion.suggested_due_date)}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="border-t border-slate-100 bg-slate-50/70 px-5 py-4">
                  <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                    <p className="text-sm text-slate-500">
                      Review this AI suggestion and convert it into a real task.
                    </p>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleReject(suggestion)}
                        disabled={isBusy}
                        className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Reject
                      </button>

                      <button
                        type="button"
                        onClick={() => openConvertModal(suggestion)}
                        disabled={isBusy}
                        className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Convert to Task
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}

          {!filteredSuggestions.length ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500 shadow-sm">
              No suggestions match your filters.
            </div>
          ) : null}
        </section>
      ) : null}

      {selectedSuggestion ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-indigo-100 px-3 py-1 text-xs font-bold text-indigo-700">
                  <SparklesIcon />
                  AI suggestion
                </div>

                <h2 className="text-xl font-bold text-slate-900">
                  Convert to Task
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  Confirm assignment before creating the task.
                </p>
              </div>

              <button
                type="button"
                onClick={closeConvertModal}
                className="rounded-xl px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                ✕
              </button>
            </div>

            <div className="mb-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-900">
                {selectedSuggestion.title}
              </h3>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                {selectedSuggestion.description || "No description."}
              </p>

              <div className="mt-3 flex flex-wrap gap-2">
                <span
                  className={cx(
                    "rounded-full px-3 py-1 text-xs font-bold capitalize",
                    getConfidenceClass(selectedSuggestion.confidence)
                  )}
                >
                  {selectedSuggestion.confidence || "unknown"} confidence
                </span>

                <span
                  className={cx(
                    "rounded-full px-3 py-1 text-xs font-bold capitalize",
                    getSourceClass(selectedSuggestion.source_type)
                  )}
                >
                  {selectedSuggestion.source_type || "source"}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Project
                </label>

                <select
                  value={getApprovalValue(selectedSuggestion, "project_id")}
                  onChange={(event) =>
                    updateApprovalData(
                      selectedSuggestion.id,
                      "project_id",
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-900"
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
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Team
                </label>

                <select
                  value={getApprovalValue(selectedSuggestion, "team_id")}
                  onChange={(event) =>
                    updateApprovalData(
                      selectedSuggestion.id,
                      "team_id",
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-900"
                >
                  <option value="">Select team</option>

                  {teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Assignee
                </label>

                <select
                  value={getApprovalValue(selectedSuggestion, "assignee_id")}
                  onChange={(event) =>
                    updateApprovalData(
                      selectedSuggestion.id,
                      "assignee_id",
                      event.target.value
                    )
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-900"
                >
                  <option value="">Select assignee</option>

                  {users.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.full_name} — {formatRole(item.role)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Start Date
                  </label>

                  <DatePicker
                    value={getApprovalValue(selectedSuggestion, "start_date")}
                    onChange={(event) =>
                      updateApprovalData(
                        selectedSuggestion.id,
                        "start_date",
                        event.target.value
                      )
                    }
                  />
                </div>

                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Due Date
                  </label>

                  <DatePicker
                    value={getApprovalValue(selectedSuggestion, "due_date")}
                    onChange={(event) =>
                      updateApprovalData(
                        selectedSuggestion.id,
                        "due_date",
                        event.target.value
                      )
                    }
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleReject(selectedSuggestion)}
                  disabled={actionId === selectedSuggestion.id}
                  className="w-full rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Reject
                </button>

                <button
                  type="button"
                  onClick={() => handleApprove(selectedSuggestion)}
                  disabled={actionId === selectedSuggestion.id}
                  className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {actionId === selectedSuggestion.id
                    ? "Saving..."
                    : "Create Task"}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}