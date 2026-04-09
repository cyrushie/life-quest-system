"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  joinGuildAction,
  leaveGuildAction,
  markGuildBoardSeenAction,
  regenerateGuildInviteAction,
  removeGuildMemberAction,
  saveGuildMessageAction,
  saveGuildAction,
} from "@/app/(app)/actions";
import { ServerForm } from "@/app/(app)/server-form";
import { broadcastAppSync } from "@/lib/client/app-sync";
import { createSafeId } from "@/lib/id";
import { usePrivateBroadcastChannel } from "@/lib/client/use-private-broadcast-channel";

import { LiveStatusPill } from "./live-status-pill";

type GuildData =
  | {
      hasGuild: false;
      friendCount: number;
      incomingCount: number;
    }
  | {
      hasGuild: true;
      guild: {
        id: string;
        name: string;
        description: string | null;
        inviteCode: string;
        createdLabel: string;
        memberCount: number;
        role: "OWNER" | "MEMBER";
        ownerUsername: string | null;
      };
      board: {
        messageCount: number;
        unreadCount: number;
        messages: GuildBoardMessage[];
      };
      activityFeed: {
        id: string;
        username: string;
        dateLabel: string;
        totalQp: number;
        expGained: number;
        questPassUsed: boolean;
        summary: string;
      }[];
      members: {
        id: string;
        username: string;
        level: number;
        title: string;
        streak: number;
        guildName: string | null;
        activity: string;
        role: "OWNER" | "MEMBER";
        isSelf: boolean;
      }[];
    };

type GuildBoardMessage = {
  id: string;
  username: string;
  dateLabel: string;
  content: string;
  isSelf: boolean;
  optimistic?: boolean;
};

function roleLabel(role: "OWNER" | "MEMBER") {
  return role === "OWNER" ? "Owner" : "Member";
}

