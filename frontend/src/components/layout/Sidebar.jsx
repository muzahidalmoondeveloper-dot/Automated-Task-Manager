import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../../context/AuthContext";
import { projectApi } from "../../api/projectApi";
import { teamApi } from "../../api/teamApi";
import OrgSwitcher from "../OrgSwitcher";

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

function ScoreboardIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path d="M3 13a1 1 0 011-1h1a1 1 0 011 1v4a1 1 0 01-1 1H4a1 1 0 01-1-1v-4zM8 9a1 1 0 011-1h1a1 1 0 011 1v8a1 1 0 01-1 1H9a1 1 0 01-1-1V9zM14 5a1 1 0 011-1h1a1 1 0 011 1v12a1 1 0 01-1 1h-1a1 1 0 01-1-1V5z" />
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


function OrganizationIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M4 16.5v-13h-.25a.75.75 0 010-1.5h12.5a.75.75 0 010 1.5H16v13h.25a.75.75 0 010 1.5h-3.5a.75.75 0 01-.75-.75v-2.5a.75.75 0 00-.75-.75h-2.5a.75.75 0 00-.75.75v2.5a.75.75 0 01-.75.75h-3.5a.75.75 0 010-1.5H4zm3-11a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-4.5A.75.75 0 017 5.5zm0 4a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-4.5A.75.75 0 017 9.5z" clipRule="evenodd" />
    </svg>
  );
}

function CoreValuesIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
    </svg>
  );
}

function OrgChartIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
      <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v1h8v-1zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-1a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v1h-3zM4.75 12.094A5.973 5.973 0 004 15v1H1v-1a3 3 0 013.75-2.906z" />
    </svg>
  );
}

function ObjectivesIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clipRule="evenodd" />
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

function OrgNestedItem({ to, tabValue, icon, label, collapsed, onClick }) {
  const location = useLocation();
  const isActive =
    location.pathname === "/organization" &&
    location.search.includes(`tab=${tabValue}`);

  return (
    <NavLink
      to={to}
      onClick={onClick}
      title={label}
      className={() =>
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

// ─── Team sub-tab icons ───────────────────────────────────────────────────────

function NewsIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M2 5a2 2 0 012-2h8a2 2 0 012 2v10a2 2 0 002 2H4a2 2 0 01-2-2V5zm3 1h6v4H5V6zm6 6H5v2h6v-2z" clipRule="evenodd" />
      <path d="M15 7h1a2 2 0 012 2v5.5a1.5 1.5 0 01-3 0V7z" />
    </svg>
  );
}

function RocksIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M10 1l2.928 6.057L20 8.07l-5 4.952L16.18 20 10 16.785 3.82 20 5 13.022 0 8.07l7.072-1.013L10 1z" clipRule="evenodd" />
    </svg>
  );
}

function KPIsIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M12 7a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0V8.414l-4.293 4.293a1 1 0 01-1.414 0L8 10.414l-4.293 4.293a1 1 0 01-1.414-1.414l5-5a1 1 0 011.414 0L11 10.586 14.586 7H12z" clipRule="evenodd" />
    </svg>
  );
}

function TodosIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
      <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z" />
    </svg>
  );
}

function IssuesIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
    </svg>
  );
}

function MeetingsIcon() {
  return (
    <svg className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5.75 2a.75.75 0 01.75.75V4h7V2.75a.75.75 0 011.5 0V4h.25A2.75 2.75 0 0118 6.75v8.5A2.75 2.75 0 0115.25 18H4.75A2.75 2.75 0 012 15.25v-8.5A2.75 2.75 0 014.75 4H5V2.75A.75.75 0 015.75 2zm-1 5.5c0-.414.336-.75.75-.75h9a.75.75 0 010 1.5h-9A.75.75 0 014.75 7.5z" clipRule="evenodd" />
    </svg>
  );
}

const TEAM_TABS = [
  { id: "news",     label: "News",     icon: <NewsIcon /> },
  { id: "rocks",    label: "Rocks",    icon: <RocksIcon /> },
  { id: "kpis",     label: "KPIs",     icon: <KPIsIcon /> },
  { id: "todos",    label: "To-Dos",   icon: <TodosIcon /> },
  { id: "issues",   label: "Issues",   icon: <IssuesIcon /> },
  { id: "meetings", label: "Meetings", icon: <MeetingsIcon /> },
];

function ChevronDownIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
      <path fillRule="evenodd" d="M5.22 8.22a.75.75 0 011.06 0L10 11.94l3.72-3.72a.75.75 0 111.06 1.06l-4.25 4.25a.75.75 0 01-1.06 0L5.22 9.28a.75.75 0 010-1.06z" clipRule="evenodd" />
    </svg>
  );
}

