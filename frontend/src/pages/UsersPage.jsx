import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { userApi } from "../api/userApi";
import { teamApi } from "../api/teamApi";
import { invitationApi } from "../api/invitationApi";
import { useAuth } from "../context/AuthContext";
import { useConfirm } from "../context/ConfirmContext";

const ROLE_OPTIONS = [
  { value: "owner", label: "Owner" },
  { value: "admin", label: "Admin" },
  { value: "team_manager", label: "Team Manager" },
  { value: "project_manager", label: "Project Manager" },
  { value: "team_member", label: "Team Member" },
];

const ASSIGNABLE_ROLES = ROLE_OPTIONS.filter((r) => r.value !== "owner");

function formatRole(role) {
  return ROLE_OPTIONS.find((item) => item.value === role)?.label || role;
}

function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getUserInitials(targetUser) {
  const name = targetUser?.full_name || targetUser?.email || "User";
  return name
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

export default function UsersPage() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const navigate = useNavigate();

  // Users & teams
  const [users, setUsers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");

  // Filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Action menu
  const [openActionMenuId, setOpenActionMenuId] = useState(null);

  // Tabs
  const [activeTab, setActiveTab] = useState("members");

  // Edit modal
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingUserId, setEditingUserId] = useState(null);
  const [editForm, setEditForm] = useState({ full_name: "", email: "", role: "team_member" });
  const [editError, setEditError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Invite modal
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", role: "team_member" });
  const [inviteError, setInviteError] = useState("");
  const [isInviting, setIsInviting] = useState(false);

  // Pending invitations
  const [invitations, setInvitations] = useState([]);

  const isAdmin = user?.role === "owner" || user?.role === "admin";

  const availableRoles = useMemo(() => {
    const canAssignAdmin = user?.role === "owner" || user?.role === "admin";
    return ASSIGNABLE_ROLES.filter((r) => canAssignAdmin || r.value === "team_member");
  }, [user?.role]);

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

  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return users.filter((item) => {
      const userTeamNames = getTeamsForUser(item).map((t) => t.name).join(" ");
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

      return (
        (!query || searchableText.includes(query)) &&
        (roleFilter === "all" || item.role === roleFilter) &&
        (statusFilter === "all" ||
          (statusFilter === "active" && item.is_active) ||
          (statusFilter === "inactive" && !item.is_active) ||
          (statusFilter === "verified" && item.email_verified_at) ||
          (statusFilter === "unverified" && !item.email_verified_at))
      );
    });
  }, [users, teams, searchQuery, roleFilter, statusFilter]);

  const hasActiveFilters = searchQuery || roleFilter !== "all" || statusFilter !== "all";

  async function loadUsers() {
    try {
      setIsLoading(true);
      setError("");
      const [userData, teamData] = await Promise.all([userApi.list(), teamApi.list()]);
      setUsers(userData);
      setTeams(teamData);
    } catch (err) {
      setError(err.message || "Unable to load users.");
      toast.error(err.message || "Unable to load users.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadInvitations() {
    if (!isAdmin) return;
    try {
      const data = await invitationApi.listPending();
      setInvitations(data);
    } catch {
      // silently fail
    }
  }

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  useEffect(() => {
    if (isAdmin) loadInvitations();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  // ── Edit handlers ──────────────────────────────────────────────────────────

  function handleEdit(targetUser) {
    setOpenActionMenuId(null);
    setEditingUserId(targetUser.id);
    setEditForm({
      full_name: targetUser.full_name || "",
      email: targetUser.email || "",
      role: targetUser.role || "team_member",
    });
    setEditError("");
    setIsEditModalOpen(true);
  }

  function closeEditModal() {
    setIsEditModalOpen(false);
    setEditingUserId(null);
    setEditForm({ full_name: "", email: "", role: "team_member" });
    setEditError("");
  }

  async function handleEditSubmit(event) {
    event.preventDefault();
    try {
      setIsSubmitting(true);
      setEditError("");
      const payload = {
        full_name: editForm.full_name,
        email: editForm.email,
        role: editForm.role,
      };
      const updatedUser = await userApi.update(editingUserId, payload);
      setUsers((current) =>
        current.map((item) => (item.id === editingUserId ? updatedUser : item))
      );
      toast.success("User updated successfully.");
      window.dispatchEvent(new Event("teams-changed"));
      closeEditModal();
    } catch (err) {
      setEditError(err.message || "Unable to save user.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(targetUser) {
    setOpenActionMenuId(null);
    if (!(await confirm({ message: `Delete ${targetUser.full_name}?`, tone: "danger", confirmLabel: "Delete" }))) return;
    try {
      await userApi.delete(targetUser.id);
      setUsers((current) => current.filter((item) => item.id !== targetUser.id));
      window.dispatchEvent(new Event("teams-changed"));
      toast.success(`${targetUser.full_name} deleted successfully.`);
    } catch (err) {
      toast.error(err.message || "Unable to delete user.");
    }
  }

  // ── Invite handlers ────────────────────────────────────────────────────────

  function openInviteModal() {
    setInviteForm({ email: "", role: "team_member" });
    setInviteError("");
    setIsInviteModalOpen(true);
  }

  function closeInviteModal() {
    setIsInviteModalOpen(false);
    setInviteForm({ email: "", role: "team_member" });
    setInviteError("");
  }

  async function handleInvite(event) {
    event.preventDefault();
    if (!inviteForm.email.trim()) {
      setInviteError("Email is required.");
      return;
    }
    try {
      setIsInviting(true);
      setInviteError("");
      await invitationApi.invite(inviteForm);
      toast.success(`Invitation sent to ${inviteForm.email}`);
      closeInviteModal();
      await loadInvitations();
    } catch (err) {
      setInviteError(err.message || "Failed to send invitation.");
    } finally {
      setIsInviting(false);
    }
  }

  async function handleRevoke(invitation) {
    if (!(await confirm({ message: `Revoke invitation for ${invitation.email}?`, tone: "danger", confirmLabel: "Revoke" }))) return;
    try {
      await invitationApi.revoke(invitation.id);
      setInvitations((current) => current.filter((i) => i.id !== invitation.id));
      toast.success("Invitation revoked.");
    } catch (err) {
      toast.error(err.message || "Failed to revoke invitation.");
    }
  }

  async function handleResend(invitation) {
    try {
      await invitationApi.resend(invitation.id);
      toast.success(`Invitation resent to ${invitation.email}`);
      await loadInvitations();
    } catch (err) {
      toast.error(err.message || "Failed to resend invitation.");
    }
  }

  return (
    <div className="w-full">
      {/* Page header */}
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Users</h1>
          <p className="mt-2 text-sm text-slate-600">
            Manage team members and pending invitations.
          </p>
        </div>
        {isAdmin && (
          <button
            type="button"
            onClick={openInviteModal}
            className="w-fit rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            + Invite Member
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-slate-200">
        <nav className="flex gap-6">
          <button
            type="button"
            onClick={() => setActiveTab("members")}
            className={`border-b-2 pb-3 text-sm font-semibold transition-colors ${
              activeTab === "members"
                ? "border-slate-900 text-slate-900"
                : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            Members
          </button>
          {isAdmin && (
            <button
              type="button"
              onClick={() => { setActiveTab("invitations"); loadInvitations(); }}
              className={`border-b-2 pb-3 text-sm font-semibold transition-colors ${
                activeTab === "invitations"
                  ? "border-slate-900 text-slate-900"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
            >
              Pending Invitations
              {invitations.length > 0 && (
                <span className="ml-2 rounded-full bg-slate-200 px-2 py-0.5 text-xs text-slate-700">
                  {invitations.length}
                </span>
              )}
            </button>
          )}
        </nav>
      </div>

      {/* ── Members tab ───────────────────────────────────────────────────────── */}
      {activeTab === "members" && (
        <>
          {/* Filters */}
          <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr_1fr_auto]">
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Search
                </label>
                <input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
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
                  onChange={(e) => setRoleFilter(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-900"
                >
                  <option value="all">All roles</option>
                  {ROLE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Status
                </label>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
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
                  onClick={() => { setSearchQuery(""); setRoleFilter("all"); setStatusFilter("all"); setOpenActionMenuId(null); }}
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
                <span className="font-semibold text-slate-900">{filteredUsers.length}</span>{" "}
                of{" "}
                <span className="font-semibold text-slate-900">{users.length}</span> members
              </p>
              {hasActiveFilters && (
                <p className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                  Filters active
                </p>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {isLoading ? (
            <div className="rounded-2xl bg-white p-6 text-sm text-slate-500 shadow-sm">
              Loading users...
            </div>
          ) : (
            <section className="overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="overflow-x-auto xl:overflow-visible">
                <table className="w-full min-w-[1100px] text-sm xl:min-w-0">
                  <thead className="bg-slate-50">
                    <tr className="border-b border-slate-200">
                      <th className="min-w-72 px-4 py-3 text-left font-semibold text-slate-700">User</th>
                      <th className="min-w-56 px-4 py-3 text-left font-semibold text-slate-700">Email</th>
                      <th className="min-w-40 px-4 py-3 text-left font-semibold text-slate-700">Role</th>
                      <th className="min-w-44 px-4 py-3 text-left font-semibold text-slate-700">Team</th>
                      <th className="min-w-32 px-4 py-3 text-left font-semibold text-slate-700">Account</th>
                      <th className="min-w-32 px-4 py-3 text-left font-semibold text-slate-700">Verification</th>
                      {isAdmin && (
                        <th className="w-16 px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
                      )}
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
                                  <button
                                    type="button"
                                    onClick={() => navigate(`/users/${item.id}/scoreboard`)}
                                    className="truncate font-semibold text-slate-900 hover:text-indigo-600 hover:underline"
                                  >
                                    {item.full_name}
                                  </button>
                                  {user?.id === item.id && (
                                    <p className="mt-1 text-xs font-medium text-slate-400">You</p>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-4 align-middle text-slate-700">{item.email}</td>
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
                                <span className="text-amber-600">No team assigned</span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-4 py-4 align-middle">
                              {item.is_active ? (
                                <span className="inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">Active</span>
                              ) : (
                                <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">Inactive</span>
                              )}
                            </td>
                            <td className="px-4 py-4 align-middle">
                              {item.email_verified_at ? (
                                <span className="inline-flex rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">Verified</span>
                              ) : (
                                <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-700">Unverified</span>
                              )}
                            </td>
                            {isAdmin && (
                              <td className="relative px-4 py-4 text-right align-middle">
                                <button
                                  type="button"
                                  onClick={() => setOpenActionMenuId((current) => current === item.id ? null : item.id)}
                                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                                >
                                  <ThreeDotsIcon />
                                </button>
                                {openActionMenuId === item.id && (
                                  <div className="absolute right-4 top-12 z-20 w-36 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                                    <button
                                      type="button"
                                      onClick={() => handleEdit(item)}
                                      className="block w-full px-4 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
                                    >
                                      Edit
                                    </button>
                                    {user?.id !== item.id && (
                                      <button
                                        type="button"
                                        onClick={() => handleDelete(item)}
                                        className="block w-full px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                                      >
                                        Delete
                                      </button>
                                    )}
                                  </div>
                                )}
                              </td>
                            )}
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={isAdmin ? 7 : 6} className="px-4 py-8 text-center text-sm text-slate-500">
                          {hasActiveFilters ? "No users match your filters." : "No users found."}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}

      {/* ── Pending Invitations tab ───────────────────────────────────────────── */}
      {activeTab === "invitations" && isAdmin && (
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          {invitations.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-slate-500">
              No pending invitations.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200">
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Email</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Role</th>
                    <th className="px-4 py-3 text-left font-semibold text-slate-700">Expires</th>
                    <th className="px-4 py-3 text-right font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {invitations.map((invitation) => (
                    <tr key={invitation.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-4 align-middle text-slate-900">{invitation.email}</td>
                      <td className="px-4 py-4 align-middle">
                        <span className="inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {formatRole(invitation.role)}
                        </span>
                      </td>
                      <td className="px-4 py-4 align-middle text-slate-600">
                        {formatDate(invitation.expires_at)}
                      </td>
                      <td className="px-4 py-4 text-right align-middle">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleResend(invitation)}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50"
                          >
                            Resend
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRevoke(invitation)}
                            className="rounded-lg px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-200 hover:bg-red-50"
                          >
                            Revoke
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── Edit modal ─────────────────────────────────────────────────────────── */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Edit User</h2>
                <p className="mt-1 text-sm text-slate-500">Update this user's profile details.</p>
              </div>
              <button
                type="button"
                onClick={closeEditModal}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                ✕
              </button>
            </div>

            {editError && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {editError}
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
                <input
                  value={editForm.full_name}
                  onChange={(e) => setEditForm((current) => ({ ...current, full_name: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((current) => ({ ...current, email: e.target.value }))}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((current) => ({ ...current, role: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  {availableRoles.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSubmitting ? "Saving..." : "Update User"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Invite modal ───────────────────────────────────────────────────────── */}
      {isInviteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 py-6">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">Invite Member</h2>
                <p className="mt-1 text-sm text-slate-500">
                  An invitation link will be sent to their email.
                </p>
              </div>
              <button
                type="button"
                onClick={closeInviteModal}
                className="rounded-lg px-3 py-2 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                ✕
              </button>
            </div>

            {inviteError && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {inviteError}
              </div>
            )}

            <form onSubmit={handleInvite} className="space-y-5">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Email address</label>
                <input
                  type="email"
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm((current) => ({ ...current, email: e.target.value }))}
                  placeholder="colleague@example.com"
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700">Role</label>
                <select
                  value={inviteForm.role}
                  onChange={(e) => setInviteForm((current) => ({ ...current, role: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
                >
                  {availableRoles.map((r) => (
                    <option key={r.value} value={r.value}>{r.label}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeInviteModal}
                  className="w-full rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isInviting}
                  className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isInviting ? "Sending..." : "Send Invitation"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
