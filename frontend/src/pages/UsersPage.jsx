import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { userApi } from "../api/userApi";
import { teamApi } from "../api/teamApi";
import { useAuth } from "../context/AuthContext";

const ROLE_OPTIONS = [
  { value: "admin", label: "Admin" },
  { value: "team_manager", label: "Team Manager" },
  { value: "team_member", label: "Team Member" },
];

const initialForm = {
  full_name: "",
  email: "",
  password: "",
  role: "team_member",
  managed_team_id: "",
};

function formatRole(role) {
  return ROLE_OPTIONS.find((item) => item.value === role)?.label || role;
}

function getUserInitials(user) {
  const name = user?.full_name || user?.email || "User";

  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function EyeIcon({ hidden }) {
  if (hidden) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="h-5 w-5"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 3l18 18M10.58 10.58A2 2 0 0012 14a2 2 0 001.42-.58M9.88 5.09A10.45 10.45 0 0112 4.88c5.25 0 8.5 4.62 9.5 7.12a12.17 12.17 0 01-2.3 3.48M6.53 6.53A12.32 12.32 0 002.5 12c1 2.5 4.25 7.12 9.5 7.12a10.7 10.7 0 005.47-1.55"
        />
      </svg>
    );
  }

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className="h-5 w-5"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.5 12S5.75 4.88 12 4.88 21.5 12 21.5 12 18.25 19.12 12 19.12 2.5 12 2.5 12z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 14.75A2.75 2.75 0 1012 9.25a2.75 2.75 0 000 5.5z"
      />
    </svg>
  );
}

function ThreeDotsIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M6 10a2 2 0 11-4 0 2 2 0 014 0zM12 10a2 2 0 11-4 0 2 2 0 014 0zM18 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  );
}

