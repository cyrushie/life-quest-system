"use client";

import { useEffect, useState, useTransition } from "react";
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

export function NotificationsPageClient({ refreshKey }: { refreshKey: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [localRefreshKey, setLocalRefreshKey] = useState(refreshKey);
  const { data, loading, error } = useCachedJson<NotificationsData>(
    NOTIFICATIONS_API_URL,
    localRefreshKey,
  );

  useEffect(() => {
    const refresh = () => {
      invalidateCachedJson(NOTIFICATIONS_API_URL);
      setLocalRefreshKey(createSafeId());
    };

    const unsubscribe = subscribeToAppSync(() => {
      refresh();
    });
    const intervalId = window.setInterval(() => {
      refresh();
    }, 12000);
    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };
    const handleFocus = () => {
      refresh();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    return () => {
      unsubscribe();
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  const safeData =
    data ?? {
      unreadCount: 0,
      notifications: [],
      system: [],
    };

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
      return;
    }

    router.push(item.href);
  }

  if (loading && !data) {
    return <section className="quest-panel h-80 animate-pulse bg-white/[0.03]" />;
  }

  if (error || !data) {
    return (
      <section className="quest-panel">
        <p className="text-sm text-rose-200">{error ?? "Failed to load notifications."}</p>
      </section>
    );
  }

  return (
    <section className="quest-panel">
      <NotificationFeed
        busy={isPending}
        data={safeData}
        mode="page"
        onMarkAllRead={handleMarkAllRead}
        onOpenItem={handleOpenItem}
      />
    </section>
  );
}
