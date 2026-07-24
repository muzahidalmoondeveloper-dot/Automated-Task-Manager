import { apiClient } from "./client";

export const notificationApi = {
  /** All recent notifications (default limit 50) */
  list(limit = 50) {
    return apiClient.get(`/notifications?limit=${limit}`);
  },

  /** Unread notifications only */
  listUnread() {
    return apiClient.get("/notifications?unread_only=true");
  },

  markRead(notificationId) {
    return apiClient.patch(`/notifications/${notificationId}/read`);
  },

  markAllRead() {
    return apiClient.patch("/notifications/read-all");
  },

  remove(notificationId) {
    return apiClient.delete(`/notifications/${notificationId}`);
  },

  clearAll() {
    return apiClient.delete("/notifications");
  },
};
