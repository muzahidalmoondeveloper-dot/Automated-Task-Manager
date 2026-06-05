import { apiClient } from "./client";

export const teamMemberApi = {
  list() {
    return apiClient.get("/team-members");
  },

  getById(id) {
    return apiClient.get(`/team-members/${id}`);
  },

  create(payload) {
    return apiClient.post("/team-members", payload);
  },

  update(id, payload) {
    return apiClient.patch(`/team-members/${id}`, payload);
  },

  delete(id) {
    return apiClient.delete(`/team-members/${id}`);
  },
};