/**
 * The migration filenames are well-formed and their versions are unique.
 *
 * ## What this catches, and what it cannot
 *
 * #127: `20260831040000_move_hardcoded_strings_to_prose.sql` was recorded in the database as
 * version `20260831033713`. It was applied through the management connector, which **stamps its
 * own timestamp rather than the one in the filename**, and the file was not renamed afterwards.
 * `supabase/migrations/README.md` had already written down that this happens and what to do
 * about it; the step was skipped anyway.
 *
 * **This file does not catch that, and nothing in CI can.** The check would have to read
 * `supabase_migrations.schema_migrations` on the hosted project, and no credential available to
 * CI can:
 *
 *   - The **anonymous key** cannot. `supabase_migrations` is not an exposed schema, so PostgREST
 *     answers 406 — verified rather than assumed.
 *   - A **Supabase personal access token** could, and is deliberately not in CI. A PAT can create
 *     and delete projects; putting one in a public repository's CI to catch a filename typo trades
 *     a large blast radius for a small check. `docs/RUNBOOK.md` applies the same reasoning to the
 *     other credentials this project holds.
 *
 * So the drift itself is caught by running the comparison deliberately after applying through the
 * connector — the runbook step — not here. Saying so plainly matters more than the assertions
 * below: a guard that looks like it covers #127 and does not is worse than no guard, because the
 * next person trusts it.
 *
 * ## What it does cover, which is a worse failure
 *
 * **Two migrations sharing a version prefix.** `schema_migrations` is keyed by version, so a
 * duplicate means one of the two is recorded as already applied and silently never runs — against
 * the hosted project, where there is no second chance to notice. That is a genuinely dangerous
 * state and it is free to rule out from the filenames alone.
 *
 * A malformed name is milder but the same family: the CLI derives the version by splitting on the
 * first underscore, so a name it cannot parse is one whose ordering nobody can predict.
 */
import { readdirSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

const MIGRATIONS_DIR = path.resolve(
  import.meta.dirname,
  "../supabase/migrations",
);

/** `<14-digit timestamp>_<snake_case name>.sql`, which is what `supabase migration new` writes. */
const FILENAME = /^(\d{14})_([a-z0-9]+(?:_[a-z0-9]+)*)\.sql$/;

const filenames = readdirSync(MIGRATIONS_DIR)
  .filter((name) => name.endsWith(".sql"))
  .sort();

describe("migration filenames", () => {
  test("there are migrations to check", () => {
    // Otherwise every assertion below iterates an empty list and passes, which is the one way
    // this file could go green while proving nothing.
    expect(filenames.length).toBeGreaterThan(0);
  });

  test("each is a timestamp and a snake_case name", () => {
    expect(filenames.filter((name) => !FILENAME.test(name))).toEqual([]);
  });

  test("no two share a version", () => {
    /*
     * The one that would be dangerous rather than untidy. `schema_migrations` is keyed by
     * version alone, so two files stamped the same means the second is considered applied the
     * moment the first runs — and it never executes. Against the hosted project that is a schema
     * change that silently did not happen.
     */
    const versions = filenames
      .map((name) => name.match(FILENAME)?.[1])
      .filter(Boolean);

    const duplicated = versions.filter(
      (version, index) => versions.indexOf(version) !== index,
    );

    expect([...new Set(duplicated)]).toEqual([]);
  });

  test("each timestamp is a real date", () => {
    // `20260831336000` matches the digit count and is not a time. It would sort into a plausible
    // position and be impossible to reconcile with anything the database recorded.
    const unparseable = filenames.filter((name) => {
      const version = name.match(FILENAME)?.[1];
      if (!version) return false;

      const [year, month, day, hour, minute, second] = [
        version.slice(0, 4),
        version.slice(4, 6),
        version.slice(6, 8),
        version.slice(8, 10),
        version.slice(10, 12),
        version.slice(12, 14),
      ].map(Number);

      const date = new Date(
        Date.UTC(year, month - 1, day, hour, minute, second),
      );

      return (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day ||
        date.getUTCHours() !== hour ||
        date.getUTCMinutes() !== minute ||
        date.getUTCSeconds() !== second
      );
    });

    expect(unparseable).toEqual([]);
  });
});