function TeamSubItem({ to, tabId, teamId, icon, label, collapsed, onClick }) {
  const location = useLocation();
  const defaultTab = "news";
  const activeTab = new URLSearchParams(location.search).get("tab") || defaultTab;
  const isActive = location.pathname === `/teams/${teamId}` && activeTab === tabId;

  return (
    <NavLink
      to={to}
      onClick={onClick}
      title={label}
      className={() =>
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

function TeamSection({ team, collapsed, onClick }) {
  const location = useLocation();
  const isOnTeam = location.pathname === `/teams/${team.id}`;
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (isOnTeam) setExpanded(true);
  }, [location.pathname]);

  if (collapsed) {
    return (
      <NavLink
        to={`/teams/${team.id}?tab=news`}
        title={team.name}
        onClick={onClick}
        className={({ isActive }) =>
          cx(
            "flex items-center justify-center rounded-xl p-2.5 transition",
            isActive ? "bg-slate-950 text-white" : "text-slate-500 hover:bg-slate-100"
          )
        }
      >
        <TeamsIcon />
      </NavLink>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className={cx(
          "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition",
          isOnTeam ? "text-slate-900" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        )}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
          <TeamsIcon />
        </span>
        <span className="flex-1 truncate text-left">{team.name}</span>
        <span className={cx("shrink-0 text-slate-400 transition-transform", expanded && "rotate-180")}>
          <ChevronDownIcon />
        </span>
      </button>
      {expanded && (
        <div className="mt-0.5 space-y-0.5 pl-3">
          {TEAM_TABS.map((tab) => (
            <TeamSubItem
              key={tab.id}
              to={`/teams/${team.id}?tab=${tab.id}`}
              tabId={tab.id}
              teamId={team.id}
              icon={tab.icon}
              label={tab.label}
              collapsed={collapsed}
              onClick={onClick}
            />
          ))}
        </div>
      )}
    </div>
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
                  <LogoutIcon />
                  Logout
                </span>
                <ChevronRightIcon />
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
    user?.role === "owner" || user?.role === "admin" || user?.role === "team_manager";

  const canViewProjects = canManageProjects || user?.role === "project_manager";

  const canManageUsers =
    user?.role === "owner" || user?.role === "admin" || user?.role === "team_manager";

  const canManageTeams = user?.role === "owner" || user?.role === "admin";

  const canViewTeams =
    user?.role === "owner" ||
    user?.role === "admin" ||
    user?.role === "team_manager" ||
    user?.role === "project_manager";

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
    if (!canViewProjects) {
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
  }, [canViewProjects]);

  function handleNavigateProfile() {
    setProfileOpen(false);
    onNavigate?.();
    navigate("/profile");
  }

  function handleLogout() {
    setProfileOpen(false);
    logout();
    navigate("/login", { replace: true });
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

      <OrgSwitcher collapsed={collapsed} />

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
              to="/scoreboard"
              icon={<ScoreboardIcon />}
              label="Scoreboard"
              collapsed={collapsed}
              onClick={handleClickNav}
            />
          ) : null}

          {canManageUsers ? (
            <NavItem
              to="/users"
              icon={<UsersIcon />}
              label="Users"
              collapsed={collapsed}
              onClick={handleClickNav}
            />
          ) : null}

          <>
            <SectionTitle collapsed={collapsed}>Organization</SectionTitle>

            <NavItem
              to="/organization"
              icon={<OrganizationIcon />}
              label="Organization"
              collapsed={collapsed}
              onClick={handleClickNav}
            />

            <div className={cx("space-y-1", !collapsed && "pl-3")}>
              <OrgNestedItem
                to="/organization?tab=core-values"
                tabValue="core-values"
                icon={<CoreValuesIcon />}
                label="Core Values"
                collapsed={collapsed}
                onClick={handleClickNav}
              />
              <OrgNestedItem
                to="/organization?tab=org-chart"
                tabValue="org-chart"
                icon={<OrgChartIcon />}
                label="Org Chart"
                collapsed={collapsed}
                onClick={handleClickNav}
              />
              <OrgNestedItem
                to="/organization?tab=objectives"
                tabValue="objectives"
                icon={<ObjectivesIcon />}
                label="Objectives"
                collapsed={collapsed}
                onClick={handleClickNav}
              />
            </div>
          </>

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

              <div className={cx("space-y-1", !collapsed && "")}>
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
                  <TeamSection
                    key={team.id}
                    team={team}
                    collapsed={collapsed}
                    onClick={handleClickNav}
                  />
                ))}
              </div>
            </>
          ) : null}

          {canViewProjects ? (
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

      <div ref={profileRef} className="relative border-t border-slate-100 p-3">
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