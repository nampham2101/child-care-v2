"use client";

import { createContext, useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

import { IDLE, type SaveState } from "@/lib/admin/form-state";

/**
 * The wrapper every editor section uses: one form, one save button, one place a result is
 * reported.
 *
 * The fields inside are ordinary server-rendered markup passed as `children`. Only the parts
 * that genuinely need interactivity are client components — this wrapper, for the pending
 * state and the result banner, and `Field`, so an input can show its own error. That is the
 * "push `use client` as far down the tree as possible" rule in `docs/CONVENTIONS.md`, and it
 * is also what keeps the form working before JavaScript has loaded: the action is a server
 * action, so submitting is a plain POST until React takes over.
 */
export const FieldErrorContext = createContext<Record<string, string>>({});

export function EditorForm({
  action,
  children,
  submitLabel = "Save draft",
}: {
  action: (state: SaveState, formData: FormData) => Promise<SaveState>;
  children: ReactNode;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState(action, IDLE);

  return (
    <form action={formAction} className="flex flex-col gap-8">
      <FieldErrorContext.Provider value={state.fieldErrors ?? {}}>
        {children}
      </FieldErrorContext.Provider>

      <div className="flex flex-wrap items-center gap-4 border-t border-border pt-6">
        <SaveButton label={submitLabel} />
        {state.status !== "idle" && state.message ? (
          <p
            // `role="status"` rather than `alert` for the success case: a save is not an
            // interruption, and a screen reader should hear it without being cut off.
            role={state.status === "error" ? "alert" : "status"}
            className={
              state.status === "error"
                ? "text-sm font-medium text-terracotta-700"
                : "text-sm text-ink-700"
            }
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}

/** Split out because `useFormStatus` reports the status of the form *above* it in the tree. */
function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-full bg-sage-700 px-5 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-sage-900 focus-visible:ring-2 focus-visible:ring-sage-900 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-100 focus-visible:outline-none disabled:opacity-70"
    >
      {pending ? "Saving…" : label}
    </button>
  );
}
