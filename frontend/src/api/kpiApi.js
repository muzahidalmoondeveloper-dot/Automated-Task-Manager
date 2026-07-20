import { apiClient } from "./client";

export const kpiApi = {
  list(teamId) {
    return apiClient.get(`/teams/${teamId}/kpis`);
  },
  create(teamId, data) {
    return apiClient.post(`/teams/${teamId}/kpis`, data);
  },
  update(teamId, kpiId, data) {
    return apiClient.patch(`/teams/${teamId}/kpis/${kpiId}`, data);
  },
  delete(teamId, kpiId) {
    return apiClient.delete(`/teams/${teamId}/kpis/${kpiId}`);
  },
  upsertEntry(teamId, kpiId, data) {
    return apiClient.put(`/teams/${teamId}/kpis/${kpiId}/entries`, data);
  },
  deleteEntry(teamId, kpiId, entryId) {
    return apiClient.delete(`/teams/${teamId}/kpis/${kpiId}/entries/${entryId}`);
  },
  addNote(teamId, kpiId, entryId, text) {
    return apiClient.post(`/teams/${teamId}/kpis/${kpiId}/entries/${entryId}/notes`, { text });
  },
  editNote(teamId, kpiId, entryId, noteIdx, text) {
    return apiClient.patch(`/teams/${teamId}/kpis/${kpiId}/entries/${entryId}/notes/${noteIdx}`, { text });
  },
  deleteNote(teamId, kpiId, entryId, noteIdx) {
    return apiClient.delete(`/teams/${teamId}/kpis/${kpiId}/entries/${entryId}/notes/${noteIdx}`);
  },
  reorder(teamId, items) {
    return apiClient.put(`/teams/${teamId}/kpis/reorder`, items);
  },

  // ── KPI groups ──────────────────────────────────────────────────────────
  listGroups(teamId) {
    return apiClient.get(`/teams/${teamId}/kpi-groups`);
  },
  createGroup(teamId, data) {
    return apiClient.post(`/teams/${teamId}/kpi-groups`, data);
  },
  updateGroup(teamId, groupId, data) {
    return apiClient.patch(`/teams/${teamId}/kpi-groups/${groupId}`, data);
  },
  deleteGroup(teamId, groupId) {
    return apiClient.delete(`/teams/${teamId}/kpi-groups/${groupId}`);
  },
};
