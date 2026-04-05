import { db } from "@/lib/db";
import {
  APP_TIMEZONE,
  dateFromKey,
  formatDisplayDate,
  formatMonthYear,
  formatWeekdayLabel,
  getAccountCreatedDateKey,
  getDateKey,
  getPastDateKey,
  getTodayDateKey,
  getWeekdayKey,
  isDateKeyEditableForAccount,
  WEEKDAY_ORDER,
} from "@/lib/date";
import { calculateDailyProgress } from "@/lib/game/logic";
import { backfillMissedDayPunishments, getLevelState, syncDailyLog } from "@/lib/progress";

type PendingPunishmentRecord = {
  id: string;
  missedLogDate: Date;
  punishment: {
    name: string;
    description: string | null;
  };
  isChecked: boolean;
};

type HistoryPunishmentRecord = PendingPunishmentRecord & {
  status: "PENDING" | "COMPLETED";
};

type TrendLogRecord = {
  logDate: Date;
  totalQp: number;
  expGained: number;
};

type SocialStats = {
  currentLevel: number;
  currentTitle: string;
  currentStreak: number;
} | null | undefined;

type SocialGuildMembership = {
  guild: {
    name: string;
  };
} | null | undefined;

type SocialLatestLog = {
  logDate: Date;
  totalQp: number;
  expGained: number;
  questPassUsed: boolean;
} | null | undefined;

type RelationshipState =
  | "self"
  | "none"
  | "outgoing_pending"
  | "incoming_pending"
  | "friends";

function formatTrendDate(date: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: APP_TIMEZONE,
  }).format(date);
}

