import { NextResponse } from "next/server";

import { getNotificationsData } from "@/lib/app-data";
import { requireApiSession } from "@/lib/auth/api-session";

export async function GET() {
  const { session, errorResponse } = await requireApiSession();

  if (!session) {
    return errorResponse;
  }

  return NextResponse.json(await getNotificationsData(session.userId));
}
