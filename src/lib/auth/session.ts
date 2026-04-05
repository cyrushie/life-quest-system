import { SignJWT, jwtVerify } from "jose";
import { getAuthSecret } from "@/lib/env";

function getSecretKey() {
  return new TextEncoder().encode(getAuthSecret());
}

export type SessionPayload = {
  userId: string;
  username: string;
};

export async function createSessionToken(payload: SessionPayload) {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string) {
  const result = await jwtVerify<SessionPayload>(token, getSecretKey());
  return result.payload;
}
