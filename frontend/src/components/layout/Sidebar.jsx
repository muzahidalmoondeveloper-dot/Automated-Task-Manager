import { useEffect, useRef, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { projectApi } from "../../api/projectApi";
import { teamApi } from "../../api/teamApi";

const THEME_STORAGE_KEY = "atm-theme";

function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}

function getInitialTheme() {
  return localStorage.getItem(THEME_STORAGE_KEY) || "device";
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

function DashboardIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M3 3a2 2 0 00-2 2v4a2 2 0 002 2h4a2 2 0 002-2V5a2 2 0 00-2-2H3zM13 3a2 2 0 00-2 2v2a2 2 0 002 2h4a2 2 0 002-2V5a2 2 0 00-2-2h-4zM13 11a2 2 0 00-2 2v2a2 2 0 002 2h4a2 2 0 002-2v-2a2 2 0 00-2-2h-4zM3 13a2 2 0 00-2 2v.5A1.5 1.5 0 002.5 17h5A1.5 1.5 0 009 15.5V15a2 2 0 00-2-2H3z" />
    </svg>
  );
}

function TasksIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M7.75 3.5a2.25 2.25 0 014.5 0h1A2.75 2.75 0 0116 6.25v8.5A2.75 2.75 0 0113.25 17h-6.5A2.75 2.75 0 014 14.75v-8.5A2.75 2.75 0 016.75 3.5h1zM10 2.75a.75.75 0 00-.75.75h1.5a.75.75 0 00-.75-.75zM8.28 10.22a.75.75 0 00-1.06 1.06l1.25 1.25a.75.75 0 001.06 0l3-3a.75.75 0 10-1.06-1.06L9 10.94l-.72-.72z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 9a3 3 0 100-6 3 3 0 000 6z" />
      <path d="M3.465 14.493A6.98 6.98 0 0110 10a6.98 6.98 0 016.535 4.493.75.75 0 01-.699 1.007H4.164a.75.75 0 01-.699-1.007z" />
    </svg>
  );
}

function TeamsIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M7 8a3 3 0 100-6 3 3 0 000 6zM13.5 9a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
      <path d="M2.5 15.5A4.5 4.5 0 017 11h.25a4.5 4.5 0 014.5 4.5.5.5 0 01-.5.5H3a.5.5 0 01-.5-.5zM12.8 16h3.7a.5.5 0 00.5-.5A3.5 3.5 0 0013.5 12c-.32 0-.63.04-.92.13.42.84.67 1.78.67 2.79 0 .38-.03.74-.1 1.08z" />
    </svg>
  );
}

function ProjectsIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M3 5a2 2 0 012-2h3.586A2 2 0 0110 3.586L11.414 5H15a2 2 0 012 2v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5z" />
    </svg>
  );
}

function IntegrationsIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M7 3a3 3 0 00-3 3v2H3a2 2 0 000 4h1v2a3 3 0 006 0v-1.25a.75.75 0 00-1.5 0V14a1.5 1.5 0 01-3 0V6a1.5 1.5 0 013 0v1.25a.75.75 0 001.5 0V6a3 3 0 00-3-3zM13 3a3 3 0 00-3 3v1.25a.75.75 0 001.5 0V6a1.5 1.5 0 013 0v8a1.5 1.5 0 01-3 0v-1.25a.75.75 0 00-1.5 0V14a3 3 0 006 0v-2h1a2 2 0 100-4h-1V6a3 3 0 00-3-3z" />
    </svg>
  );
}


function MenuIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M3 5.75A.75.75 0 013.75 5h12.5a.75.75 0 010 1.5H3.75A.75.75 0 013 5.75zM3 10a.75.75 0 01.75-.75h12.5a.75.75 0 010 1.5H3.75A.75.75 0 013 10zM3.75 13.5a.75.75 0 000 1.5h12.5a.75.75 0 000-1.5H3.75z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
      <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
    </svg>
  );
}

function LogoutIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M3 4.25A2.25 2.25 0 015.25 2h5.5A2.25 2.25 0 0113 4.25v2a.75.75 0 01-1.5 0v-2a.75.75 0 00-.75-.75h-5.5a.75.75 0 00-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 00.75-.75v-2a.75.75 0 011.5 0v2A2.25 2.25 0 0110.75 18h-5.5A2.25 2.25 0 013 15.75V4.25zm11.47 3.22a.75.75 0 011.06 0l2 2a.75.75 0 010 1.06l-2 2a.75.75 0 11-1.06-1.06l.72-.72H8.75a.75.75 0 010-1.5h6.44l-.72-.72a.75.75 0 010-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ProfileIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 9a3 3 0 100-6 3 3 0 000 6z" />
      <path d="M3.465 14.493A6.98 6.98 0 0110 10a6.98 6.98 0 016.535 4.493.75.75 0 01-.699 1.007H4.164a.75.75 0 01-.699-1.007z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M7.84 1.804A1.75 1.75 0 019.5 1h1a1.75 1.75 0 011.66.804l.365.622a1.75 1.75 0 001.267.837l.709.117A1.75 1.75 0 0116 5.11v.78c0 .459.18.9.5 1.228l.49.502a1.75 1.75 0 010 2.46l-.49.502A1.75 1.75 0 0016 11.81v.78a1.75 1.75 0 01-1.499 1.73l-.709.117a1.75 1.75 0 00-1.267.837l-.365.622A1.75 1.75 0 0110.5 17h-1a1.75 1.75 0 01-1.66-.804l-.365-.622a1.75 1.75 0 00-1.267-.837l-.709-.117A1.75 1.75 0 014 12.59v-.78c0-.459-.18-.9-.5-1.228l-.49-.502a1.75 1.75 0 010-2.46l.49-.502c.32-.328.5-.769.5-1.228v-.78A1.75 1.75 0 015.499 3.38l.709-.117a1.75 1.75 0 001.267-.837l.365-.622zM10 12.25A2.25 2.25 0 1010 7.75a2.25 2.25 0 000 4.5z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M7.22 14.78a.75.75 0 001.06 0l4-4a.75.75 0 000-1.06l-4-4a.75.75 0 10-1.06 1.06L10.69 10l-3.47 3.72a.75.75 0 000 1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function SunIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10 4a.75.75 0 01.75.75V6a.75.75 0 01-1.5 0V4.75A.75.75 0 0110 4zM10 13.25a3.25 3.25 0 100-6.5 3.25 3.25 0 000 6.5zM15.25 9.25H16.5a.75.75 0 010 1.5h-1.25a.75.75 0 010-1.5zM3.5 9.25h1.25a.75.75 0 010 1.5H3.5a.75.75 0 010-1.5zM13.712 6.288a.75.75 0 011.06 0l.884.884a.75.75 0 11-1.06 1.06l-.884-.883a.75.75 0 010-1.061zM5.228 14.772a.75.75 0 011.06 0l.884.884a.75.75 0 11-1.06 1.06l-.884-.884a.75.75 0 010-1.06zM14.772 14.772a.75.75 0 010 1.06l-.884.884a.75.75 0 11-1.06-1.06l.883-.884a.75.75 0 011.061 0zM6.288 6.288a.75.75 0 010 1.06l-.883.884a.75.75 0 11-1.06-1.06l.883-.884a.75.75 0 011.06 0z" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M17.293 13.293A8 8 0 016.707 2.707a8 8 0 1010.586 10.586z" />
    </svg>
  );
}

function DeviceIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M4 4a2 2 0 00-2 2v6a2 2 0 002 2h4.25v1.5H6.5a.75.75 0 000 1.5h7a.75.75 0 000-1.5h-1.75V14H16a2 2 0 002-2V6a2 2 0 00-2-2H4zm0 1.5h12a.5.5 0 01.5.5v6a.5.5 0 01-.5.5H4a.5.5 0 01-.5-.5V6a.5.5 0 01.5-.5z" />
    </svg>
  );
}

function SectionTitle({ children, collapsed }) {
  if (collapsed) return null;

  return (
    <p className="px-3 pb-2 pt-5 text-[11px] font-bold uppercase tracking-[0.18em] text-slate-400">
      {children}
    </p>
  );
}

function NavItem({ to, icon, label, collapsed, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cx(
          "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
          collapsed && "justify-center",
          isActive
            ? "bg-slate-950 text-white shadow-sm"
            : "text-slate-600 hover:bg-slate-100 hover:text-slate-950"
        )
      }
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        {icon}
      </span>
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </NavLink>
  );
}

function NestedItem({ to, icon, label, collapsed, onClick }) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      title={label}
      className={({ isActive }) =>
        cx(
          "group flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
          collapsed && "justify-center px-2",
          isActive
            ? "bg-slate-900 text-white"
            : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        )
      }
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-slate-100 text-current">
        {icon}
      </span>
      {!collapsed ? <span className="truncate">{label}</span> : null}
    </NavLink>
  );
}

