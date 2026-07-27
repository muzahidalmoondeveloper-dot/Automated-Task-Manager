import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { teamMemberApi } from "../api/teamMemberApi";
import TeamMemberForm from "../components/team/TeamMemberForm";
import TeamMemberList from "../components/team/TeamMemberList";
import { useConfirm } from "../context/ConfirmContext";

export default function TeamMembersPage() {
  const confirm = useConfirm();
  const [teamMembers, setTeamMembers] = useState([]);
  const [editingMember, setEditingMember] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeletingId, setIsDeletingId] = useState(null);

  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  async function loadTeamMembers() {
    try {
      setIsLoading(true);
      setError("");

      const data = await teamMemberApi.list();
      setTeamMembers(data);
    } catch (err) {
      toast.error(err.message || "Unable to load team members.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadTeamMembers();
  }, []);

  async function handleCreate(payload) {
    try {
      setIsSubmitting(true);
      setError("");
      setSuccessMessage("");

      const createdMember = await teamMemberApi.create(payload);
      setTeamMembers((current) => [createdMember, ...current]);
      toast.success("Team member added successfully.");
    } catch (err) {
      toast.success(err.message || "Unable to create team member.");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleUpdate(payload) {
    if (!editingMember) return;

    try {
      setIsSubmitting(true);
      setError("");
      setSuccessMessage("");

      const updatedMember = await teamMemberApi.update(editingMember.id, payload);

      setTeamMembers((current) =>
        current.map((member) =>
          member.id === updatedMember.id ? updatedMember : member
        )
      );

      setEditingMember(null);
      toast.success("Team member updated successfully.");
    } catch (err) {
      toast.error(err.message || "Unable to update team member.");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(member) {
    const confirmed = await confirm({
      message: `Delete ${member.full_name}? This cannot be undone.`,
      tone: "danger",
      confirmLabel: "Delete",
    });

    if (!confirmed) return;

    try {
      setIsDeletingId(member.id);
      setError("");
      setSuccessMessage("");

      await teamMemberApi.delete(member.id);

      setTeamMembers((current) =>
        current.filter((item) => item.id !== member.id)
      );

      if (editingMember?.id === member.id) {
        setEditingMember(null);
      }

      toast.success("Team member deleted successfully.");
    } catch (err) {
      toast.error(err.message || "Unable to delete team member.");
    } finally {
      setIsDeletingId(null);
    }
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">
            Team Members
          </h1>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Manage people who can be matched to action items extracted from
            meeting transcripts.
          </p>
        </div>

        <button
          type="button"
          onClick={loadTeamMembers}
          disabled={isLoading}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {successMessage ? (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {successMessage}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_420px]">
        <section>
          {isLoading ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
              <p className="text-sm text-slate-500">Loading team members...</p>
            </div>
          ) : (
            <TeamMemberList
              teamMembers={teamMembers}
              onEdit={setEditingMember}
              onDelete={handleDelete}
              isDeletingId={isDeletingId}
            />
          )}
        </section>

        <aside className="lg:sticky lg:top-24 lg:self-start">
          <TeamMemberForm
            key={editingMember?.id || "create"}
            mode={editingMember ? "edit" : "create"}
            initialValues={editingMember}
            onSubmit={editingMember ? handleUpdate : handleCreate}
            onCancel={editingMember ? () => setEditingMember(null) : undefined}
            isSubmitting={isSubmitting}
          />
        </aside>
      </div>
    </div>
  );
}