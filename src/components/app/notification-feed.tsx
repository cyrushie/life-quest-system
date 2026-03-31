"use client";

export type NotificationEventItem = {
  id: string;
  kind: "event";
  type: string;
  title: string;
  body: string;
  href: string;
  createdLabel: string;
  isRead: boolean;
  tone: "gold" | "emerald" | "rose" | "stone";
};

export type NotificationSystemItem = {
  id: string;
  kind: "system";
  title: string;
  body: string;
  href: string;
  tone: "gold" | "emerald" | "rose" | "stone";
};

export type NotificationsData = {
  unreadCount: number;
  notifications: NotificationEventItem[];
  system: NotificationSystemItem[];
};

function toneClasses(tone: NotificationEventItem["tone"] | NotificationSystemItem["tone"]) {
  switch (tone) {
    case "gold":
      return "border-[#d6b77a]/18 bg-[#d6b77a]/[0.08]";
    case "emerald":
      return "border-emerald-300/14 bg-emerald-400/[0.06]";
    case "rose":
      return "border-rose-300/14 bg-rose-400/[0.06]";
    default:
      return "border-white/6 bg-white/[0.025]";
  }
}

type NotificationFeedProps = {
  data: NotificationsData;
  mode: "compact" | "page";
  busy: boolean;
  onMarkAllRead: () => void;
  onOpenItem: (item: NotificationEventItem | NotificationSystemItem) => void;
};

export function NotificationFeed({
  data,
  mode,
  busy,
  onMarkAllRead,
  onOpenItem,
}: NotificationFeedProps) {
  const previewNotifications =
    mode === "compact" ? data.notifications.slice(0, 6) : data.notifications;
  const previewSystem = mode === "compact" ? data.system.slice(0, 2) : data.system;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="page-label">{mode === "compact" ? "Alerts" : "Notifications"}</p>
          <h2 className="mt-2 font-serif text-2xl text-stone-50">
            {mode === "compact" ? "Notification center" : "All notifications"}
          </h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="status-pill">
            <strong>{data.unreadCount}</strong> unread
          </span>
          {data.unreadCount ? (
            <button
              className="quest-button quest-button-secondary"
              disabled={busy}
              onClick={onMarkAllRead}
              type="button"
            >
              {busy ? "Saving..." : "Mark all read"}
            </button>
          ) : null}
        </div>
      </div>

      {previewSystem.length ? (
        <section>
          <p className="mini-card-label">System</p>
          <div className="mt-3 compact-list">
            {previewSystem.map((item) => (
              <button
                key={item.id}
                className={`w-full rounded-[1rem] border px-4 py-3 text-left transition hover:border-white/12 ${toneClasses(item.tone)}`}
                onClick={() => onOpenItem(item)}
                type="button"
              >
                <p className="font-medium text-stone-100">{item.title}</p>
                <p className="mt-2 text-sm leading-6 text-stone-400">{item.body}</p>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <p className="mini-card-label">Activity</p>
        <div className="mt-3 compact-list">
          {previewNotifications.length ? (
            previewNotifications.map((item) => (
              <article
                key={item.id}
                className={`rounded-[1rem] border px-4 py-3 ${toneClasses(item.tone)}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => onOpenItem(item)}
                    type="button"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-stone-100">{item.title}</p>
                      {!item.isRead ? (
                        <span className="status-pill status-pill-live">
                          <span className="status-dot" />
                          New
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-sm leading-6 text-stone-400">{item.body}</p>
                    <p className="mt-2 text-xs uppercase tracking-[0.14em] text-stone-500">
                      {item.createdLabel}
                    </p>
                  </button>
                  {!item.isRead ? (
                    <button
                      className="quest-button quest-button-secondary shrink-0"
                      disabled={busy}
                      onClick={() => onOpenItem(item)}
                      type="button"
                    >
                      Open
                    </button>
                  ) : null}
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-[1rem] border border-white/6 bg-white/[0.025] px-4 py-5 text-sm text-stone-400">
              No recent notifications yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
