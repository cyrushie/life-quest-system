"use client";

import { startTransition, useEffect, useEffectEvent, useRef } from "react";
import { useRouter } from "next/navigation";

import { subscribeToAppSync } from "@/lib/client/app-sync";

export function AppSyncListener() {
  const router = useRouter();
  const lastRefreshAt = useRef(0);
  const refreshPending = useRef(false);

  const refresh = useEffectEvent(() => {
    const now = Date.now();

    if (now - lastRefreshAt.current < 1500) {
      return;
    }

    lastRefreshAt.current = now;
    refreshPending.current = false;

    startTransition(() => {
      router.refresh();
    });
  });

  useEffect(() => {
    const unsubscribe = subscribeToAppSync(() => {
      if (document.visibilityState === "visible") {
        refresh();
      } else {
        refreshPending.current = true;
      }
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && refreshPending.current) {
        refresh();
      }
    };

    const handleFocus = () => {
      if (refreshPending.current) {
        refresh();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);

    return () => {
      unsubscribe();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return null;
}
