"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main className="min-h-screen bg-[#0b0a09] px-4 py-10 text-stone-100">
          <div className="mx-auto max-w-2xl rounded-[1.4rem] border border-white/8 bg-white/[0.03] p-6">
            <p className="page-label">System fault</p>
            <h1 className="mt-2 font-serif text-3xl text-stone-50">
              Something broke unexpectedly
            </h1>
            <p className="mt-4 text-sm leading-7 text-stone-300">
              The app hit an unexpected error. You can try again now, or refresh the page if
              the problem keeps happening.
            </p>
            {error.digest ? (
              <p className="mt-4 text-xs uppercase tracking-[0.14em] text-stone-500">
                Error reference: {error.digest}
              </p>
            ) : null}
            <div className="mt-6 flex flex-wrap gap-3">
              <button className="quest-button" onClick={() => reset()} type="button">
                Try again
              </button>
              <button
                className="quest-button quest-button-secondary"
                onClick={() => window.location.reload()}
                type="button"
              >
                Reload page
              </button>
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
