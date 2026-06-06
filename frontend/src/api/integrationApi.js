import { apiClient } from "./client";

export const integrationApi = {
  accounts() {
    return apiClient.get("/integrations/accounts");
  },

  connectGoogle() {
    return apiClient.get("/integrations/google/connect");
  },

  connectMicrosoft() {
    return apiClient.get("/integrations/microsoft/connect");
  },

  syncMicrosoftRecent() {
    return apiClient.post("/integrations/microsoft/sync-recent", {});
  },
  disconnectAccount(accountId) {
    return apiClient.delete(`/integrations/accounts/${accountId}`);
  },
};