export default function UsersPage() {
  const { user } = useAuth();

  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);

  const [formData, setFormData] = useState(initialForm);
  const [editingUserId, setEditingUserId] = useState(null);

  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const [showPassword, setShowPassword] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [error, setError] = useState("");

  const isEditing = editingUserId !== null;
  const isAdmin = user?.role === "admin";
  const isTeamManager = user?.role === "team_manager";
  const canCreateAdmin = user?.role === "admin";

  const managedTeams = useMemo(
    () => teams.filter((t) => t.team_manager_id === user?.id),
    [teams, user]
  );

  const availableRoles = useMemo(() => {
    return ROLE_OPTIONS.filter((role) => {
      if (canCreateAdmin) return true;
      return role.value === "team_member";
    });
  }, [canCreateAdmin]);


  function getTeamsForUser(targetUser) {
    if (!targetUser) return [];

    if (targetUser.role === "team_manager") {
      return teams.filter((team) => team.team_manager_id === targetUser.id);
    }

    if (targetUser.role === "team_member") {
      return teams.filter((team) =>
        team.members?.some((member) => member.id === targetUser.id)
      );
    }

    return [];
  }

  function getPrimaryTeamForUser(targetUser) {
    return getTeamsForUser(targetUser)[0] || null;
  }

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return users.filter((item) => {
      const userTeamNames = getTeamsForUser(item)
        .map((team) => team.name)
        .join(" ");

      const searchableText = [
        item.full_name,
        item.email,
        formatRole(item.role),
        userTeamNames,
        item.is_active ? "active" : "inactive",
        item.email_verified_at ? "verified" : "unverified",
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || searchableText.includes(query);

      const matchesRole = roleFilter === "all" || item.role === roleFilter;

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && item.is_active) ||
        (statusFilter === "inactive" && !item.is_active) ||
        (statusFilter === "verified" && item.email_verified_at) ||
        (statusFilter === "unverified" && !item.email_verified_at);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, teams, searchQuery, roleFilter, statusFilter]);

  const hasActiveFilters =
    searchQuery || roleFilter !== "all" || statusFilter !== "all";

  async function loadUsers() {
    try {
      setIsLoading(true);
      setError("");

      if (isAdmin) {
        const [userData, teamData] = await Promise.all([
          userApi.list(),
          teamApi.list(),
        ]);

        setUsers(userData);
        setTeams(teamData);
      } else {
        const [userData, teamData] = await Promise.all([
          userApi.list(),
          teamApi.list(),
        ]);

        setUsers(userData);
        setTeams(teamData);
      }
    } catch (err) {
      setError(err.message || "Unable to load users.");
      toast.error(err.message || "Unable to load users.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, [isAdmin]);

  function handleChange(event) {
    const { name, value } = event.target;
  
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function resetForm() {
    setFormData(initialForm);
    setEditingUserId(null);
    setShowPassword(false);
    setError("");
  }

  function resetFilters() {
    setSearchQuery("");
    setRoleFilter("all");
    setStatusFilter("all");
    setOpenActionMenuId(null);
  }

  function openCreateModal() {
    resetForm();
    setOpenActionMenuId(null);
    setIsUserModalOpen(true);
  }

  function closeUserModal() {
    resetForm();
    setIsUserModalOpen(false);
  }

  function handleEdit(targetUser) {
    setOpenActionMenuId(null);
    setEditingUserId(targetUser.id);
  
    setFormData({
      full_name: targetUser.full_name || "",
      email: targetUser.email || "",
      password: "",
      role: targetUser.role || "team_member",
    });
  
    setError("");
    setIsUserModalOpen(true);
  }

  function toggleActionMenu(userId) {
    setOpenActionMenuId((current) => (current === userId ? null : userId));
  }

  async function handleSubmit(event) {
    event.preventDefault();


    try {
      setIsSubmitting(true);
      setError("");

      if (isEditing) {
        const payload = {
          full_name: formData.full_name,
          email: formData.email,
          role: formData.role,
        };

        if (formData.password.trim()) {
          payload.password = formData.password;
        }

        const updatedUser = await userApi.update(editingUserId, payload);

        setUsers((current) =>
          current.map((item) => (item.id === editingUserId ? updatedUser : item))
        );

        toast.success("User updated successfully.");
      } else {
        const createPayload = {
          full_name: formData.full_name,
          email: formData.email,
          password: formData.password,
          role: formData.role,
        };

        if (isTeamManager && managedTeams.length > 1 && formData.managed_team_id) {
          createPayload.managed_team_id = Number(formData.managed_team_id);
        }

        const createdUser = await userApi.create(createPayload);

        setUsers((current) => [createdUser, ...current]);

        toast.success("User created successfully.");
      }

      window.dispatchEvent(new Event("teams-changed"));

      await loadUsers();

      closeUserModal();
    } catch (err) {
      setError(err.message || "Unable to save user.");
      toast.error(err.message || "Unable to save user.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(targetUser) {
    setOpenActionMenuId(null);

    const confirmed = window.confirm(`Delete ${targetUser.full_name}?`);

    if (!confirmed) return;

    try {
      setError("");

      await userApi.delete(targetUser.id);

      setUsers((current) =>
        current.filter((item) => item.id !== targetUser.id)
      );

      if (editingUserId === targetUser.id) {
        closeUserModal();
      }

      window.dispatchEvent(new Event("teams-changed"));

      toast.success(`${targetUser.full_name} deleted successfully.`);
    } catch (err) {
      toast.error(err.message || "Unable to delete user.");
    }
  }

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Users</h1>
          <p className="mt-2 text-sm text-slate-600">
            Create, update, and manage Admins, Team Managers, and Team Members.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="w-fit rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
        >
          + Add User
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
              placeholder="Search by name, email, role, team..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-900"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
              Role
            </label>

            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-900"
            >
              <option value="all">All roles</option>

              {ROLE_OPTIONS.map((role) => (
                <option key={role.value} value={role.value}>
                  {role.label}
                </option>
              ))}
            </select>
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
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
              <option value="verified">Verified</option>
              <option value="unverified">Unverified</option>
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
              {filteredUsers.length}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-slate-900">{users.length}</span>{" "}
            users
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
          Loading users...
        </div>
      ) : null}

      {!isLoading ? (
        <section className="overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto xl:overflow-visible">
            <table className="w-full min-w-[1100px] text-sm xl:min-w-0">
              <thead className="bg-slate-50">
                <tr className="border-b border-slate-200">
                  <th className="min-w-72 px-4 py-3 text-left font-semibold text-slate-700">
                    User
                  </th>

                  <th className="min-w-56 px-4 py-3 text-left font-semibold text-slate-700">
                    Email
                  </th>

                  <th className="min-w-40 px-4 py-3 text-left font-semibold text-slate-700">
                    Role
                  </th>

                  <th className="min-w-44 px-4 py-3 text-left font-semibold text-slate-700">
                    Team
                  </th>

                  <th className="min-w-32 px-4 py-3 text-left font-semibold text-slate-700">
                    Account
                  </th>

                  <th className="min-w-32 px-4 py-3 text-left font-semibold text-slate-700">
                    Verification
                  </th>

                  {isAdmin ? (
                    <th className="w-16 px-4 py-3 text-right font-semibold text-slate-700">
                      Actions
                    </th>
                  ) : null}
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-200">
                {filteredUsers.length ? (
                  filteredUsers.map((item) => {
                    const userTeams = getTeamsForUser(item);

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/70">
                        <td className="px-4 py-4 align-middle">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-sm font-bold text-white">
                              {getUserInitials(item)}
                            </div>

                            <div className="min-w-0">
                              <p className="truncate font-semibold text-slate-900">
                                {item.full_name}
                              </p>

                              {user?.id === item.id ? (
                                <p className="mt-1 text-xs font-medium text-slate-400">
                                  You
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>

                        <td className="px-4 py-4 align-middle text-slate-700">
                          {item.email}
                        </td>

                        <td className="px-4 py-4 align-middle">
                          <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                            {formatRole(item.role)}
                          </span>
                        </td>

                        <td className="px-4 py-4 align-middle text-slate-700">
                          {userTeams.length ? (
                            <div className="flex flex-wrap gap-2">
                              {userTeams.map((teamItem) => (
                                <span
                                  key={teamItem.id}
                                  className={
                                    item.role === "team_manager"
                                      ? "inline-flex rounded-full bg-indigo-100 px-3 py-1 text-xs font-semibold text-indigo-700"
                                      : "inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                                  }
                                >
                                  {teamItem.name}
                                </span>
                              ))}
                            </div>
                          ) : item.role === "team_manager" ? (
                            <span className="text-amber-600">
                              No team assigned
                            </span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>

                        <td className="px-4 py-4 align-middle">
                          {item.is_active ? (
                            <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
                              Inactive
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-4 align-middle">
                          {item.email_verified_at ? (
                            <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
                              Verified
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">
                              Unverified
                            </span>
                          )}
                        </td>

                        {isAdmin ? (
                          <td className="relative px-4 py-4 text-right align-middle">
                            <button
                              type="button"
                              onClick={() => toggleActionMenu(item.id)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                              title="User actions"
                            >
                              <ThreeDotsIcon />
                            </button>

                            {openActionMenuId === item.id ? (
                              <div className="absolute right-4 top-12 z-20 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpenActionMenuId(null);
                                    handleEdit(item);
                                  }}
                                  className="block w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                                >
                                  Edit
                                </button>

                                {user?.id !== item.id ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      handleDelete(item);
                                    }}
                                    className="block w-full px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                                  >
                                    Delete
                                  </button>
                                ) : null}
                              </div>
                            ) : null}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td
                      colSpan={isAdmin ? 7 : 6}
                      className="px-4 py-8 text-center text-sm text-slate-500"
                    >
                      {hasActiveFilters
                        ? "No users match your filters."
                        : "No users found."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {isUserModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {isEditing ? "Edit User" : "Create User"}
                </h2>

                <p className="mt-1 text-sm text-slate-500">
                  {isEditing
                    ? "Leave password empty if you do not want to change it."
                    : isTeamManager
                    ? "New member will be added to your team."
                    : "Select a role. Team Manager can be assigned later from the Teams page."}
                </p>
              </div>

              <button
                type="button"
                onClick={closeUserModal}
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
                  Full name
                </label>

                <input
                  name="full_name"
                  value={formData.full_name}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Email
                </label>

                <input
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Password
                </label>

                <div className="relative">
                  <input
                    name="password"
                    type={showPassword ? "text" : "password"}
                    minLength={isEditing ? undefined : 8}
                    value={formData.password}
                    onChange={handleChange}
                    required={!isEditing}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-11 text-sm"
                  />

                  <button
                    type="button"
                    onClick={() => setShowPassword((current) => !current)}
                    className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 hover:text-slate-900"
                    aria-label={
                      showPassword ? "Hide password" : "Show password"
                    }
                  >
                    <EyeIcon hidden={showPassword} />
                  </button>
                </div>

                {isEditing ? (
                  <p className="mt-1 text-xs text-slate-400">
                    Leave empty to keep the current password.
                  </p>
                ) : null}
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  Role
                </label>

                <select
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {availableRoles.map((role) => (
                    <option key={role.value} value={role.value}>
                      {role.label}
                    </option>
                  ))}
                </select>
              </div>

              {!isEditing && isTeamManager && managedTeams.length > 1 && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700">
                    Team <span className="text-red-500">*</span>
                  </label>

                  <select
                    name="managed_team_id"
                    value={formData.managed_team_id}
                    onChange={handleChange}
                    required
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    <option value="">Select a team...</option>
                    {managedTeams.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name}
                      </option>
                    ))}
                  </select>

                  <p className="mt-1 text-xs text-slate-400">
                    Choose which of your teams to add this member to.
                  </p>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeUserModal}
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
                    ? "Update User"
                    : "Create User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}