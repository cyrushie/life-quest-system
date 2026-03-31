"use client";

import Link from "next/link";
import { useState } from "react";

import {
  acceptFriendRequestAction,
  cancelFriendRequestAction,
  declineFriendRequestAction,
  removeFriendAction,
  sendFriendRequestAction,
} from "@/app/(app)/actions";

type FriendsData = {
  query: string;
  searchMeta: string;
  friends: {
    id: string;
    username: string;
    level: number;
    title: string;
    streak: number;
    guildName: string | null;
    activity: string;
  }[];
  incomingRequests: {
    id: string;
    username: string;
    level: number;
    title: string;
    streak: number;
    guildName: string | null;
    activity: string;
  }[];
  outgoingRequests: {
    id: string;
    username: string;
    level: number;
    title: string;
    streak: number;
    guildName: string | null;
    activity: string;
  }[];
  discover: {
    id: string;
    username: string;
    level: number;
    title: string;
    streak: number;
    guildName: string | null;
    activity: string;
    relationship: "none" | "outgoing_pending" | "incoming_pending" | "friends";
  }[];
};

export function FriendsView({
  data,
  liveLabel,
}: {
  data: FriendsData;
  liveLabel?: string;
}) {
  const [activeTab, setActiveTab] = useState<"requests" | "friends" | "discover">(
    data.incomingRequests.length || data.outgoingRequests.length ? "requests" : "friends",
  );

  return (
    <div className="grid gap-4">
      <section className="quest-panel">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="page-label">Social</p>
            <h1 className="page-title">Friends</h1>
            <p className="page-copy mt-3">
              Find like-minded players, accept requests, and open their public progress pages.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {liveLabel ? (
              <span className="status-pill status-pill-live">
                <span className="status-dot" />
                {liveLabel}
              </span>
            ) : null}
            <Link className="quest-button" href="/profile">
              Open profile
            </Link>
          </div>
        </div>

        <form className="mt-4 grid gap-3 md:grid-cols-[1fr_auto]" method="GET">
          <input
            defaultValue={data.query}
            name="q"
            placeholder="Search username or title..."
            type="text"
          />
          <div className="flex gap-2">
            <button className="quest-button" type="submit">
              Search
            </button>
            {data.query ? (
              <Link className="quest-button quest-button-secondary" href="/friends">
                Clear
              </Link>
            ) : null}
          </div>
        </form>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-stone-400">
          <span className="status-pill">
            <strong>{data.discover.length}</strong> discover
          </span>
          <span>{data.searchMeta}</span>
        </div>

        <div className="section-tabs mt-5">
          <button
            className={`section-tab ${activeTab === "requests" ? "section-tab-active" : ""}`}
            onClick={() => setActiveTab("requests")}
            type="button"
          >
            <span className="section-tab-label">Requests</span>
            <span className="status-pill">
              {data.incomingRequests.length + data.outgoingRequests.length}
            </span>
          </button>
          <button
            className={`section-tab ${activeTab === "friends" ? "section-tab-active" : ""}`}
            onClick={() => setActiveTab("friends")}
            type="button"
          >
            <span className="section-tab-label">Friends</span>
            <span className="status-pill">{data.friends.length}</span>
          </button>
          <button
            className={`section-tab ${activeTab === "discover" ? "section-tab-active" : ""}`}
            onClick={() => setActiveTab("discover")}
            type="button"
          >
            <span className="section-tab-label">Discover</span>
            <span className="status-pill">{data.discover.length}</span>
          </button>
        </div>
      </section>

      {activeTab === "requests" ? (
        <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
          <section className="quest-panel">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="page-label">Incoming</p>
                <h2 className="mt-2 font-serif text-2xl text-stone-50">Requests</h2>
              </div>
              <span className="status-pill">
                <strong>{data.incomingRequests.length}</strong> open
              </span>
            </div>

            <div className="mt-4 compact-list">
              {data.incomingRequests.length ? (
                data.incomingRequests.map((request) => (
                  <article
                    key={request.id}
                    className="rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Link
                          className="font-serif text-xl text-stone-50 hover:text-[#f7e7bc]"
                          href={`/adventurers/${request.username}`}
                        >
                          {request.username}
                        </Link>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="status-pill">Lv {request.level}</span>
                          <span className="status-pill">{request.title}</span>
                          <span className="status-pill">{request.streak}d streak</span>
                          {request.guildName ? (
                            <span className="status-pill">{request.guildName}</span>
                          ) : null}
                        </div>
                        <p className="mt-3 max-w-xl text-sm leading-6 text-stone-400">
                          {request.activity}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <form action={acceptFriendRequestAction}>
                          <input name="requestId" type="hidden" value={request.id} />
                          <button className="quest-button" type="submit">
                            Accept
                          </button>
                        </form>
                        <form action={declineFriendRequestAction}>
                          <input name="requestId" type="hidden" value={request.id} />
                          <button className="quest-button quest-button-secondary" type="submit">
                            Decline
                          </button>
                        </form>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <EmptyCard message="No incoming requests." />
              )}
            </div>
          </section>

          <section className="quest-panel">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="page-label">Outgoing</p>
                <h2 className="mt-2 font-serif text-2xl text-stone-50">Pending</h2>
              </div>
              <span className="status-pill">
                <strong>{data.outgoingRequests.length}</strong> sent
              </span>
            </div>

            <div className="mt-4 compact-list">
              {data.outgoingRequests.length ? (
                data.outgoingRequests.map((request) => (
                  <article
                    key={request.id}
                    className="rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-3"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Link
                          className="font-serif text-xl text-stone-50 hover:text-[#f7e7bc]"
                          href={`/adventurers/${request.username}`}
                        >
                          {request.username}
                        </Link>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className="status-pill">Lv {request.level}</span>
                          <span className="status-pill">{request.title}</span>
                          <span className="status-pill">{request.streak}d streak</span>
                          {request.guildName ? (
                            <span className="status-pill">{request.guildName}</span>
                          ) : null}
                        </div>
                        <p className="mt-3 max-w-xl text-sm leading-6 text-stone-400">
                          {request.activity}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="status-pill">Pending</span>
                        <form action={cancelFriendRequestAction}>
                          <input name="requestId" type="hidden" value={request.id} />
                          <button className="quest-button quest-button-secondary" type="submit">
                            Withdraw
                          </button>
                        </form>
                      </div>
                    </div>
                  </article>
                ))
              ) : (
                <EmptyCard message="No outgoing requests." />
              )}
            </div>
          </section>
        </div>
      ) : null}

      {activeTab === "friends" ? (
        <section className="quest-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="page-label">Friends</p>
              <h2 className="mt-2 font-serif text-2xl text-stone-50">Connected</h2>
            </div>
            <span className="status-pill">
              <strong>{data.friends.length}</strong> linked
            </span>
          </div>

          <div className="mt-4 compact-list">
            {data.friends.length ? (
              data.friends.map((friend) => (
                <article
                  key={friend.id}
                  className="rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link
                        className="font-serif text-xl text-stone-50 hover:text-[#f7e7bc]"
                        href={`/adventurers/${friend.username}`}
                      >
                        {friend.username}
                      </Link>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="status-pill">Lv {friend.level}</span>
                        <span className="status-pill">{friend.title}</span>
                        <span className="status-pill">{friend.streak}d streak</span>
                        {friend.guildName ? (
                          <span className="status-pill">{friend.guildName}</span>
                        ) : null}
                      </div>
                      <p className="mt-3 max-w-xl text-sm leading-6 text-stone-400">
                        {friend.activity}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="status-pill status-pill-live">Friends</span>
                      <form action={removeFriendAction}>
                        <input name="username" type="hidden" value={friend.username} />
                        <button className="quest-button quest-button-secondary" type="submit">
                          Remove
                        </button>
                      </form>
                    </div>
                  </div>
                </article>
              ))
            ) : (
              <EmptyCard message="No friends connected yet." />
            )}
          </div>
        </section>
      ) : null}

      {activeTab === "discover" ? (
        <section className="quest-panel">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="page-label">Discover</p>
              <h2 className="mt-2 font-serif text-2xl text-stone-50">
                {data.query ? "Search results" : "Players"}
              </h2>
            </div>
            <span className="status-pill">
              <strong>{data.discover.length}</strong> shown
            </span>
          </div>

          <div className="mt-4 compact-list">
            {data.discover.length ? (
              data.discover.map((user) => (
                <article
                  key={user.id}
                  className="rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Link
                        className="font-serif text-xl text-stone-50 hover:text-[#f7e7bc]"
                        href={`/adventurers/${user.username}`}
                      >
                        {user.username}
                      </Link>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="status-pill">Lv {user.level}</span>
                        <span className="status-pill">{user.title}</span>
                        <span className="status-pill">{user.streak}d streak</span>
                        {user.guildName ? (
                          <span className="status-pill">{user.guildName}</span>
                        ) : null}
                      </div>
                      <p className="mt-3 max-w-xl text-sm leading-6 text-stone-400">
                        {user.activity}
                      </p>
                    </div>
                    {user.relationship === "none" ? (
                      <form action={sendFriendRequestAction}>
                        <input name="username" type="hidden" value={user.username} />
                        <button className="quest-button" type="submit">
                          Add
                        </button>
                      </form>
                    ) : user.relationship === "incoming_pending" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="status-pill">Incoming</span>
                        <form action={acceptFriendRequestAction}>
                          <input name="username" type="hidden" value={user.username} />
                          <button className="quest-button" type="submit">
                            Accept
                          </button>
                        </form>
                      </div>
                    ) : user.relationship === "outgoing_pending" ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="status-pill">Pending</span>
                        <form action={cancelFriendRequestAction}>
                          <input name="username" type="hidden" value={user.username} />
                          <button className="quest-button quest-button-secondary" type="submit">
                            Withdraw
                          </button>
                        </form>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="status-pill status-pill-live">Friends</span>
                        <form action={removeFriendAction}>
                          <input name="username" type="hidden" value={user.username} />
                          <button className="quest-button quest-button-secondary" type="submit">
                            Remove
                          </button>
                        </form>
                      </div>
                    )}
                  </div>
                </article>
              ))
            ) : (
              <EmptyCard
                message={data.query ? "No matching players found." : "No players to discover yet."}
              />
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function EmptyCard({ message }: { message: string }) {
  return (
    <div className="rounded-[1.1rem] border border-white/6 bg-white/[0.025] px-4 py-5 text-sm text-stone-400">
      {message}
    </div>
  );
}
