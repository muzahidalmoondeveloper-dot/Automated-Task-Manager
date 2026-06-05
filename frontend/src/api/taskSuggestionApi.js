import { apiClient } from "./client";

export const taskSuggestionApi = {
  list() {
    return apiClient.get("/task-suggestions");
  },

  syncYesterday() {
    return apiClient.post("/task-suggestions/sync-yesterday", {});
  },

  analyze(payload) {
    return apiClient.post("/task-suggestions/analyze", payload);
  },

  approve(id, payload) {
    return apiClient.post(`/task-suggestions/${id}/approve`, payload);
  },

  reject(id) {
    return apiClient.post(`/task-suggestions/${id}/reject`);
  },
};