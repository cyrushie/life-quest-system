"use client";

import Link from "next/link";

import {
  archiveTaskAction,
  restoreTaskAction,
  saveTaskAction,
} from "@/app/(app)/actions";
import { ServerForm } from "@/app/(app)/server-form";
import { useCachedJson } from "@/lib/client/use-cached-json";

type TaskRecord = {
  id: string;
  name: string;
  anchorDescription: string;
  fullDescription: string;
  anchorQp: number;
  fullQp: number;
};

type TasksData = {
  tasks: TaskRecord[];
  archivedTasks: TaskRecord[];
};

export function TasksClient({
  editId,
  refreshKey,
}: {
  editId?: string;
  refreshKey: string;
}) {
  const { data, loading, error } = useCachedJson<TasksData>("/api/app/tasks", refreshKey);

  if (loading && !data) {
    return <section className="quest-panel h-96 animate-pulse bg-white/[0.03]" />;
  }

  if (error || !data) {
    return (
      <section className="quest-panel">
        <p className="text-sm text-rose-200">{error ?? "Failed to load tasks."}</p>
      </section>
    );
  }

  const editingTask = editId ? data.tasks.find((task) => task.id === editId) ?? null : null;

  return (
    <section className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="quest-panel">
          <p className="page-label">{editingTask ? "Edit task" : "New task"}</p>
          <h1 className="page-title">{editingTask ? editingTask.name : "Build your quest list"}</h1>

          <details className="detail-toggle">
            <summary>Anchor vs full</summary>
            <p className="mt-3 text-sm leading-7 text-stone-400">
              Anchor is the smallest version that keeps momentum. Full is the ideal version.
            </p>
          </details>

          <div className="mt-4">
            <ServerForm
              action={saveTaskAction}
              submitLabel={editingTask ? "Update task" : "Save task"}
            >
              <input name="taskId" type="hidden" value={editingTask?.id ?? ""} />
              <FormField
                defaultValue={editingTask?.name}
                label="Task"
                name="name"
                placeholder="Study"
              />
              <FormField
                defaultValue={editingTask?.anchorDescription}
                label="Anchor"
                name="anchorDescription"
                placeholder="Study for 10 minutes"
              />
              <FormField
                defaultValue={editingTask?.fullDescription}
                label="Full"
                name="fullDescription"
                placeholder="Study for 1 hour"
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <FormField
                  defaultValue={String(editingTask?.anchorQp ?? 1)}
                  label="Anchor QP"
                  name="anchorQp"
                  placeholder="1"
                />
                <FormField
                  defaultValue={String(editingTask?.fullQp ?? 1)}
                  label="Full QP"
                  name="fullQp"
                  placeholder="1"
                />
              </div>
            </ServerForm>
            {editingTask ? (
              <Link
                className="mt-3 inline-flex text-sm text-stone-400 hover:text-stone-200"
                href="/tasks"
              >
                Cancel editing
              </Link>
            ) : null}
          </div>
        </div>

        <div className="quest-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="page-label">Active</p>
              <h2 className="mt-2 font-serif text-2xl text-stone-50">Tasks</h2>
            </div>
            <span className="status-pill">
              <strong>{data.tasks.length}</strong> active
            </span>
          </div>

          <div className="mt-4 compact-list">
            {data.tasks.length ? (
              data.tasks.map((task) => (
                <article
                  key={task.id}
                  className="rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-serif text-xl text-stone-50">{task.name}</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="status-pill">A {task.anchorQp}</span>
                        <span className="status-pill">F {task.fullQp}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Link className="quest-button quest-button-secondary" href={`/tasks?edit=${task.id}`}>
                        Edit
                      </Link>
                      <form action={archiveTaskAction}>
                        <input name="taskId" type="hidden" value={task.id} />
                        <button className="quest-button quest-button-secondary" type="submit">
                          Archive
                        </button>
                      </form>
                    </div>
                  </div>
                  <details className="detail-toggle">
                    <summary>Details</summary>
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
              <EmptyState message="No tasks yet." />
            )}
          </div>
        </div>
      </div>

      <section className="quest-panel">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="page-label">Archived</p>
            <h2 className="mt-2 font-serif text-2xl text-stone-50">Stored tasks</h2>
          </div>
          <span className="status-pill">
            <strong>{data.archivedTasks.length}</strong> stored
          </span>
        </div>

        <div className="mt-4 compact-list">
          {data.archivedTasks.length ? (
            data.archivedTasks.map((task) => (
              <article
                key={task.id}
                className="rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-serif text-xl text-stone-50">{task.name}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="status-pill">A {task.anchorQp}</span>
                      <span className="status-pill">F {task.fullQp}</span>
                    </div>
                  </div>
                  <form action={restoreTaskAction}>
                    <input name="taskId" type="hidden" value={task.id} />
                    <button className="quest-button quest-button-secondary" type="submit">
                      Restore
                    </button>
                  </form>
                </div>
              </article>
            ))
          ) : (
            <EmptyState message="No archived tasks." />
          )}
        </div>
      </section>
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
