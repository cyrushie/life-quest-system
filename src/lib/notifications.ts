import { db } from "@/lib/db";
import { broadcastNotificationSync } from "@/lib/supabase/realtime-broadcast";

type NotificationInput = {
  userId: string;
  type:
    | "FRIEND_REQUEST_RECEIVED"
    | "FRIEND_REQUEST_ACCEPTED"
    | "GUILD_MEMBER_JOINED"
    | "GUILD_MEMBER_LEFT"
    | "GUILD_REMOVED"
    | "GUILD_MESSAGE";
  title: string;
  body: string;
  href: string;
};

export async function createNotification(input: NotificationInput) {
  const notification = await db.notification.create({
    data: input,
  });

  await broadcastNotificationSync([input.userId], "notification-created");

  return notification;
}

export async function createNotifications(inputs: NotificationInput[]) {
  if (!inputs.length) {
    return;
  }

  await db.$transaction(
    inputs.map((input) =>
      db.notification.create({
        data: input,
      }),
    ),
  );

  await broadcastNotificationSync(
    inputs.map((input) => input.userId),
    "notification-created",
  );
}

export async function markNotificationsReadForHref(userId: string, href: string) {
  await db.notification.updateMany({
    where: {
      userId,
      href,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  await broadcastNotificationSync([userId], "notification-read-for-href");
}
