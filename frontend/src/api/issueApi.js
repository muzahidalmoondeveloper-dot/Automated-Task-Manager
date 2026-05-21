import { apiClient } from "./client";

export const issueApi = {
  list(teamId, timeframe) {
    const q = timeframe ? `?timeframe=${encodeURIComponent(timeframe)}` : "";
    return apiClient.get(`/teams/${teamId}/issues${q}`);
  },
  create(teamId, data) {
    return apiClient.post(`/teams/${teamId}/issues`, data);
  },
  update(teamId, issueId, data) {
    return apiClient.patch(`/teams/${teamId}/issues/${issueId}`, data);
  },
  delete(teamId, issueId) {
    return apiClient.delete(`/teams/${teamId}/issues/${issueId}`);
  },
};
