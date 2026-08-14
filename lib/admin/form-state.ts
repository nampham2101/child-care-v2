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
 * is live when it is not. Publishing arrives in #75; until then the honest sentence is that
 * the edit is stored and the site is unchanged.
 */
export function saved(what: string): SaveState {
  return {
    status: "saved",
    message: `${what} saved as a draft. The public site still shows the old version — publishing arrives in a later release.`,
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
