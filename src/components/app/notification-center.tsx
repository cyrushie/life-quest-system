"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  markAllNotificationsReadAction,
  markGuildBoardSeenAction,
  markNotificationReadAction,
} from "@/app/(app)/actions";
import {
  invalidateCachedJson,
  setCachedJson,
  useCachedJson,
} from "@/lib/client/use-cached-json";
import { broadcastAppSync, subscribeToAppSync } from "@/lib/client/app-sync";
import { createSafeId } from "@/lib/id";

import {
  NotificationFeed,
  type NotificationEventItem,
  type NotificationsData,
  type NotificationSystemItem,
} from "./notification-feed";

const NOTIFICATIONS_API_URL = "/api/app/notifications";

export function NotificationCenter() {
  const router = useRouter();
  const panelRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(() => createSafeId());
  const [isPending, startTransition] = useTransition();
  const { data, loading } = useCachedJson<NotificationsData>(NOTIFICATIONS_API_URL, refreshKey);

  const unreadCount = data?.unreadCount ?? 0;
  const safeData = useMemo<NotificationsData>(
    () =>
      data ?? {
        unreadCount: 0,
        notifications: [],
        system: [],
      },
    [data],
  );

  function refreshNotifications() {
    invalidateCachedJson(NOTIFICATIONS_API_URL);
    setRefreshKey(createSafeId());
  }

  useEffect(() => {
    const unsubscribe = subscribeToAppSync(() => {
      refreshNotifications();
    });
    const intervalId = window.setInterval(() => {
      refreshNotifications();
    }, 12000);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refreshNotifications();
      }
    };

    const handleFocus = () => {
      refreshNotifications();
    };

    const handlePointerDown = (event: MouseEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("mousedown", handlePointerDown);

    return () => {
      unsubscribe();
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("mousedown", handlePointerDown);
    };
  }, []);

  function updateLocalNotifications(next: NotificationsData) {
    setCachedJson(NOTIFICATIONS_API_URL, next);
  }

  function markOneLocally(notificationId: string) {
    updateLocalNotifications({
      ...safeData,
      unreadCount: Math.max(
        0,
        safeData.unreadCount -
          Number(safeData.notifications.some((item) => item.id === notificationId && !item.isRead)),
      ),
      notifications: safeData.notifications.map((item) =>
        item.id === notificationId ? { ...item, isRead: true } : item,
      ),
    });
  }

  function markGuildBoardNotificationsLocally() {
    const unreadGuildBoardCount = safeData.notifications.filter(
      (item) => item.type === "GUILD_MESSAGE" && item.href === "/guild?tab=board" && !item.isRead,
    ).length;

    updateLocalNotifications({
      ...safeData,
      unreadCount: Math.max(0, safeData.unreadCount - unreadGuildBoardCount),
      notifications: safeData.notifications.map((item) =>
        item.type === "GUILD_MESSAGE" && item.href === "/guild?tab=board"
          ? { ...item, isRead: true }
          : item,
      ),
    });
  }

  function markAllLocally() {
    updateLocalNotifications({
      ...safeData,
      unreadCount: 0,
      notifications: safeData.notifications.map((item) => ({ ...item, isRead: true })),
    });
  }

  function handleMarkAllRead() {
    markAllLocally();

    startTransition(async () => {
      await markAllNotificationsReadAction();
      broadcastAppSync("notifications-read-all");
      router.refresh();
    });
  }

  function handleOpenItem(item: NotificationEventItem | NotificationSystemItem) {
    if (item.kind === "event" && !item.isRead) {
      if (item.type === "GUILD_MESSAGE" && item.href === "/guild?tab=board") {
        markGuildBoardNotificationsLocally();

        startTransition(async () => {
          await markGuildBoardSeenAction();
          broadcastAppSync("guild-board-opened");
          router.push(item.href);
          router.refresh();
        });
        setIsOpen(false);
        return;
      }

      markOneLocally(item.id);

      startTransition(async () => {
        const formData = new FormData();
        formData.set("notificationId", item.id);
        await markNotificationReadAction(formData);
        broadcastAppSync("notification-opened");
        router.push(item.href);
        router.refresh();
      });
    } else {
      router.push(item.href);
    }

    setIsOpen(false);
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        aria-expanded={isOpen}
        aria-label="Open notifications"
        className="quest-button quest-button-secondary relative inline-flex min-w-[3.25rem] items-center justify-center px-3"
        onClick={() =>
          setIsOpen((current) => {
            const next = !current;

            if (next) {
              refreshNotifications();
            }

            return next;
          })
        }
        type="button"
      >
        <svg
          aria-hidden="true"
          className="h-[1.05rem] w-[1.05rem] text-stone-100"
          fill="none"
          viewBox="0 0 24 24"
        >
          <path
            d="M15 18H9M18 16V11C18 7.68629 15.3137 5 12 5C8.68629 5 6 7.68629 6 11V16L4.75 17.25V18H19.25V17.25L18 16ZM13.73 20C13.3832 20.5978 12.7367 21 12 21C11.2633 21 10.6168 20.5978 10.27 20H13.73Z"
            stroke="currentColor"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="1.7"
          />
        </svg>
        {unreadCount ? (
          <span className="absolute -right-1.5 -top-1.5 inline-flex min-h-[1.25rem] min-w-[1.25rem] items-center justify-center rounded-full bg-[#d6b77a] px-1 text-[0.68rem] font-semibold text-[#241b10]">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div className="absolute right-0 top-[calc(100%+0.75rem)] z-30 w-[min(94vw,28rem)] rounded-[1.15rem] border border-white/8 bg-[#120f0d]/95 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.42)] backdrop-blur">
          {loading && !data ? (
            <div className="rounded-[1rem] border border-white/6 bg-white/[0.025] px-4 py-8 text-sm text-stone-400">
              Loading notifications...
            </div>
          ) : (
            <>
              <NotificationFeed
                busy={isPending}
                data={safeData}
                mode="compact"
                onMarkAllRead={handleMarkAllRead}
                onOpenItem={handleOpenItem}
              />

              <div className="mt-4 flex justify-end">
                <button
                  className="quest-button quest-button-secondary"
                  onClick={() => {
                    setIsOpen(false);
                    router.push("/notifications");
                  }}
                  type="button"
                >
                  Open all
                </button>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