function formatQpValue(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatActivityDateLabel(date: Date) {
  return getDateKey(date) === getTodayDateKey() ? "Today" : formatDisplayDate(date);
}

function formatNotificationDateLabel(date: Date) {
  return getDateKey(date) === getTodayDateKey() ? "Today" : formatDisplayDate(date);
}

function buildProgressTrend(logs: TrendLogRecord[], days = 14) {
  const logMap = new Map(logs.map((log) => [getDateKey(log.logDate), log]));
  const keys = Array.from({ length: days }, (_, index) => getPastDateKey(days - index - 1));

  return keys.map((dateKey) => {
    const logDate = dateFromKey(dateKey);
    const log = logMap.get(dateKey);

    return {
      dateKey,
      label: formatTrendDate(logDate),
      totalQp: log?.totalQp ?? 0,
      expGained: log?.expGained ?? 0,
    };
  });
}

function buildWindowTrend(logMap: Map<string, TrendLogRecord>, days: number, startOffset = 0) {
  const keys = Array.from({ length: days }, (_, index) => getPastDateKey(days - index - 1 + startOffset));

  return keys.map((dateKey) => {
    const logDate = dateFromKey(dateKey);
    const log = logMap.get(dateKey);

    return {
      dateKey,
      label: formatTrendDate(logDate),
      totalQp: log?.totalQp ?? 0,
      expGained: log?.expGained ?? 0,
    };
  });
}

function countActiveDays(points: { totalQp: number }[]) {
  return points.filter((point) => point.totalQp > 0).length;
}

function countZeroDays(points: { totalQp: number }[]) {
  return points.filter((point) => point.totalQp <= 0).length;
}

function averageQp(points: { totalQp: number }[]) {
  if (!points.length) {
    return 0;
  }

  return points.reduce((sum, point) => sum + point.totalQp, 0) / points.length;
}

function totalExp(points: { expGained: number }[]) {
  return points.reduce((sum, point) => sum + point.expGained, 0);
}

function totalQp(points: { totalQp: number }[]) {
  return points.reduce((sum, point) => sum + point.totalQp, 0);
}

function buildRangeSummary<T extends { totalQp: number; expGained: number }>(points: T[]) {
  return {
    totalQp: totalQp(points),
    averageQp: averageQp(points),
    activeDays: countActiveDays(points),
    zeroDays: countZeroDays(points),
    exp: totalExp(points),
  };
}

function buildRangeComparison<T extends { totalQp: number; expGained: number }>(
  current: T[],
  previous: T[],
  labels: {
    current: string;
    previous: string;
  },
) {
  const currentSummary = buildRangeSummary(current);
  const previousSummary = buildRangeSummary(previous);

  return {
    currentLabel: labels.current,
    previousLabel: labels.previous,
    current: currentSummary,
    previous: previousSummary,
    delta: {
      totalQp: currentSummary.totalQp - previousSummary.totalQp,
      averageQp: currentSummary.averageQp - previousSummary.averageQp,
      activeDays: currentSummary.activeDays - previousSummary.activeDays,
      zeroDays: currentSummary.zeroDays - previousSummary.zeroDays,
      exp: currentSummary.exp - previousSummary.exp,
    },
  };
}

function getMonthKey(monthsBack = 0) {
  const monthDate = dateFromKey(getTodayDateKey());
  monthDate.setUTCDate(1);
  monthDate.setUTCMonth(monthDate.getUTCMonth() - monthsBack);
  return getDateKey(monthDate).slice(0, 7);
}

function getRelationshipState(
  friendship:
    | {
        requesterId: string;
        addresseeId: string;
        status: "PENDING" | "ACCEPTED";
      }
    | null
    | undefined,
  viewerUserId: string,
): Exclude<RelationshipState, "self"> {
  if (!friendship) {
    return "none";
  }

  if (friendship.status === "ACCEPTED") {
    return "friends";
  }

  return friendship.requesterId === viewerUserId
    ? "outgoing_pending"
    : "incoming_pending";
}

function groupPendingPunishments(pendingPunishments: PendingPunishmentRecord[]) {
  return Array.from(
    pendingPunishments.reduce<
      Map<
        string,
        {
          dateKey: string;
          missedDateLabel: string;
          items: {
            id: string;
            name: string;
            description: string | null;
            isChecked: boolean;
          }[];
        }
      >
    >((acc, punishment) => {
      const dateKey = getDateKey(punishment.missedLogDate);
      const current = acc.get(dateKey) ?? {
        dateKey,
        missedDateLabel: formatDisplayDate(punishment.missedLogDate),
        items: [],
      };

      current.items.push({
        id: punishment.id,
        name: punishment.punishment.name,
        description: punishment.punishment.description,
        isChecked: punishment.isChecked,
      });

      acc.set(dateKey, current);
      return acc;
    }, new Map()).values(),
  );
}

function groupHistoryPunishments(punishments: HistoryPunishmentRecord[]) {
  return punishments.reduce<
    Map<
      string,
      {
        state: "pending" | "completed" | "mixed";
        checkedCount: number;
        completedCount: number;
        totalCount: number;
        items: {
          id: string;
          name: string;
          description: string | null;
          isChecked: boolean;
          status: "PENDING" | "COMPLETED";
        }[];
      }
    >
  >((acc, item) => {
    const key = item.missedLogDate.toISOString();
    const current = acc.get(key) ?? {
      state: "pending" as const,
      checkedCount: 0,
      completedCount: 0,
      totalCount: 0,
      items: [],
    };

    current.totalCount += 1;
    current.checkedCount += Number(item.isChecked);
    current.completedCount += Number(item.status === "COMPLETED");
    current.items.push({
      id: item.id,
      name: item.punishment.name,
      description: item.punishment.description,
      isChecked: item.isChecked,
      status: item.status,
    });

    if (current.completedCount === current.totalCount) {
      current.state = "completed";
    } else if (current.completedCount === 0) {
      current.state = "pending";
    } else {
      current.state = "mixed";
    }

    acc.set(key, current);
    return acc;
  }, new Map());
}

function buildActivitySnippet(stats: SocialStats, latestLog: SocialLatestLog) {
  if (latestLog) {
    const dateKey = getDateKey(latestLog.logDate);

    if (dateKey === getTodayDateKey() && latestLog.totalQp > 0) {
      return `Logged ${formatQpValue(latestLog.totalQp)} QP today for +${latestLog.expGained.toLocaleString()} EXP.`;
    }

    if (latestLog.questPassUsed) {
      return `Used a Quest Pass on ${formatDisplayDate(latestLog.logDate)}.`;
    }

    if (latestLog.totalQp > 0) {
      return `Last quest day: ${formatDisplayDate(latestLog.logDate)} with ${formatQpValue(latestLog.totalQp)} QP.`;
    }

    return `Checked in on ${formatDisplayDate(latestLog.logDate)}.`;
  }

  if ((stats?.currentStreak ?? 0) > 0) {
    return `${stats?.currentStreak ?? 0}-day streak active.`;
  }

  return "No public quest activity yet.";
}

function mapNotificationTone(
  type:
    | "FRIEND_REQUEST_RECEIVED"
    | "FRIEND_REQUEST_ACCEPTED"
    | "GUILD_MEMBER_JOINED"
    | "GUILD_MEMBER_LEFT"
    | "GUILD_REMOVED"
    | "GUILD_MESSAGE",
) {
  switch (type) {
    case "FRIEND_REQUEST_RECEIVED":
      return "gold";
    case "FRIEND_REQUEST_ACCEPTED":
      return "emerald";
    case "GUILD_MESSAGE":
      return "gold";
    case "GUILD_REMOVED":
      return "rose";
    default:
      return "stone";
  }
}

function buildGuildActivitySummary(log: TrendLogRecord & { questPassUsed?: boolean }) {
  if (log.questPassUsed) {
    return `used a Quest Pass for a full clear`;
  }

  if (log.totalQp <= 0) {
    return "logged a 0 QP day";
  }

  return `earned ${formatQpValue(log.totalQp)} QP`;
}

function mapSocialUser(
  user: {
    id: string;
    username: string;
    stats?: SocialStats;
    guildMembership?: SocialGuildMembership;
  },
  latestLogByUserId: Map<string, SocialLatestLog>,
) {
  return {
    id: user.id,
    username: user.username,
    level: user.stats?.currentLevel ?? 1,
    title: user.stats?.currentTitle ?? "Apprentice",
    streak: user.stats?.currentStreak ?? 0,
    guildName: user.guildMembership?.guild.name ?? null,
    activity: buildActivitySnippet(user.stats, latestLogByUserId.get(user.id)),
  };
}

async function syncDateLogIfItExists(userId: string, dateKey: string) {
  const logDate = new Date(`${dateKey}T00:00:00.000Z`);
  const existingLog = await db.dailyLog.findUnique({
    where: {
      userId_logDate: {
        userId,
        logDate,
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

  if (!existingLog) {
    return;
  }

  await syncDailyLog(userId, dateKey, {
    existingLog,
  });
}

export async function getDashboardData(userId: string) {
  await backfillMissedDayPunishments(userId);
  await syncDateLogIfItExists(userId, getTodayDateKey());

  const [stats, todayLog, recentLogs, pendingPunishments] = await db.$transaction([
    db.userStats.findUnique({ where: { userId } }),
    db.dailyLog.findUnique({
      where: {
        userId_logDate: {
          userId,
          logDate: new Date(`${getTodayDateKey()}T00:00:00.000Z`),
        },
      },
    }),
    db.dailyLog.findMany({
      where: { userId },
      orderBy: { logDate: "desc" },
      take: 14,
    }),
    db.missedDayPunishment.findMany({
      where: { userId, status: "PENDING" },
      include: { punishment: true },
      orderBy: [{ missedLogDate: "desc" }, { createdAt: "asc" }],
    }),
  ]);

  const safeStats = stats ?? {
    currentLevel: 1,
    currentTitle: "Apprentice",
    totalExp: 0,
    currentStreak: 0,
    questPassCount: 0,
  };

  const levelState = getLevelState(safeStats.totalExp);

  return {
    stats: safeStats,
    todayQp: todayLog?.totalQp ?? 0,
    levelState,
    recentLogs: recentLogs.map((entry) => ({
      id: entry.id,
      dateLabel: formatDisplayDate(entry.logDate),
      questPassUsed: entry.questPassUsed,
      anchorCount: entry.anchorCount,
      fullCount: entry.fullCount,
      totalQp: entry.totalQp,
      expGained: entry.expGained,
    })).slice(0, 5),
    trend: buildProgressTrend(recentLogs),
    pendingPunishments: groupPendingPunishments(pendingPunishments).slice(0, 3),
  };
}

export async function getTodayData(userId: string, requestedDateKey = getTodayDateKey()) {
  await backfillMissedDayPunishments(userId);

  const todayKey = getTodayDateKey();
  if (requestedDateKey === todayKey) {
    await syncDateLogIfItExists(userId, todayKey);
  }
  const targetDate = new Date(`${requestedDateKey}T00:00:00.000Z`);
  const previousDate = new Date(targetDate.getTime() - 86_400_000);
  const isToday = requestedDateKey === todayKey;

  const dayOfWeek = getWeekdayKey(targetDate);

  const [
    user,
    stats,
    tasks,
    todayLog,
    previousDayLog,
    journalEntry,
    pendingPunishments,
    exercisePlanItems,
  ] =
    await db.$transaction([
    db.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    }),
    db.userStats.findUnique({
      where: { userId },
      select: { questPassCount: true },
    }),
    db.task.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: "asc" },
    }),
    db.dailyLog.findUnique({
      where: {
        userId_logDate: {
          userId,
          logDate: targetDate,
        },
      },
      include: { taskCompletions: true },
    }),
    db.dailyLog.findUnique({
      where: {
        userId_logDate: {
          userId,
          logDate: previousDate,
        },
      },
      select: {
        totalQp: true,
        streakValueForDay: true,
      },
    }),
    db.journalEntry.findUnique({
      where: {
        userId_entryDate: {
          userId,
          entryDate: targetDate,
        },
      },
    }),
    db.missedDayPunishment.findMany({
      where: {
        userId,
        status: "PENDING",
      },
      include: { punishment: true },
      orderBy: [{ missedLogDate: "asc" }, { createdAt: "asc" }],
    }),
    db.exercisePlanItem.findMany({
      where: {
        userId,
        dayOfWeek,
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    }),
  ]);

  const accountCreatedAt = user?.createdAt ?? new Date();
  const canEdit = isDateKeyEditableForAccount(requestedDateKey, accountCreatedAt);

  const completionMap = new Map(todayLog?.taskCompletions.map((item) => [item.taskId, item]) ?? []);
  const previousStreak = previousDayLog?.totalQp && previousDayLog.totalQp >= 1
    ? previousDayLog.streakValueForDay
    : 0;

  const derivedCalculation = calculateDailyProgress({
    previousStreak,
    tasks: tasks.map((task) => {
      const completion = completionMap.get(task.id);

      return {
        anchorCompleted: completion?.anchorCompleted ?? false,
        fullCompleted: completion?.fullCompleted ?? false,
        anchorQp: task.anchorQp,
        fullQp: task.fullQp,
      };
    }),
  });
  const savedCalculation = todayLog
    ? {
        baseQp: todayLog.baseQp,
        bonusQp: todayLog.bonusQp,
        totalQp: todayLog.totalQp,
        expGained: todayLog.expGained,
        allAnchorsCompleted: todayLog.allAnchorsCompleted,
        earnedFullBonus: todayLog.threeFullBonusEarned,
        fullCount: todayLog.fullCount,
      }
    : null;
  const liveCalculation = !canEdit && savedCalculation ? savedCalculation : derivedCalculation;

  return {
    todayKey: requestedDateKey,
    todayLabel: formatDisplayDate(targetDate),
    isToday,
    canEdit,
    previousStreak,
    questPassUsed: todayLog?.questPassUsed ?? false,
    availableQuestPasses: stats?.questPassCount ?? 0,
    tasks: tasks.map((task) => {
      const completion = completionMap.get(task.id);
      const status = todayLog?.questPassUsed
        ? "full"
        : completion?.fullCompleted
        ? "full"
        : completion?.anchorCompleted
          ? "anchor"
          : "clear";

      return {
        id: task.id,
        name: task.name,
        anchorDescription: task.anchorDescription,
        fullDescription: task.fullDescription,
        anchorQp: task.anchorQp,
        fullQp: task.fullQp,
        status,
      };
    }),
    liveCalculation,
    journalContent: journalEntry?.content ?? "",
    exercisePlan: {
      dayLabel: formatWeekdayLabel(dayOfWeek),
      items: exercisePlanItems.map((item) => ({
        id: item.id,
        title: item.title,
        notes: item.notes,
        durationText: item.durationText,
      })),
    },
    pendingPunishments: groupPendingPunishments(pendingPunishments),
  };
}

export async function getTasksData(userId: string) {
  const [tasks, archivedTasks] = await db.$transaction([
    db.task.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: "asc" },
    }),
    db.task.findMany({
      where: { userId, isActive: false },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return { tasks, archivedTasks };
}

export async function getPunishmentsData(userId: string) {
  const [punishments, archivedPunishments] = await db.$transaction([
    db.punishment.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: "asc" },
    }),
    db.punishment.findMany({
      where: { userId, isActive: false },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return { punishments, archivedPunishments };
}

export async function getExerciseData(userId: string) {
  const items = await db.exercisePlanItem.findMany({
    where: { userId },
    orderBy: [{ dayOfWeek: "asc" }, { sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const grouped = new Map(
    WEEKDAY_ORDER.map((weekday) => [
      weekday,
      {
        weekday,
        dayLabel: formatWeekdayLabel(weekday),
        items: [] as {
          id: string;
          title: string;
          notes: string | null;
          durationText: string | null;
          sortOrder: number;
        }[],
      },
    ]),
  );

  for (const item of items) {
    grouped.get(item.dayOfWeek)?.items.push({
      id: item.id,
      title: item.title,
      notes: item.notes,
      durationText: item.durationText,
      sortOrder: item.sortOrder,
    });
  }

  return {
    days: WEEKDAY_ORDER.map((weekday) => grouped.get(weekday)!),
  };
}

export async function getFriendsData(userId: string, query = "") {
  const normalizedQuery = query.trim();

  const [acceptedRows, incomingRows, outgoingRows, candidateUsers] = await db.$transaction([
    db.friendship.findMany({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: userId }, { addresseeId: userId }],
      },
      include: {
        requester: {
          include: {
            stats: true,
            guildMembership: {
              include: {
                guild: {
                  select: { name: true },
                },
              },
            },
          },
        },
        addressee: {
          include: {
            stats: true,
            guildMembership: {
              include: {
                guild: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.friendship.findMany({
      where: {
        status: "PENDING",
        addresseeId: userId,
      },
      include: {
        requester: {
          include: {
            stats: true,
            guildMembership: {
              include: {
                guild: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.friendship.findMany({
      where: {
        status: "PENDING",
        requesterId: userId,
      },
      include: {
        addressee: {
          include: {
            stats: true,
            guildMembership: {
              include: {
                guild: {
                  select: { name: true },
                },
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.user.findMany({
      where: {
        id: { not: userId },
        ...(normalizedQuery
          ? {
              OR: [
                {
                  username: {
                    contains: normalizedQuery,
                    mode: "insensitive",
                  },
                },
                {
                  stats: {
                    is: {
                      currentTitle: {
                        contains: normalizedQuery,
                        mode: "insensitive",
                      },
                    },
                  },
                },
              ],
            }
          : {}),
      },
      select: {
        id: true,
        username: true,
        stats: true,
        guildMembership: {
          include: {
            guild: {
              select: { name: true },
            },
          },
        },
      },
      orderBy: normalizedQuery ? { username: "asc" } : { createdAt: "desc" },
      take: normalizedQuery ? 12 : 16,
    }),
  ]);

  const relatedUsers = new Set<string>();

  for (const row of acceptedRows) {
    relatedUsers.add(row.requesterId);
    relatedUsers.add(row.addresseeId);
  }

  for (const row of incomingRows) {
    relatedUsers.add(row.requesterId);
  }

  for (const row of outgoingRows) {
    relatedUsers.add(row.addresseeId);
  }

  for (const user of candidateUsers) {
    relatedUsers.add(user.id);
  }

  const latestLogs = relatedUsers.size
    ? await db.dailyLog.findMany({
        where: {
          userId: {
            in: [...relatedUsers],
          },
        },
        select: {
          userId: true,
          logDate: true,
          totalQp: true,
          expGained: true,
          questPassUsed: true,
        },
        orderBy: [{ userId: "asc" }, { logDate: "desc" }],
      })
    : [];

  const latestLogByUserId = latestLogs.reduce<Map<string, SocialLatestLog>>((acc, log) => {
    if (!acc.has(log.userId)) {
      acc.set(log.userId, log);
    }

    return acc;
  }, new Map());

  const relationshipRows = await db.friendship.findMany({
    where: {
      OR: [
        {
          requesterId: userId,
          addresseeId: { in: candidateUsers.map((user) => user.id) },
        },
        {
          addresseeId: userId,
          requesterId: { in: candidateUsers.map((user) => user.id) },
        },
      ],
    },
    select: {
      requesterId: true,
      addresseeId: true,
      status: true,
    },
  });

  const relationshipMap = new Map(
    relationshipRows.map((row) => [
      row.requesterId === userId ? row.addresseeId : row.requesterId,
      getRelationshipState(row, userId),
    ]),
  );

  const discover = candidateUsers
    .map((user) => ({
      ...mapSocialUser(user, latestLogByUserId),
      relationship: relationshipMap.get(user.id) ?? "none",
    }))
    .filter((user) => (normalizedQuery ? true : user.relationship === "none"))
    .slice(0, 8);

  return {
    query: normalizedQuery,
    searchMeta: normalizedQuery
      ? `Matching usernames or titles for "${normalizedQuery}".`
      : "Search by username or title to find more players.",
    friends: acceptedRows.map((row) => {
      const friend = row.requesterId === userId ? row.addressee : row.requester;

      return mapSocialUser(friend, latestLogByUserId);
    }),
    incomingRequests: incomingRows.map((row) => {
      const requester = mapSocialUser(row.requester, latestLogByUserId);

      return {
        ...requester,
        id: row.id,
      };
    }),
    outgoingRequests: outgoingRows.map((row) => {
      const addressee = mapSocialUser(row.addressee, latestLogByUserId);

      return {
        ...addressee,
        id: row.id,
      };
    }),
    discover,
  };
}

export async function getProfileData(viewerUserId: string, username: string) {
  const profileUser = await db.user.findUnique({
    where: { username },
    include: {
      stats: true,
      guildMembership: {
        include: {
          guild: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  if (!profileUser) {
    return null;
  }

  const [logs, friendCount, guildMemberCount] = await db.$transaction([
    db.dailyLog.findMany({
      where: { userId: profileUser.id },
      orderBy: { logDate: "desc" },
      take: 14,
    }),
    db.friendship.count({
      where: {
        status: "ACCEPTED",
        OR: [{ requesterId: profileUser.id }, { addresseeId: profileUser.id }],
      },
    }),
    profileUser.guildMembership
      ? db.guildMembership.count({
          where: { guildId: profileUser.guildMembership.guildId },
        })
      : db.guildMembership.count({
          where: { guildId: "__no_guild__" },
        }),
  ]);
  const friendship =
    profileUser.id === viewerUserId
      ? null
      : await db.friendship.findFirst({
          where: {
            OR: [
              {
                requesterId: viewerUserId,
                addresseeId: profileUser.id,
              },
              {
                requesterId: profileUser.id,
                addresseeId: viewerUserId,
              },
            ],
          },
          select: {
            requesterId: true,
            addresseeId: true,
            status: true,
          },
        });

  const safeStats = profileUser.stats ?? {
    currentLevel: 1,
    currentTitle: "Apprentice",
    totalExp: 0,
    currentStreak: 0,
    questPassCount: 0,
  };

  return {
    username: profileUser.username,
    joinedLabel: formatDisplayDate(profileUser.createdAt),
    isSelf: profileUser.id === viewerUserId,
    relationship: (
      profileUser.id === viewerUserId
        ? "self"
        : getRelationshipState(friendship, viewerUserId)
    ) as RelationshipState,
    stats: safeStats,
    friendCount,
    guild: profileUser.guildMembership
      ? {
          id: profileUser.guildMembership.guild.id,
          name: profileUser.guildMembership.guild.name,
          role: profileUser.guildMembership.role,
          memberCount: guildMemberCount,
        }
      : null,
    latestActivity: buildActivitySnippet(safeStats, logs[0]),
    trend: buildProgressTrend(logs),
    recentLogs: logs.slice(0, 5).map((entry) => ({
      id: entry.id,
      dateLabel: formatDisplayDate(entry.logDate),
      totalQp: entry.totalQp,
      expGained: entry.expGained,
      anchorCount: entry.anchorCount,
      fullCount: entry.fullCount,
    })),
  };
}

export async function getGuildData(userId: string) {
  const membership = await db.guildMembership.findUnique({
    where: { userId },
    include: {
      guild: true,
    },
  });

  if (!membership) {
    const [friendCount, incomingCount] = await db.$transaction([
      db.friendship.count({
        where: {
          status: "ACCEPTED",
          OR: [{ requesterId: userId }, { addresseeId: userId }],
        },
      }),
      db.friendship.count({
        where: {
          status: "PENDING",
          addresseeId: userId,
        },
      }),
    ]);

    return {
      hasGuild: false as const,
      friendCount,
      incomingCount,
    };
  }

  const seenAfter = membership.lastBoardSeenAt ?? membership.createdAt;

  const [members, messages, unreadCount] = await db.$transaction([
    db.guildMembership.findMany({
      where: { guildId: membership.guildId },
      include: {
        user: {
          include: {
            stats: true,
          },
        },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    }),
    db.guildMessage.findMany({
      where: { guildId: membership.guildId },
      include: {
        user: {
          select: {
            username: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    db.guildMessage.count({
      where: {
        guildId: membership.guildId,
        userId: { not: userId },
        createdAt: { gt: seenAfter },
      },
    }),
  ]);

  const latestLogs = members.length
    ? await db.dailyLog.findMany({
        where: {
          userId: {
            in: members.map((entry) => entry.userId),
          },
        },
        select: {
          userId: true,
          logDate: true,
          totalQp: true,
          expGained: true,
          questPassUsed: true,
        },
        orderBy: [{ userId: "asc" }, { logDate: "desc" }],
      })
    : [];

  const latestLogByUserId = latestLogs.reduce<Map<string, SocialLatestLog>>((acc, log) => {
    if (!acc.has(log.userId)) {
      acc.set(log.userId, log);
    }

    return acc;
  }, new Map());

  const ownerMembership = members.find((entry) => entry.role === "OWNER") ?? members[0];

  return {
    hasGuild: true as const,
    guild: {
      id: membership.guild.id,
      name: membership.guild.name,
      description: membership.guild.description,
      inviteCode: membership.guild.inviteCode,
      createdLabel: formatDisplayDate(membership.guild.createdAt),
      memberCount: members.length,
      role: membership.role,
      ownerUsername: ownerMembership?.user.username ?? null,
    },
    board: {
      messageCount: messages.length,
      unreadCount,
      messages: messages.map((message) => ({
        id: message.id,
        username: message.user.username,
        dateLabel: formatActivityDateLabel(message.createdAt),
        content: message.content,
        isSelf: message.userId === userId,
      })),
    },
    activityFeed: latestLogs
      .slice()
      .sort((left, right) => right.logDate.getTime() - left.logDate.getTime())
      .slice(0, 8)
      .map((entry) => {
        const member = members.find((memberEntry) => memberEntry.userId === entry.userId);

        return {
          id: `${entry.userId}-${entry.logDate.toISOString()}`,
          username: member?.user.username ?? "Unknown",
          dateLabel: formatActivityDateLabel(entry.logDate),
          totalQp: entry.totalQp,
          expGained: entry.expGained,
          questPassUsed: entry.questPassUsed,
          summary: buildGuildActivitySummary(entry),
        };
      }),
    members: members.map((entry) => {
      const social = mapSocialUser(entry.user, latestLogByUserId);

      return {
        ...social,
        role: entry.role,
        isSelf: entry.userId === userId,
      };
    }),
  };
}

export async function getHistoryData(userId: string) {
  await backfillMissedDayPunishments(userId);
  await syncDateLogIfItExists(userId, getTodayDateKey());

  const [user, logs, punishments, journalEntries] = await db.$transaction([
    db.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    }),
    db.dailyLog.findMany({
      where: { userId },
      orderBy: { logDate: "desc" },
    }),
    db.missedDayPunishment.findMany({
      where: { userId },
      include: { punishment: true },
    }),
    db.journalEntry.findMany({
      where: { userId },
      select: { entryDate: true },
      orderBy: { entryDate: "desc" },
    }),
  ]);

  const punishmentMap = groupHistoryPunishments(punishments);
  const journalDateKeys = new Set(journalEntries.map((entry) => getDateKey(entry.entryDate)));
  const todayDateKey = getTodayDateKey();
  const accountCreatedDateKey = getAccountCreatedDateKey(user?.createdAt ?? new Date());

  const historyMap = new Map(
    logs.map((entry) => [getDateKey(entry.logDate), entry]),
  );
  const recentKeys = Array.from({ length: 7 }, (_, index) => getPastDateKey(index)).filter(
    (dateKey) => dateKey >= accountCreatedDateKey,
  );
  const mergedKeys = [...new Set([
    ...recentKeys,
    ...logs
      .map((entry) => getDateKey(entry.logDate))
      .filter((dateKey) => !recentKeys.includes(dateKey)),
    ...journalEntries
      .map((entry) => getDateKey(entry.entryDate))
      .filter((dateKey) => !recentKeys.includes(dateKey)),
    ...punishments
      .map((entry) => getDateKey(entry.missedLogDate))
      .filter((dateKey) => !recentKeys.includes(dateKey)),
  ])].sort((left, right) => (left < right ? 1 : left > right ? -1 : 0));

  return {
    todayDateKey,
    logs: mergedKeys.map((dateKey) => {
      const entry = historyMap.get(dateKey);
      const logDate = entry?.logDate ?? dateFromKey(dateKey);
      const recovery = punishmentMap.get(logDate.toISOString()) ?? null;

      return {
        id: entry?.id ?? `virtual-${dateKey}`,
        dateKey,
        dateLabel: formatDisplayDate(logDate),
        anchorCount: entry?.anchorCount ?? 0,
        fullCount: entry?.fullCount ?? 0,
        totalQp: entry?.totalQp ?? 0,
        expGained: entry?.expGained ?? 0,
        questPassUsed: entry?.questPassUsed ?? false,
        journalWritten: journalDateKeys.has(dateKey),
        isToday: dateKey === todayDateKey,
        canEdit: isDateKeyEditableForAccount(dateKey, user?.createdAt ?? new Date()),
        recovery,
      };
    }),
  };
}

export async function getJournalData(userId: string) {
  const entries = await db.journalEntry.findMany({
    where: { userId },
    orderBy: { entryDate: "desc" },
  });

  const grouped = Object.entries(
    entries.reduce<Record<string, { id: string; dateLabel: string; content: string }[]>>(
      (acc, entry) => {
        const key = formatMonthYear(entry.entryDate);
        acc[key] ??= [];
        acc[key].push({
          id: entry.id,
          dateLabel: formatDisplayDate(entry.entryDate),
          content: entry.content,
        });
        return acc;
      },
      {},
    ),
  ).map(([group, entriesForGroup]) => ({
    group,
    entries: entriesForGroup,
  }));

  return { groups: grouped };
}

export async function getInsightsData(userId: string) {
  const [user, logs, punishments, taskCompletions] = await db.$transaction([
    db.user.findUnique({
      where: { id: userId },
      select: { createdAt: true },
    }),
    db.dailyLog.findMany({
      where: { userId },
      orderBy: { logDate: "desc" },
    }),
    db.missedDayPunishment.findMany({
      where: { userId },
      include: { punishment: true },
    }),
    db.dailyTaskCompletion.findMany({
      where: {
        dailyLog: {
          userId,
        },
        OR: [{ anchorCompleted: true }, { fullCompleted: true }],
      },
      include: {
        task: {
          select: {
            id: true,
            name: true,
          },
        },
        dailyLog: {
          select: {
            logDate: true,
          },
        },
      },
      orderBy: {
        dailyLog: {
          logDate: "desc",
        },
      },
    }),
  ]);

  const accountCreatedAt = user?.createdAt ?? new Date();
  const accountCreatedDateKey = getAccountCreatedDateKey(accountCreatedAt);
  const logMap = new Map(logs.map((entry) => [getDateKey(entry.logDate), entry]));
  const last7 = buildWindowTrend(logMap, 7).filter((point) => point.dateKey >= accountCreatedDateKey);
  const previous7 = buildWindowTrend(logMap, 7, 7).filter(
    (point) => point.dateKey >= accountCreatedDateKey,
  );
  const last30 = buildWindowTrend(logMap, 30).filter(
    (point) => point.dateKey >= accountCreatedDateKey,
  );
  const previous30 = buildWindowTrend(logMap, 30, 30).filter(
    (point) => point.dateKey >= accountCreatedDateKey,
  );
  const currentMonthKey = getMonthKey();
  const previousMonthKey = getMonthKey(1);
  const currentMonthLogs = logs.filter((entry) => getDateKey(entry.logDate).startsWith(currentMonthKey));
  const previousMonthLogs = logs.filter((entry) =>
    getDateKey(entry.logDate).startsWith(previousMonthKey),
  );

  const groupedRecovery = groupHistoryPunishments(punishments);
  const recoveryGroups = [...groupedRecovery.values()];
  const completedRecoveryDays = recoveryGroups.filter((group) => group.state === "completed").length;
  const longestStreak = logs.reduce(
    (max, entry) => Math.max(max, entry.streakValueForDay),
    0,
  );
  const weekdayStats = WEEKDAY_ORDER.map((weekday) => ({
    weekday,
    label: formatWeekdayLabel(weekday),
    totalQp: 0,
    averageQp: 0,
    activeDays: 0,
    zeroDays: 0,
    observedDays: 0,
  }));
  const weekdayMap = new Map(weekdayStats.map((entry) => [entry.weekday, entry]));

  last30.forEach((point) => {
    const weekday = getWeekdayKey(dateFromKey(point.dateKey));
    const current = weekdayMap.get(weekday);

    if (!current) {
      return;
    }

    current.totalQp += point.totalQp;
    current.activeDays += Number(point.totalQp > 0);
    current.zeroDays += Number(point.totalQp <= 0);
    current.observedDays += 1;
  });

  weekdayStats.forEach((entry) => {
    entry.averageQp = entry.observedDays ? entry.totalQp / entry.observedDays : 0;
  });

  const bestWeekday =
    weekdayStats
      .slice()
      .sort((left, right) => {
        if (left.averageQp !== right.averageQp) {
          return right.averageQp - left.averageQp;
        }

        if (left.activeDays !== right.activeDays) {
          return right.activeDays - left.activeDays;
        }

        return left.label.localeCompare(right.label);
      })[0] ?? null;
  const hardestWeekday =
    weekdayStats
      .slice()
      .sort((left, right) => {
        if (left.zeroDays !== right.zeroDays) {
          return right.zeroDays - left.zeroDays;
        }

        if (left.averageQp !== right.averageQp) {
          return left.averageQp - right.averageQp;
        }

        return left.label.localeCompare(right.label);
      })[0] ?? null;
  const last7StartKey = last7[0]?.dateKey ?? accountCreatedDateKey;
  const last30StartKey = last30[0]?.dateKey ?? accountCreatedDateKey;

  const taskStatsMap = taskCompletions.reduce<
    Map<
      string,
      {
        id: string;
        name: string;
        anchorCount: number;
        fullCount: number;
        recentDateKey: string;
        recent7Count: number;
        recent30Count: number;
      }
    >
  >((acc, completion) => {
    const current = acc.get(completion.task.id) ?? {
      id: completion.task.id,
      name: completion.task.name,
      anchorCount: 0,
      fullCount: 0,
      recentDateKey: getDateKey(completion.dailyLog.logDate),
      recent7Count: 0,
      recent30Count: 0,
    };

    if (completion.fullCompleted) {
      current.fullCount += 1;
    } else if (completion.anchorCompleted) {
      current.anchorCount += 1;
    }

    const completionDateKey = getDateKey(completion.dailyLog.logDate);
    if (completionDateKey > current.recentDateKey) {
      current.recentDateKey = completionDateKey;
    }
    if (completionDateKey >= last7StartKey) {
      current.recent7Count += 1;
    }
    if (completionDateKey >= last30StartKey) {
      current.recent30Count += 1;
    }

    acc.set(completion.task.id, current);
    return acc;
  }, new Map());

  const topTasks = [...taskStatsMap.values()]
    .sort((left, right) => {
      const leftScore = left.fullCount * 2 + left.anchorCount;
      const rightScore = right.fullCount * 2 + right.anchorCount;

      if (leftScore !== rightScore) {
        return rightScore - leftScore;
      }

      return left.name.localeCompare(right.name);
    })
    .slice(0, 5)
    .map((task) => {
      const totalCompletions = task.anchorCount + task.fullCount;

      return {
        ...task,
        fullRate: totalCompletions === 0 ? 0 : task.fullCount / totalCompletions,
        recent30Rate: last30.length === 0 ? 0 : task.recent30Count / last30.length,
      };
    });

  return {
    accountCreatedLabel: formatDisplayDate(accountCreatedAt),
    last7,
    last30,
    overview: {
      totalLoggedDays: logs.length,
      activeDays: logs.filter((entry) => entry.totalQp > 0).length,
      longestStreak,
      lifetimeExp: logs.reduce((sum, entry) => sum + entry.expGained, 0),
    },
    recentWindow: {
      averageQp7: averageQp(last7),
      averageQp30: averageQp(last30),
      activeDays30: countActiveDays(last30),
      zeroDays30: countZeroDays(last30),
      exp30: totalExp(last30),
    },
    comparisons: {
      last7: buildRangeComparison(last7, previous7, {
        current: "Last 7 days",
        previous: "Previous 7 days",
      }),
      last30: buildRangeComparison(last30, previous30, {
        current: "Last 30 days",
        previous: "Previous 30 days",
      }),
      month: buildRangeComparison(currentMonthLogs, previousMonthLogs, {
        current: formatMonthYear(dateFromKey(`${currentMonthKey}-01`)),
        previous: formatMonthYear(dateFromKey(`${previousMonthKey}-01`)),
      }),
    },
    currentMonth: {
      monthLabel: formatMonthYear(dateFromKey(`${currentMonthKey}-01`)),
      activeDays: currentMonthLogs.filter((entry) => entry.totalQp > 0).length,
      totalQp: currentMonthLogs.reduce((sum, entry) => sum + entry.totalQp, 0),
      totalExp: currentMonthLogs.reduce((sum, entry) => sum + entry.expGained, 0),
      questPassDays: currentMonthLogs.filter((entry) => entry.questPassUsed).length,
      fullCompletions: currentMonthLogs.reduce((sum, entry) => sum + entry.fullCount, 0),
    },
    rhythm: {
      bestWeekday,
      hardestWeekday,
      weekdays: weekdayStats,
    },
    recovery: {
      totalRecoveryDays: recoveryGroups.length,
      completedRecoveryDays,
      pendingRecoveryDays: recoveryGroups.length - completedRecoveryDays,
      completionRate:
        recoveryGroups.length === 0 ? 0 : completedRecoveryDays / recoveryGroups.length,
    },
    topTasks,
  };
}

export async function getNotificationsData(userId: string) {
  const [notifications, unreadCount, pendingPunishments, stats] = await db.$transaction([
    db.notification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    db.notification.count({
      where: {
        userId,
        readAt: null,
      },
    }),
    db.missedDayPunishment.findMany({
      where: {
        userId,
        status: "PENDING",
      },
      select: {
        missedLogDate: true,
      },
    }),
    db.userStats.findUnique({
      where: { userId },
      select: { questPassCount: true },
    }),
  ]);

  const pendingRecoveryCount = new Set(
    pendingPunishments.map((item) => getDateKey(item.missedLogDate)),
  ).size;
  const availableQuestPasses = stats?.questPassCount ?? 0;

  return {
    unreadCount,
    notifications: notifications.map((item) => ({
      id: item.id,
      kind: "event" as const,
      type: item.type,
      title: item.title,
      body: item.body,
      href: item.href,
      createdLabel: formatNotificationDateLabel(item.createdAt),
      isRead: item.readAt !== null,
      tone: mapNotificationTone(item.type),
    })),
    system: [
      ...(pendingRecoveryCount > 0
        ? [
            {
              id: "system-recovery",
              kind: "system" as const,
              title: "Recovery pending",
              body: `You still have ${pendingRecoveryCount} recovery day${
                pendingRecoveryCount === 1 ? "" : "s"
              } open.`,
              href: "/today",
              tone: "rose" as const,
            },
          ]
        : []),
      ...(availableQuestPasses > 0
        ? [
            {
              id: "system-quest-pass",
              kind: "system" as const,
              title: "Quest Pass ready",
              body: `You have ${availableQuestPasses} quest pass${
                availableQuestPasses === 1 ? "" : "es"
              } available if the system needs one.`,
              href: "/today",
              tone: "gold" as const,
            },
          ]
        : []),
    ],
  };
}

export async function getOnboardingData(userId: string) {
  const [taskCount, punishmentCount] = await db.$transaction([
    db.task.count({ where: { userId, isActive: true } }),
    db.punishment.count({ where: { userId, isActive: true } }),
  ]);

  return {
    taskCount,
    punishmentCount,
    taskReady: taskCount > 0,
    punishmentReady: punishmentCount > 0,
    ready: taskCount > 0 && punishmentCount > 0,
    completedSteps: Number(taskCount > 0) + Number(punishmentCount > 0),
    totalSteps: 2,
  };
}
