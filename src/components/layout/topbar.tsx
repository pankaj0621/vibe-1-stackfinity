"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Car, CheckCheck, User as UserIcon } from "lucide-react";
import { AVATARS } from "@/lib/utils/formatters";
import { notifyLiveUpdate, useLiveRefresh } from "@/lib/hooks/use-live-refresh";
import { SessionUser, UserNotification } from "@/types/domain.types";
import { fetchApi, getApiErrorMessage } from "@/lib/api/client";

interface TopBarProps {
  currentUser?: SessionUser | null;
}

interface NotificationResponse {
  items: UserNotification[];
  unreadCount: number;
}

export function TopBar({ currentUser }: TopBarProps) {
  const pathname = usePathname();
  const [notifications, setNotifications] = useState<NotificationResponse>({ items: [], unreadCount: 0 });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationError, setNotificationError] = useState("");
  const hasLoadedNotifications = useRef(false);

  const getPageMeta = () => {
    switch (pathname) {
      case "/rider":
        return ["Rider Dispatch", "Accept, pick up and drop"];
      case "/history":
        return ["Trip History", "Everything the Toto has done"];
      case "/track":
        return ["Live Tracking", "Real-time interactive Toto GPS tracking"];
      case "/admin":
        return ["Admin Control Room", "Manage people, bookings and fleet access"];
      case "/login":
        return ["Sign In", "Access campus mobility roles"];
      default:
        return ["Book a Ride", "Request the Toto for your group"];
    }
  };

  const [title, subtitle] = getPageMeta();
  const homeHref =
    currentUser?.role === "admin"
      ? "/admin"
      : currentUser?.role === "rider"
      ? "/rider"
      : "/request";

  const loadNotifications = useCallback(async () => {
    if (!currentUser) return;
    if (!hasLoadedNotifications.current) setNotificationsLoading(true);
    try {
      const json = await fetchApi<NotificationResponse>("/api/notifications", { cache: "no-store" }, "load notifications");
      if (!json.data) throw new Error("The server returned no notification data. Refresh and try again.");
      setNotifications(json.data);
      setNotificationError("");
    } catch (error) {
      setNotificationError(getApiErrorMessage(error, "Could not load notifications."));
    } finally {
      setNotificationsLoading(false);
      hasLoadedNotifications.current = true;
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setNotifications({ items: [], unreadCount: 0 });
      setNotificationError("");
      return;
    }
  }, [currentUser]);

  useLiveRefresh(loadNotifications, 5000);

  const markNotificationRead = async (id: string) => {
    try {
      await fetchApi("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      }, "mark notification as read");
      notifyLiveUpdate();
      await loadNotifications();
    } catch (error) {
      setNotificationError(getApiErrorMessage(error, "Could not mark the notification as read."));
    }
  };

  const markAllRead = async () => {
    try {
      await fetchApi("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markAllRead: true }),
      }, "mark notifications as read");
      notifyLiveUpdate();
      await loadNotifications();
    } catch (error) {
      setNotificationError(getApiErrorMessage(error, "Could not update notifications."));
    }
  };

  return (
    <header className="sticky top-0 z-40 border-b border-[#EADDC6]/80 bg-[#FFF8EC]/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1240px] items-center gap-2.5 px-3.5 py-3 sm:px-6 sm:py-3.5 lg:px-10">
        <Link href={homeHref} className="flex min-w-0 items-center gap-2.5 lg:hidden">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-ink text-sun">
            <Car size={18} />
          </div>
          <div className="min-w-0">
            <div className="truncate font-display text-[16px] leading-none text-ink">Lawazia</div>
            <div className="mt-0.5 text-[8.5px] font-semibold uppercase tracking-[0.16em] text-ink-500">Campus Transit</div>
          </div>
        </Link>

        <div className="hidden lg:block">
          <h1 className="font-display text-[19px] leading-none text-ink">{title}</h1>
          <p className="mt-1.5 text-[12px] text-ink-500">{subtitle}</p>
        </div>

        <div className="relative ml-auto flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => {
              const nextOpen = !notificationsOpen;
              setNotificationsOpen(nextOpen);
              if (nextOpen) void loadNotifications();
            }}
            className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#E5D5BA] bg-white text-ink-600 transition hover:border-sun hover:text-ink"
            aria-label={notifications.unreadCount ? `Notifications, ${notifications.unreadCount} unread` : "Notifications"}
            aria-expanded={notificationsOpen}
            aria-controls="notification-panel"
          >
            <Bell size={18} />
            {notifications.unreadCount > 0 && (
              <span className="absolute -right-1 -top-1 grid min-h-5 min-w-5 place-items-center rounded-full bg-coral px-1 text-[10px] font-bold text-white ring-2 ring-[#FFF8EC]">
                {notifications.unreadCount > 9 ? "9+" : notifications.unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <section
              id="notification-panel"
              aria-label="Notifications"
              className="absolute right-0 top-full z-[60] mt-3 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-[22px] border border-[#E7D9C1] bg-white shadow-[0_20px_60px_rgba(35,28,18,0.18)]"
            >
              <div className="flex items-center justify-between gap-3 border-b border-[#F0E6D5] px-4 py-3.5">
                <div>
                  <h2 className="font-display text-lg text-ink">Notifications</h2>
                  <p className="text-[11px] text-ink-500">{currentUser ? `${notifications.unreadCount} unread` : "Sign in to see updates"}</p>
                </div>
                {currentUser && notifications.unreadCount > 0 && (
                  <button type="button" onClick={() => void markAllRead()} className="inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2 py-1.5 text-[11px] font-bold text-[#8A5B00] hover:bg-sun-100">
                    <CheckCheck size={14} /> Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-[min(65vh,26rem)] overflow-y-auto overscroll-contain">
                {!currentUser ? (
                  <div className="px-5 py-8 text-center">
                    <UserIcon className="mx-auto text-ink-300" size={24} />
                    <p className="mt-2 text-sm font-semibold text-ink">Your updates are private</p>
                    <Link href="/login" onClick={() => setNotificationsOpen(false)} className="mt-3 inline-block text-xs font-bold text-[#8A5B00] hover:underline">Sign in to view notifications</Link>
                  </div>
                ) : notificationsLoading && notifications.items.length === 0 ? (
                  <p className="px-5 py-8 text-center text-sm text-ink-500">Loading your updates…</p>
                ) : notificationError ? (
                  <div className="px-5 py-7 text-center">
                    <p role="alert" className="text-sm text-coral">{notificationError}</p>
                    <button type="button" onClick={() => void loadNotifications()} className="mt-3 text-xs font-bold text-[#8A5B00] hover:underline">Try again</button>
                  </div>
                ) : notifications.items.length === 0 ? (
                  <div className="px-5 py-8 text-center">
                    <Bell className="mx-auto text-ink-300" size={24} />
                    <p className="mt-2 text-sm font-semibold text-ink">You’re all caught up</p>
                    <p className="mt-1 text-xs text-ink-500">Ride and trip updates will show here.</p>
                  </div>
                ) : (
                  notifications.items.map((notification) => (
                    <Link
                      key={notification.id}
                      href={notification.href || "/request"}
                      onClick={() => {
                        setNotificationsOpen(false);
                        if (!notification.readAt) void markNotificationRead(notification.id);
                      }}
                      className={`block border-b border-[#F4EBDD] px-4 py-3.5 transition hover:bg-[#FFF9EE] ${notification.readAt ? "bg-white" : "bg-[#FFF9EE]"}`}
                    >
                      <div className="flex gap-3">
                        <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${notification.readAt ? "bg-transparent" : "bg-coral"}`} aria-hidden="true" />
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-2">
                            <span className="text-[13px] font-bold leading-5 text-ink">{notification.title}</span>
                            <time className="shrink-0 pt-0.5 text-[10px] text-ink-400">{formatNotificationTime(notification.createdAt)}</time>
                          </span>
                          <span className="mt-1 block text-xs leading-5 text-ink-600">{notification.message}</span>
                        </span>
                      </div>
                    </Link>
                  ))
                )}
              </div>
            </section>
          )}

          <Link href="/login" className="flex min-w-0 items-center gap-2 rounded-full border border-[#E5D5BA] bg-white py-1.5 pl-1.5 pr-3 transition hover:border-sun">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={currentUser?.role === "rider" ? AVATARS[1] : AVATARS[0]} alt={currentUser?.name || "User"} className="h-7 w-7 shrink-0 rounded-full object-cover" />
            <span className="hidden max-w-32 truncate text-[12px] font-semibold text-ink sm:block">{currentUser?.name || "Sign In"}</span>
            {currentUser && <span className="rounded-full bg-sun-100 px-2 py-0.5 text-[10px] font-bold uppercase text-[#8A5B00]">{currentUser.role}</span>}
          </Link>
        </div>
      </div>
    </header>
  );
}

function formatNotificationTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-IN", { hour: "2-digit", minute: "2-digit" }).format(date);
}
