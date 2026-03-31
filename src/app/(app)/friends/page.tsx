import { redirect } from "next/navigation";

import { FriendsView } from "@/components/app/friends-view";
import { LiveRouteRefresh } from "@/components/app/live-route-refresh";
import { getCurrentSession } from "@/lib/auth/get-session";
import { getFriendsData } from "@/lib/app-data";

type FriendsPageProps = {
  searchParams: Promise<{
    q?: string;
  }>;
};

export default async function FriendsPage({ searchParams }: FriendsPageProps) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  const params = await searchParams;
  const data = await getFriendsData(session.userId, params.q ?? "");

  return (
    <>
      <LiveRouteRefresh intervalMs={8000} />
      <FriendsView data={data} liveLabel="Auto-updates while open" />
    </>
  );
}
