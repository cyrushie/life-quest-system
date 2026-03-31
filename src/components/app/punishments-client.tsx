"use client";

import Link from "next/link";

import {
  archivePunishmentAction,
  restorePunishmentAction,
  savePunishmentAction,
} from "@/app/(app)/actions";
import { ServerForm } from "@/app/(app)/server-form";
import { useCachedJson } from "@/lib/client/use-cached-json";

type PunishmentRecord = {
  id: string;
  name: string;
  description: string | null;
};

type PunishmentsData = {
  punishments: PunishmentRecord[];
  archivedPunishments: PunishmentRecord[];
};

export function PunishmentsClient({
  editId,
  refreshKey,
}: {
  editId?: string;
  refreshKey: string;
}) {
  const { data, loading, error } = useCachedJson<PunishmentsData>(
    "/api/app/punishments",
    refreshKey,
  );

  if (loading && !data) {
    return <section className="quest-panel h-96 animate-pulse bg-white/[0.03]" />;
  }

  if (error || !data) {
    return (
      <section className="quest-panel">
        <p className="text-sm text-rose-200">{error ?? "Failed to load punishments."}</p>
      </section>
    );
  }

  const editingPunishment = editId
    ? data.punishments.find((item) => item.id === editId) ?? null
    : null;

  return (
    <section className="grid gap-4">
      <div className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="quest-panel">
          <p className="page-label">{editingPunishment ? "Edit recovery" : "New recovery"}</p>
          <h1 className="page-title">
            {editingPunishment ? editingPunishment.name : "Punishment pool"}
          </h1>

          <details className="detail-toggle">
            <summary>Why this matters</summary>
            <p className="mt-3 text-sm leading-7 text-stone-400">
              Zero-QP days should lead to a clear follow-up action, not just a silent reset.
            </p>
          </details>

          <div className="mt-4">
            <ServerForm
              action={savePunishmentAction}
              submitLabel={editingPunishment ? "Update recovery" : "Save recovery"}
            >
              <input name="punishmentId" type="hidden" value={editingPunishment?.id ?? ""} />
              <label className="auth-field">
                <span>Name</span>
                <input
                  defaultValue={editingPunishment?.name ?? ""}
                  name="name"
                  placeholder="Deep clean"
                  type="text"
                />
              </label>
              <label className="auth-field">
                <span>Details</span>
                <textarea
                  defaultValue={editingPunishment?.description ?? ""}
                  name="description"
                  placeholder="Reset the room before the next work block."
                  rows={5}
                />
              </label>
            </ServerForm>
            {editingPunishment ? (
              <Link
                className="mt-3 inline-flex text-sm text-stone-400 hover:text-stone-200"
                href="/punishments"
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
              <h2 className="mt-2 font-serif text-2xl text-stone-50">Recoveries</h2>
            </div>
            <span className="status-pill">
              <strong>{data.punishments.length}</strong> active
            </span>
          </div>

          <div className="mt-4 compact-list">
            {data.punishments.length ? (
              data.punishments.map((punishment) => (
                <article
                  key={punishment.id}
                  className="rounded-[1.1rem] border border-rose-300/12 bg-rose-400/[0.05] px-4 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-serif text-xl text-stone-50">{punishment.name}</p>
                      {punishment.description ? (
                        <p className="mt-2 max-w-xl text-sm leading-7 text-stone-400">
                          {punishment.description}
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-stone-500">No details</p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Link
                        className="quest-button quest-button-secondary"
                        href={`/punishments?edit=${punishment.id}`}
                      >
                        Edit
                      </Link>
                      <form action={archivePunishmentAction}>
                        <input name="punishmentId" type="hidden" value={punishment.id} />
                        <button className="quest-button quest-button-secondary" type="submit">
                          Archive
                        </button>
                      </form>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <EmptyState message="No punishments yet." />
            )}
          </div>
        </div>
      </div>

      <section className="quest-panel">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="page-label">Archived</p>
            <h2 className="mt-2 font-serif text-2xl text-stone-50">Stored recoveries</h2>
          </div>
          <span className="status-pill">
            <strong>{data.archivedPunishments.length}</strong> stored
          </span>
        </div>

        <div className="mt-4 compact-list">
          {data.archivedPunishments.length ? (
            data.archivedPunishments.map((punishment) => (
              <article
                key={punishment.id}
                className="rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-serif text-xl text-stone-50">{punishment.name}</p>
                    {punishment.description ? (
                      <p className="mt-2 max-w-xl text-sm leading-7 text-stone-400">
                        {punishment.description}
                      </p>
                    ) : (
                      <p className="mt-2 text-sm text-stone-500">No details</p>
                    )}
                  </div>
                  <form action={restorePunishmentAction}>
                    <input name="punishmentId" type="hidden" value={punishment.id} />
                    <button className="quest-button quest-button-secondary" type="submit">
                      Restore
                    </button>
                  </form>
                </div>
              </article>
            ))
          ) : (
            <EmptyState message="No archived punishments." />
          )}
        </div>
      </section>
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-5 text-sm text-stone-400">
      {message}
    </div>
  );
}
