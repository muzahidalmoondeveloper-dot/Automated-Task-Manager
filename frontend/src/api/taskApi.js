import { apiClient } from "./client";

function buildQuery(params = {}) {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "" && v !== false)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  return qs ? `?${qs}` : "";
}

export const taskApi = {
  /** Admin / Manager only — all tasks with optional filters */
  list(params = {}) {
    return apiClient.get(`/tasks${buildQuery(params)}`);
  },

  /** All roles — only the logged-in user's assigned tasks */
  listMy(params = {}) {
    return apiClient.get(`/tasks/my${buildQuery(params)}`);
  },

  listByProject(projectId) {
    return apiClient.get(`/tasks/project/${projectId}`);
  },

  listByTeam(teamId) {
    return apiClient.get(`/tasks/team/${teamId}`);
  },

  getById(id) {
    return apiClient.get(`/tasks/${id}`);
  },

  create(payload) {
    return apiClient.post("/tasks", payload);
  },

  update(id, payload) {
    return apiClient.patch(`/tasks/${id}`, payload);
  },

  updateStatus(id, status) {
    return apiClient.patch(`/tasks/${id}/status`, { status });
  },

  approve(taskId) {
    return apiClient.post(`/tasks/${taskId}/approve`);
  },

  assignBack(taskId, payload) {
    return apiClient.post(`/tasks/${taskId}/assign-back`, payload);
  },

  delete(id) {
    return apiClient.delete(`/tasks/${id}`);
  },
};
