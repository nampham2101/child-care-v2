/**
 * Naming the thing a discard applies to, and saying in words what discarding it will do.
 *
 * Pure — no React, no database — so the parsing below can be tested against crafted input
 * rather than against a signed-in session, which is the only way the interesting cases get
 * exercised at all. `lib/admin/drafts.ts` does the deleting; this decides what may be asked for
 * and how it is described.
 *
 * ## The target arrives from a form field, so it is untrusted
 *
 * A discard control posts the table and identity of the thing it belongs to. Both come back
 * through `FormData`, which anyone with a session can craft, so neither is believed:
 *
 *   - **The table is matched against an allowlist**, not merely cast. Without that, a crafted
 *     post could name any table with a `status` column, including ones the editor does not
 *     show.
 *   - **The identity must be flat strings.** A nested object would reach PostgREST's `match()`
 *     as something other than an equality filter.
 *
 * What this is *not* doing is enforcing tenancy. Row-level security already scopes every query
 * to `org_id = current_org_id()`, so a crafted identity naming another center's row finds
 * nothing — the same reasoning `lib/admin/drafts.ts` gives for the admin not filtering by
 * organization. The allowlist is about not offering a lever the interface never intended,
 * which is a different concern from the security boundary and is not a substitute for it.
 */
import type { DraftableTable } from "@/lib/admin/drafts";

/**
 * The tables a discard control may name.
 *
 * Every draftable table except none of them, today — but written as its own list rather than
 * reusing `DraftableTable`, because these answer different questions. `DraftableTable` is
 * "what can hold a draft"; this is "what may be discarded from the editor". A table that gains
 * a draft twin for some internal reason should not become discardable by inheriting it.
 */
export const DISCARDABLE_TABLES = [
  "site_settings",
  "programs",
  "daily_rhythm",
  "staff",
  "tuition_schedules",
  "tuition_rates",
  "tuition_fees",
  "prose",
  "media",
] as const satisfies readonly DraftableTable[];

export type DiscardableTable = (typeof DISCARDABLE_TABLES)[number];

export type DiscardTarget = {
  table: DiscardableTable;
  identity: Record<string, string>;
  /** What the person calls this thing. Shown in the prompt; never a key or a column name. */
  label: string;
};

/**
 * The target, encoded for a submit button's `value`.
 *
 * A button's name and value are submitted only for the button actually pressed, which is what
 * makes this work without a hidden input per section and without JavaScript: the browser tells
 * the server which control was used. JSON because an identity is a small map and inventing a
 * delimiter would break the first time a key contained it.
 */
export function encodeTarget(target: DiscardTarget): string {
  return JSON.stringify(target);
}

/**
 * Parse a target back, refusing anything that is not one.
 *
 * Returns `null` rather than throwing. A malformed value here is not a staff member's mistake
 * to be explained — it is a crafted or corrupted post, and the caller turns it into one flat
 * refusal rather than a message that describes the internals back to whoever sent it.
 */
export function parseTarget(value: unknown): DiscardTarget | null {
  if (typeof value !== "string" || value.length > 2000) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return null;
  }

  const { table, identity, label } = parsed as Record<string, unknown>;

  if (!isDiscardableTable(table)) return null;
  if (typeof label !== "string" || label.trim() === "") return null;
  if (
    typeof identity !== "object" ||
    identity === null ||
    Array.isArray(identity)
  ) {
    return null;
  }

  // Flat strings only. `{ key: { gt: "" } }` would otherwise reach PostgREST's `match()` as
  // something that is not an equality test.
  const entries = Object.entries(identity as Record<string, unknown>);
  if (entries.some(([, v]) => typeof v !== "string")) return null;

  return {
    table,
    identity: Object.fromEntries(entries) as Record<string, string>,
    label: label.trim(),
  };
}

function isDiscardableTable(value: unknown): value is DiscardableTable {
  return (
    typeof value === "string" &&
    (DISCARDABLE_TABLES as readonly string[]).includes(value)
  );
}

/**
 * What the confirmation asks, worded for which of ADR 0001's two cases this is.
 *
 * The distinction is the whole point of asking. `reverted` destroys an edit and the published
 * value comes back; `removed` destroys the content, because there is no published value to come
 * back to. Offering one sentence for both would make the second one a surprise, and it is the
 * irreversible one.
 *
 * The outcome is read from the database before this is called rather than guessed from what the
 * page happens to know, so the sentence cannot disagree with what the button will do.
 */
export function discardPrompt(
  outcome: "reverted" | "removed",
  label: string,
): string {
  return outcome === "reverted"
    ? `Discard your unpublished change to ${label}? The published version stays exactly as it is, and the editor goes back to showing it. This cannot be undone.`
    : `Remove ${label}? It has never been published, so there is no earlier version to go back to — this deletes it outright and cannot be undone.`;
}

/** What the result message says once it has happened. Same distinction, past tense. */
export function discardResult(
  outcome: "reverted" | "removed",
  label: string,
): string {
  return outcome === "reverted"
    ? `Your unpublished change to ${label} was discarded. The editor now shows the published version again, which is what the public site has been showing all along.`
    : `${label} was removed. It had never been published, so the public site is unchanged.`;
}
