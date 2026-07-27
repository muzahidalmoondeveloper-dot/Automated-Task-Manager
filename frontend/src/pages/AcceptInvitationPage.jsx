import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

import { invitationApi } from "../api/invitationApi";
import { authApi } from "../api/authApi";
import { useAuth } from "../context/AuthContext";
import {
  EyeOnIcon,
  EyeOffIcon,
  PasswordStrengthBar,
  PasswordRequirementsChecklist,
} from "../components/auth/PasswordRequirements";

const ROLE_LABELS = {
  owner: "Owner",
  admin: "Admin",
  team_manager: "Team Manager",
  project_manager: "Project Manager",
  team_member: "Team Member",
  client: "Client",
};

function redirectPathForRole(role) {
  return role === "client" ? "/client" : "/dashboard";
}

export default function AcceptInvitationPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const { isAuthenticated, isAuthLoading, loginWithToken } = useAuth();

  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accepting, setAccepting] = useState(false);

  const [setupForm, setSetupForm] = useState({ full_name: "", password: "", confirm_password: "" });
  const [isSettingUp, setIsSettingUp] = useState(false);
  const [setupError, setSetupError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("Invalid invitation link. No token provided.");
      setLoading(false);
      return;
    }
    invitationApi
      .preview(token)
      .then((data) => setPreview(data))
      .catch((err) => setError(err.message || "This invitation is invalid or has expired."))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleAccept() {
    try {
      setAccepting(true);
      const response = await invitationApi.accept(token);
      loginWithToken(response.access_token, response.user, null, response.refresh_token);
      toast.success(`You've joined ${preview?.organization_name || "the organization"}!`);
      navigate(redirectPathForRole(response.user?.role), { replace: true });
    } catch (err) {
      toast.error(err.message || "Failed to accept invitation.");
      setAccepting(false);
    }
  }

  function handleSetupFormChange(event) {
    const { name, value } = event.target;
    setSetupForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSetupAccount(event) {
    event.preventDefault();
    setSetupError("");

    if (setupForm.password !== setupForm.confirm_password) {
      setSetupError("Passwords do not match.");
      return;
    }

    try {
      setIsSettingUp(true);
      const response = await authApi.registerAndAcceptInvitation({
        token,
        full_name: setupForm.full_name,
        password: setupForm.password,
      });
      loginWithToken(response.access_token, response.user, null, response.refresh_token);
      toast.success(`You've joined ${preview?.organization_name || "the organization"}!`);
      navigate(redirectPathForRole(response.user?.role), { replace: true });
    } catch (err) {
      setSetupError(err.message || "Failed to set up your account.");
    } finally {
      setIsSettingUp(false);
    }
  }

  if (loading || isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <p className="text-sm text-slate-500">Loading invitation...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm text-center">
          <p className="mb-2 text-4xl">⚠</p>
          <h1 className="mb-2 text-xl font-bold text-slate-900">Invitation Unavailable</h1>
          <p className="mb-6 text-sm text-slate-600">{error}</p>
          <Link to="/login" className="text-sm font-medium text-slate-900 hover:underline">
            Go to login
          </Link>
        </div>
      </div>
    );
  }

  const redirectPath = `/accept-invitation?token=${encodeURIComponent(token)}`;

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-slate-900">You&apos;re invited</h1>
          <p className="mt-2 text-sm text-slate-600">
            {preview?.invited_by_name ? (
              <>
                <span className="font-medium text-slate-900">{preview.invited_by_name}</span>
                {" invited you to join "}
              </>
            ) : (
              "You have been invited to join "
            )}
            <span className="font-semibold text-slate-900">{preview?.organization_name}</span>
          </p>
        </div>

        <div className="mb-6 space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Email</span>
            <span className="font-medium text-slate-900">{preview?.email}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Role</span>
            <span className="font-medium text-slate-900">
              {ROLE_LABELS[preview?.role] || preview?.role}
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Organization</span>
            <span className="font-medium text-slate-900">{preview?.organization_name}</span>
          </div>
          {preview?.project_name ? (
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Project</span>
              <span className="font-medium text-slate-900">{preview.project_name}</span>
            </div>
          ) : null}
        </div>

        {isAuthenticated ? (
          <button
            type="button"
            onClick={handleAccept}
            disabled={accepting}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {accepting ? "Accepting..." : "Accept Invitation"}
          </button>
        ) : preview?.account_exists ? (
          <div className="space-y-3">
            <p className="text-center text-sm text-slate-600">
              An account already exists for this email. Log in to accept this invitation.
            </p>
            <Link
              to={`/login?redirect=${encodeURIComponent(redirectPath)}`}
              className="block w-full rounded-lg bg-slate-900 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-slate-800"
            >
              Log in to accept
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSetupAccount} className="space-y-4">
            <p className="text-center text-sm text-slate-600">
              No account found for this email yet. Set one up below to accept this invitation.
            </p>

            {setupError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {setupError}
              </div>
            ) : null}

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Full name</label>
              <input
                name="full_name"
                value={setupForm.full_name}
                onChange={handleSetupFormChange}
                required
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  autoComplete="new-password"
                  value={setupForm.password}
                  onChange={handleSetupFormChange}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  required
                  minLength={8}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-11 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 transition-colors hover:text-slate-700"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOnIcon /> : <EyeOffIcon />}
                </button>
              </div>

              {setupForm.password.length > 0 && (
                <PasswordStrengthBar password={setupForm.password} />
              )}

              {(passwordFocused || setupForm.password.length > 0) && (
                <PasswordRequirementsChecklist password={setupForm.password} />
              )}
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">Confirm password</label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirm_password"
                  autoComplete="new-password"
                  value={setupForm.confirm_password}
                  onChange={handleSetupFormChange}
                  required
                  minLength={8}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 pr-11 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-400 transition-colors hover:text-slate-700"
                  aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                >
                  {showConfirmPassword ? <EyeOnIcon /> : <EyeOffIcon />}
                </button>
              </div>
              {setupForm.confirm_password.length > 0 && (
                <p className={`mt-1.5 text-xs font-medium ${
                  setupForm.confirm_password === setupForm.password ? "text-emerald-600" : "text-red-500"
                }`}>
                  {setupForm.confirm_password === setupForm.password ? "Passwords match" : "Passwords do not match"}
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSettingUp}
              className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSettingUp ? "Setting up..." : "Create Account & Accept"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
