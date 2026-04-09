import { redirect } from "next/navigation";

import { NotificationsPageClient } from "@/components/app/notifications-page-client";
import { getCurrentSession } from "@/lib/auth/get-session";

export default async function NotificationsPage() {
  const session = await getCurrentSession();

  if (!session) {
    redirect("/login");
  }

  return <NotificationsPageClient refreshKey={crypto.randomUUID()} userId={session.userId} />;
}
