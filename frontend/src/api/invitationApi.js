import { apiClient } from "./client";

export const invitationApi = {
  invite(payload) {
    return apiClient.post("/organizations/current/members/invite", payload);
  },
  listPending() {
    return apiClient.get("/organizations/current/invitations");
  },
  revoke(invitationId) {
    return apiClient.delete(`/organizations/current/invitations/${invitationId}`);
  },
  resend(invitationId) {
    return apiClient.post(`/organizations/current/invitations/${invitationId}/resend`);
  },
  preview(token) {
    return apiClient.get(`/auth/invitation-preview?token=${encodeURIComponent(token)}`);
  },
  accept(token) {
    return apiClient.post("/auth/accept-invitation", { token });
  },
};
