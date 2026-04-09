import fs from "node:fs/promises";
import path from "node:path";

process.loadEnvFile?.(".env");

const dataDir = path.join(process.cwd(), "src", "lib", "database-data");

const tablePlan = [
  { file: "User.json", model: "user", dateFields: ["createdAt", "updatedAt"] },
  { file: "UserStats.json", model: "userStats", dateFields: ["updatedAt"] },
  { file: "Guild.json", model: "guild", dateFields: ["createdAt", "updatedAt"] },
  { file: "Task.json", model: "task", dateFields: ["createdAt", "updatedAt"] },
  { file: "Punishment.json", model: "punishment", dateFields: ["createdAt", "updatedAt"] },
  { file: "DailyLog.json", model: "dailyLog", dateFields: ["logDate", "createdAt", "updatedAt"] },
  { file: "JournalEntry.json", model: "journalEntry", dateFields: ["entryDate", "createdAt", "updatedAt"] },
  {
    file: "ExercisePlanItem.json",
    model: "exercisePlanItem",
    dateFields: ["createdAt", "updatedAt"],
  },
  { file: "Friendship.json", model: "friendship", dateFields: ["createdAt", "updatedAt"] },
  {
    file: "GuildMembership.json",
    model: "guildMembership",
    dateFields: ["lastBoardSeenAt", "createdAt", "updatedAt"],
  },
  { file: "GuildMessage.json", model: "guildMessage", dateFields: ["createdAt", "updatedAt"] },
  {
    file: "DailyTaskCompletion.json",
    model: "dailyTaskCompletion",
    dateFields: ["createdAt", "updatedAt"],
  },
  {
    file: "MissedDayPunishment.json",
    model: "missedDayPunishment",
    dateFields: ["missedLogDate", "completedAt", "createdAt", "updatedAt"],
  },
  {
    file: "QuestPassEvent.json",
    model: "questPassEvent",
    dateFields: ["relatedDate", "createdAt"],
  },
  { file: "Notification.json", model: "notification", dateFields: ["readAt", "createdAt"] },
];

function normalizeRow(row, dateFields) {
  const normalized = { ...row };

  for (const field of dateFields) {
    if (normalized[field] !== null && normalized[field] !== undefined) {
      normalized[field] = new Date(normalized[field]);
    }
  }

  return normalized;
}

async function loadRows(file, dateFields) {
  const raw = await fs.readFile(path.join(dataDir, file), "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed)) {
    throw new Error(`${file} did not contain a JSON array.`);
  }

  return parsed.map((row) => normalizeRow(row, dateFields));
}

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

try {
  const counts = [];

  for (const entry of tablePlan) {
    const rows = await loadRows(entry.file, entry.dateFields);

    if (!rows.length) {
      counts.push({ model: entry.model, inserted: 0, skipped: true });
      continue;
    }

    const result = await prisma[entry.model].createMany({
      data: rows,
      skipDuplicates: true,
    });

    counts.push({ model: entry.model, inserted: result.count, skipped: false });
  }

  console.log(JSON.stringify(counts, null, 2));
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
