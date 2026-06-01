import { apiClient } from "./client";

export const rockApi = {
  list(teamId) {
    return apiClient.get(`/teams/${teamId}/rocks`);
  },
  create(teamId, payload) {
    return apiClient.post(`/teams/${teamId}/rocks`, payload);
  },
  update(teamId, rockId, payload) {
    return apiClient.patch(`/teams/${teamId}/rocks/${rockId}`, payload);
  },
  delete(teamId, rockId) {
    return apiClient.delete(`/teams/${teamId}/rocks/${rockId}`);
  },
};
