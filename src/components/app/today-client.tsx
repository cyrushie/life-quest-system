"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import {
  completePunishmentAction,
  saveJournalAction,
  setTaskCompletionAction,
  togglePunishmentItemAction,
} from "@/app/(app)/actions";
import {
  invalidateCachedJson,
  setCachedJson,
  useCachedJson,
} from "@/lib/client/use-cached-json";
import { broadcastAppSync } from "@/lib/client/app-sync";
import { calculateDailyProgress } from "@/lib/game/logic";

type TodayTask = {
  id: string;
  name: string;
  anchorDescription: string;
  fullDescription: string;
  anchorQp: number;
  fullQp: number;
  status: "anchor" | "full" | "clear";
};

type TodayPunishmentItem = {
  id: string;
  name: string;
  description: string | null;
  isChecked: boolean;
};

type TodayPunishmentGroup = {
  dateKey: string;
  missedDateLabel: string;
  items: TodayPunishmentItem[];
};

type TodayData = {
  todayKey: string;
  todayLabel: string;
  isToday: boolean;
  canEdit: boolean;
  questPassUsed: boolean;
  availableQuestPasses: number;
  tasks: TodayTask[];
  liveCalculation: {
    baseQp: number;
    bonusQp: number;
    totalQp: number;
    expGained: number;
    allAnchorsCompleted: boolean;
    earnedFullBonus: boolean;
    fullCount: number;
  };
  journalContent: string;
  exercisePlan: {
    dayLabel: string;
    items: {
      id: string;
      title: string;
      notes: string | null;
      durationText: string | null;
    }[];
  };
  pendingPunishments: TodayPunishmentGroup[];
};

type FeedbackState =
  | {
      tone: "error" | "success";
      message: string;
    }
  | null;

const TODAY_API_URL = "/api/app/today";
const DASHBOARD_API_URL = "/api/app/dashboard";
const HISTORY_API_URL = "/api/app/history";
const JOURNAL_API_URL = "/api/app/journal";

