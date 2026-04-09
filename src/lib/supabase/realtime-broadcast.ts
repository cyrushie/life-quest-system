import { createClient } from "@supabase/supabase-js";

import {
  getSupabaseServiceRoleKey,
  getSupabaseUrl,
} from "@/lib/env";

type BroadcastMessage = {
  topic: string;
  event: string;
  payload: Record<string, unknown>;
};

let serverSupabase:
  | ReturnType<typeof createClient>
  | null = null;

function getServerSupabase() {
  if (!serverSupabase) {
    serverSupabase = createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }

  return serverSupabase;
}

async function sendPrivateBroadcast(message: BroadcastMessage) {
  const supabase = getServerSupabase();
  const channel = supabase.channel(message.topic, {
    config: { private: true },
  });

  try {
    await channel.httpSend(message.event, message.payload);
  } finally {
    void supabase.removeChannel(channel);
  }
}

export async function broadcastGuildMessage(input: {
  guildId: string;
  message: {
    id: string;
    username: string;
    dateLabel: string;
    content: string;
    isSelf?: boolean;
  };
}) {
  await sendPrivateBroadcast({
    topic: `guild:${input.guildId}`,
    event: "message-created",
    payload: {
      guildId: input.guildId,
      message: input.message,
    },
  });
}

export async function broadcastGuildSync(guildId: string, reason: string) {
  await sendPrivateBroadcast({
    topic: `guild:${guildId}`,
    event: "guild-sync",
    payload: {
      guildId,
      reason,
      at: new Date().toISOString(),
    },
  });
}

export async function broadcastNotificationSync(userIds: string[], reason: string) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];

  await Promise.all(
    uniqueUserIds.map((userId) =>
      sendPrivateBroadcast({
        topic: `notifications:${userId}`,
        event: "notification-sync",
        payload: {
          userId,
          reason,
          at: new Date().toISOString(),
        },
      }),
    ),
  );
}

export async function broadcastSocialSync(userIds: string[], reason: string) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];

  await Promise.all(
    uniqueUserIds.map((userId) =>
      sendPrivateBroadcast({
        topic: `social:${userId}`,
        event: "social-sync",
        payload: {
          userId,
          reason,
          at: new Date().toISOString(),
        },
      }),
    ),
  );
}

export async function broadcastProfileSync(userIds: string[], reason: string) {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];

  await Promise.all(
    uniqueUserIds.map((userId) =>
      sendPrivateBroadcast({
        topic: `profile:${userId}`,
        event: "profile-sync",
        payload: {
          userId,
          reason,
          at: new Date().toISOString(),
        },
      }),
    ),
  );
}
