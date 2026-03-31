import Link from "next/link";

import { loginAction } from "@/app/(auth)/actions";
import { AuthForm } from "@/app/(auth)/auth-form";

export default function LoginPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="auth-eyebrow">Return To Quest</p>
        <h1 className="auth-title">Log in to continue your adventure.</h1>
        <p className="auth-copy">
          Username and password only. No extra friction, just a fast way back
          to your dashboard.
        </p>

        <AuthForm action={loginAction} submitLabel="Enter The Realm">
          <label className="auth-field">
            <span>Username</span>
            <input name="username" placeholder="craftsman_cyrus" type="text" />
          </label>

          <label className="auth-field">
            <span>Password</span>
            <input name="password" placeholder="Enter your password" type="password" />
          </label>
        </AuthForm>

        <p className="mt-6 text-sm text-stone-300">
          New here?{" "}
          <Link className="text-amber-200 underline-offset-4 hover:underline" href="/register">
            Create your character
          </Link>
        </p>
      </section>
    </main>
  );
}
