import { cache } from "react";

import { getSessionCookie } from "./cookies";
import { verifySessionToken } from "./session";

export const getCurrentSession = cache(async () => {
  const token = await getSessionCookie();

  if (!token) {
    return null;
  }

  try {
    return await verifySessionToken(token);
  } catch {
    return null;
  }
});
