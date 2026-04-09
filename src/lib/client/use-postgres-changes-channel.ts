"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  getBrowserSupabaseRealtimeClient,
  getBrowserSupabaseRealtimeToken,
} from "@/lib/client/supabase-realtime";
import { type RealtimeConnectionState } from "@/lib/client/use-private-broadcast-channel";

type PostgresChangeSpec = {
  event: "*" | "INSERT" | "UPDATE" | "DELETE";
  schema: string;
  table: string;
  filter?: string;
};

type PostgresChangePayload = {
  eventType: PostgresChangeSpec["event"];
  table: string;
  schema: string;
  new: Record<string, unknown> | null;
  old: Record<string, unknown> | null;
};

export function usePostgresChangesChannel({
  channelName,
  changes,
  enabled = true,
  onMessage,
  onError,
}: {
  channelName: string | null;
  changes: PostgresChangeSpec[];
  enabled?: boolean;
  onMessage: (input: PostgresChangePayload) => void;
  onError?: (message: string) => void;
}) {
  const messageRef = useRef(onMessage);
  const errorRef = useRef(onError);
  const connectionStateRef = useRef<RealtimeConnectionState>(
    enabled && channelName && changes.length ? "connecting" : "idle",
  );
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>(
    enabled && channelName && changes.length ? "connecting" : "idle",
  );
  const [lastError, setLastError] = useState<string | null>(null);
  const changeKey = JSON.stringify(changes);
  const parsedChanges = useMemo(
    () => JSON.parse(changeKey || "[]") as PostgresChangeSpec[],
    [changeKey],
  );

  useEffect(() => {
    messageRef.current = onMessage;
    errorRef.current = onError;
  }, [onError, onMessage]);

  useEffect(() => {
    connectionStateRef.current = connectionState;
  }, [connectionState]);

  useEffect(() => {
    if (!enabled || !channelName || !parsedChanges.length) {
      return;
    }

    const currentChannelName = channelName;
    const supabase = getBrowserSupabaseRealtimeClient();
    let cancelled = false;
    let cleanupChannel: (() => void) | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | null = null;

    function clearRetryTimer() {
      if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
      }
    }

    function scheduleRetry(delayMs = 5000) {
      if (cancelled || retryTimer) {
        return;
      }

      setConnectionState("fallback");
      retryTimer = setTimeout(() => {
        retryTimer = null;
        void connect();
      }, delayMs);
    }

    async function connect() {
      if (connectionStateRef.current !== "fallback") {
        setConnectionState("connecting");
      }

      try {
        const token = await getBrowserSupabaseRealtimeToken();

        if (cancelled) {
          return;
        }

        await supabase.realtime.setAuth(token);
        setLastError(null);

        const channel = supabase.channel(currentChannelName);

        for (const change of parsedChanges) {
          channel.on(
            "postgres_changes",
            {
              event: change.event,
              schema: change.schema,
              table: change.table,
              filter: change.filter,
            },
            (payload) => {
              messageRef.current({
                eventType: change.event,
                table: change.table,
                schema: change.schema,
                new: (payload.new as Record<string, unknown> | null) ?? null,
                old: (payload.old as Record<string, unknown> | null) ?? null,
              });
            },
          );
        }

        channel.subscribe((status) => {
          if (cancelled) {
            return;
          }

          if (status === "SUBSCRIBED") {
            clearRetryTimer();
            setLastError(null);
            setConnectionState("live");
            return;
          }

          if (status === "CHANNEL_ERROR") {
            const message = `Realtime subscription failed for ${currentChannelName}.`;

            setLastError(message);
            errorRef.current?.(message);
            cleanupChannel?.();
            cleanupChannel = null;
            scheduleRetry();
            return;
          }

          if (status === "TIMED_OUT") {
            const message = `Realtime timed out for ${currentChannelName}.`;

            setLastError(message);
            errorRef.current?.(message);
            cleanupChannel?.();
            cleanupChannel = null;
            scheduleRetry(3000);
            return;
          }

          if (status === "CLOSED") {
            const message = `Realtime closed for ${currentChannelName}.`;

            setLastError(message);
            errorRef.current?.(message);
            cleanupChannel?.();
            cleanupChannel = null;
            scheduleRetry();
          }
        });

        cleanupChannel = () => {
          clearRetryTimer();
          void supabase.removeChannel(channel);
        };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Realtime subscription failed.";

        setLastError(message);
        errorRef.current?.(message);
        scheduleRetry();
      }
    }

    void connect();

    return () => {
      cancelled = true;
      clearRetryTimer();
      cleanupChannel?.();
    };
  }, [changeKey, channelName, enabled, parsedChanges]);

  if (!enabled || !channelName || !parsedChanges.length) {
    return {
      connectionState: "idle" as const,
      lastError: null,
    };
  }

  return {
    connectionState,
    lastError,
  };
}
