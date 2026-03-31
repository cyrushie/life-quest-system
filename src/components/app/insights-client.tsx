"use client";

import { useCachedJson } from "@/lib/client/use-cached-json";

import { ProgressTrendChart } from "./progress-trend-chart";

type InsightsData = {
  accountCreatedLabel: string;
  last7: {
    dateKey: string;
    label: string;
    totalQp: number;
    expGained: number;
  }[];
  last30: {
    dateKey: string;
    label: string;
    totalQp: number;
    expGained: number;
  }[];
  overview: {
    totalLoggedDays: number;
    activeDays: number;
    longestStreak: number;
    lifetimeExp: number;
  };
  recentWindow: {
    averageQp7: number;
    averageQp30: number;
    activeDays30: number;
    zeroDays30: number;
    exp30: number;
  };
  comparisons: {
    last7: RangeComparison;
    last30: RangeComparison;
    month: RangeComparison;
  };
  currentMonth: {
    monthLabel: string;
    activeDays: number;
    totalQp: number;
    totalExp: number;
    questPassDays: number;
    fullCompletions: number;
  };
  recovery: {
    totalRecoveryDays: number;
    completedRecoveryDays: number;
    pendingRecoveryDays: number;
    completionRate: number;
  };
  rhythm: {
    bestWeekday: WeekdayInsight | null;
    hardestWeekday: WeekdayInsight | null;
    weekdays: WeekdayInsight[];
  };
  topTasks: {
    id: string;
    name: string;
    anchorCount: number;
    fullCount: number;
    recentDateKey: string;
    recent7Count: number;
    recent30Count: number;
    fullRate: number;
    recent30Rate: number;
  }[];
};

type RangeComparison = {
  currentLabel: string;
  previousLabel: string;
  current: {
    totalQp: number;
    averageQp: number;
    activeDays: number;
    zeroDays: number;
    exp: number;
  };
  previous: {
    totalQp: number;
    averageQp: number;
    activeDays: number;
    zeroDays: number;
    exp: number;
  };
  delta: {
    totalQp: number;
    averageQp: number;
    activeDays: number;
    zeroDays: number;
    exp: number;
  };
};

type WeekdayInsight = {
  weekday: string;
  label: string;
  totalQp: number;
  averageQp: number;
  activeDays: number;
  zeroDays: number;
  observedDays: number;
};

