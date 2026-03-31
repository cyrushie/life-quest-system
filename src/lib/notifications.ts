import { db } from "@/lib/db";

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
  return db.notification.create({
    data: input,
  });
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
}
