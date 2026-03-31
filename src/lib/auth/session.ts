import { SignJWT, jwtVerify } from "jose";

const secret = process.env.AUTH_SECRET ?? "development-secret-change-me";

function getSecretKey() {
  return new TextEncoder().encode(secret);
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
