import { notFound, redirect } from "next/navigation";

import { LiveRouteRefresh } from "@/components/app/live-route-refresh";
import { ProfileView } from "@/components/app/profile-view";
import { getCurrentSession } from "@/lib/auth/get-session";
import { getProfileData } from "@/lib/app-data";

type AdventurerPageProps = {
  params: Promise<{
    username: string;
  }>;
};

export default async function AdventurerPage({ params }: AdventurerPageProps) {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  const resolvedParams = await params;
  const data = await getProfileData(session.userId, resolvedParams.username);

  if (!data) {
    notFound();
  }

  return (
    <>
      <LiveRouteRefresh intervalMs={8000} />
      <ProfileView data={data} liveLabel="Auto-updates" />
    </>
  );
}
