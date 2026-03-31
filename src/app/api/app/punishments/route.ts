import { NextResponse } from "next/server";

import { getPunishmentsData } from "@/lib/app-data";
import { requireApiSession } from "@/lib/auth/api-session";

export async function GET() {
  const { session, errorResponse } = await requireApiSession();

  if (!session) {
    return errorResponse;
  }

  return NextResponse.json(await getPunishmentsData(session.userId));
}
