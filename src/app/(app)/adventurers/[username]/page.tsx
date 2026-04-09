import { notFound, redirect } from "next/navigation";

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
    <ProfileView data={data} liveLabel="Live while open" viewerUserId={session.userId} />
  );
}
