"use client";

import { useCachedJson } from "@/lib/client/use-cached-json";

type JournalData = {
  groups: {
    group: string;
    entries: {
      id: string;
      dateLabel: string;
      content: string;
    }[];
  }[];
};

export function JournalClient({ refreshKey }: { refreshKey: string }) {
  const { data, loading, error } = useCachedJson<JournalData>("/api/app/journal", refreshKey);

  if (loading && !data) {
    return <section className="quest-panel h-96 animate-pulse bg-white/[0.03]" />;
  }

  if (error || !data) {
    return (
      <section className="quest-panel">
        <p className="text-sm text-rose-200">{error ?? "Failed to load journal."}</p>
      </section>
    );
  }

  return (
    <section className="grid gap-4">
      <div className="quest-panel">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="page-label">Journal</p>
            <h1 className="page-title">Archive</h1>
          </div>
          <span className="status-pill">
            <strong>{data.groups.length}</strong> groups
          </span>
        </div>
      </div>

      {data.groups.length ? (
        data.groups.map((group) => (
          <section key={group.group} className="quest-panel">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-serif text-2xl text-stone-50">{group.group}</h2>
              <span className="status-pill">
                <strong>{group.entries.length}</strong> entries
              </span>
            </div>
            <div className="mt-4 compact-list">
              {group.entries.map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-3"
                >
                  <p className="text-xs uppercase tracking-[0.16em] text-stone-500">
                    {entry.dateLabel}
                  </p>
                  <p className="mt-3 text-sm leading-7 text-stone-300">
                    {entry.content || "No journal content saved for this day."}
                  </p>
                </article>
              ))}
            </div>
          </section>
        ))
      ) : (
        <section className="quest-panel">
          <div className="rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-5 text-sm text-stone-400">
            No journal entries yet.
          </div>
        </section>
      )}
    </section>
  );
}
