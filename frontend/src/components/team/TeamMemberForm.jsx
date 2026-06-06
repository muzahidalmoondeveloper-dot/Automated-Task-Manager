import { useEffect, useState } from "react";

const initialFormState = {
  full_name: "",
  email: "",
  aliasesText: "",
  role_title: "",
  is_active: true,
};

export default function TeamMemberForm({
  mode = "create",
  initialValues = null,
  onSubmit,
  onCancel,
  isSubmitting = false,
}) {
  const [formData, setFormData] = useState(initialFormState);
  const [error, setError] = useState("");

  useEffect(() => {
    if (initialValues) {
      setFormData({
        full_name: initialValues.full_name || "",
        email: initialValues.email || "",
        aliasesText: Array.isArray(initialValues.aliases)
          ? initialValues.aliases.join(", ")
          : "",
        role_title: initialValues.role_title || "",
        is_active:
          typeof initialValues.is_active === "boolean"
            ? initialValues.is_active
            : true,
      });
    } else {
      setFormData(initialFormState);
    }
  }, [initialValues]);

  function handleChange(event) {
    const { name, value, type, checked } = event.target;

    setFormData((current) => ({
      ...current,
      [name]: type === "checkbox" ? checked : value,
    }));
  }

  function buildPayload() {
    const aliases = formData.aliasesText
      .split(",")
      .map((alias) => alias.trim())
      .filter(Boolean);

    return {
      full_name: formData.full_name.trim(),
      email: formData.email.trim() || null,
      aliases,
      role_title: formData.role_title.trim() || null,
      is_active: formData.is_active,
    };
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!formData.full_name.trim()) {
      setError("Full name is required.");
      return;
    }

    try {
      setError("");
      await onSubmit(buildPayload());

      if (mode === "create") {
        setFormData(initialFormState);
      }
    } catch (err) {
      setError(err.message || "Unable to save team member.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5">
        <h2 className="text-lg font-semibold text-slate-900">
          {mode === "edit" ? "Edit Team Member" : "Add Team Member"}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Add people who can be matched as task assignees from meeting
          transcripts.
        </p>
      </div>

      {error ? (
        <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

          <div className="space-y-5">
        <div>
          <label
            htmlFor="full_name"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Full name <span className="text-red-500">*</span>
          </label>

          <input
            id="full_name"
            name="full_name"
            type="text"
            value={formData.full_name}
            onChange={handleChange}
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            placeholder="Alex Morgan"
          />
        </div>

        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Email
          </label>

          <input
            id="email"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            placeholder="alex@example.com"
          />
        </div>

        <div>
          <label
            htmlFor="role_title"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Role title
          </label>

          <input
            id="role_title"
            name="role_title"
            type="text"
            value={formData.role_title}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            placeholder="Product Manager"
          />
        </div>

        <div>
          <label
            htmlFor="aliasesText"
            className="mb-1 block text-sm font-medium text-slate-700"
          >
            Aliases
          </label>

          <input
            id="aliasesText"
            name="aliasesText"
            type="text"
            value={formData.aliasesText}
            onChange={handleChange}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            placeholder="Alex, A. Morgan"
          />

          <p className="mt-1 text-xs text-slate-500">
            Separate aliases with commas.
          </p>
        </div>
      </div>

      <label className="mt-5 flex items-center gap-2 text-sm text-slate-700">
        <input
          name="is_active"
          type="checkbox"
          checked={formData.is_active}
          onChange={handleChange}
          className="h-4 w-4 rounded border-slate-300"
        />
        Active team member
      </label>

      <div className="mt-6 flex items-center justify-end gap-3">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
        ) : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSubmitting
            ? "Saving..."
            : mode === "edit"
              ? "Save Changes"
              : "Add Member"}
        </button>
      </div>
    </form>
  );
}