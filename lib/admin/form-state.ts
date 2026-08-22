/**
 * The shape every editor form's server action returns, shared so the four sections cannot
 * drift into four slightly different ways of saying "saved" and "that did not work".
 *
 * Types and pure helpers only — no React, no database — so both a server action and a client
 * component can import it without dragging either into the other's bundle.
 */
import { errorsByField, type FieldError } from "@/lib/admin/validation";

export type SaveState = {
  status: "idle" | "saved" | "error";
  /** Shown to the person. Never a column name, never a Postgres code. */
  message?: string;
  /** Keyed by form field name, so an input can render its own problem beneath it. */
  fieldErrors?: Record<string, string>;
};

export const IDLE: SaveState = { status: "idle" };

/**
 * The success message says **what happens next**, not merely that the write succeeded.
 *
 * "Saved" on its own is what a staff member would reasonably read as "the website now says
 * this", and it does not — `docs/PLAN.md` is emphatic that the admin must never imply a change
 * is live when it is not. Saving writes a draft; the site changes only when someone presses
 * Publish, so the message points at the thing they still have to do.
 */
export function saved(what: string): SaveState {
  return {
    status: "saved",
    message: `${what} saved as a draft. The public site still shows the old version — press Publish on the main page to send it out.`,
  };
}

export function invalid(errors: readonly FieldError[]): SaveState {
  return {
    status: "error",
    message:
      errors.length === 1
        ? "One field needs fixing before this can be saved."
        : `${errors.length} fields need fixing before this can be saved.`,
    fieldErrors: errorsByField(errors),
  };
}

export function failed(message: string): SaveState {
  return { status: "error", message };
}
