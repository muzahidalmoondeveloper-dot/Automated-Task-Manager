import { apiClient } from "./client";

export const noteApi = {
  list(entityType, entityId) {
    return apiClient.get(`/notes/${entityType}/${entityId}`);
  },

  counts(entityType, entityIds) {
    if (!entityIds || entityIds.length === 0) return Promise.resolve({});
    return apiClient.get(`/notes/counts/${entityType}?entity_ids=${entityIds.join(",")}`);
  },

  create(entityType, entityId, text) {
    return apiClient.post(`/notes/${entityType}/${entityId}`, { text });
  },

  remove(entityType, entityId, noteId) {
    return apiClient.delete(`/notes/${entityType}/${entityId}/${noteId}`);
  },
};
