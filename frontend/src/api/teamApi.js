import { apiClient } from "./client";

function buildQuery(params = {}) {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  return qs ? `?${qs}` : "";
}

export const teamApi = {
  list() {
    return apiClient.get("/teams");
  },

  getById(id) {
    return apiClient.get(`/teams/${id}`);
  },

  create(payload) {
    return apiClient.post("/teams", payload);
  },

  update(id, payload) {
    return apiClient.patch(`/teams/${id}`, payload);
  },

  delete(id) {
    return apiClient.delete(`/teams/${id}`);
  },

  getScoreboard(teamId, params = {}) {
    return apiClient.get(`/teams/${teamId}/scoreboard${buildQuery(params)}`);
  },

  getScoreboardTasks(teamId, params = {}) {
    return apiClient.get(`/teams/${teamId}/scoreboard/tasks${buildQuery(params)}`);
  },
};