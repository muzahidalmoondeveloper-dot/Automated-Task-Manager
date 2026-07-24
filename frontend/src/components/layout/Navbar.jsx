import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { notificationApi } from "../../api/notificationApi";
import { useAuth } from "../../context/AuthContext";

const TYPE_META = {
  task_assigned:            { icon: "📋", label: "Assigned"      },
  task_approved:            { icon: "✅", label: "Approved"      },
  task_review:              { icon: "🔍", label: "Review"        },
  task_assigned_back:       { icon: "↩️", label: "Reassigned"    },
  task_due_soon:            { icon: "⏰", label: "Due Soon"      },
  task_overdue:             { icon: "⚠️", label: "Overdue"       },
  task_request_submitted:   { icon: "📨", label: "Task Request"  },
  task_request_approved:    { icon: "✅", label: "Request Approved" },
  task_request_rejected:    { icon: "🚫", label: "Request Declined" },
};

function timeAgo(dateStr) {
  if (!dateStr) return "";
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function BellIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function TrashIcon({ className }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

export default function Navbar({ unreadCount = 0, onUnreadCountChange, onUnreadCountReset }) {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isLoadingNotifs, setIsLoadingNotifs] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  async function openBell() {
    const opening = !isOpen;
    setIsOpen(opening);

    if (opening) {
      setIsLoadingNotifs(true);
      try {
        const data = await notificationApi.list(30);
        setNotifications(data);
      } catch {
        // silent
      } finally {
        setIsLoadingNotifs(false);
      }
    }
  }

  async function handleMarkRead(notification) {
    if (notification.is_read) return;
    try {
      await notificationApi.markRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      );
      onUnreadCountChange?.(-1);
    } catch {
      // silent
    }
  }

  async function handleMarkAllRead() {
    try {
      await notificationApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      onUnreadCountReset?.();
    } catch {
      // silent
    }
  }

  async function handleDelete(notification, event) {
    event.stopPropagation();
    try {
      await notificationApi.remove(notification.id);
      setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
      if (!notification.is_read) onUnreadCountChange?.(-1);
    } catch {
      // silent
    }
  }

  async function handleClearAll() {
    try {
      await notificationApi.clearAll();
      setNotifications([]);
      onUnreadCountReset?.();
    } catch {
      // silent
    }
  }

  function handleNotificationClick(n) {
    handleMarkRead(n);
    setIsOpen(false);
    if (n.project_id) {
      navigate(user?.role === "client" ? `/client/projects/${n.project_id}` : `/projects/${n.project_id}`);
    } else if (n.task_id) {
      navigate("/tasks");
    }
  }

  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-white">
      <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <div>
          <p className="text-sm font-medium text-slate-900">Automated Task Manager</p>
          <p className="text-xs text-slate-500">Meeting action items to tasks</p>
        </div>

        <div className="flex items-center gap-3">
          {/* ── Notification bell ───────────────────────────────────────── */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={openBell}
              aria-label="Notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900"
            >
              <BellIcon className="h-5 w-5" />
              {unreadCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>

            {isOpen && (
              <div className="absolute right-0 top-11 z-50 w-80 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl sm:w-96">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                  <h3 className="text-sm font-semibold text-slate-900">
                    Notifications
                    {unreadCount > 0 && (
                      <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-600">
                        {unreadCount} new
                      </span>
                    )}
                  </h3>
                  <div className="flex items-center gap-3">
                    {unreadCount > 0 && (
                      <button
                        type="button"
                        onClick={handleMarkAllRead}
                        className="text-xs font-medium text-slate-500 hover:text-slate-900"
                      >
                        Mark all read
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button
                        type="button"
                        onClick={handleClearAll}
                        className="text-xs font-medium text-slate-500 hover:text-red-600"
                      >
                        Clear all
                      </button>
                    )}
                  </div>
                </div>

                {/* List */}
                <div className="max-h-[360px] overflow-y-auto divide-y divide-slate-50">
                  {isLoadingNotifs ? (
                    <div className="px-4 py-8 text-center text-sm text-slate-400">
                      Loading…
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="px-4 py-10 text-center">
                      <BellIcon className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                      <p className="text-sm text-slate-500">No notifications yet</p>
                    </div>
                  ) : (
                    notifications.map((n) => {
                      const meta = TYPE_META[n.type] || { icon: "🔔", label: "" };
                      return (
                        <div
                          key={n.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => handleNotificationClick(n)}
                          onKeyDown={(e) => e.key === "Enter" && handleNotificationClick(n)}
                          className={`group flex w-full cursor-pointer items-start gap-2 px-4 py-3 text-left transition hover:bg-slate-50 ${
                            !n.is_read ? "bg-blue-50/50" : "bg-white"
                          }`}
                        >
                          <span className="mt-0.5 shrink-0 text-base leading-none">
                            {meta.icon}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="truncate text-xs font-semibold text-slate-800">
                                {n.title}
                              </p>
                              {meta.label && (
                                <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-500">
                                  {meta.label}
                                </span>
                              )}
                            </div>
                            <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                              {n.message}
                            </p>
                            <p className="mt-1 text-[10px] text-slate-400">
                              {timeAgo(n.created_at)}
                            </p>
                          </div>
                          {!n.is_read && (
                            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-blue-500" />
                          )}
                          <button
                            type="button"
                            onClick={(e) => handleDelete(n, e)}
                            aria-label="Delete notification"
                            className="shrink-0 rounded-md p-1 text-slate-300 opacity-0 transition hover:bg-slate-200 hover:text-red-600 group-hover:opacity-100"
                          >
                            <TrashIcon className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>

                {notifications.length > 0 && (
                  <div className="border-t border-slate-100 px-4 py-2 text-center">
                    <p className="text-xs text-slate-400">
                      Showing last {notifications.length} notification{notifications.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
}
