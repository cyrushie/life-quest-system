export type QuestCompletion = {
  anchorCompleted: boolean;
  fullCompleted: boolean;
  anchorQp: number;
  fullQp: number;
};

export type DailyCalculationInput = {
  tasks: QuestCompletion[];
  previousStreak: number;
};

export type DailyCalculationResult = {
  anchorCount: number;
  fullCount: number;
  baseQp: number;
  bonusQp: number;
  totalQp: number;
  expGained: number;
  streakContinues: boolean;
  newStreak: number;
  allAnchorsCompleted: boolean;
  earnedFullBonus: boolean;
};

export const EXP_PER_QP = 2000;

export function calculateDailyProgress(
  input: DailyCalculationInput,
): DailyCalculationResult {
  const anchorCount = input.tasks.filter((task) => task.anchorCompleted).length;
  const fullCount = input.tasks.filter((task) => task.fullCompleted).length;

  const baseQp = input.tasks.reduce((sum, task) => {
    if (task.fullCompleted) {
      return sum + task.fullQp;
    }

    if (task.anchorCompleted) {
      return sum + task.anchorQp;
    }

    return sum;
  }, 0);

  const allAnchorsCompleted =
    input.tasks.length > 0 &&
    input.tasks.every((task) => task.anchorCompleted || task.fullCompleted);
  const anchorBonus = allAnchorsCompleted ? 1 : 0;
  const earnedFullBonus = fullCount >= 3;
  const fullBonus = earnedFullBonus ? 2 : 0;
  const beforeStreakBonus = baseQp + anchorBonus + fullBonus;
  const streakContinues = beforeStreakBonus >= 1;
  const streakBonus = streakContinues ? 1 : 0;
  const totalQp = beforeStreakBonus + streakBonus;

  return {
    anchorCount,
    fullCount,
    baseQp,
    bonusQp: anchorBonus + fullBonus + streakBonus,
    totalQp,
    expGained: totalQp * EXP_PER_QP,
    streakContinues,
    newStreak: streakContinues ? input.previousStreak + 1 : 0,
    allAnchorsCompleted,
    earnedFullBonus,
  };
}

export function calculateQuestPassProgress(
  tasks: Pick<QuestCompletion, "fullQp">[],
): DailyCalculationResult {
  const fullCount = tasks.length;
  const baseQp = tasks.reduce((sum, task) => sum + task.fullQp, 0);
  const allAnchorsCompleted = tasks.length > 0;
  const anchorBonus = allAnchorsCompleted ? 1 : 0;
  const earnedFullBonus = fullCount >= 3;
  const fullBonus = earnedFullBonus ? 2 : 0;
  const beforeStreakBonus = baseQp + anchorBonus + fullBonus;
  const streakBonus = beforeStreakBonus >= 1 ? 1 : 0;
  const totalQp = beforeStreakBonus + streakBonus;

  return {
    anchorCount: tasks.length,
    fullCount,
    baseQp,
    bonusQp: anchorBonus + fullBonus + streakBonus,
    totalQp,
    expGained: totalQp * EXP_PER_QP,
    streakContinues: totalQp >= 1,
    newStreak: totalQp >= 1 ? 1 : 0,
    allAnchorsCompleted,
    earnedFullBonus,
  };
}

export function getTitleFromLevel(level: number) {
  if (level >= 50) return "Architect";
  if (level >= 40) return "Master";
  if (level >= 30) return "Craftsman";
  if (level >= 20) return "Adept";
  if (level >= 10) return "Student";
  return "Apprentice";
}

export function calculateExpNeededForNextLevel(level: number) {
  return level * 1000;
}
