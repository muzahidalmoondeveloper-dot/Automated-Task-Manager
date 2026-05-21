import { apiClient } from "./client";

export const organizationApi = {
  // Core Values
  listValues() {
    return apiClient.get("/organization/values");
  },
  createValue(payload) {
    return apiClient.post("/organization/values", payload);
  },
  updateValue(id, payload) {
    return apiClient.patch(`/organization/values/${id}`, payload);
  },
  deleteValue(id) {
    return apiClient.delete(`/organization/values/${id}`);
  },

  // Objectives
  listObjectives() {
    return apiClient.get("/organization/objectives");
  },
  listObjectiveRocks() {
    return apiClient.get("/organization/objective-rocks");
  },
  createObjective(payload) {
    return apiClient.post("/organization/objectives", payload);
  },
  updateObjective(id, payload) {
    return apiClient.patch(`/organization/objectives/${id}`, payload);
  },
  deleteObjective(id) {
    return apiClient.delete(`/organization/objectives/${id}`);
  },

  // Org Roles
  listRoles() {
    return apiClient.get("/organization/roles");
  },
  createRole(payload) {
    return apiClient.post("/organization/roles", payload);
  },
  updateRole(id, payload) {
    return apiClient.patch(`/organization/roles/${id}`, payload);
  },
  deleteRole(id) {
    return apiClient.delete(`/organization/roles/${id}`);
  },
};
