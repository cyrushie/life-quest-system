"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  acceptFriendRequestAction,
  cancelFriendRequestAction,
  declineFriendRequestAction,
  removeFriendAction,
  sendFriendRequestAction,
} from "@/app/(app)/actions";
import {
  combineRealtimeConnectionStates,
} from "@/lib/client/use-private-broadcast-channel";
import { usePostgresChangesChannel } from "@/lib/client/use-postgres-changes-channel";

import { LiveStatusPill } from "./live-status-pill";
import { ProgressTrendChart } from "./progress-trend-chart";

type ProfileData = {
  userId: string;
  username: string;
  joinedLabel: string;
  isSelf: boolean;
  relationship: "self" | "none" | "outgoing_pending" | "incoming_pending" | "friends";
  stats: {
    currentLevel: number;
    currentTitle: string;
    totalExp: number;
    currentStreak: number;
    questPassCount: number;
  };
  friendCount: number;
  guild: {
    id: string;
    name: string;
    role: "OWNER" | "MEMBER";
    memberCount: number;
  } | null;
  latestActivity: string;
  trend: {
    dateKey: string;
    label: string;
    totalQp: number;
    expGained: number;
  }[];
  recentLogs: {
    id: string;
    dateLabel: string;
    totalQp: number;
    expGained: number;
    anchorCount: number;
    fullCount: number;
  }[];
};

export function ProfileView({
  data,
  viewerUserId,
  liveLabel,
}: {
  data: ProfileData;
  viewerUserId: string;
  liveLabel?: string;
}) {
  const router = useRouter();
  const statCards = [
    { label: "Level", value: data.stats.currentLevel },
    { label: "Title", value: data.stats.currentTitle },
    { label: "Streak", value: `${data.stats.currentStreak}d` },
    { label: "Quest passes", value: data.stats.questPassCount },
  ];

  const {
    connectionState: profileConnectionState,
    lastError: profileConnectionError,
  } = usePostgresChangesChannel({
    channelName: `profile-db-${data.userId}`,
    changes: [
      {
        event: "*",
        schema: "public",
        table: "UserStats",
        filter: `userId=eq.${data.userId}`,
      },
      {
        event: "*",
        schema: "public",
        table: "DailyLog",
        filter: `userId=eq.${data.userId}`,
      },
      {
        event: "*",
        schema: "public",
        table: "GuildMembership",
        filter: `userId=eq.${data.userId}`,
      },
    ],
    onMessage: () => {
      router.refresh();
    },
  });

  const {
    connectionState: socialConnectionState,
    lastError: socialConnectionError,
  } = usePostgresChangesChannel({
    channelName: `profile-friendships-db-${viewerUserId}`,
    changes: [
      {
        event: "*",
        schema: "public",
        table: "Friendship",
        filter: `requesterId=eq.${viewerUserId}`,
      },
      {
        event: "*",
        schema: "public",
        table: "Friendship",
        filter: `addresseeId=eq.${viewerUserId}`,
      },
    ],
    onMessage: () => {
      router.refresh();
    },
  });

  const liveConnectionState = combineRealtimeConnectionStates(
    profileConnectionState,
    socialConnectionState,
  );
  const liveConnectionError = profileConnectionError ?? socialConnectionError;

  useEffect(() => {
    if (liveConnectionState === "live") {
      return;
    }

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    };

    const handleFocus = () => {
      router.refresh();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("focus", handleFocus);
    };
  }, [liveConnectionState, router]);

  useEffect(() => {
    if (liveConnectionState !== "fallback") {
      return;
    }

    const interval = window.setInterval(() => {
      router.refresh();
    }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, [liveConnectionState, router]);

  return (
    <div className="grid gap-4">
      <section className="quest-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="page-label">{data.isSelf ? "Profile" : "Adventurer"}</p>
            <h1 className="page-title">{data.username}</h1>
            <p className="page-copy mt-3">
              Joined {data.joinedLabel}. Public-facing progress view for levels, streaks, and
              recent quest momentum.
            </p>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-400">
              Latest activity: {data.latestActivity}
            </p>
            {data.guild ? (
              <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-400">
                Guild: {data.guild.name} · {data.guild.role === "OWNER" ? "Owner" : "Member"} ·{" "}
                {data.guild.memberCount} members
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <LiveStatusPill
              fallbackLabel="Fallback sync"
              liveLabel={liveLabel ?? "Live"}
              state={liveConnectionState}
              title={liveConnectionError ?? "Profile data refreshes live while connected."}
            />
            <span className="status-pill">
              <strong>{data.friendCount}</strong> friend{data.friendCount === 1 ? "" : "s"}
            </span>
            {data.relationship === "self" ? (
              <>
                {data.guild ? (
                  <Link className="quest-button quest-button-secondary" href="/guild">
                    Open guild
                  </Link>
                ) : null}
                <Link className="quest-button" href="/friends">
                  Open friends
                </Link>
              </>
            ) : data.relationship === "none" ? (
              <form action={sendFriendRequestAction}>
                <input name="username" type="hidden" value={data.username} />
                <button className="quest-button" type="submit">
                  Send request
                </button>
              </form>
            ) : data.relationship === "incoming_pending" ? (
              <>
                <form action={acceptFriendRequestAction}>
                  <input name="username" type="hidden" value={data.username} />
                  <button className="quest-button" type="submit">
                    Accept request
                  </button>
                </form>
                <form action={declineFriendRequestAction}>
                  <input name="username" type="hidden" value={data.username} />
                  <button className="quest-button quest-button-secondary" type="submit">
                    Decline
                  </button>
                </form>
              </>
            ) : data.relationship === "outgoing_pending" ? (
              <>
                <span className="status-pill">Request sent</span>
                <form action={cancelFriendRequestAction}>
                  <input name="username" type="hidden" value={data.username} />
                  <button className="quest-button quest-button-secondary" type="submit">
                    Withdraw
                  </button>
                </form>
              </>
            ) : (
              <>
                <span className="status-pill status-pill-live">Friends</span>
                <form action={removeFriendAction}>
                  <input name="username" type="hidden" value={data.username} />
                  <button className="quest-button quest-button-secondary" type="submit">
                    Remove
                  </button>
                </form>
              </>
            )}
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
      </section>

      <ProgressTrendChart
        points={data.trend}
        subtitle="Daily QP earned over the last 14 days. Hover each point for that day's QP and EXP."
        title="Recent momentum"
      />

      <section className="quest-panel">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="page-label">Recent days</p>
            <h2 className="mt-2 font-serif text-2xl text-stone-50">Quest record</h2>
          </div>
          {data.isSelf ? (
            <Link className="quest-button quest-button-secondary" href="/history">
              Open history
            </Link>
          ) : null}
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
                      A {entry.anchorCount} · F {entry.fullCount}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <span className="status-pill">QP {entry.totalQp}</span>
                    <span className="status-pill">EXP +{entry.expGained.toLocaleString()}</span>
                  </div>
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-5 text-sm text-stone-400">
              No quest record yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
