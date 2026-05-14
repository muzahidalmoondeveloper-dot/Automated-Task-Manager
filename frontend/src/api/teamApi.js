import { apiClient } from "./client";

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
};