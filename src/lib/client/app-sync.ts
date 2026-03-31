"use client";

import { createSafeId } from "@/lib/id";

type AppSyncMessage = {
  sourceId: string;
  timestamp: number;
  reason: string;
};

const CHANNEL_NAME = "life-quest-system-sync";
const STORAGE_KEY = "life-quest-system-sync-event";
const SOURCE_ID = createSafeId();

let appSyncChannel: BroadcastChannel | null = null;

function getAppSyncChannel() {
  if (typeof BroadcastChannel === "undefined") {
    return null;
  }

  if (!appSyncChannel) {
    appSyncChannel = new BroadcastChannel(CHANNEL_NAME);
  }

  return appSyncChannel;
}

export function broadcastAppSync(reason: string) {
  if (typeof window === "undefined") {
    return;
  }

  const message: AppSyncMessage = {
    sourceId: SOURCE_ID,
    timestamp: Date.now(),
    reason,
  };

  getAppSyncChannel()?.postMessage(message);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(message));
  } catch {
    // Storage fallback is optional.
  }
}

export function subscribeToAppSync(
  onMessage: (message: AppSyncMessage) => void,
) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleMessage = (message: AppSyncMessage | null | undefined) => {
    if (!message || message.sourceId === SOURCE_ID) {
      return;
    }

    onMessage(message);
  };

  const channel = getAppSyncChannel();
  const channelListener = (event: MessageEvent<AppSyncMessage>) => {
    handleMessage(event.data);
  };
  const storageListener = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY || !event.newValue) {
      return;
    }

    try {
      handleMessage(JSON.parse(event.newValue) as AppSyncMessage);
    } catch {
      // Ignore malformed payloads.
    }
  };

  channel?.addEventListener("message", channelListener);
  window.addEventListener("storage", storageListener);

  return () => {
    channel?.removeEventListener("message", channelListener);
    window.removeEventListener("storage", storageListener);
  };
}
