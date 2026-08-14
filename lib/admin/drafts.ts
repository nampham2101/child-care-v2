/**
 * Reading and writing drafts — the half of the editor that every section shares.
 *
 * `docs/adr/0001-draft-and-published-twin-rows.md` is the schema this sits on: a thing may have
 * one published row and one draft row at once, distinguished by `status` and identified by the
 * same key. Two consequences shape everything here.
 *
 * **Reading means choosing.** "The current value" is the draft if one exists, otherwise the
 * published row. Every section asks the same question, so it is answered once, here.
 *
 * **Writing is never an overwrite of the published row.** Saving either updates the existing
 * draft or creates one by copying the published row and applying the edit. The published row is
 * not touched by anything in this file — that is what keeps the public site byte-identical
 * until #75 publishes.
 *
 * ## Why the admin does not filter by organization
 *
 * The public queries in `lib/center.ts` and friends filter on `CENTER_ORG_SLUG`, because the
 * anonymous policy is `status = 'published'` with no organization scope — an unfiltered read
 * returns every tenant's published rows. **The admin is the opposite case.** The authenticated
 * policy is `org_id = current_org_id()`, so row-level security has already scoped every query
 * to the signed-in member's organization before it returns. Filtering again by a hardcoded slug
 * would add nothing and would wire the editor to a single tenant, which is the thing the
 * `org_id` column exists to avoid.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

/** The tables that carry a `status` column and therefore support a draft twin. */
export type DraftableTable =
  | "site_settings"
  | "programs"
  | "daily_rhythm"
  | "staff"
  | "tuition_schedules"
  | "tuition_rates"
  | "tuition_fees";

/** A row as it comes back from any of those tables: an id, a status, and its own columns. */
export type DraftableRow = {
  id: string;
  status: Database["public"]["Enums"]["content_status"];
} & Record<string, unknown>;

/** Raised when a save cannot proceed. Carries a message written for a staff member. */
export class DraftError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DraftError";
  }
}

/**
 * The value a staff member should see and edit: the draft if there is one, otherwise the
 * published row.
 *
 * Pure, and exported so it can be tested against fixtures rather than against a database.
 */
export function pickEffective<T extends { status: string }>(
  rows: readonly T[],
): T | undefined {
  return (
    rows.find((row) => row.status === "draft") ??
    rows.find((row) => row.status === "published")
  );
}

/** Whether a thing has an unpublished edit sitting against it. */
export function hasDraft(rows: readonly { status: string }[]): boolean {
  return rows.some((row) => row.status === "draft");
}

/**
 * Columns the database owns. Copying them onto a new draft row would either fail or lie —
 * `id` must be freshly generated, and the timestamps are set by the default and the trigger.
 */
const DATABASE_OWNED = ["id", "created_at", "updated_at"] as const;

/**
 * `supabase.from()` called with a union of table names produces a union of query builders that
 * TypeScript cannot resolve to a single callable signature. The alternative is writing this
 * same find-then-update-or-insert logic seven times, once per table — which is precisely the
 * duplication `docs/CONVENTIONS.md` says to avoid, and the version that would drift.
 *
 * So the client is narrowed to the shape this function actually uses, once, here. It is not
 * `any`: every method is named and typed, so a misuse inside this file is still a type error.
 * Callers keep the fully typed client.
 */
type LooseClient = {
  from(table: DraftableTable): {
    select(columns: string): {
      match(criteria: Record<string, string>): PromiseLike<{
        data: DraftableRow[] | null;
        error: { message: string; code?: string } | null;
      }>;
    };
    update(values: Record<string, unknown>): {
      eq(
        column: "id",
        value: string,
      ): PromiseLike<{ error: { message: string; code?: string } | null }>;
    };
    insert(values: Record<string, unknown>): PromiseLike<{
      error: { message: string; code?: string } | null;
    }>;
  };
};

/**
 * Both twins for one identity, newest question first: what does this thing look like now, and
 * is there already an edit pending against it?
 *
 * `identity` is the columns that name the thing — `{ key: "infants" }` for a program, `{}` for
 * a table with one row per organization. Row-level security supplies the organization.
 */
export async function readTwins(
  supabase: SupabaseClient<Database>,
  table: DraftableTable,
  identity: Record<string, string> = {},
): Promise<DraftableRow[]> {
  const { data, error } = await (supabase as unknown as LooseClient)
    .from(table)
    .select("*")
    .match(identity);

  if (error) {
    throw new DraftError(
      `Could not read ${table}: ${error.message}. If this says permission denied, the session ` +
        "has no profile row and resolves to no organization — see issue #87.",
    );
  }

  return data ?? [];
}

/**
 * Save an edit as a draft, leaving the published row untouched.
 *
 * Two cases, and neither writes to the published row:
 *
 *   - **A draft already exists** — update it in place. Editing the same field twice does not
 *     accumulate drafts, which is what the partial unique index would refuse anyway.
 *   - **No draft yet** — copy the published row, apply the changes, and insert it as a draft.
 *     A copy rather than a sparse row, because every column is `not null`: a draft holding only
 *     the edited field could not be inserted, and could not be published without re-reading the
 *     original.
 *
 * **There is deliberately no third case for "nothing exists yet".** Creating content from
 * nothing is not in #74 — see the note on that ticket about new entities needing a message key
 * that staff cannot yet write. Reaching this path means the identity is wrong, so it raises
 * rather than quietly inventing a row.
 *
 * ## The race this does not defend against
 *
 * Read-then-write is not atomic. Two saves against the same thing at the same moment can both
 * see no draft and both try to insert one; the partial unique index refuses the loser with
 * `23505`, so the outcome is an error rather than a duplicate. With one editor at one center
 * that is theoretical. The ADR records the same hazard for publishing and names the tripwire:
 * the second staff account at a single center.
 */
export async function saveDraft(
  supabase: SupabaseClient<Database>,
  table: DraftableTable,
  identity: Record<string, string>,
  changes: Record<string, string | number | boolean>,
): Promise<void> {
  const loose = supabase as unknown as LooseClient;
  const twins = await readTwins(supabase, table, identity);

  const draft = twins.find((row) => row.status === "draft");
  if (draft) {
    const { error } = await loose
      .from(table)
      .update(changes)
      .eq("id", draft.id);

    if (error) throw toDraftError(error, table);
    return;
  }

  const published = twins.find((row) => row.status === "published");
  if (!published) {
    throw new DraftError(
      `Nothing to edit in ${table} for ${JSON.stringify(identity)}. This editor changes ` +
        "existing content; it does not create it.",
    );
  }

  const copy: Record<string, unknown> = { ...published, ...changes };
  for (const column of DATABASE_OWNED) delete copy[column];
  copy.status = "draft";

  const { error } = await loose.from(table).insert(copy);
  if (error) throw toDraftError(error, table);
}

function toDraftError(
  error: { message: string; code?: string },
  table: DraftableTable,
): DraftError {
  /*
   * A check constraint reaching here means the form let through something the database refused,
   * which is a gap in validation rather than a thing to explain to a staff member. It is
   * surfaced plainly rather than dressed up, so the report names the real cause.
   */
  if (error.code === "23514") {
    return new DraftError(
      `The database refused that value on ${table}. This is a validation gap — the form should ` +
        `have caught it. Details: ${error.message}`,
    );
  }

  if (error.code === "23505") {
    return new DraftError(
      "Someone else saved a change to this at the same moment. Reload the page and try again.",
    );
  }

  return new DraftError(`Could not save that change: ${error.message}`);
}
