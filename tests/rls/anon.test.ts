/**
 * What an anonymous client can and cannot do, asserted against the real database.
 *
 * `docs/PLAN.md` makes this a CI gate from `v0.3.0` onward, and it runs against the hosted
 * project on purpose. Row-level security is a database behaviour — a mocked client would
 * only ever prove that the mock agrees with the assertions below, which is worth nothing.
 * The rows it needs are in `supabase/fixtures/rls.sql`.
 *
 * The client here is built from the same two public variables the site uses and carries the
 * **anonymous** key. The service-role key would bypass every policy under test and must
 * never appear in this file, in CI, or in `.env.local`.
 *
 * ## What is being claimed, precisely
 *
 * Drafts are invisible, and `anon` cannot write. That is the whole guarantee.
 *
 * It deliberately does **not** claim that another organization's rows are invisible. The
 * anonymous policy is `status = 'published'` and nothing else: the key ships inside the
 * client bundle, so any organization scope it carried would be caller-supplied and therefore
 * forgeable. `docs/PLAN.md` records that decision in full under "What `anon` is, and is not,
 * isolated from", and narrows this suite's original third assertion to drafts. A published
 * row is marketing copy already world-readable at its own URL; the private thing is the
 * draft.
 *
 * That reasoning holds only while every table is public marketing copy. The first table
 * holding enrolment records or anything about an actual child voids it.
 */
import { createClient } from "@supabase/supabase-js";
import { beforeAll, describe, expect, test } from "vitest";

import type { Database } from "@/lib/database.types";

const PROJECT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!PROJECT_URL || !ANON_KEY) {
  throw new Error(
    "The row-level security suite needs NEXT_PUBLIC_SUPABASE_URL and " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY. Copy .env.example to .env.local, or set them in CI. " +
      "Skipping the suite when they are absent would turn a missing gate into a green run.",
  );
}

/** Not `@/lib/supabase`: this suite asserts against a raw anonymous client, so it builds its
 *  own rather than inheriting anything the app client might configure later. */
const anon = createClient<Database>(PROJECT_URL, ANON_KEY);

/** Every table an anonymous visitor could try to write to. */
const CONTENT_TABLES = [
  "orgs",
  "site_settings",
  "programs",
  "daily_rhythm",
  "staff",
  "tuition_schedules",
  "tuition_rates",
  "tuition_fees",
] as const;

/** Postgres `insufficient_privilege`. The migration revokes the default grants as well as
 *  refusing writes by policy, so a write is rejected before any policy is consulted — which
 *  is the stronger of the two failures and the one asserted here. */
const INSUFFICIENT_PRIVILEGE = "42501";

beforeAll(async () => {
  const { data, error } = await anon.from("orgs").select("slug");
  if (error) throw new Error(`Cannot reach the project: ${error.message}`);

  const slugs = (data ?? []).map((row) => row.slug);
  if (!slugs.includes("rls-fixture")) {
    throw new Error(
      "The fixture organization is missing. Apply supabase/fixtures/rls.sql — see the " +
        "header of that file. Without it this suite would pass by finding nothing.",
    );
  }
});

describe("drafts are invisible to an anonymous client", () => {
  test("a draft row is not returned, by key or in a full scan", async () => {
    const byKey = await anon
      .from("programs")
      .select("key")
      .eq("key", "rlsFixtureDraft");

    expect(byKey.error).toBeNull();
    expect(byKey.data).toEqual([]);

    // Asked for directly above, and swept for here. A policy that leaked only on an
    // unfiltered scan would pass the first check and fail this one.
    const all = await anon.from("programs").select("key, status");
    expect(all.error).toBeNull();
    expect(all.data!.map((row) => row.key)).not.toContain("rlsFixtureDraft");
    expect(all.data!.every((row) => row.status === "published")).toBe(true);
  });

  test("the published twin of that row is returned, so the check above means something", async () => {
    // The two fixture rows differ in exactly one column. If this query came back empty, the
    // assertion above would be passing because the query is broken rather than because
    // row-level security works — which is the failure mode worth ruling out.
    const { data, error } = await anon
      .from("programs")
      .select("key, status")
      .eq("key", "rlsFixturePublished");

    expect(error).toBeNull();
    expect(data).toEqual([{ key: "rlsFixturePublished", status: "published" }]);
  });

  test("every table exposes only published rows", async () => {
    // orgs is excluded: it has no status column. It is the tenant list rather than content,
    // and its policy is `true` by design — the build has to resolve a slug to an id before
    // it can fetch anything, and the columns are a slug and a name already in the header.
    for (const table of CONTENT_TABLES.filter((name) => name !== "orgs")) {
      const { data, error } = await anon.from(table).select("status");
      expect(error, `${table} should be readable`).toBeNull();
      expect(
        data!.every((row) => row.status === "published"),
        `${table} returned a row that is not published`,
      ).toBe(true);
    }
  });
});

