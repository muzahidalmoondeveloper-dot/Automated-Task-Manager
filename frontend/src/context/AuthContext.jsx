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
    console.log("login-with-token-userData",authenticatedUser);
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
      console.log("checked-access-token",data['access_token']);
      console.log("checked-access-token-model",data.access_token);


    if (data.otp_required || data.email_verification_required) {
      return data;
    }

    if (data.access_token && data.user) {
      console.log("checked",data.access_token+">>>>>> "+data.user);
      loginWithToken(data.access_token, data.user);
    }

    return data;
  }

  async function verifyLoginOtp(payload) {
    setAuthError("");

    const data = await authApi.verifyLoginOtp(payload);

    loginWithToken(data.access_token, data.user);

    return data;
  }

 async function logout() {
    const refreshToken = getAccessToken();
    if(refreshToken == null) {
      console.log("token-null",refreshToken);
      return
    }
    const payload = {
      refresh_token: refreshToken,
      logout_all_devices: false,
    }

    const data = await authApi.logout(payload);
    if(data){
    //removeAccessToken();
    setUser(null);
    }
    return data;
  }

  const value = useMemo(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isAuthLoading,
      authError,

      register,
      verifyRegisterOtp,

      login,
      verifyLoginOtp,
      loginWithToken,

      resendOtp,
      logout,
      reloadUser: loadCurrentUser,
    }),
    [user, isAuthLoading, authError, loadCurrentUser]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}

