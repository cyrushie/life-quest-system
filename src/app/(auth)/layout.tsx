import { ReactNode } from "react";
import { redirect } from "next/navigation";

import { getCurrentSession } from "@/lib/auth/get-session";
import { db } from "@/lib/db";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const session = await getCurrentSession();

  if (session) {
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { onboardingComplete: true },
    });

    redirect(user?.onboardingComplete ? "/dashboard" : "/onboarding");
  }

  return children;
}
