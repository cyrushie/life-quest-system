"use server";

import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";

import { getCurrentSession } from "@/lib/auth/get-session";
import {
  WEEKDAY_ORDER,
  dateFromKey,
  getTodayDateKey,
  isDateKeyEditableForAccount,
} from "@/lib/date";
import { db } from "@/lib/db";
import {
  createNotification,
  createNotifications,
  markNotificationsReadForHref,
} from "@/lib/notifications";
import {
  backfillMissedDayPunishments,
  recalculateUserProgress,
  syncDailyLog,
  updateOnboardingStatus,
} from "@/lib/progress";

type FormState = {
  error?: string;
  success?: string;
};

async function requireSession() {
  const session = await getCurrentSession();

  if (!session) {
    throw new Error("Not authenticated.");
  }

  return session;
}

function revalidateRoutes(paths: string[]) {
  for (const path of paths) {
    revalidatePath(path);
  }
}

async function generateGuildInviteCode() {
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = randomBytes(4).toString("hex").toUpperCase();
    const existingGuild = await db.guild.findUnique({
      where: { inviteCode: code },
      select: { id: true },
    });

    if (!existingGuild) {
      return code;
    }
  }

  throw new Error("Unable to generate a guild invite code right now.");
}

async function revalidateGuildRelatedRoutes(usernames: string[]) {
  const uniqueUsernames = [...new Set(usernames.filter(Boolean))];

  revalidateRoutes([
    "/guild",
    "/friends",
    "/profile",
    ...uniqueUsernames.map((username) => `/adventurers/${username}`),
  ]);
}

async function syncTodayLogIfItExists(userId: string) {
  const todayLog = await db.dailyLog.findUnique({
    where: {
      userId_logDate: {
        userId,
        logDate: dateFromKey(getTodayDateKey()),
      },
    },
    select: {
      id: true,
      logDate: true,
      expGained: true,
      totalQp: true,
      questPassUsed: true,
    },
  });

  if (todayLog) {
    await syncDailyLog(userId, getTodayDateKey(), { existingLog: todayLog });
  }
}

async function getUserCreatedAt(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { createdAt: true },
  });

  if (!user) {
    throw new Error("User not found.");
  }

  return user.createdAt;
}