describe("profiles are invisible to an anonymous client", () => {
  // Added by #72. Deliberately its own block rather than an entry in CONTENT_TABLES above:
  // every assertion in that list assumes a `status` column and a row a visitor may read, and
  // profiles has neither. It is not content. It is the list of who works at the center and
  // which auth account is theirs, and the anonymous key ships in the client bundle.
  //
  // The refusal is a privilege error rather than an empty result, because the migration
  // grants anon nothing at all on this table — there is no anonymous policy to evaluate.

  test("select is refused", async () => {
    const { error } = await anon.from("profiles").select("display_name");

    expect(error?.code).toBe(INSUFFICIENT_PRIVILEGE);
  });

  test("insert is refused", async () => {
    const { error } = await anon.from("profiles").insert({} as never);

    expect(error?.code).toBe(INSUFFICIENT_PRIVILEGE);
  });
});

describe("an anonymous client cannot write", () => {
  test.each(CONTENT_TABLES)("insert is refused on %s", async (table) => {
    // A deliberately empty payload: the write is refused on privilege before the row is ever
    // validated, so nothing here needs to be a well-formed row. Asserting the code rather
    // than merely `error !== null` is what distinguishes "refused" from "rejected because
    // the payload was malformed", which would pass while proving nothing.
    const { error } = await anon.from(table).insert({} as never);

    expect(error?.code, `${table} accepted an insert`).toBe(
      INSUFFICIENT_PRIVILEGE,
    );
  });

  test.each(CONTENT_TABLES)("update is refused on %s", async (table) => {
    // `id`, because it is the one column every table here has. An earlier version set
    // `status` and passed on seven tables while failing on `orgs`, which has no status
    // column: PostgREST rejected it as an unknown column (PGRST204) before Postgres ever
    // checked privileges. That is a refusal for the wrong reason, and on a table that did
    // grant writes it would have read as a pass.
    const { error } = await anon
      .from(table)
      .update({ id: "00000000-0000-0000-0000-000000000000" } as never)
      .neq("id", "00000000-0000-0000-0000-000000000000");

    expect(error?.code, `${table} accepted an update`).toBe(
      INSUFFICIENT_PRIVILEGE,
    );
  });

  test.each(CONTENT_TABLES)("delete is refused on %s", async (table) => {
    const { error } = await anon
      .from(table)
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");

    expect(error?.code, `${table} accepted a delete`).toBe(
      INSUFFICIENT_PRIVILEGE,
    );
  });

  test("the seeded content survived every attempt above", async () => {
    // The refusals are asserted one table at a time; this checks the database as a whole is
    // untouched. A write that succeeded against expectation would fail its own assertion
    // above — but a *partial* success that also cascaded would not necessarily, and the seed
    // is the thing the site renders.
    const { data, error } = await anon
      .from("programs")
      .select("key, ratio")
      .in("key", ["infants", "toddlers", "preschool"])
      .order("sort_order");

    expect(error).toBeNull();
    expect(data).toEqual([
      { key: "infants", ratio: "1:4" },
      { key: "toddlers", ratio: "1:5" },
      { key: "preschool", ratio: "1:9" },
    ]);
  });
});
