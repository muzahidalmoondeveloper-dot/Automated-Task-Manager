import { apiClient } from "./client";

export const taskApi = {
  list() {
    return apiClient.get("/tasks");
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