function formatQp(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatSignedQp(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${formatQp(value)} QP`;
}

function formatSignedExp(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${Math.round(value).toLocaleString()} EXP`;
}

function formatSignedDays(value: number) {
  const prefix = value > 0 ? "+" : "";
  return `${prefix}${value}d`;
}

function getTrendTone(value: number) {
  if (value > 0) {
    return "text-emerald-300";
  }

  if (value < 0) {
    return "text-rose-300";
  }

  return "text-stone-300";
}

export function InsightsClient({ refreshKey }: { refreshKey: string }) {
  const { data, loading, error } = useCachedJson<InsightsData>("/api/app/insights", refreshKey);

  if (loading && !data) {
    return <section className="quest-panel h-96 animate-pulse bg-white/[0.03]" />;
  }

  if (error || !data) {
    return (
      <section className="quest-panel">
        <p className="text-sm text-rose-200">{error ?? "Failed to load insights."}</p>
      </section>
    );
  }

  const overviewCards = [
    { label: "Logged days", value: data.overview.totalLoggedDays },
    { label: "Active days", value: data.overview.activeDays },
    { label: "Longest streak", value: `${data.overview.longestStreak}d` },
    { label: "Lifetime EXP", value: data.overview.lifetimeExp.toLocaleString() },
  ];

  const recentCards = [
    { label: "Avg QP · 7d", value: formatQp(data.recentWindow.averageQp7) },
    { label: "Avg QP · 30d", value: formatQp(data.recentWindow.averageQp30) },
    { label: "Active days · 30d", value: data.recentWindow.activeDays30 },
    { label: "Zero days · 30d", value: data.recentWindow.zeroDays30 },
  ];
  const comparisonCards = [
    {
      label: "Last 7",
      summary: data.comparisons.last7,
      primary: formatSignedQp(data.comparisons.last7.delta.totalQp),
    },
    {
      label: "Last 30",
      summary: data.comparisons.last30,
      primary: formatSignedQp(data.comparisons.last30.delta.totalQp),
    },
    {
      label: "Month",
      summary: data.comparisons.month,
      primary: formatSignedQp(data.comparisons.month.delta.totalQp),
    },
  ];

  const monthCards = [
    { label: "Month QP", value: formatQp(data.currentMonth.totalQp) },
    { label: "Month EXP", value: `+${data.currentMonth.totalExp.toLocaleString()}` },
    { label: "Quest pass days", value: data.currentMonth.questPassDays },
    { label: "Full routines", value: formatQp(data.currentMonth.fullCompletions) },
  ];

  return (
    <div className="grid gap-4">
      <section className="quest-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="page-label">Insights</p>
            <h1 className="page-title">Pattern view</h1>
            <p className="page-copy mt-3">
              A clearer read on your momentum, recovery, and what you actually repeat.
            </p>
          </div>
          <span className="status-pill">Since {data.accountCreatedLabel}</span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {overviewCards.map((card) => (
            <article key={card.label} className="mini-card">
              <p className="mini-card-label">{card.label}</p>
              <p className="mini-card-value">{card.value}</p>
            </article>
          ))}
        </div>
      </section>

      <ProgressTrendChart
        points={data.last30}
        subtitle="Daily QP over the last 30 days, including quiet days. Hover dots for day-by-day detail."
        title="30-day momentum"
      />

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <section className="quest-panel">
          <div>
            <p className="page-label">Comparison</p>
            <h2 className="mt-2 font-serif text-2xl text-stone-50">Against earlier windows</h2>
            <p className="page-copy mt-3">
              A quick read on whether your recent rhythm is climbing, holding, or slipping.
            </p>
          </div>

          <div className="mt-4 grid gap-3">
            {comparisonCards.map((card) => (
              <article key={card.label} className="mini-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="mini-card-label">{card.label}</p>
                    <p className={`mt-2 font-serif text-2xl ${getTrendTone(card.summary.delta.totalQp)}`}>
                      {card.primary}
                    </p>
                    <p className="mt-2 text-sm text-stone-400">
                      {card.summary.currentLabel} vs {card.summary.previousLabel}
                    </p>
                  </div>
                  <span className="status-pill">
                    Avg {formatSignedQp(card.summary.delta.averageQp)}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  <div>
                    <p className="mini-card-label">Active days</p>
                    <p className={`mt-2 text-sm ${getTrendTone(card.summary.delta.activeDays)}`}>
                      {formatSignedDays(card.summary.delta.activeDays)}
                    </p>
                  </div>
                  <div>
                    <p className="mini-card-label">Zero days</p>
                    <p className={`mt-2 text-sm ${getTrendTone(-card.summary.delta.zeroDays)}`}>
                      {formatSignedDays(card.summary.delta.zeroDays)}
                    </p>
                  </div>
                  <div>
                    <p className="mini-card-label">EXP</p>
                    <p className={`mt-2 text-sm ${getTrendTone(card.summary.delta.exp)}`}>
                      {formatSignedExp(card.summary.delta.exp)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="quest-panel">
          <div>
            <p className="page-label">Recent window</p>
            <h2 className="mt-2 font-serif text-2xl text-stone-50">Last 30 days</h2>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {recentCards.map((card) => (
              <article key={card.label} className="mini-card">
                <p className="mini-card-label">{card.label}</p>
                <p className="mini-card-value">{card.value}</p>
              </article>
            ))}
          </div>

          <div className="mt-4 rounded-[1rem] border border-white/6 bg-white/[0.025] px-4 py-4">
            <p className="mini-card-label">30-day EXP</p>
            <p className="mt-2 font-serif text-2xl text-stone-50">
              +{data.recentWindow.exp30.toLocaleString()}
            </p>
            <p className="mt-2 text-sm leading-6 text-stone-400">
              This window counts quiet days too, so the averages reflect consistency, not just
              your logged highlights.
            </p>
          </div>
        </section>

        <section className="quest-panel">
          <div>
            <p className="page-label">Recovery</p>
            <h2 className="mt-2 font-serif text-2xl text-stone-50">Reset discipline</h2>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <article className="mini-card">
              <p className="mini-card-label">Recovery days</p>
              <p className="mini-card-value">{data.recovery.totalRecoveryDays}</p>
            </article>
            <article className="mini-card">
              <p className="mini-card-label">Completion rate</p>
              <p className="mini-card-value">{formatPercent(data.recovery.completionRate)}</p>
            </article>
            <article className="mini-card">
              <p className="mini-card-label">Completed</p>
              <p className="mini-card-value">{data.recovery.completedRecoveryDays}</p>
            </article>
            <article className="mini-card">
              <p className="mini-card-label">Pending</p>
              <p className="mini-card-value">{data.recovery.pendingRecoveryDays}</p>
            </article>
          </div>
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <section className="quest-panel">
          <div>
            <p className="page-label">Rhythm</p>
            <h2 className="mt-2 font-serif text-2xl text-stone-50">Weekday pattern</h2>
            <p className="page-copy mt-3">Based on the last 30 days, including quiet days.</p>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <article className="mini-card">
              <p className="mini-card-label">Best weekday</p>
              <p className="mini-card-value">{data.rhythm.bestWeekday?.label ?? "None"}</p>
              {data.rhythm.bestWeekday ? (
                <p className="mt-2 text-sm text-stone-400">
                  Avg {formatQp(data.rhythm.bestWeekday.averageQp)} QP across{" "}
                  {data.rhythm.bestWeekday.observedDays} observed days.
                </p>
              ) : null}
            </article>

            <article className="mini-card">
              <p className="mini-card-label">Most fragile weekday</p>
              <p className="mini-card-value">{data.rhythm.hardestWeekday?.label ?? "None"}</p>
              {data.rhythm.hardestWeekday ? (
                <p className="mt-2 text-sm text-stone-400">
                  {data.rhythm.hardestWeekday.zeroDays} quiet day
                  {data.rhythm.hardestWeekday.zeroDays === 1 ? "" : "s"} in the same window.
                </p>
              ) : null}
            </article>
          </div>

          <div className="mt-4 compact-list">
            {data.rhythm.weekdays.map((weekday) => (
              <article
                key={weekday.weekday}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[1rem] border border-white/6 bg-white/[0.025] px-4 py-3"
              >
                <div>
                  <p className="font-serif text-lg text-stone-50">{weekday.label}</p>
                  <p className="mt-1 text-sm text-stone-400">
                    Avg {formatQp(weekday.averageQp)} QP · Active {weekday.activeDays} · Quiet{" "}
                    {weekday.zeroDays}
                  </p>
                </div>
                <span className="status-pill">{weekday.observedDays} day sample</span>
              </article>
            ))}
          </div>
        </section>

        <section className="quest-panel">
          <div>
            <p className="page-label">This month</p>
            <h2 className="mt-2 font-serif text-2xl text-stone-50">{data.currentMonth.monthLabel}</h2>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {monthCards.map((card) => (
              <article key={card.label} className="mini-card">
                <p className="mini-card-label">{card.label}</p>
                <p className="mini-card-value">{card.value}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="quest-panel">
          <div>
            <p className="page-label">Top tasks</p>
            <h2 className="mt-2 font-serif text-2xl text-stone-50">Most repeated</h2>
          </div>

          <div className="mt-4 compact-list">
            {data.topTasks.length ? (
              data.topTasks.map((task) => (
                <article
                  key={task.id}
                  className="rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-serif text-xl text-stone-50">{task.name}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-stone-500">
                        Last logged on {task.recentDateKey}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className="status-pill">Anchor {task.anchorCount}</span>
                      <span className="status-pill">Full {task.fullCount}</span>
                      <span className="status-pill">7d {task.recent7Count}</span>
                      <span className="status-pill">30d {task.recent30Count}</span>
                      <span className="status-pill">Full share {formatPercent(task.fullRate)}</span>
                      <span className="status-pill">
                        30d consistency {formatPercent(task.recent30Rate)}
                      </span>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-5 text-sm text-stone-400">
                Complete a few tasks and your most repeated routines will appear here.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
