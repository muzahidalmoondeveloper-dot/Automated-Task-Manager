import React from "react";
import conf from "../conf/conf";
const API_BASE_URL = conf.viteApiBaseUrl || "/local-host";

export function getAccessToken() {
  return localStorage.getItem("access_token");
}

export function setAccessToken(token) {
  localStorage.setItem("access_token", token);
}

export function removeAccessToken() {
  localStorage.removeItem("access_token");
}

async function request(endpoint, options = {}) {
  const token = getAccessToken();

  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  let data = null;

  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    const rawBody = await response.text();
    data = rawBody ? JSON.parse(rawBody) : null;
  }

  if (!response.ok) {
    const message = data?.detail || "Something went wrong.";
    throw new Error(message);
  }

  return data;
}

export const apiClient = {
  get(endpoint) {
    return request(endpoint, {
      method: "GET",
    });
  },

  post(endpoint, body) {
    return request(endpoint, {
      method: "POST",
      body: JSON.stringify(body),
    });
  },

  patch(endpoint, body) {
    return request(endpoint, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
  },

  delete(endpoint) {
    return request(endpoint, {
      method: "DELETE",
    });
  },
};