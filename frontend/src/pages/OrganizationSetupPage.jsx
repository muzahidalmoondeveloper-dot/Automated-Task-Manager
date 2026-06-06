import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";

import { useAuth } from "../context/AuthContext";
import { apiClient } from "../api/client";

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function OrganizationSetupPage() {
  const navigate = useNavigate();
  const { isAuthenticated, isAuthLoading, hasOrgContext, loginWithToken } = useAuth();

  // Already has org → go straight to dashboard
  if (!isAuthLoading && hasOrgContext) {
    return <Navigate to="/dashboard" replace />;
  }
  // Not authenticated at all → back to login
  if (!isAuthLoading && !isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  function handleNameChange(e) {
    const val = e.target.value;
    setName(val);
    if (!slugTouched) setSlug(slugify(val));
  }

  function handleSlugChange(e) {
    setSlugTouched(true);
    setSlug(slugify(e.target.value));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Organization name is required.");
      return;
    }
    const resolvedSlug = slug || slugify(name.trim());
    if (!resolvedSlug) {
      setError("Please enter a valid slug.");
      return;
    }

    try {
      setError("");
      setIsSubmitting(true);

      // POST /organizations returns a new org-scoped TokenResponse
      const data = await apiClient.post("/organizations", {
        name: name.trim(),
        slug: slug || slugify(name.trim()),
      });

      // Store the new org-scoped access token and update the user
      loginWithToken(data.access_token, data.user);

      toast.success(`Organization "${name}" created!`);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      const message = err.message || "Failed to create organization.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900">
            Create your organization
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Set up your workspace to get started. You can invite team members
            after.
          </p>
        </div>

        {error && (
          <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          <div>
            <label htmlFor="org-name" className="mb-1 block text-sm font-medium text-slate-700">
              Organization name
            </label>
            <input
              id="org-name"
              value={name}
              onChange={handleNameChange}
              placeholder="Acme Corp"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none transition focus:border-slate-900 focus:ring-2 focus:ring-slate-200"
            />
          </div>

          <div>
            <label htmlFor="org-slug" className="mb-1 block text-sm font-medium text-slate-700">
              URL slug
            </label>
            <div className="flex items-center rounded-lg border border-slate-300 focus-within:border-slate-900 focus-within:ring-2 focus-within:ring-slate-200">
              <span className="px-3 text-sm text-slate-400 select-none">app/</span>
              <input
                id="org-slug"
                value={slug}
                onChange={handleSlugChange}
                placeholder="acme-corp"
                className="flex-1 rounded-r-lg py-2 pr-3 text-sm outline-none bg-transparent"
              />
            </div>
            <p className="mt-1 text-xs text-slate-500">
              Lowercase letters, numbers, and hyphens only.
            </p>
          </div>

          <button
            type="submit"
            disabled={isSubmitting || !name.trim()}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Creating..." : "Create organization"}
          </button>
        </form>
      </div>
    </div>
  );
}
