import { apiClient } from "./client";

export const userApi = {
  list() {
    return apiClient.get("/users");
  },

  listTeamManagers() {
    return apiClient.get("/users/team-managers");
  },

  create(payload) {
    return apiClient.post("/users", payload);
  },

  update(id, payload) {
    return apiClient.patch(`/users/${id}`, payload);
  },

  delete(id) {
    return apiClient.delete(`/users/${id}`);
  },
};