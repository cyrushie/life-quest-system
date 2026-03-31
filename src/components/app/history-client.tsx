"use client";

import Link from "next/link";
import { useState } from "react";

import { useCachedJson } from "@/lib/client/use-cached-json";

type HistoryEntry = {
  id: string;
  dateKey: string;
  dateLabel: string;
  anchorCount: number;
  fullCount: number;
  totalQp: number;
  expGained: number;
  questPassUsed: boolean;
  journalWritten: boolean;
  isToday: boolean;
  canEdit: boolean;
  recovery: {
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
  } | null;
};

type HistoryData = {
  todayDateKey: string;
  logs: HistoryEntry[];
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getMonthKey(dateKey: string) {
  return dateKey.slice(0, 7);
}

function toMonthDate(monthKey: string) {
  return new Date(`${monthKey}-01T00:00:00.000Z`);
}

function formatMonthLabel(monthKey: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(toMonthDate(monthKey));
}

function shiftMonthKey(monthKey: string, delta: number) {
  const next = toMonthDate(monthKey);
  next.setUTCMonth(next.getUTCMonth() + delta);
  return next.toISOString().slice(0, 7);
}

function formatQp(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function buildMonthOptions(logs: HistoryEntry[], todayDateKey: string) {
  const currentMonthKey = getMonthKey(todayDateKey);
  const allMonthKeys = new Set([currentMonthKey, ...logs.map((entry) => getMonthKey(entry.dateKey))]);
  const sorted = [...allMonthKeys].sort((left, right) => (left < right ? 1 : left > right ? -1 : 0));
  const earliestMonthKey = sorted[sorted.length - 1] ?? currentMonthKey;
  const options: string[] = [];

  for (
    let monthKey = currentMonthKey;
    monthKey >= earliestMonthKey;
    monthKey = shiftMonthKey(monthKey, -1)
  ) {
    options.push(monthKey);

    if (monthKey === earliestMonthKey) {
      break;
    }
  }

  return options;
}

function buildCalendarWeeks(monthKey: string, entryMap: Map<string, HistoryEntry>, todayDateKey: string) {
  const firstOfMonth = toMonthDate(monthKey);
  const firstWeekdayOffset = (firstOfMonth.getUTCDay() + 6) % 7;
  const gridStart = new Date(firstOfMonth);
  gridStart.setUTCDate(firstOfMonth.getUTCDate() - firstWeekdayOffset);

  const cells = Array.from({ length: 42 }, (_, index) => {
    const current = new Date(gridStart);
    current.setUTCDate(gridStart.getUTCDate() + index);

    const dateKey = current.toISOString().slice(0, 10);

    return {
      dateKey,
      dayNumber: current.getUTCDate(),
      inCurrentMonth: getMonthKey(dateKey) === monthKey,
      isFuture: dateKey > todayDateKey,
      entry: entryMap.get(dateKey) ?? null,
    };
  });

  return Array.from({ length: 6 }, (_, weekIndex) => cells.slice(weekIndex * 7, weekIndex * 7 + 7));
}

export function HistoryClient({ refreshKey }: { refreshKey: string }) {
  const { data, loading, error } = useCachedJson<HistoryData>("/api/app/history", refreshKey);
  const [view, setView] = useState<"calendar" | "logbook">("calendar");
  const [selectedMonthKey, setSelectedMonthKey] = useState("");

  if (loading && !data) {
    return <section className="quest-panel h-96 animate-pulse bg-white/[0.03]" />;
  }

  if (error || !data) {
    return (
      <section className="quest-panel">
        <p className="text-sm text-rose-200">{error ?? "Failed to load history."}</p>
      </section>
    );
  }

  const monthOptions = buildMonthOptions(data.logs, data.todayDateKey);
  const activeMonthKey = monthOptions.includes(selectedMonthKey)
    ? selectedMonthKey
    : monthOptions[0] ?? getMonthKey(data.todayDateKey);
  const activeMonthIndex = monthOptions.indexOf(activeMonthKey);
  const entryMap = new Map(data.logs.map((entry) => [entry.dateKey, entry]));
  const monthEntries = data.logs.filter((entry) => getMonthKey(entry.dateKey) === activeMonthKey);
  const weeks = buildCalendarWeeks(activeMonthKey, entryMap, data.todayDateKey);
  const activeDays = monthEntries.filter((entry) => entry.totalQp > 0).length;
  const recoveryDays = monthEntries.filter((entry) => entry.recovery).length;
  const journalDays = monthEntries.filter((entry) => entry.journalWritten).length;
  const questPassDays = monthEntries.filter((entry) => entry.questPassUsed).length;

  return (
    <section className="quest-panel">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="page-label">History</p>
          <h1 className="page-title">Calendar</h1>
          <p className="page-copy mt-3">
            See your consistency by month, then drop into the logbook when you need details.
          </p>
        </div>
        <span className="status-pill">
          <strong>{data.logs.length}</strong> tracked days
        </span>
      </div>

      <div className="section-tabs mt-5">
        <button
          className={`section-tab ${view === "calendar" ? "section-tab-active" : ""}`}
          onClick={() => setView("calendar")}
          type="button"
        >
          <span className="section-tab-label">Calendar</span>
        </button>
        <button
          className={`section-tab ${view === "logbook" ? "section-tab-active" : ""}`}
          onClick={() => setView("logbook")}
          type="button"
        >
          <span className="section-tab-label">Logbook</span>
        </button>
      </div>

      {view === "calendar" ? (
        <div className="mt-5 grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="page-label">Month</p>
              <h2 className="mt-2 font-serif text-2xl text-stone-50">
                {formatMonthLabel(activeMonthKey)}
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                className="quest-button quest-button-secondary"
                disabled={activeMonthIndex <= 0}
                onClick={() => {
                  if (activeMonthIndex > 0) {
                    setSelectedMonthKey(monthOptions[activeMonthIndex - 1]);
                  }
                }}
                type="button"
              >
                Newer
              </button>
              <button
                className="quest-button quest-button-secondary"
                disabled={activeMonthIndex < 0 || activeMonthIndex >= monthOptions.length - 1}
                onClick={() => {
                  if (activeMonthIndex >= 0 && activeMonthIndex < monthOptions.length - 1) {
                    setSelectedMonthKey(monthOptions[activeMonthIndex + 1]);
                  }
                }}
                type="button"
              >
                Older
              </button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <article className="mini-card">
              <p className="mini-card-label">Active days</p>
              <p className="mini-card-value">{activeDays}</p>
            </article>
            <article className="mini-card">
              <p className="mini-card-label">Recovery days</p>
              <p className="mini-card-value">{recoveryDays}</p>
            </article>
            <article className="mini-card">
              <p className="mini-card-label">Journal days</p>
              <p className="mini-card-value">{journalDays}</p>
            </article>
            <article className="mini-card">
              <p className="mini-card-label">Quest passes</p>
              <p className="mini-card-value">{questPassDays}</p>
            </article>
          </div>

          <div className="flex flex-wrap gap-2 text-xs text-stone-400">
            <span className="status-pill">QP day</span>
            <span className="status-pill">Recovery</span>
            <span className="status-pill">Journal</span>
            <span className="status-pill">Quest pass</span>
          </div>

          <div className="overflow-hidden rounded-[1.1rem] border border-white/6 bg-white/[0.025] p-3">
            <div className="grid grid-cols-7 gap-2">
              {WEEKDAY_LABELS.map((label) => (
                <div
                  key={label}
                  className="px-2 py-2 text-center text-[0.68rem] uppercase tracking-[0.16em] text-stone-500"
                >
                  {label}
                </div>
              ))}

              {weeks.flat().map((cell) => {
                const isActiveDay = (cell.entry?.totalQp ?? 0) > 0;
                const hasRecovery = Boolean(cell.entry?.recovery);
                const hasJournal = Boolean(cell.entry?.journalWritten);
                const hasQuestPass = Boolean(cell.entry?.questPassUsed);
                const cellClasses = [
                  "min-h-[7rem] rounded-[1rem] border px-3 py-3 transition-colors",
                  cell.inCurrentMonth
                    ? "border-white/6 bg-white/[0.025]"
                    : "border-white/4 bg-white/[0.012] opacity-45",
                  cell.entry?.isToday ? "border-[rgba(214,183,122,0.45)]" : "",
                  isActiveDay ? "bg-emerald-400/[0.06]" : "",
                  hasRecovery ? "bg-rose-400/[0.06]" : "",
                  hasQuestPass ? "ring-1 ring-[rgba(214,183,122,0.28)]" : "",
                ]
                  .filter(Boolean)
                  .join(" ");

                const content = (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-serif text-lg text-stone-50">{cell.dayNumber}</span>
                      {cell.entry?.canEdit ? (
                        <span className="text-[0.62rem] uppercase tracking-[0.14em] text-stone-500">
                          Edit
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-3 space-y-2">
                      {cell.entry ? (
                        <>
                          <p className="text-sm font-medium text-stone-200">
                            {cell.entry.totalQp > 0 ? `QP ${formatQp(cell.entry.totalQp)}` : "No QP"}
                          </p>
                          <div className="flex flex-wrap gap-2 text-[0.64rem] uppercase tracking-[0.12em] text-stone-400">
                            {hasRecovery ? <span>Recovery</span> : null}
                            {hasJournal ? <span>Journal</span> : null}
                            {hasQuestPass ? <span>Pass</span> : null}
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-stone-500">
                          {cell.isFuture ? "Upcoming" : "No log"}
                        </p>
                      )}
                    </div>
                  </>
                );

                return cell.isFuture ? (
                  <div key={cell.dateKey} className={cellClasses}>
                    {content}
                  </div>
                ) : (
                  <Link key={cell.dateKey} className={cellClasses} href={`/today?date=${cell.dateKey}`}>
                    {content}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5 overflow-hidden rounded-[1.1rem] border border-white/6 bg-white/[0.025]">
          <table className="w-full border-collapse text-left">
            <thead className="bg-white/[0.03] text-[0.68rem] uppercase tracking-[0.16em] text-stone-400">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">A</th>
                <th className="px-4 py-3">F</th>
                <th className="px-4 py-3">QP</th>
                <th className="px-4 py-3">EXP</th>
                <th className="px-4 py-3">Journal</th>
                <th className="px-4 py-3">Pass</th>
                <th className="px-4 py-3">Recovery</th>
                <th className="px-4 py-3">Edit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/6 text-sm text-stone-300">
              {data.logs.length ? (
                data.logs.map((entry) => (
                  <tr key={entry.id}>
                    <td className="px-4 py-3 font-serif text-stone-50">{entry.dateLabel}</td>
                    <td className="px-4 py-3">{entry.anchorCount}</td>
                    <td className="px-4 py-3">{entry.fullCount}</td>
                    <td className="px-4 py-3">{formatQp(entry.totalQp)}</td>
                    <td className="px-4 py-3">+{entry.expGained.toLocaleString()}</td>
                    <td className="px-4 py-3 text-stone-400">
                      {entry.journalWritten ? "Yes" : "-"}
                    </td>
                    <td className="px-4 py-3 text-stone-400">
                      {entry.questPassUsed ? "Used" : "-"}
                    </td>
                    <td className="px-4 py-3 align-top text-stone-400">
                      {entry.recovery ? (
                        <div className="min-w-[15rem] space-y-2">
                          <div className="flex flex-wrap gap-2">
                            <span
                              className={`status-pill ${
                                entry.recovery.state === "completed"
                                  ? "status-pill-live"
                                  : entry.recovery.state === "mixed"
                                    ? "border-amber-300/18 bg-amber-400/[0.06] text-amber-100"
                                    : ""
                              }`}
                            >
                              {entry.recovery.state === "completed"
                                ? "Completed"
                                : entry.recovery.state === "mixed"
                                  ? "In progress"
                                  : "Pending"}
                            </span>
                            <span className="status-pill">
                              {entry.recovery.completedCount}/{entry.recovery.totalCount} done
                            </span>
                            <span className="status-pill">
                              {entry.recovery.checkedCount}/{entry.recovery.totalCount} checked
                            </span>
                          </div>
                          <details className="detail-toggle">
                            <summary>
                              {entry.recovery.totalCount} recovery item
                              {entry.recovery.totalCount === 1 ? "" : "s"}
                            </summary>
                            <div className="mt-3 space-y-2">
                              {entry.recovery.items.map((item) => (
                                <div
                                  key={item.id}
                                  className="rounded-2xl border border-white/6 bg-black/15 px-3 py-2"
                                >
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium text-stone-200">{item.name}</span>
                                    <span className="status-pill">
                                      {item.status === "COMPLETED"
                                        ? "completed"
                                        : item.isChecked
                                          ? "checked"
                                          : "open"}
                                    </span>
                                  </div>
                                  {item.description ? (
                                    <p className="mt-1 text-xs leading-6 text-stone-400">
                                      {item.description}
                                    </p>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </details>
                        </div>
                      ) : (
                        <span className="text-stone-500">None</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {entry.canEdit ? (
                        <Link
                          className="quest-button quest-button-secondary"
                          href={`/today?date=${entry.dateKey}`}
                        >
                          Edit
                        </Link>
                      ) : (
                        <Link
                          className="text-xs uppercase tracking-[0.16em] text-stone-500 hover:text-stone-300"
                          href={`/today?date=${entry.dateKey}`}
                        >
                          View
                        </Link>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td className="px-4 py-5 text-stone-400" colSpan={9}>
                    No history yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