export async function saveTaskAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();

  const taskId = String(formData.get("taskId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const anchorDescription = String(formData.get("anchorDescription") ?? "").trim();
  const fullDescription = String(formData.get("fullDescription") ?? "").trim();
  const anchorQp = Number(formData.get("anchorQp") ?? 1);
  const fullQp = Number(formData.get("fullQp") ?? 1);

  if (!name || !anchorDescription || !fullDescription) {
    return { error: "Task name, anchor routine, and full routine are all required." };
  }

  const data = {
    name,
    anchorDescription,
    fullDescription,
    anchorQp: Number.isFinite(anchorQp) ? anchorQp : 1,
    fullQp: Number.isFinite(fullQp) ? fullQp : 1,
    isActive: true,
  };

  if (taskId) {
    const existingTask = await db.task.findFirst({
      where: { id: taskId, userId: session.userId },
      select: { id: true },
    });

    if (!existingTask) {
      return { error: "Task not found." };
    }

    await db.task.update({
      where: { id: taskId },
      data,
    });
  } else {
    await db.task.create({
      data: {
        userId: session.userId,
        ...data,
      },
    });
  }

  await updateOnboardingStatus(session.userId);
  await syncTodayLogIfItExists(session.userId);
  revalidateRoutes(["/tasks", "/today", "/dashboard", "/onboarding"]);

  return { success: "Task saved." };
}

export async function archiveTaskAction(formData: FormData) {
  const session = await requireSession();
  const taskId = String(formData.get("taskId") ?? "");

  const existingTask = await db.task.findFirst({
    where: { id: taskId, userId: session.userId },
    select: { id: true },
  });

  if (!existingTask) {
    return;
  }

  await db.task.update({
    where: { id: taskId },
    data: {
      isActive: false,
    },
  });

  await updateOnboardingStatus(session.userId);
  await syncTodayLogIfItExists(session.userId);
  revalidateRoutes(["/tasks", "/today", "/dashboard", "/onboarding"]);
}

export async function restoreTaskAction(formData: FormData) {
  const session = await requireSession();
  const taskId = String(formData.get("taskId") ?? "");

  const existingTask = await db.task.findFirst({
    where: { id: taskId, userId: session.userId },
    select: { id: true },
  });

  if (!existingTask) {
    return;
  }

  await db.task.update({
    where: { id: taskId },
    data: {
      isActive: true,
    },
  });

  await updateOnboardingStatus(session.userId);
  await syncTodayLogIfItExists(session.userId);
  revalidateRoutes(["/tasks", "/today", "/dashboard", "/onboarding"]);
}

export async function savePunishmentAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();

  const punishmentId = String(formData.get("punishmentId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!name) {
    return { error: "Punishment name is required." };
  }

  if (punishmentId) {
    const existingPunishment = await db.punishment.findFirst({
      where: { id: punishmentId, userId: session.userId },
      select: { id: true },
    });

    if (!existingPunishment) {
      return { error: "Punishment not found." };
    }

    await db.punishment.update({
      where: { id: punishmentId },
      data: {
        name,
        description,
        isActive: true,
      },
    });
  } else {
    await db.punishment.create({
      data: {
        userId: session.userId,
        name,
        description,
      },
    });
  }

  await updateOnboardingStatus(session.userId);
  await backfillMissedDayPunishments(session.userId);
  revalidateRoutes(["/punishments", "/dashboard", "/onboarding", "/today"]);

  return { success: "Punishment saved." };
}

export async function archivePunishmentAction(formData: FormData) {
  const session = await requireSession();
  const punishmentId = String(formData.get("punishmentId") ?? "");

  const existingPunishment = await db.punishment.findFirst({
    where: { id: punishmentId, userId: session.userId },
    select: { id: true },
  });

  if (!existingPunishment) {
    return;
  }

  await db.punishment.update({
    where: { id: punishmentId },
    data: {
      isActive: false,
    },
  });

  await updateOnboardingStatus(session.userId);
  await backfillMissedDayPunishments(session.userId);
  revalidateRoutes(["/punishments", "/dashboard", "/onboarding", "/today"]);
}

export async function restorePunishmentAction(formData: FormData) {
  const session = await requireSession();
  const punishmentId = String(formData.get("punishmentId") ?? "");

  const existingPunishment = await db.punishment.findFirst({
    where: { id: punishmentId, userId: session.userId },
    select: { id: true },
  });

  if (!existingPunishment) {
    return;
  }

  await db.punishment.update({
    where: { id: punishmentId },
    data: {
      isActive: true,
    },
  });

  await updateOnboardingStatus(session.userId);
  await backfillMissedDayPunishments(session.userId);
  revalidateRoutes(["/punishments", "/dashboard", "/onboarding", "/today"]);
}

export async function setTaskCompletionAction(formData: FormData) {
  const session = await requireSession();
  const taskId = String(formData.get("taskId") ?? "");
  const dateKey = String(formData.get("dateKey") ?? getTodayDateKey());
  const mode = String(formData.get("mode") ?? "clear");

  const createdAt = await getUserCreatedAt(session.userId);

  if (!isDateKeyEditableForAccount(dateKey, createdAt)) {
    throw new Error("Only today and the last 7 days can be edited.");
  }

  const logDate = dateFromKey(dateKey);

  const log = await db.dailyLog.upsert({
    where: {
      userId_logDate: {
        userId: session.userId,
        logDate,
      },
    },
    update: {},
    create: {
      userId: session.userId,
      logDate,
    },
  });

  await db.dailyTaskCompletion.upsert({
    where: {
      dailyLogId_taskId: {
        dailyLogId: log.id,
        taskId,
      },
    },
    update:
      mode === "full"
        ? { anchorCompleted: true, fullCompleted: true }
        : mode === "anchor"
          ? { anchorCompleted: true, fullCompleted: false }
          : { anchorCompleted: false, fullCompleted: false },
    create: {
      dailyLogId: log.id,
      taskId,
      anchorCompleted: mode !== "clear",
      fullCompleted: mode === "full",
    },
  });

  await syncDailyLog(session.userId, dateKey, {
    existingLog: {
      id: log.id,
      logDate: log.logDate,
      expGained: log.expGained,
      totalQp: log.totalQp,
      questPassUsed: log.questPassUsed,
    },
  });
}

export async function saveJournalAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const dateKey = String(formData.get("dateKey") ?? getTodayDateKey());
  const content = String(formData.get("content") ?? "");

  const createdAt = await getUserCreatedAt(session.userId);

  if (!isDateKeyEditableForAccount(dateKey, createdAt)) {
    return { error: "Only today and the last 7 days can be edited." };
  }

  await db.journalEntry.upsert({
    where: {
      userId_entryDate: {
        userId: session.userId,
        entryDate: dateFromKey(dateKey),
      },
    },
    update: {
      content,
    },
    create: {
      userId: session.userId,
      entryDate: dateFromKey(dateKey),
      content,
    },
  });

  return { success: "Journal saved." };
}

