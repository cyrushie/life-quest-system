"use client";

import { useEffect, useRef, useState } from "react";

import {
  getBrowserSupabaseRealtimeClient,
  getBrowserSupabaseRealtimeToken,
} from "@/lib/client/supabase-realtime";

type BroadcastPayload = {
  event: string;
  payload: Record<string, unknown>;
};

export type RealtimeConnectionState = "idle" | "connecting" | "live" | "fallback";

export function combineRealtimeConnectionStates(
  ...states: RealtimeConnectionState[]
): RealtimeConnectionState {
  if (states.includes("fallback")) {
    return "fallback";
  }

  if (states.includes("connecting")) {
    return "connecting";
  }

  if (states.includes("live")) {
    return "live";
  }

  return "idle";
}

export function usePrivateBroadcastChannel({
  topic,
  eventNames,
  enabled = true,
  onMessage,
  onError,
}: {
  topic: string | null;
  eventNames: string[];
  enabled?: boolean;
  onMessage: (input: BroadcastPayload) => void;
  onError?: (message: string) => void;
}) {
  const messageRef = useRef(onMessage);
  const errorRef = useRef(onError);
  const eventKey = eventNames.join("|");
  const [connectionState, setConnectionState] = useState<RealtimeConnectionState>(
    enabled && topic && eventNames.length ? "connecting" : "idle",
  );
  const [lastError, setLastError] = useState<string | null>(null);

  useEffect(() => {
    messageRef.current = onMessage;
    errorRef.current = onError;
  }, [onError, onMessage]);

  useEffect(() => {
    if (!enabled || !topic || !eventKey) {
      return;
    }

    const currentTopic = topic;
    const currentEventNames = eventKey ? eventKey.split("|") : [];
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
      setConnectionState("connecting");

      try {
        const token = await getBrowserSupabaseRealtimeToken();

        if (cancelled) {
          return;
        }

        await supabase.realtime.setAuth(token);
        setLastError(null);

        const channel = supabase.channel(currentTopic, {
          config: { private: true },
        });

        for (const eventName of currentEventNames) {
          channel.on("broadcast", { event: eventName }, (payload) => {
            messageRef.current({
              event: eventName,
              payload: (payload.payload as Record<string, unknown>) ?? {},
            });
          });
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
            const message = `Realtime subscription failed for ${currentTopic}.`;

            setLastError(message);
            errorRef.current?.(message);
            cleanupChannel?.();
            cleanupChannel = null;
            scheduleRetry();
            return;
          }

          if (status === "TIMED_OUT") {
            const message = `Realtime timed out for ${currentTopic}.`;

            setLastError(message);
            errorRef.current?.(message);
            cleanupChannel?.();
            cleanupChannel = null;
            scheduleRetry(3000);
            return;
          }

          if (status === "CLOSED") {
            const message = `Realtime closed for ${currentTopic}.`;

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
  }, [enabled, eventKey, topic]);

  if (!enabled || !topic || !eventKey) {
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
