"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { signIn, type SignInState } from "@/app/admin/sign-in/actions";

const INITIAL: SignInState = { error: null };

/**
 * The one interactive element in this milestone, and the only reason a `"use client"`
 * boundary exists in the admin at all.
 *
 * The form posts to a server action, so it submits and signs in with JavaScript disabled.
 * The client boundary buys two things on top of that, both of which matter on a slow phone:
 * the error message renders without a full navigation, and the submit button reports that it
 * is working so nobody presses it three times.
 */
export function SignInForm({ next }: { next: string }) {
  const [state, formAction] = useActionState(signIn, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />

      <div className="flex flex-col gap-1.5">
        <label htmlFor="email" className="text-sm font-medium text-ink-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          className="rounded-lg border border-border bg-cream-50 px-3.5 py-2.5 text-base text-ink-900 focus-visible:border-sage-500 focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:outline-none"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="password" className="text-sm font-medium text-ink-700">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-lg border border-border bg-cream-50 px-3.5 py-2.5 text-base text-ink-900 focus-visible:border-sage-500 focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:outline-none"
        />
      </div>

      {/* `role="alert"` so a screen reader announces the failure rather than leaving the
          person wondering why nothing happened. */}
      {state.error ? (
        <p
          role="alert"
          className="rounded-lg border border-terracotta-100 bg-terracotta-100/60 px-3.5 py-2.5 text-sm text-terracotta-700"
        >
          {state.error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}

/**
 * Split out because `useFormStatus` reports the status of the form *above* it in the tree —
 * called inside `SignInForm` it would always read `false`.
 */
function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-full bg-sage-700 px-5 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-sage-900 focus-visible:ring-2 focus-visible:ring-sage-900 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 focus-visible:outline-none disabled:opacity-70"
    >
      {pending ? "Signing in…" : "Sign in"}
    </button>
  );
}
