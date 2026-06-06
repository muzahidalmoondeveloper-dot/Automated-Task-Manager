import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { authApi } from "../api/authApi";
import {
  getAccessToken,
  removeAccessToken,
  setAccessToken,
} from "../api/client";

const AuthContext = createContext(null);

// Decode JWT payload without verification (client-side only, for reading claims).
function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");

  const loadCurrentUser = useCallback(async () => {
    const token = getAccessToken();

    if (!token) {
      setUser(null);
      setIsAuthLoading(false);
      return;
    }

    try {
      setIsAuthLoading(true);
      setAuthError("");

      const data = await authApi.me();
      setUser(data.user);
    } catch (error) {
      removeAccessToken();
      setUser(null);
      setAuthError(error.message || "Session expired.");
    } finally {
      setIsAuthLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCurrentUser();
  }, [loadCurrentUser]);

  function loginWithToken(accessToken, authenticatedUser) {
    setAccessToken(accessToken);
    setUser(authenticatedUser);
    setAuthError("");
  }

  async function register(payload) {
    setAuthError("");
    return await authApi.register(payload);
  }

  async function verifyRegisterOtp(payload) {
    setAuthError("");
    const data = await authApi.verifyRegisterOtp(payload);
    loginWithToken(data.access_token, data.user);
    return data;
  }

  async function resendOtp(payload) {
    setAuthError("");
    return await authApi.resendOtp(payload);
  }

  async function login(payload) {
    setAuthError("");
    const data = await authApi.login(payload);

    if (data.otp_required || data.email_verification_required) {
      return data;
    }

    if (data.requires_org_selection) {
      // Multiple orgs — caller (LoginPage) handles org selection UI
      return data;
    }

    if (data.access_token && data.user) {
      loginWithToken(data.access_token, data.user);
    }

    return data;
  }

  async function verifyLoginOtp(payload) {
    setAuthError("");
    const data = await authApi.verifyLoginOtp(payload);

    if (data.requires_org_selection) {
      return data;
    }

    loginWithToken(data.access_token, data.user);
    return data;
  }

  // Called after the user picks an org from the org-selection step.
  async function selectOrganization(orgId) {
    setAuthError("");
    const data = await authApi.selectOrganization(orgId);
    loginWithToken(data.access_token, data.user);
    return data;
  }

  function logout() {
    removeAccessToken();
    setUser(null);
  }

  // Derive org context from the stored JWT without an extra network call.
  const token = getAccessToken();
  const jwtPayload = token ? parseJwt(token) : null;
  const hasOrgContext = Boolean(jwtPayload?.org_id);

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isAuthLoading,
      authError,
      hasOrgContext,

      register,
      verifyRegisterOtp,

      login,
      verifyLoginOtp,
      loginWithToken,
      selectOrganization,

      resendOtp,
      logout,
      reloadUser: loadCurrentUser,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user, isAuthLoading, authError, hasOrgContext, loadCurrentUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
