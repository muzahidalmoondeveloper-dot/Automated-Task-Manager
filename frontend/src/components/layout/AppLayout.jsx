import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet } from "react-router-dom";

import { notificationApi } from "../../api/notificationApi";
import { useAuth } from "../../context/AuthContext";
import CelebrationOverlay from "../CelebrationOverlay";
import Navbar from "./Navbar";
import Sidebar from "./Sidebar";
import ChatWidget from "../chat/ChatWidget";

const POLL_INTERVAL_MS = 15_000;

export default function AppLayout() {
  const { user } = useAuth();
  const [celebrationTaskName, setCelebrationTaskName] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const seenIdsRef = useRef(new Set());

  const pollNotifications = useCallback(async () => {
    if (!user) return;

    try {
      const notifications = await notificationApi.listUnread();
      const approvals = notifications.filter((n) => n.type === "task_approved");

      for (const n of approvals) {
        if (seenIdsRef.current.has(n.id)) continue;

        seenIdsRef.current.add(n.id);
        await notificationApi.markRead(n.id);

        const match = n.message.match(/^Your task '(.+)' was approved\.$/);
        setCelebrationTaskName(match ? match[1] : n.title);
        break;
      }
    } catch {
      // silent — polling failures shouldn't disrupt the UI
    }
  }, [user]);

  useEffect(() => {
    pollNotifications();
    const id = setInterval(pollNotifications, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [pollNotifications]);

  return (
    <div className="min-h-screen bg-slate-100">
      <Sidebar onCollapseChange={setSidebarCollapsed} />

      <div
        className={`min-h-screen transition-all duration-300 ${
          sidebarCollapsed ? "lg:pl-20" : "lg:pl-72"
        }`}
      >
        <Navbar />

        <main className="px-4 py-6 sm:px-6 lg:px-8">
          <div className="mx-auto w-full max-w-[1700px]">
            <Outlet />
          </div>
        </main>
      </div>

      <ChatWidget />

      {celebrationTaskName !== null && (
        <CelebrationOverlay
          taskName={celebrationTaskName}
          onDismiss={() => setCelebrationTaskName(null)}
        />
      )}
    </div>
  );
}
