import Link from "next/link";

import { AuthForm } from "@/app/(auth)/auth-form";
import { registerAction } from "@/app/(auth)/actions";

export default function RegisterPage() {
  return (
    <main className="auth-shell">
      <section className="auth-card">
        <p className="auth-eyebrow">Begin Quest</p>
        <h1 className="auth-title">Create your character and start the system.</h1>
        <p className="auth-copy">
          Your first session will guide you through tasks, punishments, and the
          rules that make the system work.
        </p>

        <AuthForm action={registerAction} submitLabel="Forge Character">
          <label className="auth-field">
            <span>Username</span>
            <input name="username" placeholder="Choose a username" type="text" />
          </label>

          <label className="auth-field">
            <span>Password</span>
            <input name="password" placeholder="Create a password" type="password" />
          </label>

          <label className="auth-field">
            <span>Confirm Password</span>
            <input
              name="confirmPassword"
              placeholder="Confirm your password"
              type="password"
            />
          </label>
        </AuthForm>

        <p className="mt-6 text-sm text-stone-300">
          Already have an account?{" "}
          <Link className="text-amber-200 underline-offset-4 hover:underline" href="/login">
            Log in
          </Link>
        </p>
      </section>
    </main>
  );
}
