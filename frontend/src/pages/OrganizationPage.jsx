import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

import { useAuth } from "../context/AuthContext";
import { useConfirm } from "../context/ConfirmContext";
import RichEditor from "../components/RichEditor";
import DatePicker from "../components/DatePicker";
import { organizationApi } from "../api/organizationApi";
import { userApi } from "../api/userApi";
import { rockApi } from "../api/rockApi";
import { projectApi } from "../api/projectApi";
import { RockIconDisplay } from "../utils/rockIcons.jsx";
import IconPickerButton from "../components/IconPicker.jsx";

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "core-values", label: "Core Values" },
  { id: "org-chart",   label: "Org Chart"   },
  { id: "objectives",  label: "Objectives"  },
];

const VALUE_COLORS = [
  { id: "slate",  bg: "bg-slate-100",  text: "text-slate-700",  border: "border-slate-200"  },
  { id: "blue",   bg: "bg-blue-100",   text: "text-blue-700",   border: "border-blue-200"   },
  { id: "green",  bg: "bg-green-100",  text: "text-green-700",  border: "border-green-200"  },
  { id: "purple", bg: "bg-purple-100", text: "text-purple-700", border: "border-purple-200" },
  { id: "amber",  bg: "bg-amber-100",  text: "text-amber-700",  border: "border-amber-200"  },
  { id: "rose",   bg: "bg-rose-100",   text: "text-rose-700",   border: "border-rose-200"   },
  { id: "teal",   bg: "bg-teal-100",   text: "text-teal-700",   border: "border-teal-200"   },
  { id: "indigo", bg: "bg-indigo-100", text: "text-indigo-700", border: "border-indigo-200" },
];

const OBJECTIVE_STATUSES = [
  { value: "active",    label: "Active",    classes: "bg-blue-100 text-blue-700"   },
  { value: "completed", label: "Completed", classes: "bg-green-100 text-green-700" },
  { value: "paused",    label: "Paused",    classes: "bg-amber-100 text-amber-700" },
  { value: "cancelled", label: "Cancelled", classes: "bg-red-100 text-red-700"     },
];

function ValueIconDisplay({ iconStr, size = 24 }) {
  if (iconStr && iconStr.includes("|")) {
    return <RockIconDisplay iconStr={iconStr} size={size} />;
  }
  return <span style={{ fontSize: size }}>{iconStr || "⭐"}</span>;
}

function getColorClasses(colorId) {
  return VALUE_COLORS.find((c) => c.id === colorId) || VALUE_COLORS[0];
}

function getStatusClasses(statusValue) {
  return OBJECTIVE_STATUSES.find((s) => s.value === statusValue) || OBJECTIVE_STATUSES[0];
}

// ─── Modal ────────────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-bold text-slate-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5">{children}</div>
      </div>
    </div>
  );
}

// ─── Core Values ──────────────────────────────────────────────────────────────

const VALUE_DEFAULTS = { title: "", description: "", icon: "⭐", color: "slate", sort_order: 0 };

