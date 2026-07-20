import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";

import { invitationApi } from "../api/invitationApi";
import { useAuth } from "../context/AuthContext";

const ROLE_LABELS = {
  owner: "Owner",
  admin: "Admin",
  team_manager: "Team Manager",
  team_member: "Team Member",
};

export default function AcceptInvitationPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const navigate = useNavigate();
  const { isAuthenticated, isAuthLoading, loginWithToken } = useAuth();

  const [preview, setPreview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [accepting, setAccepting] = useState(false);

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
      navigate("/dashboard", { replace: true });
    } catch (err) {
      toast.error(err.message || "Failed to accept invitation.");
      setAccepting(false);
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
          <div className="space-y-3">
            <p className="text-center text-sm text-slate-600">
              No account found for this email yet. Create one to accept this invitation.
            </p>
            <Link
              to={`/register?invite=${encodeURIComponent(token)}`}
              className="block w-full rounded-lg bg-slate-900 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-slate-800"
            >
              Create account to accept
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
