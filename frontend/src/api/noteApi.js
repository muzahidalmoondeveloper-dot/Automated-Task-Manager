import { apiClient } from "./client";

export const noteApi = {
  list(entityType, entityId) {
    return apiClient.get(`/notes/${entityType}/${entityId}`);
  },

  create(entityType, entityId, text) {
    return apiClient.post(`/notes/${entityType}/${entityId}`, { text });
  },

  remove(entityType, entityId, noteId) {
    return apiClient.delete(`/notes/${entityType}/${entityId}/${noteId}`);
  },
};
