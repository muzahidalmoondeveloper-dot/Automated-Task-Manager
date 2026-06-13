import { apiClient } from "./client";

export const authApi = {
  register(payload) {
    return apiClient.post("/auth/register", payload);
  },

  verifyRegisterOtp(payload) {
    return apiClient.post("/auth/register/verify-otp", payload);
  },

  login(payload) {
    console.log('login-payload',payload);
    return apiClient.post("/auth/login", payload);
  },

  logout(payload){
    return apiClient.post("/auth/logout",payload);
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
};