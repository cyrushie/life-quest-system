import { SignJWT } from "jose";

import { getSupabaseJwtSecret } from "@/lib/env";

type RealtimeIdentity = {
  userId: string;
  username: string;
};

function getRealtimeSecretKey() {
  return new TextEncoder().encode(getSupabaseJwtSecret());
}

export async function createSupabaseRealtimeToken(identity: RealtimeIdentity) {
  return await new SignJWT({
    role: "authenticated",
    username: identity.username,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(identity.userId)
    .setAudience("authenticated")
    .setIssuer("life-quest-system")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(getRealtimeSecretKey());
}
