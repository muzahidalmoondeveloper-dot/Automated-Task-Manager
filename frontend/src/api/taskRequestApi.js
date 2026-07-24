import { apiClient } from "./client";

export const taskRequestApi = {
  list(projectId) {
    return apiClient.get(`/projects/${projectId}/task-requests`);
  },

  create(projectId, payload) {
    return apiClient.post(`/projects/${projectId}/task-requests`, payload);
  },

  convert(projectId, requestId, payload) {
    return apiClient.post(`/projects/${projectId}/task-requests/${requestId}/convert`, payload);
  },

  reject(projectId, requestId, payload = {}) {
    return apiClient.post(`/projects/${projectId}/task-requests/${requestId}/reject`, payload);
  },
};
