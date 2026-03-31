"use client";

import Link from "next/link";

import { useCachedJson } from "@/lib/client/use-cached-json";
import { ProgressTrendChart } from "./progress-trend-chart";

type DashboardData = {
  stats: {
    currentLevel: number;
    currentTitle: string;
    totalExp: number;
    currentStreak: number;
    questPassCount: number;
  };
  todayQp: number;
  levelState: {
    expIntoLevel: number;
    expNeededForNextLevel: number;
  };
  trend: {
    dateKey: string;
    label: string;
    totalQp: number;
    expGained: number;
  }[];
  recentLogs: {
    id: string;
    dateLabel: string;
    questPassUsed: boolean;
    anchorCount: number;
    fullCount: number;
    totalQp: number;
    expGained: number;
  }[];
  pendingPunishments: {
    dateKey: string;
    missedDateLabel: string;
    items: {
      id: string;
      name: string;
      description: string | null;
      isChecked: boolean;
    }[];
  }[];
};

export function DashboardClient({ refreshKey }: { refreshKey: string }) {
  const { data, loading, error } = useCachedJson<DashboardData>(
    "/api/app/dashboard",
    refreshKey,
  );

  if (loading && !data) {
    return <LoadingState />;
  }

  if (error || !data) {
    return <ErrorState message={error ?? "Failed to load dashboard."} />;
  }

  const progressPercent = Math.min(
    100,
    (data.levelState.expIntoLevel / data.levelState.expNeededForNextLevel) * 100,
  );

  const statCards = [
    { label: "Level", value: data.stats.currentLevel },
    { label: "Title", value: data.stats.currentTitle },
    { label: "Today QP", value: data.todayQp },
    { label: "Streak", value: `${data.stats.currentStreak}d` },
  ];

  return (
    <div className="grid gap-4">
      <section className="quest-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="page-label">Overview</p>
            <h1 className="page-title">Character state</h1>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="status-pill">
              <span className="status-dot" />
              {data.stats.questPassCount} quest pass
              {data.stats.questPassCount === 1 ? "" : "es"}
            </span>
            <Link className="quest-button" href="/today">
              Open today
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => (
            <article key={card.label} className="mini-card">
              <p className="mini-card-label">{card.label}</p>
              <p className="mini-card-value">{card.value}</p>
            </article>
          ))}
        </div>

        <div className="mt-4 rounded-[1.1rem] border border-white/6 bg-black/15 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="mini-card-label">Progress to next level</p>
              <p className="mt-2 font-serif text-2xl text-stone-50">
                {data.levelState.expIntoLevel.toLocaleString()} /{" "}
                {data.levelState.expNeededForNextLevel.toLocaleString()} EXP
              </p>
            </div>
            <Link className="quest-button quest-button-secondary" href="/tasks">
              Manage tasks
            </Link>
          </div>
          <div className="mt-4 h-2 rounded-full bg-white/6">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,_rgba(214,183,122,0.95)_0%,_rgba(124,195,159,0.75)_100%)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </section>

      <ProgressTrendChart
        points={data.trend}
        subtitle="Daily QP earned over the last 14 days. Hover each point for that day's QP and EXP."
        title="Momentum"
      />

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="quest-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="page-label">Recent days</p>
              <h2 className="mt-2 font-serif text-2xl text-stone-50">Chronicle</h2>
            </div>
            <Link className="quest-button quest-button-secondary" href="/history">
              View all
            </Link>
          </div>

          <div className="mt-4 compact-list">
            {data.recentLogs.length ? (
              data.recentLogs.map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-3"
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="font-serif text-xl text-stone-50">{entry.dateLabel}</p>
                      <p className="mt-1 text-xs uppercase tracking-[0.16em] text-stone-500">
                        {entry.questPassUsed ? "Quest pass" : "Manual log"}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2 text-xs uppercase tracking-[0.16em] text-stone-400">
                      <span className="status-pill">A {entry.anchorCount}</span>
                      <span className="status-pill">F {entry.fullCount}</span>
                      <span className="status-pill">QP {entry.totalQp}</span>
                      <span className="status-pill">EXP +{entry.expGained.toLocaleString()}</span>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <EmptyCard message="No logged days yet." />
            )}
          </div>
        </section>

        <section className="quest-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="page-label">Recovery</p>
              <h2 className="mt-2 font-serif text-2xl text-stone-50">Pending</h2>
            </div>
            <Link className="quest-button quest-button-secondary" href="/punishments">
              Edit list
            </Link>
          </div>

          <div className="mt-4 compact-list">
            {data.pendingPunishments.length ? (
              data.pendingPunishments.map((group) => {
                const checkedCount = group.items.filter((item) => item.isChecked).length;

                return (
                  <article
                    key={group.dateKey}
                    className="rounded-[1.1rem] border border-rose-300/12 bg-rose-400/[0.05] px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-[0.16em] text-rose-200/55">
                          {group.missedDateLabel}
                        </p>
                        <p className="mt-2 font-serif text-xl text-stone-50">Recovery set</p>
                      </div>
                      <span className="status-pill">
                        {checkedCount}/{group.items.length} checked
                      </span>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {group.items.map((item) => (
                        <span key={item.id} className="status-pill">
                          {item.name}
                        </span>
                      ))}
                    </div>
                  </article>
                );
              })
            ) : (
              <EmptyCard message="No pending punishments." />
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div className="rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-5 text-sm text-stone-400">
      {message}
    </div>
  );
}

function LoadingState() {
  return (
    <div className="grid gap-4">
      <section className="quest-panel h-72 animate-pulse bg-white/[0.03]" />
      <div className="grid gap-4 xl:grid-cols-2">
        <section className="quest-panel h-72 animate-pulse bg-white/[0.03]" />
        <section className="quest-panel h-72 animate-pulse bg-white/[0.03]" />
      </div>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <section className="quest-panel">
      <p className="text-sm text-rose-200">{message}</p>
    </section>
  );
}