export async function saveExercisePlanAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const itemId = String(formData.get("itemId") ?? "").trim();
  const dayOfWeek = String(formData.get("dayOfWeek") ?? "").trim();
  const title = String(formData.get("title") ?? "").trim();
  const notes = String(formData.get("notes") ?? "").trim();
  const durationText = String(formData.get("durationText") ?? "").trim();

  if (!WEEKDAY_ORDER.includes(dayOfWeek as (typeof WEEKDAY_ORDER)[number])) {
    return { error: "Choose a valid day for this workout." };
  }

  if (!title) {
    return { error: "Workout title is required." };
  }

  if (itemId) {
    const existingItem = await db.exercisePlanItem.findFirst({
      where: { id: itemId, userId: session.userId },
      select: { id: true },
    });

    if (!existingItem) {
      return { error: "Workout plan item not found." };
    }

    await db.exercisePlanItem.update({
      where: { id: itemId },
      data: {
        dayOfWeek: dayOfWeek as (typeof WEEKDAY_ORDER)[number],
        title,
        notes: notes || null,
        durationText: durationText || null,
      },
    });
  } else {
    const highestSortItem = await db.exercisePlanItem.findFirst({
      where: {
        userId: session.userId,
        dayOfWeek: dayOfWeek as (typeof WEEKDAY_ORDER)[number],
      },
      orderBy: { sortOrder: "desc" },
      select: { sortOrder: true },
    });

    await db.exercisePlanItem.create({
      data: {
        userId: session.userId,
        dayOfWeek: dayOfWeek as (typeof WEEKDAY_ORDER)[number],
        title,
        notes: notes || null,
        durationText: durationText || null,
        sortOrder: (highestSortItem?.sortOrder ?? -1) + 1,
      },
    });
  }

  revalidateRoutes(["/exercise", "/today"]);

  return { success: "Workout saved." };
}

export async function deleteExercisePlanAction(formData: FormData) {
  const session = await requireSession();
  const itemId = String(formData.get("itemId") ?? "").trim();

  if (!itemId) {
    return;
  }

  const existingItem = await db.exercisePlanItem.findFirst({
    where: { id: itemId, userId: session.userId },
    select: { id: true },
  });

  if (!existingItem) {
    return;
  }

  await db.exercisePlanItem.delete({
    where: { id: itemId },
  });

  revalidateRoutes(["/exercise", "/today"]);
}

