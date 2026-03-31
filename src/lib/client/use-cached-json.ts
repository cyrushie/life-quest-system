"use client";

import { useEffect, useState } from "react";

const jsonCache = new Map<string, unknown>();
const cacheListeners = new Map<string, Set<(value: unknown) => void>>();

export function invalidateCachedJson(url: string) {
  jsonCache.delete(url);
}

export function setCachedJson<T>(url: string, value: T) {
  jsonCache.set(url, value);

  for (const listener of cacheListeners.get(url) ?? []) {
    listener(value);
  }
}

export function useCachedJson<T>(url: string, refreshKey?: string) {
  const [data, setData] = useState<T | null>(() => {
    const cached = jsonCache.get(url);
    return (cached as T) ?? null;
  });
  const [loading, setLoading] = useState(!jsonCache.has(url));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const listener = (value: unknown) => {
      if (!cancelled) {
        setData((value as T) ?? null);
        setLoading(false);
        setError(null);
      }
    };

    const listenersForUrl = cacheListeners.get(url) ?? new Set<(value: unknown) => void>();
    listenersForUrl.add(listener);
    cacheListeners.set(url, listenersForUrl);

    async function load() {
      if (!jsonCache.has(url)) {
        setLoading(true);
      }

      try {
        const response = await fetch(url, {
          credentials: "same-origin",
          cache: "no-store",
        });

        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }

        const json = (await response.json()) as T;
        setCachedJson(url, json);

        if (!cancelled) {
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
      const currentListeners = cacheListeners.get(url);

      if (!currentListeners) {
        return;
      }

      currentListeners.delete(listener);

      if (!currentListeners.size) {
        cacheListeners.delete(url);
      }
    };
  }, [refreshKey, url]);

  return { data, loading, error };
}
