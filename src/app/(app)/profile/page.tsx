import { redirect } from "next/navigation";

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
    <ProfileView data={data} liveLabel="Live while open" viewerUserId={session.userId} />
  );
}
