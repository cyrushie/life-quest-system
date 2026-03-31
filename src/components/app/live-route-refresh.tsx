"use client";

import { startTransition, useEffect, useEffectEvent, useRef } from "react";
import { useRouter } from "next/navigation";

export function LiveRouteRefresh({
  intervalMs = 8000,
}: {
  intervalMs?: number;
}) {
  const router = useRouter();
  const lastRefreshAt = useRef(0);

  const refresh = useEffectEvent(() => {
    if (typeof document !== "undefined" && document.visibilityState !== "visible") {
      return;
    }

    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return;
    }

    const now = Date.now();

    if (now - lastRefreshAt.current < 1500) {
      return;
    }

    lastRefreshAt.current = now;
    startTransition(() => {
      router.refresh();
    });
  });

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      refresh();
    }, intervalMs);

    const handleFocus = () => {
      refresh();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [intervalMs]);

  return null;
}
