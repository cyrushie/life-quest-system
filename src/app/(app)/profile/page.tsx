import { redirect } from "next/navigation";

import { LiveRouteRefresh } from "@/components/app/live-route-refresh";
import { ProfileView } from "@/components/app/profile-view";
import { getCurrentSession } from "@/lib/auth/get-session";
import { getProfileData } from "@/lib/app-data";

export default async function ProfilePage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  const data = await getProfileData(session.userId, session.username);

  if (!data) {
    redirect("/dashboard");
  }

  return (
    <>
      <LiveRouteRefresh intervalMs={8000} />
      <ProfileView data={data} liveLabel="Auto-updates" />
    </>
  );
}
