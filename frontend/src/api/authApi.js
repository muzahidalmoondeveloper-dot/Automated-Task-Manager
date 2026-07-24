import { apiClient } from "./client";

export const authApi = {
  register(payload) {
    return apiClient.post("/auth/register", payload);
  },

  verifyRegisterOtp(payload) {
    return apiClient.post("/auth/register/verify-otp", payload);
  },

  login(payload) {
    return apiClient.post("/auth/login", payload);
  },

  verifyLoginOtp(payload) {
    return apiClient.post("/auth/login/verify-otp", payload);
  },

  me() {
    return apiClient.get("/auth/me");
  },

  getMe() {
    return apiClient.get("/auth/me");
  },
  resendOtp(payload) {
    return apiClient.post("/auth/resend-otp", payload);
  },

  forgotPassword(payload) {
    return apiClient.post("/auth/forgot-password", payload);
  },

  resetPassword(payload) {
    return apiClient.post("/auth/reset-password", payload);
  },

  // ── Multi-tenant org context ───────────────────────────────────────────────

  myOrganizations() {
    return apiClient.get("/auth/my-organizations");
  },

  selectOrganization(orgId) {
    return apiClient.post(`/auth/select-organization/${orgId}`, {});
  },

  registerAndAcceptInvitation(payload) {
    return apiClient.post("/auth/register-and-accept-invitation", payload);
  },
};
