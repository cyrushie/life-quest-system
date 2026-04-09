"use client";

import { createClient } from "@supabase/supabase-js";

let browserSupabase:
  | ReturnType<typeof createClient>
  | null = null;
let realtimeTokenPromise: Promise<string> | null = null;
let realtimeTokenExpiresAt = 0;

function readJwtExpiry(token: string) {
  try {
    const [, payload] = token.split(".");

    if (!payload) {
      return 0;
    }

    const parsed = JSON.parse(window.atob(payload.replace(/-/g, "+").replace(/_/g, "/"))) as {
      exp?: number;
    };

    return parsed.exp ? parsed.exp * 1000 : 0;
  } catch {
    return 0;
  }
}

export function getBrowserSupabaseRealtimeClient() {
  if (!browserSupabase) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key =
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
      throw new Error("Supabase Realtime env vars are missing.");
    }

    browserSupabase = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }

  return browserSupabase;
}

export async function getBrowserSupabaseRealtimeToken() {
  const now = Date.now();

  if (realtimeTokenPromise && realtimeTokenExpiresAt > now + 60_000) {
    return await realtimeTokenPromise;
  }

  realtimeTokenPromise = fetch("/api/realtime/token", {
    credentials: "same-origin",
    cache: "no-store",
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Realtime token request failed: ${response.status}`);
      }

      const data = (await response.json()) as { token?: string };

      if (!data.token) {
        throw new Error("Realtime token was missing.");
      }

      realtimeTokenExpiresAt = readJwtExpiry(data.token);

      return data.token;
    })
    .catch((error) => {
      realtimeTokenPromise = null;
      realtimeTokenExpiresAt = 0;
      throw error;
    });

  return await realtimeTokenPromise;
}
