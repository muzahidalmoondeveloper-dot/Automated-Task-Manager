import { apiClient } from "./client";

export const projectInvitationApi = {
  invite(projectId, email) {
    return apiClient.post(`/projects/${projectId}/client-invitations`, { email });
  },

  list(projectId) {
    return apiClient.get(`/projects/${projectId}/client-invitations`);
  },

  revoke(projectId, invitationId) {
    return apiClient.delete(`/projects/${projectId}/client-invitations/${invitationId}`);
  },
};
