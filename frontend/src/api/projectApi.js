import { apiClient } from "./client";

export const projectApi = {
  list() {
    return apiClient.get("/projects");
  },

  getById(id) {
    return apiClient.get(`/projects/${id}`);
  },

  create(payload) {
    return apiClient.post("/projects", payload);
  },

  update(id, payload) {
    return apiClient.patch(`/projects/${id}`, payload);
  },

  delete(id) {
    return apiClient.delete(`/projects/${id}`);
  },
};