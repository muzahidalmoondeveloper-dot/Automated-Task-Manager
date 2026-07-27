import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";

import { integrationApi } from "../api/integrationApi";
import { useConfirm } from "../context/ConfirmContext";

function ProviderCard({
  title,
  description,
  provider,
  account,
  onConnect,
  onDisconnect,
  onSync,
  isSyncing,
  isDisconnecting,
}) {
  const isConnected = Boolean(account);

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>

          <p className="mt-2 text-sm text-slate-600">{description}</p>

          {isConnected ? (
            <div className="mt-4 rounded-xl border border-green-200 bg-green-50 px-4 py-3">
              <p className="text-sm font-semibold text-green-700">
                Connected
              </p>
              <p className="mt-1 text-sm text-green-700">
                {account.account_email}
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-sm font-semibold text-slate-700">
                Not connected
              </p>
              <p className="mt-1 text-sm text-slate-500">
                Connect your {provider} account to import data.
              </p>
            </div>
          )}
        </div>

        {isConnected ? (
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
            Connected
          </span>
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
            Not connected
          </span>
        )}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        {isConnected ? (
          <button
            type="button"
            onClick={() => onDisconnect(account)}
            disabled={isDisconnecting}
            className="rounded-lg border border-red-200 px-4 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDisconnecting ? "Disconnecting..." : `Disconnect ${title}`}
          </button>
        ) : (
          <button
            type="button"
            onClick={onConnect}
            className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800"
          >
            Connect {title}
          </button>
        )}

        {provider === "microsoft" && isConnected ? (
          <button
            type="button"
            onClick={onSync}
            disabled={isSyncing}
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSyncing ? "Syncing..." : "Sync Recent Microsoft Data"}
          </button>
        ) : null}
      </div>
    </div>
  );
}

export default function IntegrationsPage() {
  const confirm = useConfirm();
  const [accounts, setAccounts] = useState([]);
  const [error, setError] = useState("");
  const [isSyncingMicrosoft, setIsSyncingMicrosoft] = useState(false);
  const [disconnectingAccountId, setDisconnectingAccountId] = useState(null);

  const googleAccount = useMemo(() => {
    return accounts.find((account) => account.provider === "google");
  }, [accounts]);

  const microsoftAccount = useMemo(() => {
    return accounts.find((account) => account.provider === "microsoft");
  }, [accounts]);

  async function loadAccounts() {
    try {
      setError("");

      const data = await integrationApi.accounts();

      setAccounts(data);
    } catch (err) {
      setError(err.message || "Unable to load integrations.");
    }
  }

  useEffect(() => {
    loadAccounts();
  }, []);

  async function handleConnectGoogle() {
    try {
      setError("");

      const data = await integrationApi.connectGoogle();

      window.location.href = data.url;
    } catch (err) {
      setError(err.message || "Unable to connect Google.");
      toast.error(err.message || "Unable to connect Google.");
    }
  }

  async function handleConnectMicrosoft() {
    try {
      setError("");

      const data = await integrationApi.connectMicrosoft();

      window.location.href = data.url;
    } catch (err) {
      setError(err.message || "Unable to connect Microsoft.");
      toast.error(err.message || "Unable to connect Microsoft.");
    }
  }

  async function handleSyncMicrosoftRecent() {
    try {
      setIsSyncingMicrosoft(true);
      setError("");

      const result = await integrationApi.syncMicrosoftRecent();

      toast.success(result.message || "Microsoft data synced.");
    } catch (err) {
      toast.error(err.message || "Unable to sync Microsoft data.");
    } finally {
      setIsSyncingMicrosoft(false);
    }
  }

  async function handleDisconnectAccount(account) {
    const confirmed = await confirm({
      message: `Disconnect ${account.account_email} from ${account.provider}?`,
      tone: "danger",
      confirmLabel: "Disconnect",
    });

    if (!confirmed) return;

    try {
      setError("");
      setDisconnectingAccountId(account.id);

      const result = await integrationApi.disconnectAccount(account.id);

      toast.success(result.message || "Account disconnected.");

      await loadAccounts();
    } catch (err) {
      setError(err.message || "Unable to disconnect account.");
      toast.error(err.message || "Unable to disconnect account.");
    } finally {
      setDisconnectingAccountId(null);
    }
  }

  return (
    <div className="w-full">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Integrations</h1>

        <p className="mt-2 text-sm text-slate-600">
          Connect Gmail, Outlook, Google Calendar, Microsoft Calendar, and Teams
          meetings.
        </p>
      </div>

      {error ? (
        <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <ProviderCard
          title="Google"
          provider="google"
          description="Connect Gmail and Google Calendar."
          account={googleAccount}
          onConnect={handleConnectGoogle}
          onDisconnect={handleDisconnectAccount}
          isDisconnecting={disconnectingAccountId === googleAccount?.id}
        />

        <ProviderCard
          title="Microsoft"
          provider="microsoft"
          description="Connect Outlook Mail, Microsoft Calendar, and Teams meetings."
          account={microsoftAccount}
          onConnect={handleConnectMicrosoft}
          onDisconnect={handleDisconnectAccount}
          onSync={handleSyncMicrosoftRecent}
          isSyncing={isSyncingMicrosoft}
          isDisconnecting={disconnectingAccountId === microsoftAccount?.id}
        />
      </div>

      <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-lg font-semibold text-slate-900">
            Connected Accounts
          </h2>
        </div>

        <div className="divide-y divide-slate-200">
          {accounts.map((account) => (
            <div
              key={account.id}
              className="flex flex-col justify-between gap-4 px-6 py-4 sm:flex-row sm:items-center"
            >
              <div>
                <p className="font-medium text-slate-900">
                  {account.account_email}
                </p>

                <p className="text-sm capitalize text-slate-500">
                  {account.provider}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
                  Connected
                </span>

                <button
                  type="button"
                  onClick={() => handleDisconnectAccount(account)}
                  disabled={disconnectingAccountId === account.id}
                  className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {disconnectingAccountId === account.id
                    ? "Disconnecting..."
                    : "Disconnect"}
                </button>
              </div>
            </div>
          ))}

          {!accounts.length ? (
            <div className="p-6 text-sm text-slate-500">
              No accounts connected yet.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}