import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { teamApi } from "../api/teamApi";
import { userApi } from "../api/userApi";
import { useConfirm } from "../context/ConfirmContext";

const initialForm = {
  name: "",
  description: "",
  team_manager_id: "",
  member_ids: [],
};

function getInitials(name) {
  return (name || "Team")
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function ThreeDotsIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM18 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

export default function TeamsPage() {
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);

  const [formData, setFormData] = useState(initialForm);
  const [editingTeamId, setEditingTeamId] = useState(null);

  const [isTeamModalOpen, setIsTeamModalOpen] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [managerFilter, setManagerFilter] = useState("all");
  const [memberFilter, setMemberFilter] = useState("all");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [error, setError] = useState("");

  const isEditing = editingTeamId !== null;

  const teamManagers = useMemo(() => {
    return users.filter((user) => user.role === "team_manager");
  }, [users]);

  const teamMembers = useMemo(() => {
    return users.filter((user) => user.role === "team_member");
  }, [users]);

  const filteredTeams = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return teams.filter((team) => {
      const memberNames =
        team.members?.map((member) => member.full_name).join(" ") || "";

      const memberEmails =
        team.members?.map((member) => member.email).join(" ") || "";

      const searchableText = [
        team.name,
        team.description,
        team.team_manager?.full_name,
        team.team_manager?.email,
        memberNames,
        memberEmails,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchableText.includes(query);

      const matchesManager =
        managerFilter === "all" ||
        String(team.team_manager_id) === managerFilter;

      const matchesMember =
        memberFilter === "all" ||
        team.members?.some((member) => String(member.id) === memberFilter);

      return matchesSearch && matchesManager && matchesMember;
    });
  }, [teams, searchQuery, managerFilter, memberFilter]);

  const hasActiveFilters =
    searchQuery || managerFilter !== "all" || memberFilter !== "all";

  async function loadData() {
    try {
      setIsLoading(true);
      setError("");

      const [teamsData, usersData] = await Promise.all([
        teamApi.list(),
        userApi.list(),
      ]);

      setTeams(teamsData);
      setUsers(usersData);
    } catch (err) {
      setError(err.message || "Unable to load teams.");
      toast.error(err.message || "Unable to load teams.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function handleChange(event) {
    const { name, value } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleMemberToggle(memberId) {
    setFormData((current) => {
      const alreadySelected = current.member_ids.includes(memberId);

      return {
        ...current,
        member_ids: alreadySelected
          ? current.member_ids.filter((id) => id !== memberId)
          : [...current.member_ids, memberId],
      };
    });
  }

  function resetForm() {
    setFormData(initialForm);
    setEditingTeamId(null);
    setError("");
  }

  function resetFilters() {
    setSearchQuery("");
    setManagerFilter("all");
    setMemberFilter("all");
    setOpenActionMenuId(null);
  }

  function openCreateModal() {
    resetForm();
    setOpenActionMenuId(null);
    setIsTeamModalOpen(true);
  }

  function closeTeamModal() {
    resetForm();
    setIsTeamModalOpen(false);
  }

  function handleEdit(team) {
    const memberIds =
      team.members
        ?.filter((member) => member.role === "team_member")
        .map((member) => member.id) || [];

    setOpenActionMenuId(null);
    setEditingTeamId(team.id);

    setFormData({
      name: team.name || "",
      description: team.description || "",
      team_manager_id: team.team_manager_id
        ? String(team.team_manager_id)
        : "",
      member_ids: memberIds,
    });

    setError("");
    setIsTeamModalOpen(true);
  }

  function toggleActionMenu(teamId) {
    setOpenActionMenuId((current) => (current === teamId ? null : teamId));
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setIsSubmitting(true);
      setError("");

      const payload = {
        name: formData.name,
        description: formData.description || null,
        team_manager_id: formData.team_manager_id ? Number(formData.team_manager_id) : null,
        member_ids: formData.member_ids,
      };

      if (isEditing) {
        const updatedTeam = await teamApi.update(editingTeamId, payload);

        setTeams((current) =>
          current.map((team) =>
            team.id === editingTeamId ? updatedTeam : team
          )
        );

        toast.success("Team updated successfully.");
      } else {
        const createdTeam = await teamApi.create(payload);

        setTeams((current) => [createdTeam, ...current]);

        toast.success("Team created successfully.");
      }

      window.dispatchEvent(new Event("teams-changed"));
      closeTeamModal();
    } catch (err) {
      setError(err.message || "Unable to save team.");
      toast.error(err.message || "Unable to save team.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(team) {
    setOpenActionMenuId(null);

    const confirmed = await confirm({ message: `Delete ${team.name}?`, tone: "danger", confirmLabel: "Delete" });

    if (!confirmed) return;

    try {
      setError("");

      await teamApi.delete(team.id);

      setTeams((current) => current.filter((item) => item.id !== team.id));

      if (editingTeamId === team.id) {
        closeTeamModal();
      }

      window.dispatchEvent(new Event("teams-changed"));
      toast.success("Team deleted successfully.");
    } catch (err) {
      toast.error(err.message || "Unable to delete team.");
    }
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Teams</h1>
          <p className="mt-2 text-sm text-slate-600">
            Create, update, and manage teams with managers and members.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="w-fit rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          + Add Team
        </button>
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
        <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr_1fr_auto]">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Search
            </label>

            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search by team, manager, member..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-900"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Manager
            </label>

            <select
              value={managerFilter}
              onChange={(event) => setManagerFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-900"
            >
              <option value="all">All managers</option>

              {teamManagers.map((manager) => (
                <option key={manager.id} value={manager.id}>
                  {manager.full_name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Member
            </label>

            <select
              value={memberFilter}
              onChange={(event) => setMemberFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-900"
            >
              <option value="all">All members</option>

              {teamMembers.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.full_name}
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
              {filteredTeams.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-slate-900">{teams.length}</span>{" "}
            teams
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
          Loading teams...
        </div>
      ) : null}

      {!isLoading ? (
        <section className="overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto xl:overflow-visible">
            <table className="w-full min-w-[1000px] text-sm xl:min-w-0">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="min-w-72 px-4 py-3 text-left font-semibold text-slate-700">
                    Team
                  </th>

                  <th className="min-w-64 px-4 py-3 text-left font-semibold text-slate-700">
                    Description
                  </th>

                  <th className="min-w-48 px-4 py-3 text-left font-semibold text-slate-700">
                    Manager
                  </th>

                  <th className="min-w-52 px-4 py-3 text-left font-semibold text-slate-700">
                    Members
                  </th>

                  <th className="min-w-32 px-4 py-3 text-left font-semibold text-slate-700">
                    Total Members
                  </th>

                  <th className="w-16 px-4 py-3 text-right font-semibold text-slate-700">
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {filteredTeams.length ? (
                  filteredTeams.map((team) => {
                    const members = team.members || [];

                    return (
                      <tr key={team.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-4 align-middle">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-sm font-bold text-white">
                              {getInitials(team.name)}
                            </div>

                            <div className="min-w-0">
                              <button
                                type="button"
                                onClick={() => navigate(`/teams/${team.id}?tab=scoreboard`)}
                                className="truncate font-semibold text-slate-900 hover:text-indigo-600 hover:underline"
                              >
                                {team.name}
                              </button>
                              <p className="mt-1 text-xs text-slate-400">
                                Team workspace
                              </p>
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4 align-middle text-slate-700">
                          <p className="line-clamp-2">
                            {team.description || "No description"}
                          </p>
                        </td>

                        <td className="px-4 py-4 align-middle">
                          {team.team_manager ? (
                            <div>
                              <p className="font-medium text-slate-900">
                                {team.team_manager.full_name}
                              </p>
                              <p className="mt-1 text-xs text-slate-500">
                                {team.team_manager.email}
                              </p>
                            </div>
                          ) : (
                            <span className="text-slate-400">No manager</span>
                          )}
                        </td>

                        <td className="px-4 py-4 align-middle">
                          {members.length ? (
                            <div className="flex flex-wrap gap-1.5">
                              {members.slice(0, 3).map((member) => (
                                <span
                                  key={member.id}
                                  className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700"
                                >
                                  {member.full_name}
                                </span>
                              ))}

                              {members.length > 3 ? (
                                <span className="rounded-full bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white">
                                  +{members.length - 3}
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-slate-400">No members</span>
                          )}
                        </td>

                        <td className="px-4 py-4 align-middle">
                          <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                            {members.length}
                          </span>
                        </td>

                        <td className="relative px-4 py-4 text-right align-middle">
                          <button
                            type="button"
                            onClick={() => toggleActionMenu(team.id)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                            title="Team actions"
                          >
                            <ThreeDotsIcon />
                          </button>

                          {openActionMenuId === team.id ? (
                            <div className="absolute right-4 top-12 z-20 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  handleEdit(team);
                                }}
                                className="block w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                              >
                                Edit
                              </button>

                              <button
                                type="button"
                                onClick={() => {
                                  setOpenActionMenuId(null);
                                  handleDelete(team);
                                }}
                                className="block w-full px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                              >
                                Delete
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-sm text-slate-500"
                    >
                      {hasActiveFilters
                        ? "No teams match your filters."
                        : "No teams created yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {isTeamModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {isEditing ? "Edit Team" : "Create Team"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {isEditing
                    ? "Update this team's manager and members."
                    : "Create a team and assign members with checkboxes."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeTeamModal}
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
                  Team name
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
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Team Manager
                </label>

                <select
                  name="team_manager_id"
                  value={formData.team_manager_id}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="">Select manager</option>

                  {teamManagers.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.full_name}
                    </option>
                  ))}
                </select>

                {!teamManagers.length ? (
                  <p className="mt-1 text-xs text-red-500">
                    Create a Team Manager first from Users page.
                  </p>
                ) : null}
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label className="block text-sm font-medium text-slate-700">
                    Team Members
                  </label>

                  <span className="text-xs font-semibold text-slate-400">
                    {formData.member_ids.length} selected
                  </span>
                </div>

                <div className="max-h-56 space-y-2 overflow-y-auto rounded-lg border border-slate-300 p-3">
                  {teamMembers.map((member) => {
                    const isChecked = formData.member_ids.includes(member.id);

                    return (
                      <label
                        key={member.id}
                        className={
                          isChecked
                            ? "flex cursor-pointer items-center gap-3 rounded-lg bg-slate-100 px-3 py-2 text-sm font-medium text-slate-900"
                            : "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                        }
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleMemberToggle(member.id)}
                          className="h-4 w-4 rounded border-slate-300"
                        />

                        <div className="min-w-0">
                          <p className="truncate">{member.full_name}</p>
                          <p className="truncate text-xs text-slate-500">
                            {member.email}
                          </p>
                        </div>
                      </label>
                    );
                  })}

                  {!teamMembers.length ? (
                    <p className="text-sm text-slate-500">
                      No Team Members found. Create Team Members first from
                      Users page.
                    </p>
                  ) : null}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeTeamModal}
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
                    ? "Update Team"
                    : "Create Team"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}