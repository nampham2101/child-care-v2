/**
 * What every content query in `lib/` shares: which organization to read, and what to do when
 * the answer is empty.
 *
 * Five modules now fetch published rows and all five fail the same way, so the failure lives
 * here rather than being written out five times with five slightly different messages. The
 * first copy to be edited is the one that starts telling a different story from the others.
 */

/**
 * Which organization this site renders. **Every content query must filter on it**, which is
 * done with a filtered inner join on `orgs` — `.eq("orgs.slug", CENTER_ORG_SLUG)`.
 *
 * This is not defensive tidiness. The anonymous policy is `status = 'published'` and carries
 * no organization scope — `docs/PLAN.md` explains why it cannot — so an unfiltered read
 * returns every tenant's published rows. `supabase/fixtures/rls.sql` keeps a deliberately
 * absurd published row in a second organization precisely so that forgetting this shows up as
 * nonsense on the page rather than as nothing at all.
 */
export const CENTER_ORG_SLUG = "willow-grove";

/** Thrown when the build cannot get the content it is supposed to render. */
export class ContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ContentError";
  }
}

/**
 * The standing instruction for an unseeded or unreachable database: **stop the build.**
 *
 * There is deliberately no fallback to the values these modules used to hold. A site that
 * quietly serves stale placeholder facts whenever a row is missing is worse than a build that
 * fails, because the ratios and rates are exactly what a parent acts on and nobody would ever
 * find out they had gone stale. A red build costs minutes; the alternative costs trust.
 */
function fail(what: string, detail: string): never {
  throw new ContentError(
    `${what}: ${detail}. Apply supabase/seed.sql — see supabase/README.md. ` +
      "Note that a draft row is invisible to the anonymous key and looks identical to a " +
      "missing one from here.",
  );
}

/** A list that must not be empty — three bands, seven staff, and so on. */
export function requireRows<T>(
  rows: T[] | null,
  error: { message: string } | null,
  what: string,
): T[] {
  if (error) fail(what, `the query failed — ${error.message}`);
  if (!rows || rows.length === 0) fail(what, "no published rows were returned");
  return rows;
}

/** A single row that must exist — the settings and fees tables hold exactly one per org. */
export function requireRow<T>(
  row: T | null,
  error: { message: string } | null,
  what: string,
): T {
  if (error) fail(what, `the query failed — ${error.message}`);
  // PostgREST returns null data with a null error when nothing matches, so this branch —
  // not the one above — is what actually catches an unseeded database.
  if (!row) fail(what, "no published row was returned");
  return row;
}