export async function completePunishmentAction(formData: FormData) {
  const session = await requireSession();
  const dateKey = String(formData.get("dateKey") ?? "");

  if (!dateKey) {
    throw new Error("Missing recovery date.");
  }

  const missedLogDate = dateFromKey(dateKey);
  const obligations = await db.missedDayPunishment.findMany({
    where: {
      userId: session.userId,
      missedLogDate,
      status: "PENDING",
    },
    select: {
      id: true,
      isChecked: true,
    },
  });

  if (!obligations.length) {
    return;
  }

  if (obligations.some((obligation) => !obligation.isChecked)) {
    throw new Error("Check every punishment for this day before completing it.");
  }

  await db.missedDayPunishment.updateMany({
    where: {
      userId: session.userId,
      missedLogDate,
      status: "PENDING",
    },
    data: {
      status: "COMPLETED",
      completedAt: new Date(),
    },
  });
}

export async function togglePunishmentItemAction(formData: FormData) {
  const session = await requireSession();
  const obligationId = String(formData.get("obligationId") ?? "");
  const checkedValue = String(formData.get("checked") ?? "");
  const isChecked = checkedValue === "true";

  const obligation = await db.missedDayPunishment.findFirst({
    where: {
      id: obligationId,
      userId: session.userId,
      status: "PENDING",
    },
    select: { id: true },
  });

  if (!obligation) {
    return;
  }

  await db.missedDayPunishment.update({
    where: { id: obligationId },
    data: {
      isChecked,
    },
  });
}

export async function sendFriendRequestAction(formData: FormData) {
  const session = await requireSession();
  const username = String(formData.get("username") ?? "").trim();

  if (!username) {
    return;
  }

  const targetUser = await db.user.findUnique({
    where: { username },
    select: { id: true, username: true },
  });

  if (!targetUser || targetUser.id === session.userId) {
    return;
  }

  const existing = await db.friendship.findFirst({
    where: {
      OR: [
        {
          requesterId: session.userId,
          addresseeId: targetUser.id,
        },
        {
          requesterId: targetUser.id,
          addresseeId: session.userId,
        },
      ],
    },
    select: {
      id: true,
      requesterId: true,
      status: true,
    },
  });

  if (existing?.status === "ACCEPTED") {
    return;
  }

  if (existing?.requesterId === session.userId) {
    return;
  }

  if (existing) {
    await db.friendship.update({
      where: { id: existing.id },
      data: {
        status: "ACCEPTED",
      },
    });

    await createNotification({
      userId: targetUser.id,
      type: "FRIEND_REQUEST_ACCEPTED",
      title: "Friend request accepted",
      body: `${session.username} accepted your friend request.`,
      href: `/adventurers/${session.username}`,
    });
  } else {
    await db.friendship.create({
      data: {
        requesterId: session.userId,
        addresseeId: targetUser.id,
      },
    });

    await createNotification({
      userId: targetUser.id,
      type: "FRIEND_REQUEST_RECEIVED",
      title: "Friend request",
      body: `${session.username} sent you a friend request.`,
      href: "/friends",
    });
  }

  revalidateRoutes([
    "/friends",
    "/notifications",
    "/profile",
    `/adventurers/${session.username}`,
    `/adventurers/${targetUser.username}`,
  ]);
}

