"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

import { clearSessionCookie, setSessionCookie } from "@/lib/auth/cookies";
import { createSessionToken } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { loginSchema, registerSchema } from "@/lib/validations/auth";

type AuthState = {
  error?: string;
};

export async function registerAction(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = registerSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid registration details.",
    };
  }

  const username = parsed.data.username.trim();
  const existingUser = await db.user.findUnique({
    where: { username },
    select: { id: true },
  });

  if (existingUser) {
    return { error: "That username is already taken." };
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const user = await db.user.create({
    data: {
      username,
      passwordHash,
      stats: {
        create: {},
      },
    },
    select: {
      id: true,
      username: true,
    },
  });

  const token = await createSessionToken({
    userId: user.id,
    username: user.username,
  });

  await setSessionCookie(token);
  redirect("/onboarding");
}

export async function loginAction(
  _prevState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  const parsed = loginSchema.safeParse({
    username: formData.get("username"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Invalid login details.",
    };
  }

  const username = parsed.data.username.trim();
  const user = await db.user.findUnique({
    where: { username },
    select: {
      id: true,
      username: true,
      passwordHash: true,
      onboardingComplete: true,
    },
  });

  if (!user) {
    return { error: "Invalid username or password." };
  }

  const matches = await bcrypt.compare(parsed.data.password, user.passwordHash);

  if (!matches) {
    return { error: "Invalid username or password." };
  }

  const token = await createSessionToken({
    userId: user.id,
    username: user.username,
  });

  await setSessionCookie(token);
  redirect(user.onboardingComplete ? "/dashboard" : "/onboarding");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/login");
}