export function TodayClient({
  dateKey,
  refreshKey,
}: {
  dateKey: string;
  refreshKey: string;
}) {
  const todayApiUrl = `${TODAY_API_URL}?date=${dateKey}`;
  const { data, loading, error } = useCachedJson<TodayData>(todayApiUrl, refreshKey);
  const [optimisticTasks, setOptimisticTasks] = useState<TodayTask[]>([]);
  const [optimisticPunishments, setOptimisticPunishments] = useState<TodayPunishmentGroup[]>([]);
  const [journalDraft, setJournalDraft] = useState("");
  const [lastSavedJournal, setLastSavedJournal] = useState("");
  const [taskFeedback, setTaskFeedback] = useState<FeedbackState>(null);
  const [journalFeedback, setJournalFeedback] = useState<FeedbackState>(null);
  const [punishmentFeedback, setPunishmentFeedback] = useState<FeedbackState>(null);
  const [syncingTaskIds, setSyncingTaskIds] = useState<string[]>([]);
  const [syncingPunishmentItemIds, setSyncingPunishmentItemIds] = useState<string[]>([]);
  const [syncingPunishmentDayKeys, setSyncingPunishmentDayKeys] = useState<string[]>([]);
  const taskRequestVersionRef = useRef<Record<string, number>>({});
  const punishmentItemRequestVersionRef = useRef<Record<string, number>>({});
  const punishmentDayRequestVersionRef = useRef<Record<string, number>>({});
  const [isJournalPending, startJournalTransition] = useTransition();

  const isJournalDirty = journalDraft !== lastSavedJournal;

  useEffect(() => {
    if (!data) {
      return;
    }

    setOptimisticTasks(data.tasks);
    setOptimisticPunishments(data.pendingPunishments);
    setLastSavedJournal(data.journalContent);

    if (!isJournalDirty) {
      setJournalDraft(data.journalContent);
    }
  }, [data, isJournalDirty]);

  if (loading && !data) {
    return <section className="quest-panel h-[34rem] animate-pulse bg-white/[0.03]" />;
  }

  if (error || !data) {
    return (
      <section className="quest-panel">
        <p className="text-sm text-rose-200">{error ?? "Failed to load today."}</p>
      </section>
    );
  }

  const todayData = data;
  const liveCalculation = calculateLiveCalculation(optimisticTasks);
  const syncingCount =
    syncingTaskIds.length +
    syncingPunishmentItemIds.length +
    syncingPunishmentDayKeys.length +
    (isJournalPending ? 1 : 0);
  let activeStatus = "All changes saved";

  if (isJournalPending) {
    activeStatus = "Saving journal";
  } else if (syncingTaskIds.length) {
    activeStatus = syncingTaskIds.length === 1 ? "Saving task" : "Saving tasks";
  } else if (syncingPunishmentDayKeys.length) {
    activeStatus = "Closing recovery";
  } else if (syncingPunishmentItemIds.length) {
    activeStatus = "Saving recovery";
  }

  async function refreshTodayData() {
    const response = await fetch(todayApiUrl, {
      credentials: "same-origin",
      cache: "no-store",
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh today: ${response.status}`);
    }

    const fresh = (await response.json()) as TodayData;
    setCachedJson(todayApiUrl, fresh);
    return fresh;
  }

  function writeTodayCache(
    nextTasks: TodayTask[],
    nextJournalContent: string,
    nextPunishments: TodayPunishmentGroup[],
  ) {
    setCachedJson<TodayData>(todayApiUrl, {
      ...todayData,
      tasks: nextTasks,
      journalContent: nextJournalContent,
      pendingPunishments: nextPunishments,
      liveCalculation: calculateLiveCalculation(nextTasks),
    });
  }

  function updateTaskStatus(taskId: string, mode: TodayTask["status"]) {
    return optimisticTasks.map((task) =>
      task.id === taskId ? { ...task, status: mode } : task,
    );
  }

  function handleTaskUpdate(taskId: string, mode: TodayTask["status"]) {
    if (!todayData.canEdit) {
      return;
    }

    const nextTasks = updateTaskStatus(taskId, mode);
    const requestVersion = (taskRequestVersionRef.current[taskId] ?? 0) + 1;

    taskRequestVersionRef.current[taskId] = requestVersion;

    setTaskFeedback(null);
    setOptimisticTasks(nextTasks);
    writeTodayCache(nextTasks, lastSavedJournal, optimisticPunishments);
    setSyncingTaskIds((current) => (current.includes(taskId) ? current : [...current, taskId]));
    invalidateCachedJson(DASHBOARD_API_URL);
    invalidateCachedJson(HISTORY_API_URL);

    void (async () => {
      try {
        const formData = new FormData();
        formData.set("taskId", taskId);
        formData.set("dateKey", todayData.todayKey);
        formData.set("mode", mode);
        await setTaskCompletionAction(formData);
        broadcastAppSync("today-task-updated");

        if (taskRequestVersionRef.current[taskId] === requestVersion) {
          void refreshTodayData();
        }
      } catch {
        if (taskRequestVersionRef.current[taskId] === requestVersion) {
          setTaskFeedback({
            tone: "error",
            message: "A task update missed sync. The board is refreshing.",
          });
          void refreshTodayData();
        }
      } finally {
        if (taskRequestVersionRef.current[taskId] === requestVersion) {
          setSyncingTaskIds((current) => current.filter((id) => id !== taskId));
        }
      }
    })();
  }

  function handleJournalSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!todayData.canEdit) {
      return;
    }

    const previousSavedJournal = lastSavedJournal;
    setJournalFeedback(null);
    setLastSavedJournal(journalDraft);
    writeTodayCache(optimisticTasks, journalDraft, optimisticPunishments);
    invalidateCachedJson(JOURNAL_API_URL);

    startJournalTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("dateKey", todayData.todayKey);
        formData.set("content", journalDraft);
        const result = await saveJournalAction({}, formData);

        if (result.error) {
          throw new Error(result.error);
        }

        setJournalFeedback({
          tone: "success",
          message: result.success ?? "Journal saved.",
        });
        broadcastAppSync("today-journal-saved");
        void refreshTodayData();
      } catch (caughtError) {
        setLastSavedJournal(previousSavedJournal);
        writeTodayCache(optimisticTasks, previousSavedJournal, optimisticPunishments);
        setJournalFeedback({
          tone: "error",
          message:
            caughtError instanceof Error
              ? caughtError.message
              : "Journal save failed. Your draft is still here.",
        });
      }
    });
  }

  function togglePunishmentChecked(obligationId: string, checked: boolean) {
    const nextPunishments = optimisticPunishments.map((group) => ({
      ...group,
      items: group.items.map((item) =>
        item.id === obligationId ? { ...item, isChecked: checked } : item,
      ),
    }));
    const requestVersion =
      (punishmentItemRequestVersionRef.current[obligationId] ?? 0) + 1;

    punishmentItemRequestVersionRef.current[obligationId] = requestVersion;

    setPunishmentFeedback(null);
    setOptimisticPunishments(nextPunishments);
    writeTodayCache(optimisticTasks, lastSavedJournal, nextPunishments);
    setSyncingPunishmentItemIds((current) =>
      current.includes(obligationId) ? current : [...current, obligationId],
    );
    invalidateCachedJson(DASHBOARD_API_URL);
    invalidateCachedJson(HISTORY_API_URL);

    void (async () => {
      try {
        const formData = new FormData();
        formData.set("obligationId", obligationId);
        formData.set("checked", String(checked));
        await togglePunishmentItemAction(formData);
        broadcastAppSync("today-punishment-item-updated");

        if (punishmentItemRequestVersionRef.current[obligationId] === requestVersion) {
          void refreshTodayData();
        }
      } catch {
        if (punishmentItemRequestVersionRef.current[obligationId] === requestVersion) {
          setPunishmentFeedback({
            tone: "error",
            message: "A recovery checklist update missed sync. The list is refreshing.",
          });
          void refreshTodayData();
        }
      } finally {
        if (punishmentItemRequestVersionRef.current[obligationId] === requestVersion) {
          setSyncingPunishmentItemIds((current) =>
            current.filter((id) => id !== obligationId),
          );
        }
      }
    })();
  }

  function completePunishmentDay(dateKey: string) {
    const nextPunishments = optimisticPunishments.filter(
      (group) => group.dateKey !== dateKey,
    );
    const requestVersion = (punishmentDayRequestVersionRef.current[dateKey] ?? 0) + 1;

    punishmentDayRequestVersionRef.current[dateKey] = requestVersion;

    setPunishmentFeedback(null);
    setOptimisticPunishments(nextPunishments);
    writeTodayCache(optimisticTasks, lastSavedJournal, nextPunishments);
    setSyncingPunishmentDayKeys((current) =>
      current.includes(dateKey) ? current : [...current, dateKey],
    );
    invalidateCachedJson(DASHBOARD_API_URL);
    invalidateCachedJson(HISTORY_API_URL);

    void (async () => {
      try {
        const formData = new FormData();
        formData.set("dateKey", dateKey);
        await completePunishmentAction(formData);
        broadcastAppSync("today-punishment-group-completed");

        if (punishmentDayRequestVersionRef.current[dateKey] === requestVersion) {
          void refreshTodayData();
        }
      } catch (caughtError) {
        if (punishmentDayRequestVersionRef.current[dateKey] === requestVersion) {
          setPunishmentFeedback({
            tone: "error",
            message:
              caughtError instanceof Error
                ? caughtError.message
                : "This recovery group could not be closed yet.",
          });
          void refreshTodayData();
        }
      } finally {
        if (punishmentDayRequestVersionRef.current[dateKey] === requestVersion) {
          setSyncingPunishmentDayKeys((current) =>
            current.filter((key) => key !== dateKey),
          );
        }
      }
    })();
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="quest-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="page-label">{todayData.isToday ? "Today" : "Date log"}</p>
            <h1 className="page-title">{todayData.todayLabel}</h1>
            <p className="page-copy">
              {todayData.canEdit
                ? todayData.isToday
                  ? "Track the current day."
                  : "Editing a past day within the 7-day window."
                : "This date is outside the 7-day edit window and is read-only."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!todayData.isToday ? (
              <Link className="quest-button quest-button-secondary" href="/history">
                Back to history
              </Link>
            ) : null}
            <div className={`status-pill ${syncingCount ? "status-pill-live" : ""}`}>
              <span className="status-dot" />
              <strong>{activeStatus}</strong>
            </div>
          </div>
        </div>

        {(taskFeedback || punishmentFeedback) && (
          <InlineFeedback
            className="mt-4"
            message={taskFeedback?.message ?? punishmentFeedback?.message ?? ""}
            tone={taskFeedback?.tone ?? punishmentFeedback?.tone ?? "error"}
          />
        )}

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <SummaryCard label="Base" value={liveCalculation.baseQp} />
          <SummaryCard label="Bonus" value={liveCalculation.bonusQp} />
          <SummaryCard label="Total" value={liveCalculation.totalQp} />
          <SummaryCard label="EXP" value={`+${liveCalculation.expGained}`} />
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className={`status-pill ${todayData.questPassUsed ? "status-pill-live" : ""}`}>
            <span className="status-dot" />
            <strong>{todayData.questPassUsed ? "Quest pass used" : "Manual day"}</strong>
          </span>
          <span className="status-pill">
            <strong>{todayData.availableQuestPasses}</strong> pass
            {todayData.availableQuestPasses === 1 ? "" : "es"} left
          </span>
        </div>

        <div className="mt-4 compact-list">
          {optimisticTasks.length ? (
            optimisticTasks.map((task) => (
              <article
                key={task.id}
                className="rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-serif text-xl text-stone-50">{task.name}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="status-pill">A {task.anchorQp} QP</span>
                      <span className="status-pill">F {task.fullQp} QP</span>
                      <span className="status-pill">
                        {task.status === "clear" ? "Not done" : task.status}
                      </span>
                      {syncingTaskIds.includes(task.id) ? (
                        <span className="status-pill status-pill-live">
                          <span className="status-dot" />
                          Saving
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <CompletionButton
                      disabled={!todayData.canEdit}
                      isActive={task.status === "anchor"}
                      label="Anchor"
                      onClick={() => handleTaskUpdate(task.id, "anchor")}
                    />
                    <CompletionButton
                      disabled={!todayData.canEdit}
                      isActive={task.status === "full"}
                      label="Full"
                      onClick={() => handleTaskUpdate(task.id, "full")}
                    />
                    <CompletionButton
                      disabled={!todayData.canEdit}
                      isActive={task.status === "clear"}
                      label="Clear"
                      onClick={() => handleTaskUpdate(task.id, "clear")}
                    />
                  </div>
                </div>

                <details className="detail-toggle">
                  <summary>Quest details</summary>
                  <div className="mt-3 grid gap-3 text-sm text-stone-400 md:grid-cols-2">
                    <div className="rounded-2xl border border-white/6 bg-black/15 p-3">
                      <p className="mini-card-label">Anchor</p>
                      <p className="mt-2 leading-7">{task.anchorDescription}</p>
                    </div>
                    <div className="rounded-2xl border border-white/6 bg-black/15 p-3">
                      <p className="mini-card-label">Full</p>
                      <p className="mt-2 leading-7">{task.fullDescription}</p>
                    </div>
                  </div>
                </details>
              </article>
            ))
          ) : (
            <EmptyState message="No active tasks yet." />
          )}
        </div>
      </section>

      <div className="grid gap-4">
        <section className="quest-panel">
          <p className="page-label">Daily log</p>
          <form className="mt-3 space-y-3" onSubmit={handleJournalSubmit}>
            <textarea
              disabled={!todayData.canEdit}
              name="content"
              onChange={(event) => setJournalDraft(event.target.value)}
              placeholder="Write today's note..."
              rows={10}
              value={journalDraft}
            />

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                <span className="status-pill">
                  <strong>{liveCalculation.allAnchorsCompleted ? "All anchors" : "Anchors open"}</strong>
                </span>
                <span className="status-pill">
                  <strong>
                    {liveCalculation.earnedFullBonus ? "3+ full bonus" : `${liveCalculation.fullCount} full`}
                  </strong>
                </span>
              </div>
              <button
                className="quest-button"
                disabled={!todayData.canEdit || isJournalPending || !isJournalDirty}
                type="submit"
              >
                {!todayData.canEdit
                  ? "Read only"
                  : isJournalPending
                    ? "Saving..."
                    : isJournalDirty
                      ? "Save log"
                      : "Saved"}
              </button>
            </div>
          </form>

          {journalFeedback ? (
            <InlineFeedback
              className="mt-3"
              message={journalFeedback.message}
              tone={journalFeedback.tone}
            />
          ) : null}
        </section>

        <section className="quest-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="page-label">Training</p>
              <h2 className="mt-2 font-serif text-2xl text-stone-50">
                {todayData.exercisePlan.dayLabel}
              </h2>
            </div>
            <Link className="quest-button quest-button-secondary" href="/exercise">
              Open planner
            </Link>
          </div>

          <div className="mt-4 compact-list">
            {todayData.exercisePlan.items.length ? (
              todayData.exercisePlan.items.map((item) => (
                <article
                  key={item.id}
                  className="rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-stone-100">{item.title}</p>
                      {item.durationText ? (
                        <p className="mt-1 text-xs uppercase tracking-[0.16em] text-stone-500">
                          {item.durationText}
                        </p>
                      ) : null}
                    </div>
                  </div>
                  {item.notes ? (
                    <div className="mt-3 rounded-2xl border border-white/6 bg-black/15 px-3 py-3">
                      <p className="whitespace-pre-wrap break-words text-sm leading-7 text-stone-400">
                        {item.notes}
                      </p>
                    </div>
                  ) : null}
                </article>
              ))
            ) : (
              <EmptyState message="No training block planned for this day." />
            )}
          </div>
        </section>

        <section className="quest-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="page-label">Recovery</p>
              <h2 className="mt-2 font-serif text-2xl text-stone-50">Pending</h2>
            </div>
            <span className="status-pill">
              <strong>{optimisticPunishments.length}</strong> day
              {optimisticPunishments.length === 1 ? "" : "s"} open
            </span>
          </div>

          <div className="mt-4 compact-list">
            {optimisticPunishments.length ? (
              optimisticPunishments.map((group) => {
                const checkedCount = group.items.filter((item) => item.isChecked).length;
                const allChecked =
                  group.items.length > 0 &&
                  group.items.every((item) => item.isChecked);

                return (
                  <article
                    key={group.dateKey}
                    className="rounded-[1.1rem] border border-rose-300/12 bg-rose-400/[0.05] px-4 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-rose-200/55">
                          {group.missedDateLabel}
                        </p>
                        <p className="mt-2 font-serif text-xl text-stone-50">Recovery set</p>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="status-pill">
                            <strong>{group.items.length}</strong> punishment
                            {group.items.length === 1 ? "" : "s"}
                          </span>
                          <span className="status-pill">
                            <strong>{checkedCount}</strong> / {group.items.length} checked
                          </span>
                          <span className={`status-pill ${allChecked ? "status-pill-live" : ""}`}>
                            <span className="status-dot" />
                            <strong>{allChecked ? "Ready to close" : "Checklist open"}</strong>
                          </span>
                          {syncingPunishmentDayKeys.includes(group.dateKey) ? (
                            <span className="status-pill status-pill-live">
                              <span className="status-dot" />
                              Updating
                            </span>
                          ) : null}
                        </div>
                      </div>
                      <button
                        className="quest-button quest-button-secondary"
                        disabled={!allChecked || syncingPunishmentDayKeys.includes(group.dateKey)}
                        onClick={() => completePunishmentDay(group.dateKey)}
                        type="button"
                      >
                        {syncingPunishmentDayKeys.includes(group.dateKey)
                          ? "Saving..."
                          : "Complete day"}
                      </button>
                    </div>
                    <div className="mt-4 space-y-2">
                      {group.items.map((punishment) => (
                        <div
                          key={punishment.id}
                          className="grid grid-cols-[1rem_minmax(0,1fr)] items-start gap-3 rounded-2xl border border-white/6 bg-black/15 px-3 py-3 text-sm text-stone-300"
                        >
                          <input
                            checked={punishment.isChecked}
                            className="mt-1 h-4 w-4 shrink-0 accent-[#d1a56f]"
                            disabled={
                              syncingPunishmentDayKeys.includes(group.dateKey) ||
                              syncingPunishmentItemIds.includes(punishment.id)
                            }
                            onChange={(event) =>
                              togglePunishmentChecked(punishment.id, event.target.checked)
                            }
                            type="checkbox"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <p className="min-w-0 flex-1 font-medium leading-6 text-stone-100">
                                {punishment.name}
                              </p>
                              {syncingPunishmentItemIds.includes(punishment.id) ? (
                                <span className="status-pill status-pill-live shrink-0">
                                  <span className="status-dot" />
                                  Saving
                                </span>
                              ) : null}
                            </div>
                            {punishment.description ? (
                              <p className="mt-1 break-words leading-6 text-stone-400">
                                {punishment.description}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })
            ) : (
              <EmptyState message="No pending punishments." />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function calculateLiveCalculation(tasks: TodayTask[]) {
  return calculateDailyProgress({
    previousStreak: 0,
    tasks: tasks.map((task) => ({
      anchorCompleted: task.status === "anchor" || task.status === "full",
      fullCompleted: task.status === "full",
      anchorQp: task.anchorQp,
      fullQp: task.fullQp,
    })),
  });
}

function CompletionButton({
  disabled,
  isActive,
  label,
  onClick,
}: {
  disabled: boolean;
  isActive: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      className={`quest-button quest-button-secondary disabled:cursor-not-allowed disabled:opacity-45 ${isActive ? "menu-link-active" : ""}`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function InlineFeedback({
  className = "",
  message,
  tone,
}: {
  className?: string;
  message: string;
  tone: "error" | "success";
}) {
  return (
    <p
      className={`${className} rounded-2xl border px-3 py-2 text-sm ${
        tone === "success"
          ? "border-emerald-300/18 bg-emerald-400/[0.06] text-emerald-100"
          : "border-rose-300/18 bg-rose-400/[0.06] text-rose-100"
      }`}
    >
      {message}
    </p>
  );
}

function SummaryCard({ label, value }: { label: string; value: number | string }) {
  return (
    <article className="mini-card">
      <p className="mini-card-label">{label}</p>
      <p className="mini-card-value">{value}</p>
    </article>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-5 text-sm text-stone-400">
      {message}
    </div>
  );
}
