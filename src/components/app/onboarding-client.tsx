"use client";

import Link from "next/link";

import { useCachedJson } from "@/lib/client/use-cached-json";

type OnboardingData = {
  taskCount: number;
  punishmentCount: number;
  taskReady: boolean;
  punishmentReady: boolean;
  ready: boolean;
  completedSteps: number;
  totalSteps: number;
};

export function OnboardingClient({ refreshKey }: { refreshKey: string }) {
  const { data, loading, error } = useCachedJson<OnboardingData>(
    "/api/app/onboarding",
    refreshKey,
  );

  if (loading && !data) {
    return <section className="quest-panel h-96 animate-pulse bg-white/[0.03]" />;
  }

  if (error || !data) {
    return (
      <section className="quest-panel">
        <p className="text-sm text-rose-200">{error ?? "Failed to load onboarding."}</p>
      </section>
    );
  }

  const progressPercent = (data.completedSteps / data.totalSteps) * 100;

  return (
    <section className="grid gap-4">
      <div className="quest-panel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="page-label">Setup</p>
            <h1 className="page-title">Start clean</h1>
          </div>
          <span className={`status-pill ${data.ready ? "status-pill-live" : ""}`}>
            <span className="status-dot" />
            <strong>{data.ready ? "Ready to play" : "Setup in progress"}</strong>
          </span>
        </div>

        <div className="mt-4 rounded-[1.1rem] border border-white/6 bg-black/15 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="mini-card-label">Setup progress</p>
              <p className="mt-2 font-serif text-2xl text-stone-50">
                {data.completedSteps} / {data.totalSteps} systems ready
              </p>
            </div>
            {data.ready ? (
              <Link className="quest-button" href="/today">
                Begin today
              </Link>
            ) : (
              <Link className="quest-button quest-button-secondary" href="/rules">
                Review rules
              </Link>
            )}
          </div>
          <div className="mt-4 h-2 rounded-full bg-white/6">
            <div
              className="h-full rounded-full bg-[linear-gradient(90deg,_rgba(214,183,122,0.95)_0%,_rgba(124,195,159,0.75)_100%)]"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <article className="mini-card">
            <p className="mini-card-label">Tasks</p>
            <p className="mini-card-value">{data.taskCount}</p>
            <p className="mt-2 text-sm text-stone-400">
              {data.taskReady ? "Quest system is ready." : "Add at least one active task."}
            </p>
          </article>
          <article className="mini-card">
            <p className="mini-card-label">Punishments</p>
            <p className="mini-card-value">{data.punishmentCount}</p>
            <p className="mt-2 text-sm text-stone-400">
              {data.punishmentReady
                ? "Recovery system is ready."
                : "Add at least one active punishment."}
            </p>
          </article>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <StepCard
          actionHref="/tasks"
          actionLabel={data.taskReady ? "Manage tasks" : "Create tasks"}
          body="Create at least one active task with an anchor and full version."
          done={data.taskReady}
          title="1. Tasks"
        />
        <StepCard
          actionHref="/punishments"
          actionLabel={data.punishmentReady ? "Manage recoveries" : "Create recoveries"}
          body="Create at least one active punishment for zero-QP days."
          done={data.punishmentReady}
          title="2. Recoveries"
        />
        <StepCard
          actionHref="/rules"
          actionLabel="Read rules"
          body="Review the formulas and system logic before your first serious run."
          done={false}
          optional
          title="3. Rules"
        />
      </div>

      <div className="quest-panel">
        <p className="page-label">Core idea</p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <article className="rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-4">
            <p className="mini-card-label">Anchor</p>
            <p className="mt-2 text-sm leading-7 text-stone-400">
              The smallest useful version of a task. It protects momentum on low-energy days.
            </p>
          </article>
          <article className="rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-4">
            <p className="mini-card-label">Full</p>
            <p className="mt-2 text-sm leading-7 text-stone-400">
              The ideal version of the task. It pushes bigger growth and stronger QP days.
            </p>
          </article>
          <article className="rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-4">
            <p className="mini-card-label">Recovery</p>
            <p className="mt-2 text-sm leading-7 text-stone-400">
              Zero-QP days create recovery work. The goal is to bounce back, not drift.
            </p>
          </article>
        </div>
      </div>
    </section>
  );
}

function StepCard({
  actionHref,
  actionLabel,
  body,
  done,
  optional = false,
  title,
}: {
  actionHref: string;
  actionLabel: string;
  body: string;
  done: boolean;
  optional?: boolean;
  title: string;
}) {
  return (
    <article className="quest-panel">
      <div className="flex items-start justify-between gap-3">
        <p className="font-serif text-2xl text-stone-50">{title}</p>
        <span className={`status-pill ${done ? "status-pill-live" : ""}`}>
          {done ? "Done" : optional ? "Optional" : "Open"}
        </span>
      </div>
      <p className="mt-3 text-sm leading-7 text-stone-400">{body}</p>
      <Link className="quest-button mt-4" href={actionHref}>
        {actionLabel}
      </Link>
    </article>
  );
}
