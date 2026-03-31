import { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/get-session";
import { db } from "@/lib/db";

import { AppSyncListener } from "@/components/app/app-sync-listener";
import { NotificationCenter } from "@/components/app/notification-center";

import { AppNav } from "./app-nav";
import { LogoutButton } from "./logout-button";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { onboardingComplete: true },
  });
  const needsSetup = !user?.onboardingComplete;

  return (
    <div className="min-h-screen text-stone-100">
      <AppSyncListener />
      <div className="mx-auto grid min-h-screen max-w-7xl gap-4 px-3 py-4 lg:grid-cols-[240px_1fr] lg:px-6 lg:py-5">
        <aside className="quest-panel h-fit lg:sticky lg:top-5">
          <div className="rounded-2xl border border-white/6 bg-white/[0.02] p-4">
            <p className="page-label">Life Quest</p>
            <h1 className="mt-2 font-serif text-2xl text-stone-50">Codex</h1>
            <div className="mt-4 flex items-center justify-between rounded-2xl border border-white/6 bg-black/15 px-3 py-2.5">
              <div>
                <p className="text-[0.65rem] uppercase tracking-[0.2em] text-stone-500">
                  Player
                </p>
                <Link className="mt-1 inline-flex text-sm font-medium text-stone-100 hover:text-[#f7e7bc]" href="/profile">
                  {session.username}
                </Link>
              </div>
              <span className="status-pill">
                <span className="status-dot" />
                Active
              </span>
            </div>

            {needsSetup ? (
              <div className="setup-note mt-4">
                <div>
                  <p className="setup-note-label">Setup required</p>
                  <p className="setup-note-copy">
                    Add at least one task and one punishment to fully unlock the system.
                  </p>
                </div>
                <Link className="quest-button quest-button-secondary" href="/onboarding">
                  Open setup
                </Link>
              </div>
            ) : null}
          </div>

          <AppNav showSetupBadge={needsSetup} />

          <details className="detail-toggle text-sm text-stone-400">
            <summary>System note</summary>
            <p className="mt-3 leading-7">
              Anchor protects momentum. Full pushes growth. The goal is steady progress,
              not perfect days.
            </p>
          </details>

          <div className="mt-5">
            <LogoutButton />
          </div>
        </aside>

        <div className="space-y-4">
          <div className="flex justify-end">
            <NotificationCenter />
          </div>
          <main className="space-y-4">{children}</main>
        </div>
      </div>
    </div>
  );
}