function formatQp(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function GuildView({
  data,
  initialTab,
  liveLabel,
}: {
  data: GuildData;
  initialTab?: string;
  liveLabel?: string;
}) {
  const router = useRouter();
  const defaultTab = data.hasGuild
    ? initialTab === "board" ||
      initialTab === "activity" ||
      initialTab === "members" ||
      initialTab === "hall"
      ? initialTab
      : "hall"
    : initialTab === "join"
      ? "join"
      : "create";
  const serverBoardMessages = data.hasGuild ? data.board.messages : [];
  const serverBoardUnreadCount = data.hasGuild ? data.board.unreadCount : 0;
  const serverBoardMessageCount = data.hasGuild ? data.board.messageCount : 0;
  const [activeTab, setActiveTab] = useState<"create" | "join" | "hall" | "board" | "activity" | "members">(
    defaultTab,
  );
  const [optimisticMessages, setOptimisticMessages] = useState<GuildBoardMessage[]>(
    serverBoardMessages,
  );
  const [messageDraft, setMessageDraft] = useState("");
  const [messageFeedback, setMessageFeedback] = useState<{
    tone: "error";
    message: string;
  } | null>(null);
  const [isMessagePending, startMessageTransition] = useTransition();
  const threadRef = useRef<HTMLDivElement>(null);
  const visibleBoardUnreadCount =
    data.hasGuild && activeTab !== "board" ? serverBoardUnreadCount : 0;
  const selfUsername = data.hasGuild
    ? data.members.find((member) => member.isSelf)?.username ?? "You"
    : "You";

  function refreshGuildView() {
    router.refresh();
  }

  const {
    connectionState: guildConnectionState,
    lastError: guildConnectionError,
  } = usePrivateBroadcastChannel({
    topic: data.hasGuild ? `guild:${data.guild.id}` : null,
    enabled: data.hasGuild,
    eventNames: ["message-created", "guild-sync"],
    onMessage: ({ event, payload }) => {
      if (!data.hasGuild) {
        return;
      }

      if (event === "guild-sync") {
        refreshGuildView();
        return;
      }

      const message = payload.message as GuildBoardMessage | undefined;

      if (!message) {
        refreshGuildView();
        return;
      }

      if (message.username === selfUsername) {
        refreshGuildView();
        return;
      }

      if (activeTab === "board") {
        setOptimisticMessages((current) => {
          if (current.some((entry) => entry.id === message.id)) {
            return current;
          }

          return [
            {
              ...message,
              isSelf: false,
            },
            ...current,
          ];
        });
        return;
      }

      refreshGuildView();
    },
  });

  useEffect(() => {
    if (!data.hasGuild || guildConnectionState === "live") {
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
  }, [data.hasGuild, guildConnectionState, router]);

  useEffect(() => {
    if (!data.hasGuild || guildConnectionState !== "fallback") {
      return;
    }

    const interval = window.setInterval(() => {
      router.refresh();
    }, 30000);

    return () => {
      window.clearInterval(interval);
    };
  }, [data.hasGuild, guildConnectionState, router]);

  useEffect(() => {
    if (!data.hasGuild || activeTab !== "board") {
      return;
    }

    threadRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    void markGuildBoardSeenAction();
  }, [activeTab, data.hasGuild, serverBoardMessageCount]);

  function changeTab(nextTab: "create" | "join" | "hall" | "board" | "activity" | "members") {
    setActiveTab(nextTab);
    router.replace(`/guild?tab=${nextTab}`);
  }

  async function handleGuildMessageSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!data.hasGuild) {
      return;
    }

    const content = messageDraft.trim();

    if (!content) {
      return;
    }

    const optimisticId = `optimistic-${createSafeId()}`;

    setMessageFeedback(null);
    setMessageDraft("");
    setOptimisticMessages((current) => [
      {
        id: optimisticId,
        username: selfUsername,
        dateLabel: "Today",
        content,
        isSelf: true,
        optimistic: true,
      },
      ...current,
    ]);

    startMessageTransition(async () => {
      const formData = new FormData();
      formData.set("content", content);
      const result = await saveGuildMessageAction({}, formData);

      if (result.error) {
        setOptimisticMessages((current) =>
          current.filter((message) => message.id !== optimisticId),
        );
        setMessageDraft(content);
        setMessageFeedback({
          tone: "error",
          message: result.error,
        });
        return;
      }

      broadcastAppSync("guild-message-sent");
      router.replace("/guild?tab=board");

      if (guildConnectionState !== "live") {
        router.refresh();
      }
    });
  }

  if (!data.hasGuild) {
    return (
      <div className="grid gap-4">
        <section className="quest-panel">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="page-label">Guild</p>
              <h1 className="page-title">Find your party</h1>
              <p className="page-copy mt-3">
                Create a guild hall for your crew or join one with an invite code. Each
                adventurer can belong to one guild at a time.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link className="quest-button quest-button-secondary" href="/friends">
                Open friends
              </Link>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            <article className="mini-card">
              <p className="mini-card-label">Friends ready</p>
              <p className="mini-card-value">{data.friendCount}</p>
            </article>
            <article className="mini-card">
              <p className="mini-card-label">Incoming requests</p>
              <p className="mini-card-value">{data.incomingCount}</p>
            </article>
          </div>

          <div className="section-tabs mt-5">
            <button
              className={`section-tab ${activeTab === "create" ? "section-tab-active" : ""}`}
              onClick={() => changeTab("create")}
              type="button"
            >
              <span className="section-tab-label">Create guild</span>
            </button>
            <button
              className={`section-tab ${activeTab === "join" ? "section-tab-active" : ""}`}
              onClick={() => changeTab("join")}
              type="button"
            >
              <span className="section-tab-label">Join guild</span>
            </button>
          </div>
        </section>

        {activeTab === "create" ? (
          <section className="quest-panel">
            <p className="page-label">Create</p>
            <h2 className="mt-2 font-serif text-2xl text-stone-50">Start a guild</h2>
            <p className="page-copy mt-3">
              Pick a name, add a short purpose, and the app will generate an invite code for
              your members.
            </p>

            <div className="mt-5">
              <ServerForm
                action={saveGuildAction}
                resetOnSuccess
                submitLabel="Create guild"
                successHref="/guild"
              >
                <div className="auth-field">
                  <span>Guild name</span>
                  <input maxLength={48} name="name" placeholder="Momentum Company" required />
                </div>
                <div className="auth-field">
                  <span>Description</span>
                  <textarea
                    maxLength={240}
                    name="description"
                    placeholder="What kind of players belong in this guild?"
                    rows={4}
                  />
                </div>
              </ServerForm>
            </div>
          </section>
        ) : null}

        {activeTab === "join" ? (
          <section className="quest-panel">
            <p className="page-label">Join</p>
            <h2 className="mt-2 font-serif text-2xl text-stone-50">Enter an invite code</h2>
            <p className="page-copy mt-3">
              If a friend already has a guild, paste the code here and step into their hall.
            </p>

            <div className="mt-5">
              <ServerForm
                action={joinGuildAction}
                resetOnSuccess
                submitLabel="Join guild"
                successHref="/guild"
              >
                <div className="auth-field">
                  <span>Invite code</span>
                  <input
                    maxLength={12}
                    name="inviteCode"
                    placeholder="AB12CD34"
                    required
                    style={{ textTransform: "uppercase" }}
                  />
                </div>
              </ServerForm>
            </div>

            <details className="detail-toggle mt-5 text-sm text-stone-400">
              <summary>Guild note</summary>
              <p className="mt-3 leading-7">
                Guilds are for support and shared identity. They do not change your private
                journal or personal task system.
              </p>
            </details>
          </section>
        ) : null}
      </div>
    );
  }

  const leaveLabel =
    data.guild.role === "OWNER"
      ? data.guild.memberCount === 1
        ? "Disband guild"
        : "Leave and pass lead"
      : "Leave guild";

  return (
    <div className="grid gap-4">
      <section className="quest-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="page-label">Guild hall</p>
            <h1 className="page-title">{data.guild.name}</h1>
            <p className="page-copy mt-3">
              {data.guild.description || "A shared hall for like-minded adventurers."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LiveStatusPill
              fallbackLabel="Fallback sync"
              liveLabel={liveLabel ?? "Live"}
              state={guildConnectionState}
              title={guildConnectionError ?? "Guild board updates refresh live while connected."}
            />
            <span className="status-pill">{roleLabel(data.guild.role)}</span>
            <span className="status-pill">
              <strong>{data.guild.memberCount}</strong> members
            </span>
          </div>
        </div>

        <div className="section-tabs mt-5">
          <button
            className={`section-tab ${activeTab === "hall" ? "section-tab-active" : ""}`}
            onClick={() => changeTab("hall")}
            type="button"
          >
            <span className="section-tab-label">Hall</span>
          </button>
          <button
            className={`section-tab ${activeTab === "board" ? "section-tab-active" : ""}`}
            onClick={() => changeTab("board")}
            type="button"
          >
            <span className="section-tab-label">Board</span>
            <span className="status-pill">{data.board.messageCount}</span>
            {visibleBoardUnreadCount > 0 ? (
              <span className="status-pill status-pill-live">
                <span className="status-dot" />
                {visibleBoardUnreadCount} new
              </span>
            ) : null}
          </button>
          <button
            className={`section-tab ${activeTab === "activity" ? "section-tab-active" : ""}`}
            onClick={() => changeTab("activity")}
            type="button"
          >
            <span className="section-tab-label">Activity</span>
            <span className="status-pill">{data.activityFeed.length}</span>
          </button>
          <button
            className={`section-tab ${activeTab === "members" ? "section-tab-active" : ""}`}
            onClick={() => changeTab("members")}
            type="button"
          >
            <span className="section-tab-label">Members</span>
            <span className="status-pill">{data.members.length}</span>
          </button>
        </div>
      </section>

      {activeTab === "hall" ? (
        <>
          <section className="quest-panel">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,22rem)]">
              <div className="grid gap-3 md:grid-cols-3">
                <article className="mini-card">
                  <p className="mini-card-label">Invite code</p>
                  <p className="mini-card-value text-[1.15rem] tracking-[0.18em]">
                    {data.guild.inviteCode}
                  </p>
                </article>
                <article className="mini-card">
                  <p className="mini-card-label">Created</p>
                  <p className="mini-card-value text-[1.15rem]">{data.guild.createdLabel}</p>
                </article>
                <article className="mini-card">
                  <p className="mini-card-label">Guild lead</p>
                  <p className="mini-card-value text-[1.15rem]">
                    {data.guild.ownerUsername ?? "Unknown"}
                  </p>
                </article>
              </div>

              <div className="rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-4">
                <p className="page-label">Actions</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {data.guild.role === "OWNER" ? (
                    <form action={regenerateGuildInviteAction}>
                      <input name="guildId" type="hidden" value={data.guild.id} />
                      <button className="quest-button quest-button-secondary" type="submit">
                        Refresh code
                      </button>
                    </form>
                  ) : null}
                  <form action={leaveGuildAction}>
                    <input name="guildId" type="hidden" value={data.guild.id} />
                    <button className="quest-button quest-button-secondary" type="submit">
                      {leaveLabel}
                    </button>
                  </form>
                  <Link className="quest-button quest-button-secondary" href="/friends">
                    Invite from friends
                  </Link>
                </div>
                <p className="mt-3 text-sm leading-6 text-stone-400">
                  Share the invite code with players you trust. If the owner leaves, the
                  oldest remaining member becomes the new lead automatically.
                </p>
              </div>
            </div>
          </section>

          {data.guild.role === "OWNER" ? (
            <section className="quest-panel">
              <p className="page-label">Settings</p>
              <h2 className="mt-2 font-serif text-2xl text-stone-50">Edit guild hall</h2>
              <p className="page-copy mt-3">
                Tweak the guild name or tighten the description without changing the roster.
              </p>

              <div className="mt-5 max-w-3xl">
                <ServerForm action={saveGuildAction} submitLabel="Save guild" successHref="/guild">
                  <input name="guildId" type="hidden" value={data.guild.id} />
                  <div className="auth-field">
                    <span>Guild name</span>
                    <input defaultValue={data.guild.name} maxLength={48} name="name" required />
                  </div>
                  <div className="auth-field">
                    <span>Description</span>
                    <textarea
                      defaultValue={data.guild.description ?? ""}
                      maxLength={240}
                      name="description"
                      rows={4}
                    />
                  </div>
                </ServerForm>
              </div>
            </section>
          ) : null}
        </>
      ) : null}

      {activeTab === "board" ? (
        <section className="quest-panel">
          <div className="grid gap-4 xl:grid-cols-[minmax(19rem,23rem)_minmax(0,1fr)]">
            <div className="xl:sticky xl:top-5 xl:self-start">
              <div className="rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="page-label">Board</p>
                    <h2 className="mt-2 font-serif text-2xl text-stone-50">Guild chat</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {visibleBoardUnreadCount > 0 ? (
                      <span className="status-pill status-pill-live">
                        <span className="status-dot" />
                        {visibleBoardUnreadCount} unread
                      </span>
                    ) : (
                      <span className="status-pill">All caught up</span>
                    )}
                    <span className="status-pill">
                      <strong>{optimisticMessages.length}</strong> message
                      {optimisticMessages.length === 1 ? "" : "s"}
                    </span>
                  </div>
                </div>

                <p className="page-copy mt-3">
                  Post first, then read the thread below. The message list stays in its own scroll
                  area so the composer is always easy to reach.
                </p>

                <div className="mt-5">
                  <form className="space-y-4" onSubmit={handleGuildMessageSubmit}>
                    <div className="auth-field">
                      <span>Message</span>
                      <textarea
                        disabled={isMessagePending}
                        maxLength={600}
                        name="content"
                        placeholder="Send a quick check-in, reminder, or encouragement..."
                        rows={6}
                        onChange={(event) => setMessageDraft(event.target.value)}
                        value={messageDraft}
                        required
                      />
                    </div>
                    {messageFeedback ? (
                      <p className="rounded-2xl border border-rose-300/18 bg-rose-400/[0.06] px-3 py-2 text-sm text-rose-100">
                        {messageFeedback.message}
                      </p>
                    ) : null}
                    <button
                      className="quest-button w-full disabled:cursor-not-allowed disabled:opacity-70"
                      disabled={isMessagePending || !messageDraft.trim()}
                      type="submit"
                    >
                      {isMessagePending ? "Sending..." : "Send message"}
                    </button>
                  </form>
                </div>
              </div>
            </div>

            <div className="rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="page-label">Thread</p>
                  <h3 className="mt-2 font-serif text-2xl text-stone-50">Recent messages</h3>
                </div>
                <span className="status-pill">Newest first</span>
              </div>

              <div className="mt-4 max-h-[48vh] overflow-y-auto pr-1 md:max-h-[60vh]" ref={threadRef}>
                <div className="compact-list">
                  {optimisticMessages.length ? (
                    optimisticMessages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex ${message.isSelf ? "justify-end" : "justify-start"}`}
                      >
                        <article
                          className={`w-full max-w-3xl rounded-[1.1rem] border px-4 py-4 ${
                            message.isSelf
                              ? "border-[#d6b77a]/18 bg-[#d6b77a]/[0.08]"
                              : "border-white/6 bg-black/15"
                          }`}
                        >
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="font-serif text-lg text-stone-50">{message.username}</p>
                            {message.isSelf ? <span className="status-pill">You</span> : null}
                            <span className="status-pill">{message.dateLabel}</span>
                            {message.optimistic ? (
                              <span className="status-pill status-pill-live">
                                <span className="status-dot" />
                                Sending
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-7 text-stone-300">
                            {message.content}
                          </p>
                        </article>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[1.1rem] border border-white/6 bg-black/15 px-4 py-5 text-sm text-stone-400">
                      No guild messages yet. Send the first one and the thread will start here.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {activeTab === "activity" ? (
        <section className="quest-panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="page-label">Pulse</p>
              <h2 className="mt-2 font-serif text-2xl text-stone-50">Recent guild activity</h2>
            </div>
            <span className="status-pill">
              <strong>{data.activityFeed.length}</strong> recent entries
            </span>
          </div>

          <div className="mt-4 compact-list">
            {data.activityFeed.length ? (
              data.activityFeed.map((entry) => (
                <article
                  key={entry.id}
                  className="rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          className="font-serif text-xl text-stone-50 hover:text-[#f7e7bc]"
                          href={`/adventurers/${entry.username}`}
                        >
                          {entry.username}
                        </Link>
                        <span className="status-pill">{entry.dateLabel}</span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-stone-300">{entry.summary}</p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <span className="status-pill">QP {formatQp(entry.totalQp)}</span>
                      <span className="status-pill">EXP +{entry.expGained.toLocaleString()}</span>
                      {entry.questPassUsed ? (
                        <span className="status-pill status-pill-live">Quest pass</span>
                      ) : null}
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-5 text-sm text-stone-400">
                No guild activity yet. Once members log quest days, the hall feed will appear
                here.
              </div>
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "members" ? (
        <section className="quest-panel">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="page-label">Roster</p>
              <h2 className="mt-2 font-serif text-2xl text-stone-50">Members</h2>
            </div>
            <span className="status-pill">
              <strong>{data.members.length}</strong> active
            </span>
          </div>

          <div className="mt-4 compact-list">
            {data.members.map((member) => (
              <article
                key={member.id}
                className="rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        className="font-serif text-xl text-stone-50 hover:text-[#f7e7bc]"
                        href={`/adventurers/${member.username}`}
                      >
                        {member.username}
                      </Link>
                      {member.isSelf ? <span className="status-pill">You</span> : null}
                      <span className="status-pill">{roleLabel(member.role)}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <span className="status-pill">Lv {member.level}</span>
                      <span className="status-pill">{member.title}</span>
                      <span className="status-pill">{member.streak}d streak</span>
                    </div>
                    <p className="mt-3 max-w-3xl text-sm leading-6 text-stone-400">
                      {member.activity}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      className="quest-button quest-button-secondary"
                      href={`/adventurers/${member.username}`}
                    >
                      View profile
                    </Link>
                    {data.guild.role === "OWNER" && !member.isSelf ? (
                      <form action={removeGuildMemberAction}>
                        <input name="memberId" type="hidden" value={member.id} />
                        <button className="quest-button quest-button-secondary" type="submit">
                          Remove
                        </button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