function ThemeOption({ value, currentTheme, label, description, icon, onClick }) {
  const isActive = currentTheme === value;

  return (
    <button
      type="button"
      onClick={() => onClick(value)}
      className={
        isActive
          ? "flex w-full items-center gap-3 rounded-xl border border-slate-900 bg-slate-900 px-3 py-3 text-left text-white"
          : "flex w-full items-center gap-3 rounded-xl border border-slate-200 px-3 py-3 text-left text-slate-700 hover:bg-slate-50"
      }
    >
      <span
        className={
          isActive
            ? "flex h-9 w-9 items-center justify-center rounded-lg bg-white/15"
            : "flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500"
        }
      >
        {icon}
      </span>

      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold">{label}</span>
        <span
          className={
            isActive
              ? "block text-xs text-slate-200"
              : "block text-xs text-slate-500"
          }
        >
          {description}
        </span>
      </span>

      {isActive ? (
        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-xs font-bold text-slate-900">
          ✓
        </span>
      ) : null}
    </button>
  );
}

function ProfileModule({
  user,
  tab,
  setTab,
  onLogout,
  onNavigateProfile,
  theme,
  setTheme,
}) {
  return (
    <div className="absolute bottom-24 left-3 right-3 z-20 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
      <div className="border-b border-slate-100 p-2">
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setTab("profile")}
            className={cx(
              "rounded-xl px-3 py-2 text-sm font-semibold transition",
              tab === "profile"
                ? "bg-slate-950 text-white"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            Profile
          </button>

          <button
            type="button"
            onClick={() => setTab("settings")}
            className={cx(
              "rounded-xl px-3 py-2 text-sm font-semibold transition",
              tab === "settings"
                ? "bg-slate-950 text-white"
                : "text-slate-600 hover:bg-slate-100"
            )}
          >
            Settings
          </button>
        </div>
      </div>

      <div className="p-4">
        {tab === "profile" ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-lg font-bold text-slate-700">
                {(user?.full_name || user?.email || "U").charAt(0).toUpperCase()}
              </div>

              <div className="min-w-0">
                <h3 className="truncate text-sm font-bold text-slate-900">
                  {user?.full_name || "User"}
                </h3>
                <p className="truncate text-xs text-slate-500">
                  {user?.email || ""}
                </p>
                <p className="mt-1 inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold capitalize text-slate-600">
                  {(user?.role || "user").replace("_", " ")}
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <button
                type="button"
                onClick={onNavigateProfile}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <span className="flex items-center gap-2">
                  <ProfileIcon />
                  View Profile
                </span>
                <ChevronRightIcon />
              </button>

              <button
                type="button"
                onClick={() => setTab("settings")}
                className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <span className="flex items-center gap-2">
                  <SettingsIcon />
                  Settings
                </span>
                <ChevronRightIcon />
              </button>

              <button
                type="button"
                onClick={onLogout}
                className="flex w-full items-center justify-between rounded-xl border border-red-200 px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                <span className="flex items-center gap-2">
                  {/* <LogoutIcon /> */}
                  Logout
                </span>
                {/* <ChevronRightIcon /> */}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <ThemeOption
              value="light"
              currentTheme={theme}
              label="Light Mode"
              description="Use a bright interface."
              icon={<SunIcon />}
              onClick={setTheme}
            />

            <ThemeOption
              value="dark"
              currentTheme={theme}
              label="Dark Mode"
              description="Use a darker interface."
              icon={<MoonIcon />}
              onClick={setTheme}
            />

            <ThemeOption
              value="device"
              currentTheme={theme}
              label="Device"
              description="Follow your system setting."
              icon={<DeviceIcon />}
              onClick={setTheme}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function SidebarContent({
  collapsed,
  onNavigate,
  onToggleCollapse,
  isMobile = false,
}) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [projects, setProjects] = useState([]);
  const [teams, setTeams] = useState([]);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingTeams, setIsLoadingTeams] = useState(false);

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileTab, setProfileTab] = useState("profile");
  const [theme, setTheme] = useState(getInitialTheme);

  const profileRef = useRef(null);

  const canManageProjects =
    user?.role === "admin" || user?.role === "team_manager";

  const canManageUsers =
    user?.role === "admin" || user?.role === "team_manager";

  const canManageTeams = user?.role === "admin";

  const canViewTeams =
    user?.role === "admin" || user?.role === "team_manager";

  const isTeamMember = user?.role === "team_member";

  useEffect(() => {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
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

  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  async function loadProjects() {
    if (!canManageProjects) {
      setProjects([]);
      return;
    }

    try {
      setIsLoadingProjects(true);
      const data = await projectApi.list();
      setProjects(data);
    } catch {
      setProjects([]);
    } finally {
      setIsLoadingProjects(false);
    }
  }

  async function loadTeams() {
    if (!canViewTeams) {
      setTeams([]);
      return;
    }

    try {
      setIsLoadingTeams(true);
      const data = await teamApi.list();
      setTeams(data);
    } catch {
      setTeams([]);
    } finally {
      setIsLoadingTeams(false);
    }
  }

  useEffect(() => {
    loadTeams();

    function handleTeamsChanged() {
      loadTeams();
    }

    window.addEventListener("teams-changed", handleTeamsChanged);

    return () => {
      window.removeEventListener("teams-changed", handleTeamsChanged);
    };
  }, [canViewTeams]);

  useEffect(() => {
    loadProjects();

    function handleProjectsChanged() {
      loadProjects();
    }

    window.addEventListener("projects-changed", handleProjectsChanged);

    return () => {
      window.removeEventListener("projects-changed", handleProjectsChanged);
    };
  }, [canManageProjects]);

  function handleNavigateProfile() {
    setProfileOpen(false);
    onNavigate?.();
    navigate("/profile");
  }

  function handleLogout() {
   setProfileOpen(false);
   console.log('handle-logout',true);
    navigate("/logout", { replace: true });
  }

  function handleClickNav() {
    onNavigate?.();
    setProfileOpen(false);
  }

  const sidebarAvatarText = (user?.full_name || user?.email || "U")
    .charAt(0)
    .toUpperCase();

  return (
    <div className="flex h-full flex-col bg-white">
      <div
        className={cx(
          "flex items-start border-b border-slate-100 px-4 py-5",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        {!collapsed ? (
          <>
            <div>
              <h1 className="text-[28px] font-extrabold leading-none tracking-tight text-slate-950">
                Task Manager
              </h1>
              <p className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold capitalize text-slate-500">
                {(user?.role || "user").replace("_", " ")}
              </p>
            </div>

            {!isMobile ? (
              <button
                type="button"
                onClick={onToggleCollapse}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <MenuIcon />
              </button>
            ) : null}
          </>
        ) : (
          <button
            type="button"
            onClick={onToggleCollapse}
            className="flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white"
            title="Expand sidebar"
          >
            <MenuIcon />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-4">
        <nav className="space-y-1">
          <SectionTitle collapsed={collapsed}>Main</SectionTitle>

          <NavItem
            to="/dashboard"
            icon={<DashboardIcon />}
            label="Dashboard"
            collapsed={collapsed}
            onClick={handleClickNav}
          />

          <NavItem
            to="/tasks"
            icon={<TasksIcon />}
            label="Tasks"
            collapsed={collapsed}
            onClick={handleClickNav}
          />

          {canManageUsers ? (
            <NavItem
              to="/users"
              icon={<UsersIcon />}
              label="Users"
              collapsed={collapsed}
              onClick={handleClickNav}
            />
          ) : null}

          {canViewTeams ? (
            <>
              <SectionTitle collapsed={collapsed}>Teams</SectionTitle>

              {canManageTeams ? (
                <NavItem
                  to="/teams"
                  icon={<TeamsIcon />}
                  label="Teams"
                  collapsed={collapsed}
                  onClick={handleClickNav}
                />
              ) : (
                <div
                  className={cx(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-slate-700",
                    collapsed && "justify-center"
                  )}
                  title="Teams"
                >
                  <TeamsIcon />
                  {!collapsed ? <span>Teams</span> : null}
                </div>
              )}

              <div className={cx("space-y-1", !collapsed && "pl-3")}>
                {isLoadingTeams && !collapsed ? (
                  <p className="px-3 py-2 text-xs text-slate-400">
                    Loading teams...
                  </p>
                ) : null}

                {!isLoadingTeams && teams.length === 0 && !collapsed ? (
                  <p className="px-3 py-2 text-xs text-slate-400">
                    No teams yet
                  </p>
                ) : null}

                {teams.map((team) => (
                  <NestedItem
                    key={team.id}
                    to={`/teams/${team.id}`}
                    icon={<TeamsIcon />}
                    label={team.name}
                    collapsed={collapsed}
                    onClick={handleClickNav}
                  />
                ))}
              </div>
            </>
          ) : null}

          {canManageProjects ? (
            <>
              <SectionTitle collapsed={collapsed}>Projects</SectionTitle>

              <NavItem
                to="/projects"
                icon={<ProjectsIcon />}
                label="Projects"
                collapsed={collapsed}
                onClick={handleClickNav}
              />

              <div className={cx("space-y-1", !collapsed && "pl-3")}>
                {isLoadingProjects && !collapsed ? (
                  <p className="px-3 py-2 text-xs text-slate-400">
                    Loading projects...
                  </p>
                ) : null}

                {!isLoadingProjects && projects.length === 0 && !collapsed ? (
                  <p className="px-3 py-2 text-xs text-slate-400">
                    No projects yet
                  </p>
                ) : null}

                {projects.map((project) => (
                  <NestedItem
                    key={project.id}
                    to={`/projects/${project.id}`}
                    icon={<ProjectsIcon />}
                    label={project.name}
                    collapsed={collapsed}
                    onClick={handleClickNav}
                  />
                ))}
              </div>
            </>
          ) : null}

          {!isTeamMember ? (
            <>
              <SectionTitle collapsed={collapsed}>Automation</SectionTitle>

              <NavItem
                to="/integrations"
                icon={<IntegrationsIcon />}
                label="Integrations"
                collapsed={collapsed}
                onClick={handleClickNav}
              />
            </>
          ) : null}
        </nav>
      </div>

      <div ref={profileRef} className="relative border-t border-slate-100 p-3 bg-black">
        {profileOpen && !collapsed ? (
          <ProfileModule
            user={user}
            tab={profileTab}
            setTab={setProfileTab}
            onLogout={handleLogout}
            onNavigateProfile={handleNavigateProfile}
            theme={theme}
            setTheme={setTheme}
          />
        ) : null}

        <button
          type="button"
          onClick={() => {
            if (collapsed) {
              setProfileOpen(false);
              navigate("/profile");
              onNavigate?.();
              return;
            }

            setProfileOpen((current) => !current);
          }}
          className={cx(
            "flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:bg-slate-100",
            collapsed && "justify-center px-2"
          )}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-500 text-sm font-bold text-white">
            {sidebarAvatarText}
          </div>

          {!collapsed ? (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-bold text-slate-900">
                  {user?.full_name || "User Name"}
                </p>
                <p className="truncate text-xs text-slate-500 capitalize">
                  {(user?.role || "user").replace("_", " ")}
                </p>
              </div>

              <ChevronRightIcon />
            </>
          ) : null}
        </button>
      </div>
    </div>
  );
}

export default function Sidebar({ onCollapseChange }) {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  function toggleCollapse() {
    setCollapsed((current) => {
      const next = !current;
      onCollapseChange?.(next);
      return next;
    });
  }

  return (
    <>
      <div className="sticky top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur lg:hidden">
        <div>
          <h1 className="text-base font-extrabold text-slate-950">
            Task Manager
          </h1>
          <p className="text-xs text-slate-500">Automated tasks</p>
        </div>

        <button
          type="button"
          onClick={() => setIsMobileOpen(true)}
          className="rounded-xl border border-slate-200 bg-white p-2 text-slate-700 shadow-sm"
        >
          <MenuIcon />
        </button>
      </div>

      <aside
        className={cx(
          "fixed inset-y-0 left-0 z-30 hidden border-r border-slate-200 bg-white shadow-sm transition-all duration-300 lg:block",
          collapsed ? "w-20" : "w-72"
        )}
      >
        <SidebarContent
          collapsed={collapsed}
          onNavigate={() => {}}
          onToggleCollapse={toggleCollapse}
        />
      </aside>

      {isMobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            onClick={() => setIsMobileOpen(false)}
          />

        <aside className="fixed inset-y-0 left-0 z-40 w-72 border-r border-slate-200 bg-white/95 backdrop-blur">
            <div className="absolute right-3 top-3 z-10">
              <button
                type="button"
                onClick={() => setIsMobileOpen(false)}
                className="rounded-xl p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              >
                <CloseIcon />
              </button>
            </div>

            <SidebarContent
              collapsed={false}
              onNavigate={() => setIsMobileOpen(false)}
              onToggleCollapse={() => {}}
              isMobile
            />
          </aside>
        </div>
      ) : null}
    </>
  );
}