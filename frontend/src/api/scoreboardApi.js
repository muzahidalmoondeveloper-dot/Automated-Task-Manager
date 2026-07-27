import { apiClient } from "./client";

function buildQuery(params = {}) {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  return qs ? `?${qs}` : "";
}

export const scoreboardApi = {
  get(userId, params = {}) {
    return apiClient.get(`/users/${userId}/scoreboard${buildQuery(params)}`);
  },

  getTasks(userId, params = {}) {
    return apiClient.get(`/users/${userId}/scoreboard/tasks${buildQuery(params)}`);
  },

  getOrganization(params = {}) {
    return apiClient.get(`/scoreboard/employees${buildQuery(params)}`);
  },

  getTeamRankings(params = {}) {
    return apiClient.get(`/scoreboard/teams${buildQuery(params)}`);
  },

  getManagerRankings(params = {}) {
    return apiClient.get(`/scoreboard/managers${buildQuery(params)}`);
  },
};
