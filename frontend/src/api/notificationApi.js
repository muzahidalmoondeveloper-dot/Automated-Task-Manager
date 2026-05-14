import { apiClient } from "./client";

export const notificationApi = {
  listUnread() {
    return apiClient.get("/notifications?unread_only=true");
  },

  markRead(notificationId) {
    return apiClient.patch(`/notifications/${notificationId}/read`);
  },
};
