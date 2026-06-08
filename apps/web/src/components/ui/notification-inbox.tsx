"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, X } from "lucide-react";
import { api } from "@/lib/api";
import type { NotificationDto } from "@sk-mobile/shared";

function formatWhen(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString();
}

function typeLabel(type: NotificationDto["type"]) {
  switch (type) {
    case "LOW_STOCK":
      return "Stock";
    case "REPAIR_PICKUP":
      return "Pickup";
    case "REPAIR_RECEIVED":
      return "Repair";
    default:
      return "Alert";
  }
}

export function NotificationInbox() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.getNotifications(1, 30),
    refetchInterval: 60_000,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markAll = useMutation({
    mutationFn: () => api.markAllNotificationsRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const unread = data?.meta.unreadCount ?? 0;
  const items = data?.data ?? [];

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  return (
    <div className="notif-bell-wrap" ref={panelRef}>
      <button
        type="button"
        className="dash-icon-btn secondary"
        aria-label="Notifications"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="notif-badge" aria-label={`${unread} unread`}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="notif-panel card">
          <div className="notif-panel-header">
            <div>
              <strong>Notifications</strong>
              {unread > 0 && <span className="notif-panel-sub">{unread} unread</span>}
            </div>
            <div className="notif-panel-actions">
              {unread > 0 && (
                <button
                  type="button"
                  className="notif-mark-all"
                  onClick={() => markAll.mutate()}
                  disabled={markAll.isPending}
                  title="Mark all read"
                >
                  <CheckCheck size={16} />
                </button>
              )}
              <button
                type="button"
                className="notif-mark-all"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          <div className="notif-list">
            {items.length === 0 ? (
              <p className="notif-empty">No notifications yet</p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  className={`notif-item${n.readAt ? "" : " unread"}`}
                  onClick={() => {
                    if (!n.readAt) markRead.mutate(n.id);
                  }}
                >
                  <div className="notif-item-top">
                    <span className="notif-type">{typeLabel(n.type)}</span>
                    <span className="notif-when">{formatWhen(n.createdAt)}</span>
                  </div>
                  <strong>{n.title}</strong>
                  <p>{n.body}</p>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
