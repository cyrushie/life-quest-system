"use client";

import Link from "next/link";

import {
  deleteExercisePlanAction,
  saveExercisePlanAction,
} from "@/app/(app)/actions";
import { ServerForm } from "@/app/(app)/server-form";
import { useCachedJson } from "@/lib/client/use-cached-json";
import { WEEKDAY_ORDER, formatWeekdayLabel } from "@/lib/date";

type ExerciseItem = {
  id: string;
  title: string;
  notes: string | null;
  durationText: string | null;
  sortOrder: number;
};

type ExerciseDay = {
  weekday: (typeof WEEKDAY_ORDER)[number];
  dayLabel: string;
  items: ExerciseItem[];
};

type ExerciseData = {
  days: ExerciseDay[];
};

export function ExerciseClient({
  editId,
  refreshKey,
}: {
  editId?: string;
  refreshKey: string;
}) {
  const { data, loading, error } = useCachedJson<ExerciseData>("/api/app/exercise", refreshKey);

  if (loading && !data) {
    return <section className="quest-panel h-96 animate-pulse bg-white/[0.03]" />;
  }

  if (error || !data) {
    return (
      <section className="quest-panel">
        <p className="text-sm text-rose-200">{error ?? "Failed to load exercise planner."}</p>
      </section>
    );
  }

  const allItems = data.days.flatMap((day) =>
    day.items.map((item) => ({
      ...item,
      weekday: day.weekday,
    })),
  );
  const editingItem = editId ? allItems.find((item) => item.id === editId) ?? null : null;

  return (
    <section className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="quest-panel">
          <p className="page-label">{editingItem ? "Edit workout" : "New workout"}</p>
          <h1 className="page-title">
            {editingItem ? editingItem.title : "Build the weekly training plan"}
          </h1>

          <p className="page-copy mt-3">
            Keep the schedule simple. This planner is here to show what training belongs to each
            day so you can follow it and mark your exercise quest with confidence.
          </p>

          <details className="detail-toggle">
            <summary>How to use it</summary>
            <p className="mt-3 text-sm leading-7 text-stone-400">
              Add your weekly training blocks here, then check your exercise-related task on the
              Today page after you follow the plan.
            </p>
          </details>

          <div className="mt-4">
            <ServerForm
              action={saveExercisePlanAction}
              key={`exercise-form-${editingItem?.id ?? "new"}`}
              resetOnSuccess
              successHref="/exercise"
              submitLabel={editingItem ? "Update workout" : "Save workout"}
            >
              <input name="itemId" type="hidden" value={editingItem?.id ?? ""} />

              <label className="auth-field">
                <span>Day</span>
                <select
                  className="rounded-[0.95rem] border border-white/10 bg-black/35 px-4 py-3 text-stone-100 outline-none"
                  defaultValue={editingItem?.weekday ?? "MONDAY"}
                  name="dayOfWeek"
                >
                  {WEEKDAY_ORDER.map((weekday) => (
                    <option key={weekday} value={weekday}>
                      {formatWeekdayLabel(weekday)}
                    </option>
                  ))}
                </select>
              </label>

              <FormField
                defaultValue={editingItem?.title}
                label="Workout title"
                name="title"
                placeholder="Pull day"
              />

              <FormField
                defaultValue={editingItem?.durationText ?? ""}
                label="Duration"
                name="durationText"
                placeholder="45 min"
              />

              <label className="auth-field">
                <span>Notes</span>
                <textarea
                  defaultValue={editingItem?.notes ?? ""}
                  name="notes"
                  placeholder="Main lifts, cardio block, skill work..."
                  rows={5}
                />
              </label>
            </ServerForm>

            {editingItem ? (
              <Link
                className="mt-3 inline-flex text-sm text-stone-400 hover:text-stone-200"
                href="/exercise"
              >
                Cancel editing
              </Link>
            ) : null}
          </div>
        </div>

        <div className="quest-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="page-label">Weekly map</p>
              <h2 className="mt-2 font-serif text-2xl text-stone-50">Training board</h2>
            </div>
            <span className="status-pill">
              <strong>{allItems.length}</strong> workout
              {allItems.length === 1 ? "" : "s"}
            </span>
          </div>

          <p className="page-copy mt-3">
            Long workout notes stay readable here. Each day gets its own full-width space so you
            can store complete routines, cues, and progression notes without crushing the layout.
          </p>

          <div className="mt-4 space-y-3">
            {data.days.map((day) => (
              <article
                key={day.weekday}
                className="rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-serif text-xl text-stone-50">{day.dayLabel}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.16em] text-stone-500">
                      {day.items.length ? "Scheduled" : "Open day"}
                    </p>
                  </div>
                  <span className="status-pill">{day.items.length}</span>
                </div>

                <div className="mt-4 compact-list">
                  {day.items.length ? (
                    day.items.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-[1.05rem] border border-white/6 bg-black/15 px-4 py-4"
                      >
                        <div className="flex flex-col gap-3">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="font-medium text-stone-100">{item.title}</p>
                                {item.durationText ? (
                                  <span className="status-pill">{item.durationText}</span>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Link
                                className="quest-button quest-button-secondary"
                                href={`/exercise?edit=${item.id}`}
                              >
                                Edit
                              </Link>
                              <form action={deleteExercisePlanAction}>
                                <input name="itemId" type="hidden" value={item.id} />
                                <button
                                  className="quest-button quest-button-secondary"
                                  type="submit"
                                >
                                  Delete
                                </button>
                              </form>
                            </div>
                          </div>

                        {item.notes ? (
                            <div className="rounded-2xl border border-white/6 bg-white/[0.02] px-4 py-3">
                              <p className="mini-card-label">Notes</p>
                              <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-stone-300">
                                {item.notes}
                              </p>
                            </div>
                        ) : null}
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState message="No workout blocks planned." />
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function FormField({
  defaultValue,
  label,
  name,
  placeholder,
}: {
  defaultValue?: string;
  label: string;
  name: string;
  placeholder: string;
}) {
  return (
    <label className="auth-field">
      <span>{label}</span>
      <input defaultValue={defaultValue} name={name} placeholder={placeholder} type="text" />
    </label>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-5 text-sm text-stone-400">
      {message}
    </div>
  );
}
