import { apiClient, getAccessToken } from "./client";

function buildQuery(params = {}) {
  const qs = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== "")
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
    .join("&");
  return qs ? `?${qs}` : "";
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export const reportApi = {
  list(params = {}) {
    return apiClient.get(`/reports${buildQuery(params)}`);
  },

  get(id) {
    return apiClient.get(`/reports/${id}`);
  },

  create(payload) {
    return apiClient.post("/reports", payload);
  },

  createEmployeeReport(payload) {
    return apiClient.post("/reports/employee", payload);
  },

  createTeamReport(payload) {
    return apiClient.post("/reports/team", payload);
  },

  update(id, payload) {
    return apiClient.patch(`/reports/${id}`, payload);
  },

  regenerate(id) {
    return apiClient.post(`/reports/${id}/regenerate`);
  },

  remove(id) {
    return apiClient.delete(`/reports/${id}`);
  },

  finalize(id) {
    return apiClient.post(`/reports/${id}/finalize`);
  },

  newVersion(id) {
    return apiClient.post(`/reports/${id}/new-version`);
  },

  listVersions(id) {
    return apiClient.get(`/reports/${id}/versions`);
  },

  listThemes() {
    return apiClient.get("/reports/themes");
  },

  createTheme(payload) {
    return apiClient.post("/reports/themes", payload);
  },

  updateTheme(id, payload) {
    return apiClient.patch(`/reports/themes/${id}`, payload);
  },

  getBranding(params = {}) {
    return apiClient.get(`/reports/branding${buildQuery(params)}`);
  },

  upsertBranding(payload) {
    return apiClient.post("/reports/branding", payload);
  },

  /** Fetches the rendered PDF as a blob (auth header can't ride on <iframe src>/<a href>). */
  async fetchPdfBlob(id, { download = false } = {}) {
    const endpoint = download ? `/reports/${id}/download` : `/reports/${id}/preview`;
    const token = getAccessToken();
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!response.ok) {
      throw new Error("Failed to load the report PDF.");
    }
    return response.blob();
  },
};
