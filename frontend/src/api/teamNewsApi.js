import { apiClient } from "./client";

export const teamNewsApi = {
  list(teamId) {
    return apiClient.get(`/teams/${teamId}/news`);
  },
  create(teamId, payload) {
    return apiClient.post(`/teams/${teamId}/news`, payload);
  },
  update(teamId, newsId, payload) {
    return apiClient.patch(`/teams/${teamId}/news/${newsId}`, payload);
  },
  delete(teamId, newsId) {
    return apiClient.delete(`/teams/${teamId}/news/${newsId}`);
  },
};
