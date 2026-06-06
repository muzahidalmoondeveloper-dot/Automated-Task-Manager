import { apiClient, getAccessToken } from "./client";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/api";

export const chatApi = {
  sendMessage(message, sessionId = null) {
    return apiClient.post("/chat/message", { message, session_id: sessionId });
  },

  async uploadFile(file, message = "", sessionId = null) {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("message", message);
    if (sessionId != null) {
      formData.append("session_id", String(sessionId));
    }

    const token = getAccessToken();
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${API_BASE_URL}/chat/upload`, {
      method: "POST",
      headers,
      body: formData,
    });

    let data = null;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      const raw = await response.text();
      data = raw ? JSON.parse(raw) : null;
    }

    if (!response.ok) {
      throw new Error(data?.detail || "File upload failed.");
    }

    return data;
  },

  listSessions() {
    return apiClient.get("/chat/sessions");
  },

  getSession(sessionId) {
    return apiClient.get(`/chat/sessions/${sessionId}`);
  },

  deleteSession(sessionId) {
    return apiClient.delete(`/chat/sessions/${sessionId}`);
  },
};
