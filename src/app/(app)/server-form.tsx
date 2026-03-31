"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { broadcastAppSync } from "@/lib/client/app-sync";

type FormState = {
  error?: string;
  success?: string;
};

type ServerFormProps = {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
  children: React.ReactNode;
  resetOnSuccess?: boolean;
  successHref?: string;
};

const initialState: FormState = {};

export function ServerForm({
  action,
  submitLabel,
  children,
  resetOnSuccess = false,
  successHref,
}: ServerFormProps) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!state.success) {
      return;
    }

    if (resetOnSuccess) {
      formRef.current?.reset();
    }

    broadcastAppSync("server-form-success");

    if (successHref) {
      router.replace(successHref);
      router.refresh();
    }
  }, [resetOnSuccess, router, state, successHref]);

  return (
    <form action={formAction} className="space-y-4" ref={formRef}>
      {children}

      {state.error ? (
        <p className="rounded-2xl border border-rose-300/18 bg-rose-400/[0.06] px-3 py-2 text-sm text-rose-100">
          {state.error}
        </p>
      ) : null}

      {state.success ? (
        <p className="rounded-2xl border border-emerald-300/18 bg-emerald-400/[0.06] px-3 py-2 text-sm text-emerald-100">
          {state.success}
        </p>
      ) : null}

      <button
        className="quest-button w-full disabled:cursor-not-allowed disabled:opacity-70"
        disabled={isPending}
        type="submit"
      >
        {isPending ? "Working..." : submitLabel}
      </button>
    </form>
  );
}
