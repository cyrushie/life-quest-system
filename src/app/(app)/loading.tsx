export default function AppLoading() {
  return (
    <div className="min-h-screen text-stone-100">
      <div className="mx-auto grid min-h-screen max-w-7xl gap-4 px-3 py-4 lg:grid-cols-[240px_1fr] lg:px-6 lg:py-5">
        <aside className="quest-panel h-fit">
          <div className="h-24 animate-pulse rounded-2xl bg-white/[0.03]" />
          <div className="mt-5 space-y-2">
            <div className="h-10 animate-pulse rounded-2xl bg-white/[0.03]" />
            <div className="h-10 animate-pulse rounded-2xl bg-white/[0.03]" />
            <div className="h-10 animate-pulse rounded-2xl bg-white/[0.03]" />
            <div className="h-10 animate-pulse rounded-2xl bg-white/[0.03]" />
          </div>
        </aside>

        <div className="space-y-4">
          <section className="quest-panel">
            <div className="h-5 w-24 animate-pulse rounded-full bg-white/[0.03]" />
            <div className="mt-3 h-10 w-1/3 animate-pulse rounded-2xl bg-white/[0.03]" />
            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <div className="h-24 animate-pulse rounded-3xl bg-white/[0.03]" />
              <div className="h-24 animate-pulse rounded-3xl bg-white/[0.03]" />
              <div className="h-24 animate-pulse rounded-3xl bg-white/[0.03]" />
              <div className="h-24 animate-pulse rounded-3xl bg-white/[0.03]" />
            </div>
          </section>

          <div className="status-pill status-pill-live w-fit">
            <span className="status-dot" />
            <strong>Loading codex</strong>
          </div>

          <section className="grid gap-4 xl:grid-cols-2">
            <div className="quest-panel h-72 animate-pulse bg-white/[0.03]" />
            <div className="quest-panel h-72 animate-pulse bg-white/[0.03]" />
          </section>
        </div>
      </div>
    </div>
  );
}
