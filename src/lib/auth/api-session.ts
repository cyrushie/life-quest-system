import { NextResponse } from "next/server";

import { getCurrentSession } from "./get-session";

export async function requireApiSession() {
  const session = await getCurrentSession();

  if (!session) {
    return {
      session: null,
      errorResponse: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  return { session, errorResponse: null };
}
