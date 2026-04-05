import { db } from "@/lib/db";

import {
  calculateDailyProgress,
  calculateExpNeededForNextLevel,
  calculateQuestPassProgress,
  getTitleFromLevel,
} from "./game/logic";
import { dateFromKey, getDateKey, getTodayDateKey } from "./date";

type SyncableDailyLog = {
  id: string;
  logDate: Date;
  expGained: number;
  totalQp: number;
  questPassUsed: boolean;
};

export function getLevelState(totalExp: number) {
  let level = 1;
  let remaining = totalExp;

  while (remaining >= calculateExpNeededForNextLevel(level)) {
    remaining -= calculateExpNeededForNextLevel(level);
    level += 1;
  }

  return {
    level,
    expIntoLevel: remaining,
    expNeededForNextLevel: calculateExpNeededForNextLevel(level),
    title: getTitleFromLevel(level),
    questPassesEarned: Math.floor(level / 10),
  };
}

export async function ensureUserStats(userId: string) {
  return await db.userStats.upsert({
    where: { userId },
    update: {},
    create: { userId, currentTitle: getTitleFromLevel(1) },
  });
}

export async function updateOnboardingStatus(userId: string) {
  const [taskCount, punishmentCount] = await Promise.all([
    db.task.count({ where: { userId, isActive: true } }),
    db.punishment.count({ where: { userId, isActive: true } }),
  ]);

  await db.user.update({
    where: { id: userId },
    data: {
      onboardingComplete: taskCount > 0 && punishmentCount > 0,
    },
  });
}

export async function getOrCreateDailyLog(userId: string, dateKey = getTodayDateKey()) {
  const logDate = dateFromKey(dateKey);

  return await db.dailyLog.upsert({
    where: {
      userId_logDate: {
        userId,
        logDate,
      },
    },
    update: {},
    create: {
      userId,
      logDate,
    },
  });
}