function CoreValuesTab({ canManage }) {
  const confirm = useConfirm();
  const [values, setValues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(VALUE_DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [icon, setIcon] = useState(null);

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setLoading(true);
      const data = await organizationApi.listValues();
      setValues(Array.isArray(data) ? data : []);
    } catch {
      toast.error("Failed to load core values.");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(VALUE_DEFAULTS);
    setIcon(null);
    setShowModal(true);
  }

  function openEdit(v) {
    setEditing(v);
    setForm({ title: v.title, description: v.description || "", icon: v.icon, color: v.color, sort_order: v.sort_order });
    setIcon(v.icon || null);
    setShowModal(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    setSaving(true);
    const payload = { ...form, icon: icon || "⭐" };
    try {
      if (editing) {
        const updated = await organizationApi.updateValue(editing.id, payload);
        setValues((prev) => prev.map((v) => (v.id === editing.id ? updated : v)));
        toast.success("Core value updated.");
      } else {
        const created = await organizationApi.createValue(payload);
        setValues((prev) => [...prev, created]);
        toast.success("Core value added.");
      }
      setShowModal(false);
    } catch {
      toast.error("Failed to save core value.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(v) {
    if (!(await confirm({ message: `Delete "${v.title}"?`, tone: "danger", confirmLabel: "Delete" }))) return;
    try {
      await organizationApi.deleteValue(v.id);
      setValues((prev) => prev.filter((x) => x.id !== v.id));
      toast.success("Core value deleted.");
    } catch {
      toast.error("Failed to delete core value.");
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Core Values</h2>
          <p className="mt-1 text-sm text-slate-500">The principles that guide your organization.</p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Add Value
          </button>
        )}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 animate-pulse rounded-2xl bg-slate-100" />
          ))}
        </div>
      ) : values.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
          <span className="mb-3 text-4xl">💡</span>
          <p className="text-sm font-semibold text-slate-700">No core values yet</p>
          <p className="mt-1 text-sm text-slate-500">
            {canManage ? 'Click "Add Value" to define your organization\'s principles.' : "No core values have been defined yet."}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {values.map((v) => {
            const c = getColorClasses(v.color);
            return (
              <div
                key={v.id}
                className={`group relative rounded-2xl border ${c.border} bg-white p-6 shadow-sm transition hover:shadow-md`}
              >
                <div className={`mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl text-2xl ${c.bg}`}>
                  <ValueIconDisplay iconStr={v.icon} size={24} />
                </div>
                <h3 className="text-base font-bold text-slate-900">{v.title}</h3>
                {v.description && (
                  <p className="mt-2 text-sm text-slate-500 leading-relaxed">{v.description}</p>
                )}
                {canManage && (
                  <div className="absolute right-4 top-4 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button
                      type="button"
                      onClick={() => openEdit(v)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(v)}
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <Modal title={editing ? "Edit Core Value" : "Add Core Value"} onClose={() => setShowModal(false)}>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Title *</label>
              <input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-slate-400 focus:outline-none"
                placeholder="e.g. Integrity"
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Description</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-slate-400 focus:outline-none"
                placeholder="What this value means to your team..."
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Icon</label>
              <IconPickerButton
                value={icon}
                onChange={setIcon}
                resetKey={editing?.id ?? "create"}
                size={20}
                renderPreview={(v) => <ValueIconDisplay iconStr={v} size={20} />}
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-600">Color</label>
              <div className="flex flex-wrap gap-2">
                {VALUE_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setForm({ ...form, color: c.id })}
                    className={`h-7 w-7 rounded-full ${c.bg} border-2 ${
                      form.color === c.id ? "border-slate-900 scale-110" : "border-transparent"
                    } transition`}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
              >
                {saving ? "Saving…" : editing ? "Save Changes" : "Add Value"}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

// ─── Org Chart ────────────────────────────────────────────────────────────────

const ROLE_FORM_DEFAULTS = { name: "", responsibilities: [], parent_id: null, assignee_ids: [] };

function UserMultiSelect({ users, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    function handle(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const selectedUsers = users.filter((u) => selected.includes(u.id));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-left hover:border-slate-300 focus:outline-none"
      >
        <span className={selectedUsers.length ? "text-slate-900 truncate" : "text-slate-400"}>
          {selectedUsers.length
            ? selectedUsers.map((u) => u.full_name || u.email).join(", ")
            : "Select users..."}
        </span>
        <svg className="ml-2 h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
        </svg>
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-xl border border-slate-200 bg-white shadow-xl max-h-52 overflow-y-auto">
          {users.length === 0 ? (
            <p className="px-3 py-2 text-sm text-slate-400">No users available.</p>
          ) : (
            users.map((u) => (
              <label
                key={u.id}
                className="flex cursor-pointer items-center gap-2.5 px-3 py-2.5 hover:bg-slate-50"
              >
                <input
                  type="checkbox"
                  checked={selected.includes(u.id)}
                  onChange={(e) => {
                    onChange(
                      e.target.checked
                        ? [...selected, u.id]
                        : selected.filter((id) => id !== u.id)
                    );
                  }}
                  className="rounded accent-slate-900"
                />
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-500 text-[10px] font-bold text-white">
                  {(u.full_name || u.email).charAt(0).toUpperCase()}
                </div>
                <span className="text-sm text-slate-900">{u.full_name || u.email}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function OrgRoleModal({ title, subtitle, onClose, roles, users, form, setForm, onSave, saving, editingId }) {
  function addResponsibility() {
    setForm((f) => ({ ...f, responsibilities: [...f.responsibilities, { title: "", description: "" }] }));
  }

  function removeResponsibility(i) {
    setForm((f) => ({ ...f, responsibilities: f.responsibilities.filter((_, idx) => idx !== i) }));
  }

  function updateResponsibility(i, field, value) {
    setForm((f) => {
      const updated = [...f.responsibilities];
      updated[i] = { ...updated[i], [field]: value };
      return { ...f, responsibilities: updated };
    });
  }

  const parentOptions = roles.filter((r) => r.id !== editingId);
  const existingRootRoles = roles.filter((r) => !r.parent_id && r.id !== editingId);
  const rootAlreadyExists = existingRootRoles.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">{title}</h2>
            <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
          >
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        {/* Body: 2-column */}
        <form onSubmit={onSave}>
          <div className="grid grid-cols-2 divide-x divide-slate-100">
            {/* Left: name + responsibilities */}
            <div className="space-y-4 p-6">
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Role name</label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Ex: Head of Engineering"
                  required
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-slate-400 focus:outline-none"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-700">Roles &amp; Responsibilities</p>
                    <p className="text-[11px] text-slate-400">Define responsibilities and expectations for this role.</p>
                  </div>
                  <button
                    type="button"
                    onClick={addResponsibility}
                    className="flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                    </svg>
                    Add
                  </button>
                </div>

                <div className="rounded-xl border border-slate-200 bg-slate-50 min-h-[80px]">
                  {form.responsibilities.length === 0 ? (
                    <p className="px-4 py-6 text-center text-xs text-slate-400">
                      No responsibilities yet. Add items to define this role's scope.
                    </p>
                  ) : (
                    <div className="divide-y divide-slate-200">
                      {form.responsibilities.map((r, i) => (
                        <div key={i} className="p-3 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                              Responsibility {i + 1}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeResponsibility(i)}
                              className="text-xs font-medium text-red-500 hover:text-red-700"
                            >
                              Remove
                            </button>
                          </div>
                          <div>
                            <label className="mb-1 block text-[11px] font-medium text-slate-500">Title</label>
                            <input
                              value={r.title}
                              onChange={(e) => updateResponsibility(i, "title", e.target.value)}
                              placeholder="e.g. CEO"
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-slate-400 focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="mb-1 block text-[11px] font-medium text-slate-500">Description (optional)</label>
                            <textarea
                              value={r.description}
                              onChange={(e) => updateResponsibility(i, "description", e.target.value)}
                              rows={2}
                              placeholder="e.g. Chief Executive Officer."
                              className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-slate-400 focus:outline-none resize-none"
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={addResponsibility}
                    className="flex w-full items-center justify-center gap-1.5 border-t border-slate-200 px-3 py-2.5 text-xs font-medium text-slate-500 hover:bg-slate-100"
                  >
                    <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
                    </svg>
                    Add responsibility
                  </button>
                </div>
              </div>
            </div>

            {/* Right: Settings */}
            <div className="space-y-5 p-6">
              <div>
                <p className="text-sm font-semibold text-slate-800">Settings</p>
                <p className="mt-0.5 text-xs text-slate-400">Configure role hierarchy and structure.</p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Assign to users</label>
                <UserMultiSelect
                  users={users}
                  selected={form.assignee_ids}
                  onChange={(ids) => setForm({ ...form, assignee_ids: ids })}
                />
                <p className="mt-1 text-[11px] text-slate-400">Assign team members to fill this role (multiple users allowed).</p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-600">Parent Role</label>
                <div className="relative">
                  <select
                    value={form.parent_id ?? ""}
                    onChange={(e) => setForm({ ...form, parent_id: e.target.value ? Number(e.target.value) : null })}
                    className="w-full appearance-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:border-slate-400 focus:outline-none disabled:bg-slate-50 disabled:text-slate-400"
                  >
                    <option value="" disabled={rootAlreadyExists}>
                      {rootAlreadyExists ? "None (only one top-level role allowed)" : "None (top-level role)"}
                    </option>
                    {parentOptions.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                  </svg>
                </div>
                {rootAlreadyExists ? (
                  <p className="mt-1.5 flex items-center gap-1 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-700">
                    <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                    Only one top-level flow is allowed. This role must report to an existing role.
                  </p>
                ) : (
                  <p className="mt-1 text-[11px] text-slate-400">
                    {editingId
                      ? "Change which role this position reports to in the organization chart."
                      : "Select the parent role that this position will report to."}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60"
            >
              {saving ? "Saving…" : editingId ? "Update role" : "Add role"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function getInitials(name) {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0][0].toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const AVATAR_COLORS = [
  "bg-indigo-500", "bg-violet-500", "bg-emerald-500", "bg-sky-500",
  "bg-amber-500", "bg-rose-500", "bg-teal-500", "bg-fuchsia-500",
];

function Arrowhead() {
  return (
    <div
      style={{
        width: 0,
        height: 0,
        borderLeft: "5px solid transparent",
        borderRight: "5px solid transparent",
        borderTop: "7px solid #94a3b8",
      }}
    />
  );
}

// Returns a seat entry for each assignee when a role has >1 users, otherwise one entry.
function expandToSeatEntries(roleList) {
  return roleList.flatMap((role) =>
    role.assignees.length > 1
      ? role.assignees.map((assignee) => ({ key: `seat-${role.id}-${assignee.id}`, role, assignee, isSeat: true }))
      : [{ key: `node-${role.id}`, role, assignee: role.assignees[0] ?? null, isSeat: false }]
  );
}

function OrgRoleCard({ role, assignee, allRoles, canManage, onEdit, onDelete, onAddChild, currentUserId }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const directReports = allRoles.filter((r) => r.parent_id === role.id).length;
  // Use string comparison to avoid number/string type mismatch from JWT vs API responses.
  const isCurrentUser = assignee != null && currentUserId != null
    && String(assignee.id) === String(currentUserId);

  return (
    <div
      className="w-64 rounded-2xl border border-slate-200 bg-white shadow-sm"
      data-org-card="true"
      data-user-id={isCurrentUser ? currentUserId : undefined}
    >
      {/* Header: avatar + role name + user name + buttons */}
      <div className="p-4">
        <div className="flex items-center gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white ${
              assignee ? AVATAR_COLORS[assignee.id % AVATAR_COLORS.length] : "bg-slate-300"
            }`}
          >
            {assignee ? getInitials(assignee.full_name || assignee.email) : "?"}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="truncate text-sm font-bold text-slate-900">{role.name}</span>
              {isCurrentUser && (
                <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  You
                </span>
              )}
            </div>
            {assignee && (
              <p className="truncate text-xs text-slate-400">{assignee.full_name || assignee.email}</p>
            )}
          </div>
          {canManage && (
            <div className="flex shrink-0 items-center gap-0.5">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onEdit(role); }}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                title="Edit role"
              >
                <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                </svg>
              </button>
              <div className="relative">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                  title="More options"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
                  </svg>
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute right-0 top-8 z-20 w-40 rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                      <button
                        type="button"
                        onClick={() => { setMenuOpen(false); onDelete(role.id); }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                      >
                        <svg className="h-4 w-4 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4z" clipRule="evenodd" />
                        </svg>
                        Delete role
                      </button>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Roles & Responsibilities — always shown */}
      <div className="border-t border-slate-100 px-4 py-3">
        <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          Roles and Responsibilities
        </p>
        {role.responsibilities.length > 0 ? (
          <ul className="space-y-1">
            {role.responsibilities.map((r, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-slate-600">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-slate-300" />
                <span>{r.title}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs italic text-slate-400">No responsibilities defined yet</p>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2.5">
        <span className="text-xs text-slate-400">
          {directReports === 0 ? "No direct reports" : `${directReports} direct report${directReports !== 1 ? "s" : ""}`}
        </span>
        {canManage && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onAddChild(role); }}
            className="flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-700"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M11 5a3 3 0 11-6 0 3 3 0 016 0zM2.046 15.253c-.18.643.25 1.131.729 1.131h13.5c.48 0 .909-.488.73-1.131a7.5 7.5 0 00-14.508 0zM15.5 7a.75.75 0 01.75.75v2.25h2.25a.75.75 0 010 1.5h-2.25v2.25a.75.75 0 01-1.5 0v-2.25H12.5a.75.75 0 010-1.5h2.25V7.75A.75.75 0 0115.5 7z" />
            </svg>
            Add seat below
          </button>
        )}
      </div>
    </div>
  );
}

function OrgChartNode({ role, allRoles, canManage, onEdit, onDelete, onAddChild, currentUserId }) {
  // Expand child roles: multi-assignee children become individual seat entries (one arrow per user).
  const childEntries = expandToSeatEntries(allRoles.filter((r) => r.parent_id === role.id));

  return (
    <div className="flex flex-col items-center">
      <OrgRoleCard
        role={role}
        assignee={role.assignees[0] ?? null}
        allRoles={allRoles}
        canManage={canManage}
        onEdit={onEdit}
        onDelete={onDelete}
        onAddChild={onAddChild}
        currentUserId={currentUserId}
      />
      {childEntries.length > 0 && (
        <>
          <div className="flex flex-col items-center">
            <div className="h-6 w-px bg-slate-200" />
            {childEntries.length === 1 && <Arrowhead />}
          </div>
          <div className="relative flex items-start gap-8">
            {childEntries.length > 1 && (
              <div className="absolute top-0 h-px bg-slate-200" style={{ left: 128, right: 128 }} />
            )}
            {childEntries.map((entry) => (
              <div key={entry.key} className="flex flex-col items-center">
                {childEntries.length > 1 && (
                  <div className="flex flex-col items-center">
                    <div className="h-6 w-px bg-slate-200" />
                    <Arrowhead />
                  </div>
                )}
                {entry.isSeat ? (
                  <OrgRoleCard
                    role={entry.role}
                    assignee={entry.assignee}
                    allRoles={allRoles}
                    canManage={canManage}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onAddChild={onAddChild}
                    currentUserId={currentUserId}
                  />
                ) : (
                  <OrgChartNode
                    role={entry.role}
                    allRoles={allRoles}
                    canManage={canManage}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onAddChild={onAddChild}
                    currentUserId={currentUserId}
                  />
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function OrgChartTab({ canManage }) {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [roles, setRoles] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState("chart");
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [form, setForm] = useState(ROLE_FORM_DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [panPos, setPanPos] = useState({ x: 0, y: 0 });
  const [scale, setScale] = useState(1);
  const draggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0, panX: 0, panY: 0 });
  const scaleRef = useRef(1);
  const chartContainerRef = useRef(null);
  const innerCanvasRef = useRef(null);
  const hasCenteredRef = useRef(false);

  useEffect(() => { load(); }, []);

  // Center once whenever the chart canvas first mounts with content — on
  // initial load, and again when the very first role is created (which
  // flips roles.length 0 -> 1 without loading/view changing). Don't re-center
  // on every later edit, or it would discard the user's manual pan/zoom.
  useLayoutEffect(() => {
    if (loading || view !== "chart") return;
    if (roles.length === 0) {
      hasCenteredRef.current = false;
      return;
    }
    if (!hasCenteredRef.current) {
      hasCenteredRef.current = true;
      centerChart();
    }
  }, [loading, view, roles.length]);

  // Attach non-passive wheel listener so we can preventDefault (prevents page scroll while zooming).
  useEffect(() => {
    const el = chartContainerRef.current;
    if (!el) return;
    function onWheel(e) {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.12 : 0.9;
      const next = Math.min(3, Math.max(0.2, scaleRef.current * factor));
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      setPanPos((prev) => ({
        x: mx - (mx - prev.x) * (next / scaleRef.current),
        y: my - (my - prev.y) * (next / scaleRef.current),
      }));
      scaleRef.current = next;
      setScale(next);
    }
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [view, loading]);

  async function load() {
    try {
      setLoading(true);
      const [r, u] = await Promise.all([
        organizationApi.listRoles(),
        userApi.list().catch(() => []),
      ]);
      setRoles(Array.isArray(r) ? r : []);
      setUsers(Array.isArray(u) ? u : []);
    } catch {
      toast.error("Failed to load org chart.");
    } finally {
      setLoading(false);
    }
  }

  function openAdd(parentRole = null) {
    setEditingRole(null);
    const rootRoles = roles.filter((r) => !r.parent_id);
    const hasRoot = rootRoles.length > 0;
    const defaultParentId = parentRole?.id ?? (hasRoot && !parentRole ? (rootRoles[0]?.id ?? null) : null);
    setForm({ ...ROLE_FORM_DEFAULTS, parent_id: defaultParentId });
    setShowModal(true);
  }

  function openEdit(role) {
    setEditingRole(role);
    setForm({
      name: role.name,
      responsibilities: role.responsibilities.map((r) => ({ title: r.title, description: r.description || "" })),
      parent_id: role.parent_id ?? null,
      assignee_ids: role.assignees.map((u) => u.id),
    });
    setShowModal(true);
  }

  async function handleDelete(roleId) {
    const role = roles.find((r) => r.id === roleId);
    if (!(await confirm({ message: `Delete "${role?.name}"? Child roles will become top-level.`, tone: "danger", confirmLabel: "Delete" }))) return;
    try {
      await organizationApi.deleteRole(roleId);
      setRoles((prev) => prev.filter((r) => r.id !== roleId));
      toast.success("Role deleted.");
    } catch {
      toast.error("Failed to delete role.");
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    const existingRoots = roles.filter((r) => !r.parent_id && r.id !== editingRole?.id);
    if (!form.parent_id && existingRoots.length > 0) {
      toast.error("Only one top-level role is allowed. Please select a parent role.");
      return;
    }
    setSaving(true);
    const payload = {
      name: form.name.trim(),
      responsibilities: form.responsibilities.filter((r) => r.title.trim()),
      parent_id: form.parent_id,
      assignee_ids: form.assignee_ids,
    };
    try {
      if (editingRole) {
        const updated = await organizationApi.updateRole(editingRole.id, payload);
        setRoles((prev) => prev.map((r) => (r.id === editingRole.id ? updated : r)));
        toast.success("Role updated.");
      } else {
        const created = await organizationApi.createRole(payload);
        setRoles((prev) => [...prev, created]);
        toast.success("Role added.");
      }
      setShowModal(false);
    } catch {
      toast.error("Failed to save role.");
    } finally {
      setSaving(false);
    }
  }

  function applyScale(next) {
    scaleRef.current = next;
    setScale(next);
  }

  function centerChart() {
    if (!chartContainerRef.current || !innerCanvasRef.current) return;
    const cw = chartContainerRef.current.offsetWidth;
    const iw = innerCanvasRef.current.offsetWidth * scaleRef.current;
    setPanPos({ x: Math.max(0, Math.round((cw - iw) / 2)), y: 0 });
  }

  function handlePointerDown(e) {
    if (e.button !== 0) return;
    if (e.target.closest('button, a, input, select, [role="button"]')) return;
    draggingRef.current = true;
    dragStartRef.current = { x: e.clientX, y: e.clientY, panX: panPos.x, panY: panPos.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e) {
    if (!draggingRef.current) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPanPos({ x: dragStartRef.current.panX + dx, y: dragStartRef.current.panY + dy });
  }

  function handlePointerUp() {
    draggingRef.current = false;
  }

  function fitToScreen() {
    applyScale(1);
    // centerChart reads scaleRef, which we just updated, so call after tick
    requestAnimationFrame(centerChart);
  }

  function centerOnMe() {
    if (!chartContainerRef.current) return;
    // Try to find the current user's card; fall back to the first visible card.
    const node = (user && chartContainerRef.current.querySelector(`[data-user-id="${user.id}"]`))
      || chartContainerRef.current.querySelector("[data-org-card]");
    if (!node) return;
    const container = chartContainerRef.current.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();

    // Layout size of card (before scale transform)
    const layoutW = nodeRect.width / scaleRef.current;
    const layoutH = nodeRect.height / scaleRef.current;

    // Scale so the card fills ~70% of container width
    const targetScale = Math.min(2.5, Math.max(1, (container.width * 0.7) / layoutW));

    // Canvas-space position of card center
    const nodeCenterX = (nodeRect.left - container.left + nodeRect.width / 2 - panPos.x) / scaleRef.current;
    const nodeCenterY = (nodeRect.top - container.top + nodeRect.height / 2 - panPos.y) / scaleRef.current;

    // New pan so card is centered at new scale
    const newPanX = container.width / 2 - nodeCenterX * targetScale;
    const newPanY = container.height / 2 - nodeCenterY * targetScale;

    applyScale(targetScale);
    setPanPos({ x: newPanX, y: newPanY });
  }

  function zoomBy(factor) {
    const next = Math.min(3, Math.max(0.2, scaleRef.current * factor));
    if (!chartContainerRef.current) { applyScale(next); return; }
    const rect = chartContainerRef.current.getBoundingClientRect();
    const mx = rect.width / 2;
    const my = rect.height / 2;
    setPanPos((prev) => ({
      x: mx - (mx - prev.x) * (next / scaleRef.current),
      y: my - (my - prev.y) * (next / scaleRef.current),
    }));
    applyScale(next);
  }

  const rootRoles = roles.filter((r) => !r.parent_id);

  function formatResponsibilities(responsibilities) {
    return responsibilities
      .map((r) => `${r.title}${r.description ? ` - ${r.description}` : ""}`)
      .join(", ") || "—";
  }

  function getParentName(parentId) {
    if (!parentId) return "—";
    return roles.find((r) => r.id === parentId)?.name ?? "—";
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Org Chart</h2>
          <p className="mt-1 text-sm text-slate-500">Define and visualize your organization's role hierarchy.</p>
        </div>
        {canManage && (
          <button
            type="button"
            onClick={() => openAdd()}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            Add role
          </button>
        )}
      </div>

      {/* View toggle */}
      <div className="mb-4 flex items-center justify-end gap-2">
        {["chart", "table"].map((v) => (
          <button
            key={v}
            type="button"
            onClick={() => setView(v)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize transition ${
              view === v
                ? "bg-slate-900 text-white"
                : "border border-slate-200 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {v.charAt(0).toUpperCase() + v.slice(1)}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-40 animate-pulse rounded-2xl bg-slate-100" />)}
        </div>
      ) : roles.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
          <svg className="mb-3 h-10 w-10 text-slate-300" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M4 16.5v-13h-.25a.75.75 0 010-1.5h12.5a.75.75 0 010 1.5H16v13h.25a.75.75 0 010 1.5h-3.5a.75.75 0 01-.75-.75v-2.5a.75.75 0 00-.75-.75h-2.5a.75.75 0 00-.75.75v2.5a.75.75 0 01-.75.75h-3.5a.75.75 0 010-1.5H4zm3-11a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-4.5A.75.75 0 017 5.5zm0 4a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-4.5A.75.75 0 017 9.5z" clipRule="evenodd" />
          </svg>
          <p className="text-sm font-semibold text-slate-700">No roles defined yet</p>
          <p className="mt-1 text-sm text-slate-500">
            {canManage ? 'Click "Add role" to define your first organizational role.' : "No roles have been defined yet."}
          </p>
        </div>
      ) : view === "chart" ? (
        <div className="relative overflow-hidden rounded-2xl border border-slate-200">
          {/* Overlay buttons */}
          <div className="absolute right-4 top-4 z-10 flex flex-col gap-2">
            {/* Zoom controls */}
            <div className="flex overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => zoomBy(1.25)}
                className="flex h-8 w-8 items-center justify-center text-slate-600 hover:bg-slate-50 text-base font-semibold leading-none"
                title="Zoom in"
              >
                +
              </button>
              <div className="flex w-10 items-center justify-center border-x border-slate-200 text-[11px] font-semibold text-slate-500 tabular-nums">
                {Math.round(scale * 100)}%
              </div>
              <button
                type="button"
                onClick={() => zoomBy(0.8)}
                className="flex h-8 w-8 items-center justify-center text-slate-600 hover:bg-slate-50 text-base font-semibold leading-none"
                title="Zoom out"
              >
                −
              </button>
            </div>
            <button
              type="button"
              onClick={fitToScreen}
              className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Fit to screen
            </button>
            <button
              type="button"
              onClick={centerOnMe}
              className="rounded-xl bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-slate-700"
            >
              Center on me
            </button>
          </div>

          {/* Pannable canvas */}
          <div
            ref={chartContainerRef}
            style={{
              minHeight: 480,
              cursor: "grab",
              overflow: "hidden",
              backgroundImage: "radial-gradient(circle, #cbd5e1 1px, transparent 1px)",
              backgroundSize: "24px 24px",
              backgroundColor: "#f8fafc",
            }}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
          >
            <div
              ref={innerCanvasRef}
              style={{
                transform: `translate(${panPos.x}px, ${panPos.y}px) scale(${scale})`,
                transformOrigin: "0 0",
                padding: "40px",
              }}
              className="inline-flex flex-col items-center"
            >
              <div className="flex flex-wrap justify-center gap-10">
                {expandToSeatEntries(rootRoles).map((entry) =>
                  entry.isSeat ? (
                    <OrgRoleCard
                      key={entry.key}
                      role={entry.role}
                      assignee={entry.assignee}
                      allRoles={roles}
                      canManage={canManage}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                      onAddChild={openAdd}
                      currentUserId={user?.id}
                    />
                  ) : (
                    <OrgChartNode
                      key={entry.key}
                      role={entry.role}
                      allRoles={roles}
                      canManage={canManage}
                      onEdit={openEdit}
                      onDelete={handleDelete}
                      onAddChild={openAdd}
                      currentUserId={user?.id}
                    />
                  )
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50">
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Role name</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">People assigned</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Responsibilities</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Reports to</th>
                {canManage && <th className="px-5 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {roles.map((role) => (
                <tr key={role.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3 font-semibold text-slate-900">{role.name}</td>
                  <td className="px-5 py-3 text-slate-500">
                    {role.assignees.length === 0 ? (
                      <em className="text-slate-400">Unassigned</em>
                    ) : (
                      role.assignees.map((u) => u.full_name || u.email).join(", ")
                    )}
                  </td>
                  <td className="max-w-xs px-5 py-3 text-slate-500">
                    <span className="line-clamp-2">{formatResponsibilities(role.responsibilities)}</span>
                  </td>
                  <td className="px-5 py-3 text-slate-500">{getParentName(role.parent_id)}</td>
                  {canManage && (
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => openEdit(role)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(role.id)}
                          className="rounded-lg p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"
                        >
                          <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <OrgRoleModal
          title={editingRole ? "Edit role" : "Add a role"}
          subtitle={editingRole ? "Update the role name and responsibilities." : "Create a new top-level role in the organization."}
          onClose={() => setShowModal(false)}
          roles={roles}
          users={users}
          form={form}
          setForm={setForm}
          onSave={handleSave}
          saving={saving}
          editingId={editingRole?.id ?? null}
        />
      )}
    </div>
  );
}

// ─── Objectives ───────────────────────────────────────────────────────────────

const OBJ_DEFAULTS = { title: "", description: "", icon: null, status: "active", progress: 0, due_date: "", owner_id: "", project_id: "" };

function ObjectiveProgressCircle({ progress }) {
  const r = 13;
  const circ = 2 * Math.PI * r;
  const dash = (progress / 100) * circ;
  return (
    <svg width="34" height="34" viewBox="0 0 34 34" className="shrink-0">
      <circle cx="17" cy="17" r={r} fill="none" stroke="#e2e8f0" strokeWidth="2.5" />
      {progress > 0 && (
        <circle cx="17" cy="17" r={r} fill="none" stroke="#1e293b" strokeWidth="2.5"
          strokeDasharray={`${dash} ${circ - dash}`} strokeLinecap="round"
          transform="rotate(-90 17 17)" />
      )}
      <text x="17" y="17" textAnchor="middle" dominantBaseline="central"
        fontSize="9" fontWeight="600" fill="#64748b">{progress}</text>
    </svg>
  );
}

function ObjectiveModal({ editing, form, setForm, onSave, onClose, saving, users, projects }) {
  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSave({ ...form });
  }

  const selectedOwner = users.find((u) => String(u.id) === String(form.owner_id));

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 p-8 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-2xl bg-white shadow-2xl">
        {/* Title row */}
        <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-4">
          <IconPickerButton
            value={form.icon}
            onChange={(icon) => setForm({ ...form, icon })}
            resetKey={editing?.id ?? "create"}
            size={20}
          />
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="Title"
            required
            autoFocus
            className="flex-1 border-none text-base font-medium text-slate-900 placeholder:text-slate-300 outline-none"
          />
          <button type="button" onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="grid min-h-[260px] grid-cols-[1fr_260px] divide-x divide-slate-100">
            {/* Left: rich text description */}
            <div className="flex flex-col">
              <RichEditor
                content={form.description || ""}
                onChange={(html) => setForm({ ...form, description: html })}
                placeholder="Add context or acceptance criteria."
                minHeight={200}
                className="rounded-none border-0 border-r border-slate-100"
              />
            </div>

            {/* Right: Settings */}
            <div className="space-y-5 p-5">
              <p className="text-sm font-semibold text-slate-800">Settings</p>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Project</label>
                <div className="relative">
                  <select
                    value={form.project_id}
                    onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                    className={`w-full appearance-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none ${form.project_id ? "text-slate-900" : "text-slate-400"}`}
                  >
                    <option value="">No project</option>
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                  </svg>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Assignee</label>
                <div className="relative">
                  <div className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
                    {selectedOwner ? (
                      <>
                        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${AVATAR_COLORS[selectedOwner.id % AVATAR_COLORS.length]}`}>
                          {getInitials(selectedOwner.full_name || selectedOwner.email)}
                        </div>
                        <span className="truncate text-sm text-slate-900">{selectedOwner.full_name || selectedOwner.email}</span>
                      </>
                    ) : (
                      <span className="text-sm text-slate-400">Unassigned</span>
                    )}
                    <svg className="ml-auto h-4 w-4 shrink-0 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <select value={form.owner_id} onChange={(e) => setForm({ ...form, owner_id: e.target.value })}
                    className="absolute inset-0 w-full cursor-pointer opacity-0">
                    <option value="">Unassigned</option>
                    {users.map((u) => <option key={u.id} value={u.id}>{u.full_name || u.email}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-500">Due date</label>
                <DatePicker value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
              </div>

              {editing && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-500">Status</label>
                  <div className="relative">
                    <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}
                      className="w-full appearance-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none">
                      {OBJECTIVE_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                    </select>
                    <svg className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
              )}

            </div>
          </div>

          <div className="flex items-center justify-end gap-2 border-t border-slate-100 px-6 py-4">
            <button type="button" onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button type="submit" disabled={saving}
              className="rounded-xl bg-slate-900 px-5 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-60">
              {saving ? "Saving…" : editing ? "Save Changes" : "Create Objective"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const ROCK_STATUS_CFG = {
  on_track: { label: "On-track",  bg: "bg-green-100",   text: "text-green-700"   },
  backlog:   { label: "Backlog",   bg: "bg-slate-100",   text: "text-slate-600"   },
  planned:   { label: "Planned",   bg: "bg-blue-100",    text: "text-blue-700"    },
  off_track: { label: "Off-track", bg: "bg-red-100",     text: "text-red-700"     },
  complete:  { label: "Complete",  bg: "bg-emerald-100", text: "text-emerald-700" },
  archived:  { label: "Archived",  bg: "bg-slate-100",   text: "text-slate-500"   },
};

function ObjectivesTab({ canManage }) {
  const confirm = useConfirm();
  const [objectives, setObjectives] = useState([]);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [rocks, setRocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("active");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(OBJ_DEFAULTS);
  const [saving, setSaving] = useState(false);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [expandedIds, setExpandedIds] = useState(new Set());
  const [rockMenuState, setRockMenuState] = useState(null); // { rockId, top, left }
  const rockBtnRefs = useRef({});

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!openMenuId) return;
    function handle() { setOpenMenuId(null); }
    document.addEventListener("click", handle);
    return () => document.removeEventListener("click", handle);
  }, [openMenuId]);

  async function load() {
    try {
      setLoading(true);
      const [objs, us, rs, ps] = await Promise.all([
        organizationApi.listObjectives(),
        userApi.list().catch(() => []),
        organizationApi.listObjectiveRocks().catch(() => []),
        projectApi.list().catch(() => []),
      ]);
      setObjectives(Array.isArray(objs) ? objs : []);
      setUsers(Array.isArray(us) ? us : []);
      setRocks(Array.isArray(rs) ? rs : []);
      setProjects(Array.isArray(ps) ? ps : []);
    } catch {
      toast.error("Failed to load objectives.");
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditing(null);
    setForm(OBJ_DEFAULTS);
    setShowModal(true);
  }

  function openEdit(obj) {
    setEditing(obj);
    setForm({
      title: obj.title,
      description: obj.description || "",
      icon: obj.icon || null,
      status: obj.status,
      progress: obj.progress,
      due_date: obj.due_date || "",
      owner_id: obj.owner_id || "",
      project_id: obj.project_id || "",
    });
    setShowModal(true);
  }

  async function handleSave(formData) {
    if (!formData.title.trim()) return;
    setSaving(true);
    const payload = {
      ...formData,
      progress: Number(formData.progress),
      due_date: formData.due_date || null,
      owner_id: formData.owner_id ? Number(formData.owner_id) : null,
      project_id: formData.project_id ? Number(formData.project_id) : null,
    };
    try {
      if (editing) {
        const updated = await organizationApi.updateObjective(editing.id, payload);
        setObjectives((prev) => prev.map((o) => (o.id === editing.id ? updated : o)));
        toast.success("Objective updated.");
      } else {
        const created = await organizationApi.createObjective(payload);
        setObjectives((prev) => [created, ...prev]);
        toast.success("Objective created.");
      }
      setShowModal(false);
    } catch (err) {
      toast.error(err.message || "Failed to save objective.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(obj) {
    if (!(await confirm({ message: `Delete "${obj.title}"?`, tone: "danger", confirmLabel: "Delete" }))) return;
    try {
      await organizationApi.deleteObjective(obj.id);
      setObjectives((prev) => prev.filter((o) => o.id !== obj.id));
      toast.success("Objective deleted.");
    } catch {
      toast.error("Failed to delete objective.");
    }
  }

  function openRockStatusMenu(rock) {
    const btn = rockBtnRefs.current[rock.id];
    if (btn) {
      const r = btn.getBoundingClientRect();
      setRockMenuState({ rockId: rock.id, teamId: rock.team_id, top: r.bottom + 4, left: r.left });
    }
  }

  async function handleRockStatusChange(teamId, rockId, newStatus) {
    setRockMenuState(null);
    try {
      const updated = await rockApi.update(teamId, rockId, { status: newStatus });
      setRocks((prev) => prev.map((r) => (r.id === rockId ? updated : r)));
    } catch {
      toast.error("Failed to update rock status.");
    }
  }

  const filteredObjectives = objectives.filter((o) =>
    filter === "archived"
      ? ["completed", "cancelled"].includes(o.status)
      : !["completed", "cancelled"].includes(o.status)
  );

  const rocksByObjective = rocks.reduce((acc, r) => {
    if (!acc[r.objective_id]) acc[r.objective_id] = [];
    acc[r.objective_id].push(r);
    return acc;
  }, {});

  function toggleExpand(id) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function formatDate(dateStr) {
    if (!dateStr) return null;
    return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }

  function isOverdue(dateStr) {
    if (!dateStr) return false;
    return new Date(dateStr + "T00:00:00") < new Date(new Date().toDateString());
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-slate-900">Objectives</h2>
          <button type="button" className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a.75.75 0 000 1.5h.253a.25.25 0 01.244.304l-.459 2.066A1.75 1.75 0 0010.747 15H11a.75.75 0 000-1.5h-.253a.25.25 0 01-.244-.304l.459-2.066A1.75 1.75 0 009.253 9H9z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
        {canManage && (
          <button type="button" onClick={openCreate}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50">
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
            </svg>
            New Objective
          </button>
        )}
      </div>

      {/* Active / Archived filter tabs */}
      <div className="mb-4 flex items-center gap-1">
        {[{ id: "active", label: "Active" }, { id: "archived", label: "Archived" }].map((f) => (
          <button key={f.id} type="button" onClick={() => setFilter(f.id)}
            className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
              filter === f.id ? "bg-orange-500 text-white" : "text-slate-600 hover:bg-slate-100"
            }`}>
            {f.label}
          </button>
        ))}
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100" />)}
        </div>
      ) : filteredObjectives.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 py-16 text-center">
          <span className="mb-3 text-4xl">🎯</span>
          <p className="text-sm font-semibold text-slate-700">
            {filter === "archived" ? "No archived objectives" : "No active objectives"}
          </p>
          {canManage && filter === "active" && (
            <p className="mt-1 text-sm text-slate-500">Click "New Objective" to set your first goal.</p>
          )}
        </div>
      ) : (
        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white">
          {filteredObjectives.map((obj) => {
            const owner = obj.owner ?? users.find((u) => u.id === obj.owner_id);
            const objRocks = rocksByObjective[obj.id] || [];
            const isExpanded = expandedIds.has(obj.id);
            const totalMilestones = objRocks.reduce((sum, r) => sum + r.milestones.length, 0);
            const doneMilestones = objRocks.reduce((sum, r) => sum + r.milestones.filter((m) => m.status === "complete").length, 0);
            return (
              <div key={obj.id} className="first:rounded-t-2xl last:rounded-b-2xl">
                {/* Objective row */}
                <div className="group flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                  {/* Expand chevron */}
                  <button type="button"
                    onClick={() => toggleExpand(obj.id)}
                    className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${objRocks.length === 0 ? "invisible" : ""}`}
                    style={{ transform: isExpanded ? "rotate(90deg)" : "" }}>
                    <svg viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <ObjectiveProgressCircle progress={totalMilestones > 0 ? Math.round((doneMilestones / totalMilestones) * 100) : obj.progress} />
                  <span className="shrink-0 text-slate-400">
                    <RockIconDisplay iconStr={obj.icon} size={16} />
                  </span>
                  <span className="flex-1 truncate text-sm font-medium text-slate-900">{obj.title}</span>
                  {obj.project && (
                    <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-600" title={`Project: ${obj.project.name}`}>
                      {obj.project.name}
                    </span>
                  )}
                  <span className="shrink-0 text-xs text-slate-400">
                    {totalMilestones === 0 ? "No milestones" : `${doneMilestones}/${totalMilestones} done`}
                  </span>
                  {owner && (
                    <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white ${AVATAR_COLORS[owner.id % AVATAR_COLORS.length]}`}
                      title={owner.full_name || owner.email}>
                      {getInitials(owner.full_name || owner.email)}
                    </div>
                  )}
                  {obj.due_date && (
                    <span className={`shrink-0 text-xs font-medium ${isOverdue(obj.due_date) ? "text-red-500" : "text-slate-500"}`}>
                      {formatDate(obj.due_date)}
                    </span>
                  )}
                  {canManage && (
                    <div className="relative opacity-0 transition-opacity group-hover:opacity-100">
                      <button type="button"
                        onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === obj.id ? null : obj.id); }}
                        className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
                        <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 3a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM10 8.5a1.5 1.5 0 110 3 1.5 1.5 0 010-3zM11.5 15.5a1.5 1.5 0 10-3 0 1.5 1.5 0 003 0z" />
                        </svg>
                      </button>
                      {openMenuId === obj.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setOpenMenuId(null)} />
                          <div className="absolute right-0 top-8 z-20 w-36 rounded-xl border border-slate-200 bg-white py-1 shadow-xl">
                            <button type="button" onClick={() => { setOpenMenuId(null); openEdit(obj); }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50">
                              <svg className="h-4 w-4 text-slate-400" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M5.433 13.917l1.262-3.155A4 4 0 017.58 9.42l6.92-6.918a2.121 2.121 0 013 3l-6.92 6.918c-.383.383-.84.685-1.343.886l-3.154 1.262a.5.5 0 01-.65-.65z" />
                              </svg>
                              Edit
                            </button>
                            <button type="button" onClick={() => { setOpenMenuId(null); handleDelete(obj); }}
                              className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50">
                              <svg className="h-4 w-4 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4z" clipRule="evenodd" />
                              </svg>
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
                {/* Rock sub-rows */}
                {isExpanded && objRocks.map((rock) => {
                  const rockOwner = rock.owner;
                  const cfg = ROCK_STATUS_CFG[rock.status] || ROCK_STATUS_CFG.backlog;
                  const completed = rock.milestones.filter((m) => m.status === "complete").length;
                  const total = rock.milestones.length;
                  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
                  return (
                    <div key={rock.id} className="flex items-center gap-3 border-t border-slate-100 bg-slate-50/60 px-4 py-2 pl-14">
                      <button
                        ref={(el) => { rockBtnRefs.current[rock.id] = el; }}
                        type="button"
                        onClick={() => openRockStatusMenu(rock)}
                        className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold cursor-pointer hover:opacity-80 ${cfg.bg} ${cfg.text}`}>
                        {cfg.label}
                        <svg className="h-2.5 w-2.5 opacity-60" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
                        </svg>
                      </button>
                      <RockIconDisplay iconStr={rock.icon} size={14} />
                      <span className="flex-1 truncate text-xs font-medium text-slate-700">{rock.title}</span>
                      <span className="shrink-0 text-xs text-slate-400">
                        {total === 0 ? "No milestones" : `${completed}/${total} (${pct}%)`}
                      </span>
                      {rockOwner && (
                        <div className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white ${AVATAR_COLORS[rockOwner.id % AVATAR_COLORS.length]}`}
                          title={rockOwner.full_name || rockOwner.email}>
                          {getInitials(rockOwner.full_name || rockOwner.email)}
                        </div>
                      )}
                      {rock.due_date && (
                        <span className={`shrink-0 text-xs font-medium ${isOverdue(rock.due_date) ? "text-red-500" : "text-slate-400"}`}>
                          {formatDate(rock.due_date)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <ObjectiveModal
          editing={editing}
          form={form}
          setForm={setForm}
          onSave={handleSave}
          onClose={() => setShowModal(false)}
          saving={saving}
          users={users}
          projects={projects}
        />
      )}

      {/* Rock status portal dropdown */}
      {rockMenuState && createPortal(
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setRockMenuState(null)} />
          <div className="fixed z-[101] w-36 rounded-xl border border-slate-200 bg-white py-1 shadow-xl"
            style={{ top: rockMenuState.top, left: rockMenuState.left }}>
            {Object.entries(ROCK_STATUS_CFG).map(([value, cfg]) => (
              <button key={value} type="button"
                onClick={() => handleRockStatusChange(rockMenuState.teamId, rockMenuState.rockId, value)}
                className={`flex w-full items-center gap-2 px-3 py-2 text-xs hover:bg-slate-50 ${cfg.text}`}>
                {cfg.label}
              </button>
            ))}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function OrganizationPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const activeTab = searchParams.get("tab") || "core-values";
  const canManage = user?.role === "owner" || user?.role === "admin" || user?.role === "team_manager";

  function setTab(tabId) {
    setSearchParams({ tab: tabId });
  }

  return (
    <div className="w-full">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900">Organization</h1>
        <p className="mt-2 text-sm text-slate-600">
          Manage your company's values, structure, and strategic objectives.
        </p>
      </div>

      {/* Tab nav */}
      <div className="mb-8 border-b border-slate-200">
        <nav className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setTab(tab.id)}
              className={`px-4 py-3 text-sm font-semibold transition ${
                activeTab === tab.id
                  ? "border-b-2 border-slate-900 text-slate-900"
                  : "text-slate-500 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab content */}
      {activeTab === "core-values" && <CoreValuesTab canManage={canManage} />}
      {activeTab === "org-chart"   && <OrgChartTab canManage={canManage} />}
      {activeTab === "objectives"  && <ObjectivesTab canManage={canManage} />}
    </div>
  );
}
