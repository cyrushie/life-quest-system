import { NextResponse } from "next/server";

import { getTodayData } from "@/lib/app-data";
import { requireApiSession } from "@/lib/auth/api-session";
import { getTodayDateKey, isValidDateKey } from "@/lib/date";

export async function GET(request: Request) {
  const { session, errorResponse } = await requireApiSession();

  if (!session) {
    return errorResponse;
  }

  const { searchParams } = new URL(request.url);
  const dateKeyParam = searchParams.get("date");
  const dateKey =
    dateKeyParam && isValidDateKey(dateKeyParam) ? dateKeyParam : getTodayDateKey();

  return NextResponse.json(await getTodayData(session.userId, dateKey));
}
