export default function TeamMemberList({
    teamMembers,
    onEdit,
    onDelete,
    isDeletingId = null,
  }) {
    if (!teamMembers.length) {
      return (
        <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
          <h3 className="text-base font-semibold text-slate-900">
            No team members yet
          </h3>
          <p className="mt-2 text-sm text-slate-500">
            Add team members so transcript action items can be assigned
            automatically.
          </p>
        </div>
      );
    }
  
    return (
      <div className="overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">Team Members</h2>
          <p className="mt-1 text-sm text-slate-500">
            These members are used for assignee matching.
          </p>
        </div>
  
        <div className="divide-y divide-slate-200">
          {teamMembers.map((member) => (
            <div
              key={member.id}
              className="flex flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between"
            >
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-slate-900">
                    {member.full_name}
                  </h3>
  
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      member.is_active
                        ? "bg-green-50 text-green-700"
                        : "bg-slate-100 text-slate-500",
                    ].join(" ")}
                  >
                    {member.is_active ? "Active" : "Inactive"}
                  </span>
                </div>
  
                <div className="mt-1 space-y-1 text-sm text-slate-500">
                  {member.email ? <p>{member.email}</p> : null}
                  {member.role_title ? <p>{member.role_title}</p> : null}
                </div>
  
                {member.aliases?.length ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {member.aliases.map((alias) => (
                      <span
                        key={alias}
                        className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600"
                      >
                        {alias}
                      </span>
                    ))}
                  </div>
                ) : null}
              </div>
  
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onEdit(member)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  Edit
                </button>
  
                <button
                  type="button"
                  onClick={() => onDelete(member)}
                  disabled={isDeletingId === member.id}
                  className="rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isDeletingId === member.id ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }