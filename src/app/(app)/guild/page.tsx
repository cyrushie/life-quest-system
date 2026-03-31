import { redirect } from "next/navigation";

import { GuildView } from "@/components/app/guild-view";
import { LiveRouteRefresh } from "@/components/app/live-route-refresh";
import { getCurrentSession } from "@/lib/auth/get-session";
import { getGuildData } from "@/lib/app-data";

type GuildPageProps = {
  searchParams: Promise<{
    tab?: string;
  }>;
};

export default async function GuildPage({ searchParams }: GuildPageProps) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  const params = await searchParams;
  const data = await getGuildData(session.userId);
  const viewKey = data.hasGuild
    ? `${params.tab ?? "hall"}:${data.guild.memberCount}:${data.board.messageCount}:${data.board.unreadCount}:${data.activityFeed.length}`
    : `noguild:${params.tab ?? "create"}:${data.friendCount}:${data.incomingCount}`;

  return (
    <>
      <LiveRouteRefresh intervalMs={8000} />
      <GuildView
        key={viewKey}
        data={data}
        initialTab={params.tab}
        liveLabel="Auto-updates while open"
      />
    </>
  );
}