export async function declineFriendRequestAction(formData: FormData) {
  const session = await requireSession();
  const requestId = String(formData.get("requestId") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();

  const request = requestId
      ? await db.friendship.findFirst({
          where: {
            id: requestId,
            addresseeId: session.userId,
            status: "PENDING",
          },
          include: {
            requester: {
              select: { id: true, username: true },
            },
          },
        })
      : username
      ? await db.friendship.findFirst({
          where: {
            addresseeId: session.userId,
            status: "PENDING",
            requester: {
              username,
            },
          },
          include: {
            requester: {
              select: { id: true, username: true },
            },
          },
        })
      : null;

  if (!request) {
    return;
  }

  await db.friendship.delete({
    where: { id: request.id },
  });

  revalidateRoutes([
    "/friends",
    "/profile",
    `/adventurers/${session.username}`,
    `/adventurers/${request.requester.username}`,
  ]);
}

export async function acceptFriendRequestAction(formData: FormData) {
  const session = await requireSession();
  const requestId = String(formData.get("requestId") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();

  const request = requestId
    ? await db.friendship.findFirst({
        where: {
          id: requestId,
          addresseeId: session.userId,
          status: "PENDING",
        },
        include: {
          requester: {
            select: { id: true, username: true },
          },
        },
      })
    : username
      ? await db.friendship.findFirst({
          where: {
            addresseeId: session.userId,
            status: "PENDING",
            requester: {
              username,
            },
          },
          include: {
            requester: {
              select: { id: true, username: true },
            },
          },
        })
      : null;

  if (!request) {
    return;
  }

  await db.friendship.update({
    where: { id: request.id },
    data: {
      status: "ACCEPTED",
    },
  });

  await createNotification({
    userId: request.requester.id,
    type: "FRIEND_REQUEST_ACCEPTED",
    title: "Friend request accepted",
    body: `${session.username} accepted your friend request.`,
    href: `/adventurers/${session.username}`,
  });

  revalidateRoutes([
    "/friends",
    "/notifications",
    "/profile",
    `/adventurers/${session.username}`,
    `/adventurers/${request.requester.username}`,
  ]);
}

export async function cancelFriendRequestAction(formData: FormData) {
  const session = await requireSession();
  const requestId = String(formData.get("requestId") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim();

  const request = requestId
    ? await db.friendship.findFirst({
        where: {
          id: requestId,
          requesterId: session.userId,
          status: "PENDING",
        },
        include: {
          addressee: {
            select: { username: true },
          },
        },
      })
    : username
      ? await db.friendship.findFirst({
          where: {
            requesterId: session.userId,
            status: "PENDING",
            addressee: {
              username,
            },
          },
          include: {
            addressee: {
              select: { username: true },
            },
          },
        })
      : null;

  if (!request) {
    return;
  }

  await db.friendship.delete({
    where: { id: request.id },
  });

  revalidateRoutes([
    "/friends",
    "/profile",
    `/adventurers/${session.username}`,
    `/adventurers/${request.addressee.username}`,
  ]);
}

export async function removeFriendAction(formData: FormData) {
  const session = await requireSession();
  const username = String(formData.get("username") ?? "").trim();

  if (!username) {
    return;
  }

  const targetUser = await db.user.findUnique({
    where: { username },
    select: { id: true, username: true },
  });

  if (!targetUser || targetUser.id === session.userId) {
    return;
  }

  const friendship = await db.friendship.findFirst({
    where: {
      status: "ACCEPTED",
      OR: [
        {
          requesterId: session.userId,
          addresseeId: targetUser.id,
        },
        {
          requesterId: targetUser.id,
          addresseeId: session.userId,
        },
      ],
    },
    select: { id: true },
  });

  if (!friendship) {
    return;
  }

  await db.friendship.delete({
    where: { id: friendship.id },
  });

  revalidateRoutes([
    "/friends",
    "/profile",
    `/adventurers/${session.username}`,
    `/adventurers/${targetUser.username}`,
  ]);
}

export async function saveGuildAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const guildId = String(formData.get("guildId") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();

  if (!name) {
    return { error: "Guild name is required." };
  }

  if (guildId) {
    const ownerMembership = await db.guildMembership.findUnique({
      where: { userId: session.userId },
      include: {
        guild: {
          select: {
            id: true,
            members: {
              include: {
                user: {
                  select: { username: true },
                },
              },
            },
          },
        },
      },
    });

    if (
      !ownerMembership ||
      ownerMembership.guild.id !== guildId ||
      ownerMembership.role !== "OWNER"
    ) {
      return { error: "Only the guild owner can update the guild hall." };
    }

    await db.guild.update({
      where: { id: guildId },
      data: {
        name,
        description: description || null,
      },
    });

    await revalidateGuildRelatedRoutes([
      session.username,
      ...ownerMembership.guild.members.map((member) => member.user.username),
    ]);

    return { success: "Guild updated." };
  }

  const existingMembership = await db.guildMembership.findUnique({
    where: { userId: session.userId },
    select: { id: true },
  });

  if (existingMembership) {
    return { error: "You are already in a guild." };
  }

  const inviteCode = await generateGuildInviteCode();

  await db.$transaction(async (tx) => {
    const guild = await tx.guild.create({
      data: {
        name,
        description: description || null,
        inviteCode,
      },
      select: { id: true },
    });

    await tx.guildMembership.create({
      data: {
        guildId: guild.id,
        userId: session.userId,
        role: "OWNER",
        lastBoardSeenAt: new Date(),
      },
    });
  });

  await revalidateGuildRelatedRoutes([session.username]);

  return { success: "Guild created." };
}

export async function joinGuildAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const inviteCode = String(formData.get("inviteCode") ?? "")
    .trim()
    .toUpperCase();

  if (!inviteCode) {
    return { error: "Enter a guild invite code." };
  }

  const [existingMembership, guild] = await db.$transaction([
    db.guildMembership.findUnique({
      where: { userId: session.userId },
      select: { id: true },
    }),
    db.guild.findUnique({
      where: { inviteCode },
      select: {
        id: true,
        name: true,
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
              },
            },
          },
        },
      },
    }),
  ]);

  if (existingMembership) {
    return { error: "Leave your current guild before joining a new one." };
  }

  if (!guild) {
    return { error: "That invite code does not match any guild." };
  }

  await db.guildMembership.create({
    data: {
      guildId: guild.id,
      userId: session.userId,
      role: "MEMBER",
      lastBoardSeenAt: new Date(),
    },
  });

  await createNotifications(
    guild.members
      .filter((member) => member.userId !== session.userId)
      .map((member) => ({
        userId: member.userId,
        type: "GUILD_MEMBER_JOINED" as const,
        title: "Guild updated",
        body: `${session.username} joined ${guild.name}.`,
        href: "/guild",
      })),
  );

  await revalidateGuildRelatedRoutes([
    session.username,
    ...guild.members.map((member) => member.user.username),
  ]);
  revalidateRoutes(["/notifications"]);

  return { success: "Guild joined." };
}

