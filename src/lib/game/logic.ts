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

export const TITLE_LADDER = [
  { min: 360, title: "Legend" },
  { min: 340, title: "Architect" },
  { min: 320, title: "Mythic" },
  { min: 300, title: "Exalted" },
  { min: 280, title: "Ascendant" },
  { min: 260, title: "Paragon" },
  { min: 240, title: "Grandmaster" },
  { min: 220, title: "Master" },
  { min: 200, title: "Sage" },
  { min: 180, title: "Commander" },
  { min: 160, title: "Champion" },
  { min: 140, title: "Knight" },
  { min: 120, title: "Tactician" },
  { min: 105, title: "Warden" },
  { min: 90, title: "Vanguard" },
  { min: 75, title: "Pathfinder" },
  { min: 60, title: "Adept" },
  { min: 45, title: "Aspirant" },
  { min: 30, title: "Seeker" },
  { min: 20, title: "Disciple" },
  { min: 10, title: "Initiate" },
  { min: 1, title: "Wanderer" },
] as const;

export function calculateDailyProgress(
  input: DailyCalculationInput,
): DailyCalculationResult {
  const anchorCount = input.tasks.filter((task) => task.anchorCompleted).length;
  const fullCount = input.tasks.filter((task) => task.fullCompleted).length;

  const baseQp = input.tasks.reduce((sum, task) => {
    if (task.fullCompleted) {
      return sum + task.anchorQp + task.fullQp;
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
  const dayQualifies = beforeStreakBonus >= 1;
  const streakContinues = dayQualifies && input.previousStreak >= 1;
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
    newStreak: dayQualifies ? (streakContinues ? input.previousStreak + 1 : 1) : 0,
    allAnchorsCompleted,
    earnedFullBonus,
  };
}

export function calculateQuestPassProgress(
  tasks: Pick<QuestCompletion, "anchorQp" | "fullQp">[],
  previousStreak: number,
): DailyCalculationResult {
  const fullCount = tasks.length;
  const baseQp = tasks.reduce((sum, task) => sum + task.anchorQp + task.fullQp, 0);
  const allAnchorsCompleted = tasks.length > 0;
  const anchorBonus = allAnchorsCompleted ? 1 : 0;
  const earnedFullBonus = fullCount >= 3;
  const fullBonus = earnedFullBonus ? 2 : 0;
  const beforeStreakBonus = baseQp + anchorBonus + fullBonus;
  const dayQualifies = beforeStreakBonus >= 1;
  const streakContinues = dayQualifies && previousStreak >= 1;
  const streakBonus = streakContinues ? 1 : 0;
  const totalQp = beforeStreakBonus + streakBonus;

  return {
    anchorCount: tasks.length,
    fullCount,
    baseQp,
    bonusQp: anchorBonus + fullBonus + streakBonus,
    totalQp,
    expGained: totalQp * EXP_PER_QP,
    streakContinues,
    newStreak: dayQualifies ? (streakContinues ? previousStreak + 1 : 1) : 0,
    allAnchorsCompleted,
    earnedFullBonus,
  };
}

export function getTitleFromLevel(level: number) {
  return TITLE_LADDER.find((entry) => level >= entry.min)?.title ?? "Wanderer";
}

export function calculateExpNeededForNextLevel(level: number) {
  return level * 1000;
}
