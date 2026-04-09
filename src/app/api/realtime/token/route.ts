import { NextResponse } from "next/server";

import { getCurrentSession } from "@/lib/auth/get-session";
import { createSupabaseRealtimeToken } from "@/lib/supabase/realtime-token";

export async function GET() {
  const session = await getCurrentSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const token = await createSupabaseRealtimeToken({
    userId: session.userId,
    username: session.username,
  });

  return NextResponse.json({
    token,
    userId: session.userId,
    username: session.username,
  });
}