export async function regenerateGuildInviteAction(formData: FormData) {
  const session = await requireSession();
  const guildId = String(formData.get("guildId") ?? "").trim();

  if (!guildId) {
    return;
  }

  const membership = await db.guildMembership.findUnique({
    where: { userId: session.userId },
    include: {
      guild: {
        select: {
          id: true,
          members: {
            include: {
              user: {
                select: { id: true, username: true },
              },
            },
          },
        },
      },
    },
  });

  if (!membership || membership.role !== "OWNER" || membership.guild.id !== guildId) {
    return;
  }

  await db.guild.update({
    where: { id: guildId },
    data: {
      inviteCode: await generateGuildInviteCode(),
    },
  });

  await revalidateGuildRelatedRoutes([
    session.username,
    ...membership.guild.members.map((member) => member.user.username),
  ]);
}

export async function leaveGuildAction(formData: FormData) {
  const session = await requireSession();
  const guildId = String(formData.get("guildId") ?? "").trim();

  const membership = await db.guildMembership.findUnique({
    where: { userId: session.userId },
    include: {
      guild: {
        select: {
          id: true,
          name: true,
          members: {
            orderBy: { createdAt: "asc" },
            include: {
              user: {
                select: { id: true, username: true },
              },
            },
          },
        },
      },
    },
  });

  if (!membership || membership.guild.id !== guildId) {
    return;
  }

  const otherMembers = membership.guild.members.filter((member) => member.userId !== session.userId);

  await db.$transaction(async (tx) => {
    if (membership.role === "OWNER" && otherMembers.length > 0) {
      await tx.guildMembership.update({
        where: { id: otherMembers[0].id },
        data: {
          role: "OWNER",
        },
      });
    }

    if (membership.role === "OWNER" && otherMembers.length === 0) {
      await tx.guild.delete({
        where: { id: membership.guild.id },
      });

      return;
    }

    await tx.guildMembership.delete({
      where: { id: membership.id },
    });
  });

  if (otherMembers.length > 0) {
    await createNotifications(
      otherMembers.map((member) => ({
        userId: member.userId,
        type: "GUILD_MEMBER_LEFT" as const,
        title: "Guild updated",
        body: `${session.username} left ${membership.guild.name}.`,
        href: "/guild",
      })),
    );
  }

  await revalidateGuildRelatedRoutes([
    session.username,
    ...membership.guild.members.map((member) => member.user.username),
  ]);
  revalidateRoutes(["/notifications"]);
}