export async function syncDailyLog(
  userId: string,
  dateKey = getTodayDateKey(),
  options?: {
    existingLog?: SyncableDailyLog;
  },
) {
  const log = options?.existingLog ?? (await getOrCreateDailyLog(userId, dateKey));
  const [tasks, taskCompletions, previousExistingLog, expBeforeAggregate, usedBeforeCount] =
    await db.$transaction([
    db.task.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    db.dailyTaskCompletion.findMany({
      where: { dailyLogId: log.id },
    }),
    db.dailyLog.findFirst({
      where: {
        userId,
        logDate: {
          lt: log.logDate,
        },
      },
      orderBy: { logDate: "desc" },
      select: {
        logDate: true,
        streakValueForDay: true,
        questPassUsed: true,
      },
    }),
    db.dailyLog.aggregate({
      where: {
        userId,
        logDate: {
          lt: log.logDate,
        },
      },
      _sum: {
        expGained: true,
      },
    }),
    db.dailyLog.count({
      where: {
        userId,
        logDate: {
          lt: log.logDate,
        },
        questPassUsed: true,
      },
    }),
  ]);

  const completionMap = new Map(taskCompletions.map((item) => [item.taskId, item]));
  const manualCalculation = calculateDailyProgress({
    previousStreak: 0,
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
  const manualZero = manualCalculation.totalQp < 1;
  const totalExpBefore = expBeforeAggregate._sum.expGained ?? 0;
  const earnedBefore = getLevelState(totalExpBefore).questPassesEarned;
  const availableBefore = Math.max(earnedBefore - usedBeforeCount, 0);
  const previousDayKey = getDateKey(new Date(log.logDate.getTime() - 86_400_000));
  const previousDayUsedQuestPass =
    previousExistingLog?.questPassUsed === true &&
    getDateKey(previousExistingLog.logDate) === previousDayKey;
  const previousStreak =
    previousExistingLog && getDateKey(previousExistingLog.logDate) === previousDayKey
      ? previousExistingLog.streakValueForDay
      : 0;
  const shouldUseQuestPass =
    tasks.length > 0 &&
    manualZero &&
    availableBefore > 0 &&
    !previousDayUsedQuestPass;
  const calculation = shouldUseQuestPass
    ? calculateQuestPassProgress(
        tasks.map((task) => ({
          anchorQp: task.anchorQp,
          fullQp: task.fullQp,
        })),
        previousStreak,
      )
    : calculateDailyProgress({
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

  const updatedLog = await db.dailyLog.update({
    where: { id: log.id },
    data: {
      anchorCount: calculation.anchorCount,
      fullCount: calculation.fullCount,
      baseQp: calculation.baseQp,
      bonusQp: calculation.bonusQp,
      totalQp: calculation.totalQp,
      expGained: calculation.expGained,
      streakValueForDay: calculation.newStreak,
      questPassUsed: shouldUseQuestPass,
      allAnchorsCompleted: calculation.allAnchorsCompleted,
      threeFullBonusEarned: calculation.earnedFullBonus,
    },
  });

  await syncMissedDayPunishment(userId, updatedLog.logDate, updatedLog.totalQp);

  if (getDateKey(updatedLog.logDate) === getTodayDateKey()) {
    await refreshUserStatsForTodayChange(userId, log, updatedLog);
  } else {
    await recalculateUserProgress(userId);
  }

  return updatedLog;
}

export async function syncMissedDayPunishment(
  userId: string,
  logDate: Date,
  totalQp: number,
) {
  const existing = await db.missedDayPunishment.findMany({
    where: {
      userId,
      missedLogDate: logDate,
    },
  });

  if (totalQp > 0) {
    if (existing.length) {
      await db.missedDayPunishment.deleteMany({
        where: {
          userId,
          missedLogDate: logDate,
        },
      });
    }

    return;
  }

  const punishments = await db.punishment.findMany({
    where: { userId, isActive: true },
    orderBy: { createdAt: "asc" },
  });

  if (!punishments.length) {
    return;
  }

  const existingPunishmentIds = new Set(existing.map((item) => item.punishmentId));
  const missingPunishments = punishments.filter(
    (punishment) => !existingPunishmentIds.has(punishment.id),
  );

  if (!missingPunishments.length) {
    return;
  }

  await db.missedDayPunishment.createMany({
    data: missingPunishments.map((punishment) => ({
      userId,
      missedLogDate: logDate,
      punishmentId: punishment.id,
    })),
  });
}

async function materializeMissingPastLogs(userId: string) {
  const [firstTask, logs] = await db.$transaction([
    db.task.findFirst({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { createdAt: true },
    }),
    db.dailyLog.findMany({
      where: { userId },
      select: { logDate: true },
      orderBy: { logDate: "asc" },
    }),
  ]);

  if (!firstTask) {
    return false;
  }

  const todayKey = getTodayDateKey();
  const todayDate = dateFromKey(todayKey);
  const existingKeys = new Set(logs.map((log) => getDateKey(log.logDate)));
  const missingDates: Date[] = [];
  const cursor = dateFromKey(getDateKey(firstTask.createdAt));

  while (cursor < todayDate) {
    const dateKey = getDateKey(cursor);

    if (!existingKeys.has(dateKey)) {
      missingDates.push(dateFromKey(dateKey));
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  if (!missingDates.length) {
    return false;
  }

  await db.dailyLog.createMany({
    data: missingDates.map((logDate) => ({
      userId,
      logDate,
    })),
    skipDuplicates: true,
  });

  return true;
}

export async function backfillMissedDayPunishments(userId: string) {
  const createdMissingLogs = await materializeMissingPastLogs(userId);

  if (createdMissingLogs) {
    await recalculateUserProgress(userId);
  }

  const [zeroLogs, activePunishments, existing] = await db.$transaction([
    db.dailyLog.findMany({
      where: {
        userId,
        totalQp: 0,
      },
      select: {
        logDate: true,
      },
    }),
    db.punishment.findMany({
      where: {
        userId,
        isActive: true,
      },
      select: {
        id: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    db.missedDayPunishment.findMany({
      where: {
        userId,
      },
      select: {
        id: true,
        missedLogDate: true,
        punishmentId: true,
      },
    }),
  ]);

  const zeroLogDateKeys = new Set(zeroLogs.map((log) => log.logDate.toISOString()));
  const existingPairs = new Set(
    existing.map((item) => `${item.missedLogDate.toISOString()}::${item.punishmentId}`),
  );

  const staleIds = existing
    .filter((item) => !zeroLogDateKeys.has(item.missedLogDate.toISOString()))
    .map((item) => item.id);

  if (staleIds.length) {
    await db.missedDayPunishment.deleteMany({
      where: {
        id: {
          in: staleIds,
        },
      },
    });
  }

  if (!zeroLogs.length || !activePunishments.length) {
    return;
  }

  const missingRows = zeroLogs.flatMap((log) =>
    activePunishments
      .filter((punishment) => !existingPairs.has(`${log.logDate.toISOString()}::${punishment.id}`))
      .map((punishment) => ({
        userId,
        missedLogDate: log.logDate,
        punishmentId: punishment.id,
      })),
  );

  if (!missingRows.length) {
    return;
  }

  await db.missedDayPunishment.createMany({
    data: missingRows,
    skipDuplicates: true,
  });
}

export async function recalculateUserProgress(userId: string) {
  const [tasks, logs] = await db.$transaction([
    db.task.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    db.dailyLog.findMany({
      where: { userId },
      orderBy: { logDate: "asc" },
      include: { taskCompletions: true },
    }),
  ]);

  let streak = 0;
  let totalExp = 0;
  let usedQuestPasses = 0;
  let previousLogDateKey: string | null = null;
  let previousQuestPassUsed = false;

  for (const log of logs) {
    const completionMap = new Map(log.taskCompletions.map((item) => [item.taskId, item]));
    const currentDateKey = getDateKey(log.logDate);
    const previousDayKey = getDateKey(new Date(log.logDate.getTime() - 86_400_000));
    const previousStreak =
      previousLogDateKey === previousDayKey
        ? streak
        : 0;
    const manualCalculation = calculateDailyProgress({
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
    const availableBefore = Math.max(getLevelState(totalExp).questPassesEarned - usedQuestPasses, 0);
    const canUseQuestPass: boolean =
      tasks.length > 0 &&
      manualCalculation.totalQp < 1 &&
      availableBefore > 0 &&
      !(previousQuestPassUsed && previousLogDateKey === previousDayKey);
    const finalCalculation = canUseQuestPass
      ? calculateQuestPassProgress(
          tasks.map((task) => ({
            anchorQp: task.anchorQp,
            fullQp: task.fullQp,
          })),
          previousStreak,
        )
      : manualCalculation;

    totalExp += finalCalculation.expGained;
    streak = finalCalculation.newStreak;
    if (canUseQuestPass) {
      usedQuestPasses += 1;
    }

    await db.dailyLog.update({
      where: { id: log.id },
      data: {
        anchorCount: finalCalculation.anchorCount,
        fullCount: finalCalculation.fullCount,
        baseQp: finalCalculation.baseQp,
        bonusQp: finalCalculation.bonusQp,
        totalQp: finalCalculation.totalQp,
        expGained: finalCalculation.expGained,
        streakValueForDay: streak,
        questPassUsed: canUseQuestPass,
        allAnchorsCompleted: finalCalculation.allAnchorsCompleted,
        threeFullBonusEarned: finalCalculation.earnedFullBonus,
      },
    });

    previousQuestPassUsed = canUseQuestPass;
    previousLogDateKey = currentDateKey;
  }

  const levelState = getLevelState(totalExp);

  await db.userStats.upsert({
    where: { userId },
    update: {
      currentLevel: levelState.level,
      totalExp,
      currentTitle: levelState.title,
      currentStreak: streak,
      questPassCount: Math.max(levelState.questPassesEarned - usedQuestPasses, 0),
    },
    create: {
      userId,
      currentLevel: levelState.level,
      totalExp,
      currentTitle: levelState.title,
      currentStreak: streak,
      questPassCount: Math.max(levelState.questPassesEarned - usedQuestPasses, 0),
    },
  });
}

export async function refreshUserStatsSnapshot(userId: string) {
  const [expAggregate, logsDescending, usedQuestPasses] = await db.$transaction([
    db.dailyLog.aggregate({
      where: { userId },
      _sum: { expGained: true },
    }),
    db.dailyLog.findMany({
      where: { userId },
      orderBy: { logDate: "desc" },
      select: { totalQp: true },
    }),
    db.dailyLog.count({
      where: { userId, questPassUsed: true },
    }),
  ]);

  let currentStreak = 0;

  for (const log of logsDescending) {
    if (log.totalQp < 1) {
      break;
    }

    currentStreak += 1;
  }

  const totalExp = expAggregate._sum.expGained ?? 0;
  const levelState = getLevelState(totalExp);

  await db.userStats.upsert({
    where: { userId },
    update: {
      currentLevel: levelState.level,
      totalExp,
      currentTitle: levelState.title,
      currentStreak,
      questPassCount: Math.max(levelState.questPassesEarned - usedQuestPasses, 0),
    },
    create: {
      userId,
      currentLevel: levelState.level,
      totalExp,
      currentTitle: levelState.title,
      currentStreak,
      questPassCount: Math.max(levelState.questPassesEarned - usedQuestPasses, 0),
    },
  });
}

async function refreshUserStatsForTodayChange(
  userId: string,
  previousLog: SyncableDailyLog,
  updatedLog: {
    expGained: number;
    streakValueForDay: number;
    questPassUsed: boolean;
  },
) {
  const existingStats = await db.userStats.findUnique({
    where: { userId },
    select: {
      currentLevel: true,
      totalExp: true,
      questPassCount: true,
    },
  });

  const totalExp = Math.max(
    0,
    (existingStats?.totalExp ?? 0) - previousLog.expGained + updatedLog.expGained,
  );
  const levelState = getLevelState(totalExp);
  const previousMilestoneCount = Math.floor((existingStats?.currentLevel ?? 1) / 10);
  const nextMilestoneCount = levelState.questPassesEarned;
  const milestoneDelta = nextMilestoneCount - previousMilestoneCount;
  const questPassUsageDelta =
    Number(updatedLog.questPassUsed) - Number(previousLog.questPassUsed);
  const questPassCount = Math.max(
    0,
    (existingStats?.questPassCount ?? 0) + milestoneDelta - questPassUsageDelta,
  );

  await db.userStats.upsert({
    where: { userId },
    update: {
      currentLevel: levelState.level,
      totalExp,
      currentTitle: levelState.title,
      currentStreak: updatedLog.streakValueForDay,
      questPassCount,
    },
    create: {
      userId,
      currentLevel: levelState.level,
      totalExp,
      currentTitle: levelState.title,
      currentStreak: updatedLog.streakValueForDay,
      questPassCount,
    },
  });
}

export async function getTodaySummary(userId: string) {
  const today = getTodayDateKey();
  const log = await getOrCreateDailyLog(userId, today);
  return await db.dailyLog.findUnique({
    where: { id: log.id },
    include: {
      taskCompletions: true,
    },
  });
}

export async function getPreviousDateKey(dateKey: string) {
  const current = dateFromKey(dateKey);
  current.setUTCDate(current.getUTCDate() - 1);
  return getDateKey(current);
}
