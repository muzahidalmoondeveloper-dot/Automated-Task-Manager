import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";

const SETUP_PATH = "/setup/organization";

export default function ProtectedRoute() {
  const { isAuthenticated, isAuthLoading, hasOrgContext, needsOrgSetup } = useAuth();
  const location = useLocation();

  if (isAuthLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="rounded-xl bg-white px-6 py-4 shadow">
          <p className="text-sm text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Authenticated but no org in the JWT, or their active org is still mid
  // creation-wizard (owner abandoned it last session) → send them to set up.
  // Skip this redirect when the user is already on the setup page.
  if ((!hasOrgContext || needsOrgSetup) && location.pathname !== SETUP_PATH) {
    return <Navigate to={SETUP_PATH} replace />;
  }

  return <Outlet />;
}