export async function removeGuildMemberAction(formData: FormData) {
  const session = await requireSession();
  const memberId = String(formData.get("memberId") ?? "").trim();

  if (!memberId) {
    return;
  }

  const ownerMembership = await db.guildMembership.findUnique({
    where: { userId: session.userId },
    include: {
      guild: {
        select: {
          id: true,
          name: true,
          members: {
            include: {
              user: {
                select: { id: true, username: true },
              },
            },
          },
        },
      },
    },
  });

  if (!ownerMembership || ownerMembership.role !== "OWNER") {
    return;
  }

  const targetMembership = ownerMembership.guild.members.find((member) => member.id === memberId);

  if (
    !targetMembership ||
    targetMembership.userId === session.userId ||
    targetMembership.role === "OWNER"
  ) {
    return;
  }

  await db.guildMembership.delete({
    where: { id: targetMembership.id },
  });

  await createNotification({
    userId: targetMembership.userId,
    type: "GUILD_REMOVED",
    title: "Removed from guild",
    body: `You were removed from ${ownerMembership.guild.name}.`,
    href: "/guild",
  });

  await revalidateGuildRelatedRoutes([
    session.username,
    targetMembership.user.username,
    ...ownerMembership.guild.members.map((member) => member.user.username),
  ]);
  revalidateRoutes(["/notifications"]);
}

export async function saveGuildMessageAction(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await requireSession();
  const content = String(formData.get("content") ?? "").trim();

  if (!content) {
    return { error: "Write a message before posting." };
  }

  if (content.length > 600) {
    return { error: "Keep guild posts to 600 characters or less." };
  }

  const membership = await db.guildMembership.findUnique({
    where: { userId: session.userId },
    include: {
      guild: {
        select: {
          name: true,
          members: {
            include: {
              user: {
                select: {
                  username: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!membership) {
    return { error: "Join a guild before posting to the board." };
  }

  await db.guildMessage.create({
    data: {
      guildId: membership.guildId,
      userId: session.userId,
      content,
    },
  });

  const preview =
    content.length > 120 ? `${content.slice(0, 117).trimEnd()}...` : content;

  await createNotifications(
    membership.guild.members
      .filter((member) => member.userId !== session.userId)
      .map((member) => ({
        userId: member.userId,
        type: "GUILD_MESSAGE" as const,
        title: `New guild message from ${session.username}`,
        body: preview,
        href: "/guild?tab=board",
      })),
  );

  revalidateRoutes(["/guild", "/notifications"]);

  return { success: "Guild post sent." };
}

export async function markGuildBoardSeenAction() {
  const session = await requireSession();

  await db.guildMembership.updateMany({
    where: { userId: session.userId },
    data: {
      lastBoardSeenAt: new Date(),
    },
  });
  await markNotificationsReadForHref(session.userId, "/guild?tab=board");

  revalidateRoutes(["/guild", "/notifications"]);
}

export async function rebuildProgressAction() {
  const session = await requireSession();
  await recalculateUserProgress(session.userId);
  revalidateRoutes(["/dashboard", "/today", "/history"]);
}

export async function markNotificationReadAction(formData: FormData) {
  const session = await requireSession();
  const notificationId = String(formData.get("notificationId") ?? "").trim();

  if (!notificationId) {
    return;
  }

  await db.notification.updateMany({
    where: {
      id: notificationId,
      userId: session.userId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  revalidateRoutes(["/notifications"]);
}

export async function markAllNotificationsReadAction() {
  const session = await requireSession();

  await db.notification.updateMany({
    where: {
      userId: session.userId,
      readAt: null,
    },
    data: {
      readAt: new Date(),
    },
  });

  revalidateRoutes(["/notifications"]);
}
