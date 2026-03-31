"use client";

import { useActionState } from "react";

type AuthFormProps = {
  action: (
    state: { error?: string },
    formData: FormData,
  ) => Promise<{ error?: string }>;
  submitLabel: string;
  children: React.ReactNode;
};

const initialState: { error?: string } = {};

export function AuthForm({ action, submitLabel, children }: AuthFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="mt-8 space-y-4">
      {children}

      {state.error ? (
        <p className="rounded-2xl border border-rose-300/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
          {state.error}
        </p>
      ) : null}

      <button className="quest-button w-full disabled:cursor-not-allowed disabled:opacity-70" disabled={isPending} type="submit">
        {isPending ? "Working..." : submitLabel}
      </button>
    </form>
  );
}
