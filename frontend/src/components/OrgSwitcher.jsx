import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { authApi } from "../api/authApi";
import { useAuth } from "../context/AuthContext";

function getInitials(name) {
  if (!name) return "?";
  const words = name.trim().split(/\s+/);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-slate-900" viewBox="0 0 20 20" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
      <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
    </svg>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path
        fillRule="evenodd"
        d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function OrgSwitcher({ collapsed }) {
  const { selectOrganization } = useAuth();
  const navigate = useNavigate();

  const [orgs, setOrgs] = useState([]);
  const [currentOrg, setCurrentOrg] = useState(null);
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(null);

  const containerRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    authApi
      .myOrganizations()
      .then((data) => {
        if (cancelled) return;
        setOrgs(data.organizations || []);
        const cur = (data.organizations || []).find((o) => o.is_current);
        setCurrentOrg(cur || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    if (!open) return;
    function handleOutside(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  async function handleSwitch(org) {
    if (org.is_current || switching) return;
    setSwitching(org.id);
    try {
      await selectOrganization(org.id);
      // Hard redirect to flush all tenant-scoped React state
      window.location.href = "/dashboard";
    } catch {
      setSwitching(null);
    }
  }

  function handleCreateOrg() {
    setOpen(false);
    navigate("/setup/organization");
  }

  if (!currentOrg && orgs.length === 0) return null;

  const display = currentOrg || orgs[0];
  const initials = display ? getInitials(display.name) : "?";

  // Collapsed: show only initials button with right-opening dropdown
  if (collapsed) {
    return (
      <div ref={containerRef} className="relative flex justify-center py-2">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white"
          title={display?.name || "Switch organization"}
        >
          {initials}
        </button>

        {open && (
          <div className="absolute left-full top-0 z-50 ml-2 w-60 rounded-xl border border-slate-200 bg-white shadow-lg">
            <OrgList
              orgs={orgs}
              switching={switching}
              onSwitch={handleSwitch}
              onCreateOrg={handleCreateOrg}
            />
          </div>
        )}
      </div>
    );
  }

  // Expanded sidebar
  return (
    <div ref={containerRef} className="relative px-3 py-2">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left hover:bg-slate-100"
      >
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-950 text-xs font-bold text-white">
          {initials}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">
            {display?.name || "Select org"}
          </p>
          {display?.role && (
            <p className="truncate text-xs capitalize text-slate-500">
              {display.role.replace(/_/g, " ")}
            </p>
          )}
        </div>

        <ChevronIcon open={open} />
      </button>

      {open && (
        <div className="absolute left-3 right-3 z-50 mt-1 rounded-xl border border-slate-200 bg-white shadow-lg">
          <OrgList
            orgs={orgs}
            switching={switching}
            onSwitch={handleSwitch}
            onCreateOrg={handleCreateOrg}
          />
        </div>
      )}
    </div>
  );
}

function OrgList({ orgs, switching, onSwitch, onCreateOrg }) {
  return (
    <>
      <ul className="max-h-64 overflow-y-auto py-1.5">
        {orgs.map((org) => (
          <li key={org.id}>
            <button
              type="button"
              disabled={!!switching}
              onClick={() => onSwitch(org)}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 disabled:opacity-60 ${
                org.is_current ? "cursor-default" : "cursor-pointer"
              }`}
            >
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-200 text-xs font-bold text-slate-700">
                {getInitials(org.name)}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-slate-900">
                  {org.name}
                  {switching === org.id && (
                    <span className="ml-1.5 text-xs font-normal text-slate-400">
                      switching…
                    </span>
                  )}
                </p>
                <p className="truncate text-xs capitalize text-slate-500">
                  {org.role.replace(/_/g, " ")}
                  {org.status === "pending_setup" && (
                    <span className="ml-1.5 normal-case text-amber-600">
                      · setup incomplete
                    </span>
                  )}
                </p>
              </div>

              {org.is_current && <CheckIcon />}
            </button>
          </li>
        ))}
      </ul>

      <div className="border-t border-slate-100 py-1.5">
        <button
          type="button"
          onClick={onCreateOrg}
          className="flex w-full items-center gap-2 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
        >
          <PlusIcon />
          Create organization
        </button>
      </div>
    </>
  );
}
