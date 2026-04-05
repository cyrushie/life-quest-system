process.loadEnvFile(".env");

const { PrismaClient } = await import("@prisma/client");

const prisma = new PrismaClient();

function getDateKey(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function getLevelState(totalExp) {
  let level = 1;
  let remaining = totalExp;

  while (remaining >= level * 1000) {
    remaining -= level * 1000;
    level += 1;
  }

  return {
    level,
    title:
      level >= 50
        ? "Architect"
        : level >= 40
          ? "Master"
          : level >= 30
            ? "Craftsman"
            : level >= 20
              ? "Adept"
              : level >= 10
                ? "Student"
                : "Apprentice",
    questPassesEarned: Math.floor(level / 10),
  };
}

function calculateDaily(tasks) {
  const anchorCount = tasks.filter((task) => task.anchorCompleted).length;
  const fullCount = tasks.filter((task) => task.fullCompleted).length;
  const baseQp = tasks.reduce((sum, task) => {
    if (task.fullCompleted) {
      return sum + task.anchorQp + task.fullQp;
    }

    if (task.anchorCompleted) {
      return sum + task.anchorQp;
    }

    return sum;
  }, 0);
  const allAnchorsCompleted =
    tasks.length > 0 &&
    tasks.every((task) => task.anchorCompleted || task.fullCompleted);
  const anchorBonus = allAnchorsCompleted ? 1 : 0;
  const fullBonus = fullCount >= 3 ? 2 : 0;
  const beforeStreakBonus = baseQp + anchorBonus + fullBonus;
  const streakBonus = 0;
  const totalQp = beforeStreakBonus + streakBonus;

  return {
    anchorCount,
    fullCount,
    baseQp,
    bonusQp: anchorBonus + fullBonus + streakBonus,
    totalQp,
    expGained: totalQp * 2000,
    allAnchorsCompleted,
    earnedFullBonus: fullCount >= 3,
  };
}

function calculateQuestPass(tasks) {
  const fullCount = tasks.length;
  const baseQp = tasks.reduce((sum, task) => sum + task.anchorQp + task.fullQp, 0);
  const anchorBonus = tasks.length > 0 ? 1 : 0;
  const fullBonus = fullCount >= 3 ? 2 : 0;
  const beforeStreakBonus = baseQp + anchorBonus + fullBonus;
  const streakBonus = 0;
  const totalQp = beforeStreakBonus + streakBonus;

  return {
    anchorCount: tasks.length,
    fullCount,
    baseQp,
    bonusQp: anchorBonus + fullBonus + streakBonus,
    totalQp,
    expGained: totalQp * 2000,
    allAnchorsCompleted: tasks.length > 0,
    earnedFullBonus: fullCount >= 3,
  };
}

async function rebuildAllUsers() {
  const users = await prisma.user.findMany({
    select: { id: true, username: true },
    orderBy: { createdAt: "asc" },
  });

  const summary = [];

  for (const user of users) {
    const [tasks, logs] = await prisma.$transaction([
      prisma.task.findMany({
        where: {
          userId: user.id,
          isActive: true,
        },
        orderBy: { createdAt: "asc" },
      }),
      prisma.dailyLog.findMany({
        where: { userId: user.id },
        orderBy: { logDate: "asc" },
        include: { taskCompletions: true },
      }),
    ]);

    let streak = 0;
    let totalExp = 0;
    let usedQuestPasses = 0;
    let previousLogDateKey = null;
    let previousQuestPassUsed = false;

    for (const log of logs) {
      const completionMap = new Map(
        log.taskCompletions.map((item) => [item.taskId, item]),
      );
      const manualCalculation = calculateDaily(
        tasks.map((task) => {
          const completion = completionMap.get(task.id);

          return {
            anchorCompleted: completion?.anchorCompleted ?? false,
            fullCompleted: completion?.fullCompleted ?? false,
            anchorQp: task.anchorQp,
            fullQp: task.fullQp,
          };
        }),
      );

      const availableBefore = Math.max(
        getLevelState(totalExp).questPassesEarned - usedQuestPasses,
        0,
      );
      const currentDateKey = getDateKey(log.logDate);
      const previousDay = new Date(new Date(log.logDate).getTime() - 86_400_000);
      const previousDayKey = getDateKey(previousDay);
      const previousStreak =
        previousLogDateKey === previousDayKey
          ? streak
          : 0;
      if (manualCalculation.totalQp >= 1 && previousStreak >= 1) {
        manualCalculation.bonusQp += 1;
        manualCalculation.totalQp += 1;
        manualCalculation.expGained += 2000;
      }
      const canUseQuestPass =
        tasks.length > 0 &&
        manualCalculation.totalQp < 1 &&
        availableBefore > 0 &&
        !(previousQuestPassUsed && previousLogDateKey === previousDayKey);

      const finalCalculation = canUseQuestPass
        ? calculateQuestPass(
            tasks.map((task) => ({
              anchorQp: task.anchorQp,
              fullQp: task.fullQp,
            })),
          )
        : manualCalculation;

      if (canUseQuestPass && previousStreak >= 1) {
        finalCalculation.bonusQp += 1;
        finalCalculation.totalQp += 1;
        finalCalculation.expGained += 2000;
      }

      totalExp += finalCalculation.expGained;
      streak = finalCalculation.totalQp >= 1 ? (previousStreak >= 1 ? previousStreak + 1 : 1) : 0;

      if (canUseQuestPass) {
        usedQuestPasses += 1;
      }

      await prisma.dailyLog.update({
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

    await prisma.userStats.upsert({
      where: { userId: user.id },
      update: {
        currentLevel: levelState.level,
        totalExp,
        currentTitle: levelState.title,
        currentStreak: streak,
        questPassCount: Math.max(levelState.questPassesEarned - usedQuestPasses, 0),
      },
      create: {
        userId: user.id,
        currentLevel: levelState.level,
        totalExp,
        currentTitle: levelState.title,
        currentStreak: streak,
        questPassCount: Math.max(levelState.questPassesEarned - usedQuestPasses, 0),
      },
    });

    summary.push({
      username: user.username,
      logs: logs.length,
      totalExp,
      currentLevel: levelState.level,
      questPassesLeft: Math.max(levelState.questPassesEarned - usedQuestPasses, 0),
    });
  }

  return summary;
}

try {
  const summary = await rebuildAllUsers();
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await prisma.$disconnect();
}
