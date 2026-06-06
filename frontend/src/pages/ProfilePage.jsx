import { useEffect, useState } from "react";
import toast from "react-hot-toast";

import { useAuth } from "../context/AuthContext";

const THEME_STORAGE_KEY = "atm-theme";

function formatRole(role) {
  return (role || "user").replace("_", " ");
}

function getInitials(user) {
  const name = user?.full_name || user?.email || "User";

  return name
    .split(" ")
    .map((part) => part.charAt(0))
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function applyTheme(theme) {
  const root = document.documentElement;
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;

  const shouldUseDark =
    theme === "dark" || (theme === "device" && prefersDark);

  if (shouldUseDark) {
    root.classList.add("dark");
    root.classList.add("night");
  } else {
    root.classList.remove("dark");
    root.classList.remove("night");
  }
}

function SunIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 4a.75.75 0 01.75.75V6a.75.75 0 01-1.5 0V4.75A.75.75 0 0110 4zM10 13.25a3.25 3.25 0 100-6.5 3.25 3.25 0 000 6.5zM15.25 9.25H16.5a.75.75 0 010 1.5h-1.25a.75.75 0 010-1.5zM3.5 9.25h1.25a.75.75 0 010 1.5H3.5a.75.75 0 010-1.5zM13.712 6.288a.75.75 0 011.06 0l.884.884a.75.75 0 11-1.06 1.06l-.884-.883a.75.75 0 010-1.061zM5.228 14.772a.75.75 0 011.06 0l.884.884a.75.75 0 11-1.06 1.06l-.884-.884a.75.75 0 010-1.06zM14.772 14.772a.75.75 0 010 1.06l-.884.884a.75.75 0 11-1.06-1.06l.883-.884a.75.75 0 011.061 0zM6.288 6.288a.75.75 0 010 1.06l-.883.884a.75.75 0 11-1.06-1.06l.883-.884a.75.75 0 011.06 0z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M17.293 13.293A8 8 0 016.707 2.707a8 8 0 1010.586 10.586z" />
    </svg>
  );
}

function DeviceIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M4 4a2 2 0 00-2 2v6a2 2 0 002 2h4.25v1.5H6.5a.75.75 0 000 1.5h7a.75.75 0 000-1.5h-1.75V14H16a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 1.5h12a.5.5 0 01.5.5v6a.5.5 0 01-.5.5H4a.5.5 0 01-.5-.5V6a.5.5 0 01.5-.5z" />
    </svg>
  );
}

function ThemeCard({ value, currentTheme, label, description, icon, onClick }) {
  const isActive = currentTheme === value;

  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={
        isActive
          ? "rounded-2xl border border-slate-900 bg-slate-900 p-5 text-left text-white shadow-sm"
          : "rounded-2xl border border-slate-200 bg-white p-5 text-left text-slate-700 hover:bg-slate-50"
      }
    >
      <div
        className={
          isActive
            ? "mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white/15"
            : "mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-100 text-slate-500"
        }
      >
        {icon}
      </div>

      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold">{label}</h3>

        {isActive ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-900">
            ✓
          </span>
        ) : null}
      </div>

      <p className={isActive ? "mt-2 text-sm text-slate-200" : "mt-2 text-sm text-slate-500"}>
        {description}
      </p>
    </button>
  );
}

export default function ProfilePage() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("profile");
  const [theme, setTheme] = useState(
    localStorage.getItem(THEME_STORAGE_KEY) || "device"
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  useEffect(() => {
    function handleSystemThemeChange() {
      if (theme === "device") {
        applyTheme("device");
      }
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    mediaQuery.addEventListener("change", handleSystemThemeChange);

    return () => {
      mediaQuery.removeEventListener("change", handleSystemThemeChange);
    };
  }, [theme]);

  function updateTheme(value) {
    setTheme(value);
    localStorage.setItem(THEME_STORAGE_KEY, value);
    applyTheme(value);

    if (value === "light") {
      toast.success("Light mode enabled.");
    } else if (value === "dark") {
      toast.success("Dark mode enabled.");
    } else {
      toast.success("Theme set to device.");
    }
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Profile</h1>
        <p className="mt-2 text-sm text-slate-600">
          Manage your account information and workspace preferences.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-3xl bg-slate-900 text-2xl font-bold text-white">
              {getInitials(user)}
            </div>

            <div className="min-w-0">
              <h2 className="truncate text-2xl font-bold text-slate-900">
                {user?.full_name || "User Name"}
              </h2>

              <p className="mt-1 truncate text-sm text-slate-500">
                {user?.email}
              </p>

              <span className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-700">
                {formatRole(user?.role)}
              </span>
            </div>
          </div>
        </div>

        <div className="border-b border-slate-200 px-6">
          <nav className="flex gap-6">
            <button
              type="button"
              onClick={() => setActiveTab("profile")}
              className={
                activeTab === "profile"
                  ? "border-b-2 border-slate-900 py-4 text-sm font-semibold text-slate-900"
                  : "py-4 text-sm font-semibold text-slate-500 hover:text-slate-900"
              }
            >
              Profile
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("settings")}
              className={
                activeTab === "settings"
                  ? "border-b-2 border-slate-900 py-4 text-sm font-semibold text-slate-900"
                  : "py-4 text-sm font-semibold text-slate-500 hover:text-slate-900"
              }
            >
              Settings
            </button>
          </nav>
        </div>

        <div className="p-6">
          {activeTab === "profile" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Full Name
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {user?.full_name || "Not available"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Email Address
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {user?.email || "Not available"}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Role
                </p>
                <p className="mt-2 text-sm font-semibold capitalize text-slate-900">
                  {formatRole(user?.role)}
                </p>
              </div>

              <div className="rounded-2xl border border-slate-200 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Account Status
                </p>
                <p className="mt-2 text-sm font-semibold text-green-700">
                  Active
                </p>
              </div>
            </div>
          ) : null}

          {activeTab === "settings" ? (
            <div>
              <div className="mb-5">
                <h3 className="text-lg font-bold text-slate-900">
                  Appearance
                </h3>
                <p className="mt-1 text-sm text-slate-500">
                  Choose how the application should look.
                </p>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <ThemeCard
                  value="light"
                  currentTheme={theme}
                  label="Light Mode"
                  description="Use a bright interface."
                  icon={<SunIcon />}
                  onClick={updateTheme}
                />

                <ThemeCard
                  value="dark"
                  currentTheme={theme}
                  label="Dark Mode"
                  description="Use a darker interface."
                  icon={<MoonIcon />}
                  onClick={updateTheme}
                />

                <ThemeCard
                  value="device"
                  currentTheme={theme}
                  label="Device"
                  description="Follow system setting."
                  icon={<DeviceIcon />}
                  onClick={updateTheme}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}