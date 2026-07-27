import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { projectApi } from "../api/projectApi";
import { userApi } from "../api/userApi";
import { useAuth } from "../context/AuthContext";
import { useConfirm } from "../context/ConfirmContext";

const PROJECT_STATUS_OPTIONS = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

const initialForm = {
  name: "",
  description: "",
  status: "active",
  project_manager_id: "",
};

function getStatusLabel(status) {
  return (
    PROJECT_STATUS_OPTIONS.find((option) => option.value === status)?.label ||
    status
  );
}

function getProjectInitials(project) {
  const name = project?.name || "Project";

  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function formatDate(dateString) {
  if (!dateString) return "—";

  return new Date(dateString).toLocaleDateString();
}

function getStatusClass(status) {
  if (status === "active") {
    return "inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700";
  }

  if (status === "paused") {
    return "inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700";
  }

  if (status === "completed") {
    return "inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700";
  }

  if (status === "cancelled") {
    return "inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700";
  }

  return "inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700";
}

function ThreeDotsIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM18 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const canManageProjects =
    user?.role === "owner" || user?.role === "admin" || user?.role === "team_manager";

  const [projects, setProjects] = useState([]);
  const [formData, setFormData] = useState(initialForm);
  const [editingProjectId, setEditingProjectId] = useState(null);
  const [originalManagerId, setOriginalManagerId] = useState("");

  const [projectManagers, setProjectManagers] = useState([]);

  const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [error, setError] = useState("");

  const isEditing = editingProjectId !== null;

  const filteredProjects = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return projects.filter((project) => {
      const searchableText = [
        project.name,
        project.description,
        getStatusLabel(project.status),
        project.created_at,
        project.updated_at,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchableText.includes(query);

      const matchesStatus =
        statusFilter === "all" || project.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  const hasActiveFilters = searchQuery || statusFilter !== "all";

  function notifyProjectsChanged() {
    window.dispatchEvent(new Event("projects-changed"));
  }

  async function loadProjects() {
    try {
      setIsLoading(true);
      setError("");

      const data = await projectApi.list();
      setProjects(data);
    } catch (err) {
      setError(err.message || "Unable to load projects.");
      toast.error(err.message || "Unable to load projects.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
  }, []);

  useEffect(() => {
    if (!canManageProjects) return;

    async function loadProjectManagers() {
      try {
        const data = await userApi.list();
        setProjectManagers(data.filter((u) => u.role === "project_manager"));
      } catch {
        setProjectManagers([]);
      }
    }

    loadProjectManagers();
  }, [canManageProjects]);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function resetForm() {
    setFormData(initialForm);
    setEditingProjectId(null);
    setOriginalManagerId("");
    setError("");
  }

  function resetFilters() {
    setSearchQuery("");
    setStatusFilter("all");
    setOpenActionMenuId(null);
  }

  function openCreateModal() {
    resetForm();
    setOpenActionMenuId(null);
    setIsProjectModalOpen(true);
  }

  function closeProjectModal() {
    resetForm();
    setIsProjectModalOpen(false);
  }

  async function handleEdit(project) {
    setOpenActionMenuId(null);
    setEditingProjectId(project.id);

    setFormData({
      name: project.name || "",
      description: project.description || "",
      status: project.status || "active",
      project_manager_id: "",
    });

    setError("");
    setIsProjectModalOpen(true);

    try {
      const members = await projectApi.listMembers(project.id);
      const currentManagerId = members[0]?.user_id ? String(members[0].user_id) : "";
      setOriginalManagerId(currentManagerId);
      setFormData((current) => ({ ...current, project_manager_id: currentManagerId }));
    } catch {
      setOriginalManagerId("");
    }
  }

  function toggleActionMenu(projectId) {
    setOpenActionMenuId((current) =>
      current === projectId ? null : projectId
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setError("");

      const payload = {
        name: formData.name,
        description: formData.description || null,
        status: formData.status,
      };

      if (isEditing) {
        const updatedProject = await projectApi.update(
          editingProjectId,
          payload
        );

        if (formData.project_manager_id !== originalManagerId) {
          if (originalManagerId) {
            await projectApi.removeMember(editingProjectId, Number(originalManagerId));
          }
          if (formData.project_manager_id) {
            await projectApi.addMember(editingProjectId, Number(formData.project_manager_id));
          }
        }

        setProjects((current) =>
          current.map((project) =>
            project.id === editingProjectId ? updatedProject : project
          )
        );

        toast.success("Project updated successfully.");
      } else {
        const createdProject = await projectApi.create(payload);

        if (formData.project_manager_id) {
          await projectApi.addMember(createdProject.id, Number(formData.project_manager_id));
        }

        setProjects((current) => [createdProject, ...current]);

        toast.success("Project created successfully.");
      }

      notifyProjectsChanged();
      closeProjectModal();
    } catch (err) {
      setError(err.message || "Unable to save project.");
      toast.error(err.message || "Unable to save project.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(project) {
    setOpenActionMenuId(null);

    const confirmed = await confirm({ message: `Delete ${project.name}?`, tone: "danger", confirmLabel: "Delete" });

    if (!confirmed) return;

    try {
      setError("");

      await projectApi.delete(project.id);

      setProjects((current) =>
        current.filter((item) => item.id !== project.id)
      );

      if (editingProjectId === project.id) {
        closeProjectModal();
      }

      notifyProjectsChanged();
      toast.success("Project deleted successfully.");
    } catch (err) {
      toast.error(err.message || "Unable to delete project.");
    }
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Projects</h1>
          <p className="mt-2 text-sm text-slate-600">
            Create, update, and manage project workspaces.
          </p>
        </div>

        {canManageProjects ? (
          <button
            type="button"
            onClick={openCreateModal}
            className="w-fit rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            + Add Project
          </button>
        ) : null}
      </div>

      <div className="mb-6 border-b border-slate-200">
        <nav className="flex gap-6">
          <button
            type="button"
            className="border-b-2 border-slate-900 pb-3 text-sm font-semibold text-slate-900"
          >
            List
          </button>
        </nav>
      </div>

      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr_auto]">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Search
            </label>

            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by project, description, status..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-900"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Status
            </label>

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-900"
            >
              <option value="all">All statuses</option>

              {PROJECT_STATUS_OPTIONS.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
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
              {filteredProjects.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-slate-900">
              {projects.length}
            </span>{" "}
            projects
          </p>

          {hasActiveFilters ? (
            <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
              Filters active
            </p>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-sm">
          Loading projects...
        </div>
      ) : null}

      {!isLoading ? (
        <section className="overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto xl:overflow-visible">
            <table className="w-full min-w-[1000px] text-sm xl:min-w-0">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="min-w-72 px-4 py-3 text-left font-semibold text-slate-700">
                    Project
                  </th>

                  <th className="min-w-64 px-4 py-3 text-left font-semibold text-slate-700">
                    Description
                  </th>

                  <th className="min-w-36 px-4 py-3 text-left font-semibold text-slate-700">
                    Status
                  </th>

                  <th className="min-w-36 px-4 py-3 text-left font-semibold text-slate-700">
                    Created
                  </th>

                  <th className="min-w-36 px-4 py-3 text-left font-semibold text-slate-700">
                    Updated
                  </th>

                  {canManageProjects ? (
                    <th className="w-16 px-4 py-3 text-right font-semibold text-slate-700">
                      Actions
                    </th>
                  ) : null}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {filteredProjects.length ? (
                  filteredProjects.map((project) => (
                    <tr key={project.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-4 align-middle">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-500 text-sm font-bold text-white">
                            {getProjectInitials(project)}
                          </div>

                          <div className="min-w-0">
                            <p className="truncate font-semibold text-slate-900">
                              {project.name}
                            </p>
                            <p className="mt-1 text-xs text-slate-400">
                              Project workspace
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-4 align-middle text-slate-700">
                        <p className="line-clamp-2">
                          {project.description || "No description"}
                        </p>
                      </td>

                      <td className="px-4 py-4 align-middle">
                        <span className={getStatusClass(project.status)}>
                          {getStatusLabel(project.status)}
                        </span>
                      </td>

                      <td className="px-4 py-4 align-middle text-slate-700">
                        {formatDate(project.created_at)}
                      </td>

                      <td className="px-4 py-4 align-middle text-slate-700">
                        {formatDate(project.updated_at)}
                      </td>

                      {canManageProjects ? (
                        <td className="relative px-4 py-4 text-right align-middle">
                          <button
                            type="button"
                            onClick={() => toggleActionMenu(project.id)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            title="Project actions"
                          >
                            <ThreeDotsIcon />
                          </button>

                          {openActionMenuId === project.id ? (
                            <div className="absolute right-4 top-12 z-20 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  handleEdit(project);
                                }}
                                className="block w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  handleDelete(project);
                                }}
                                className="block w-full px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </td>
                      ) : null}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan={canManageProjects ? 6 : 5}
                      className="px-4 py-8 text-center text-sm text-slate-500"
                    >
                      {hasActiveFilters
                        ? "No projects match your filters."
                        : "No projects created yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {isProjectModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {isEditing ? "Edit Project" : "Create Project"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {isEditing
                    ? "Update this project's name, description, and status."
                    : "Create a new project workspace."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeProjectModal}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                ✕
              </button>
            </div>

            {error ? (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Project name
                </label>

                <input
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Description
                </label>

                <textarea
                  name="description"
                  value={formData.description}
                  onChange={handleChange}
                  rows={4}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Status
                </label>

                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {PROJECT_STATUS_OPTIONS.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Project Manager
                </label>

                <select
                  name="project_manager_id"
                  value={formData.project_manager_id}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">No Project Manager assigned</option>
                  {projectManagers.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.full_name || manager.email}
                    </option>
                  ))}
                </select>

                {projectManagers.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-400">
                    No users with the Project Manager role yet — assign that role from the Users
                    page first.
                  </p>
                ) : null}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeProjectModal}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting
                    ? "Saving..."
                    : isEditing
                    ? "Update Project"
                    : "Create Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}