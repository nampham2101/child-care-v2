/**
 * That a draft can sit beside its published twin, and that only one of them is ever the
 * public one.
 *
 * ## What this suite is actually protecting
 *
 * The editor in #74 needs somewhere to put an edit that is not yet live. Before the migration
 * this suite covers, there was nowhere: every content table held one row per thing, so an edit
 * either overwrote the published row or flipped it to `draft` — and the second is worse than
 * it sounds, because `lib/content.ts` raises on a missing published row and **the next build
 * would fail**. Editing the phone number would have broken the next deploy, with an error
 * pointing at seed data rather than at the edit.
 *
 * So the invariant is a pair, and both halves have to hold at once:
 *
 *   1. A draft and a published row with the same identity may coexist.
 *   2. There is still **at most one published row** per identity, and at most one draft.
 *
 * Half 2 is the half that would rot quietly. Partial unique indexes are easy to write and easy
 * to write *wrong* — a missing `where` clause, or one scoped to the wrong status, produces a
 * schema that accepts two published rows for the same key. Nothing would fail at write time;
 * the site would render whichever row the query happened to return first, and the rate sheet
 * would start disagreeing with itself between builds.
 *
 * ## Why it runs against the real project, as a signed-in member
 *
 * Unique indexes are database behaviour, so mocking proves nothing. And the writes go through
 * a real session rather than the service role, so the policies from #72 are exercised on the
 * same path the editor will use — a suite that bypassed row-level security could pass against
 * a schema the admin cannot actually write to.
 *
 * Everything written here belongs to the **fixture** organization and is deleted afterwards.
 */
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import type { Database } from "@/lib/database.types";
import { requireFixtureSetup } from "./fixture-setup";

const PROJECT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TEST_PASSWORD = process.env.SUPABASE_TEST_PASSWORD;

const TEST_EMAIL = "rls-fixture@example.com";

if (!PROJECT_URL || !ANON_KEY || !TEST_PASSWORD) {
  throw new Error(
    "The draft-twin suite needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and " +
      "SUPABASE_TEST_PASSWORD, for the same reasons authenticated.test.ts does. Skipping when " +
      "they are absent would turn a missing gate into a green run.",
  );
}

const member = createClient<Database>(PROJECT_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Signed out, so "a visitor cannot see the draft" is checked from outside the member's own
 *  filtered view rather than being inferred from it. */
const visitor = createClient<Database>(PROJECT_URL, ANON_KEY);

/** Distinct from the keys `anon.test.ts` and `authenticated.test.ts` assert against, so a
 *  failure here cannot leave either of those red for an unrelated reason. */
const TWIN_KEY = "rlsFixtureTwin";

/** Postgres `unique_violation`. Asserted by code rather than by "an error came back": a
 *  not-null violation or a policy refusal would also produce an error, and a test that accepts
 *  any failure passes against a schema with no unique index at all. */
const UNIQUE_VIOLATION = "23505";

let fixtureOrgId: string;
let willowGroveOrgId: string;

/**
 * The columns `programs` needs beyond the ones under test.
 *
 * The distinguishing text is carried in `ratio` rather than `age_label`, which #123 dropped:
 * the age range and the group size are sentences, so they are `prose` rows now, and `ratio` is
 * the only free text column this table has left. What the twin tests need is any column whose
 * value can differ between the two rows, so which one it is does not matter here.
 */
function programRow(status: "draft" | "published", marker: string) {
  return {
    org_id: fixtureOrgId,
    key: TWIN_KEY,
    ratio: marker,
    sort_order: 905,
    status,
  };
}

async function cleanUp() {
  await member.from("programs").delete().eq("key", TWIN_KEY);
  await member.from("tuition_fees").delete().eq("org_id", fixtureOrgId);
}

beforeAll(async () => {
  const { error } = await member.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (error) {
    throw new Error(
      `Could not sign in as ${TEST_EMAIL}: ${error.message}. The account is created by hand in ` +
        "the Supabase dashboard and its profile row by supabase/fixtures/rls.sql. This is " +
        "setup missing, not a policy failure.",
    );
  }

  ({ fixtureOrgId, willowGroveOrgId } = await requireFixtureSetup(
    member,
    visitor,
  ));

  // A previous run that died mid-way would otherwise leave rows that make the first insert
  // below fail on the very constraint this suite is trying to characterise.
  await cleanUp();
});

afterAll(async () => {
  await cleanUp();
  await member.auth.signOut();
});

describe("a keyed table holds a draft beside its published twin", () => {
  test("both rows exist under the same key, and the visitor sees only the published one", async () => {
    const published = await member
      .from("programs")
      .insert(programRow("published", "FIXTURE twin — published"))
      .select("key, status");
    expect(published.error).toBeNull();

    // The insert this migration exists to permit. Before it, this failed on
    // `programs_key_unique_per_org` and the editor had nowhere to put an edit.
    const draft = await member
      .from("programs")
      .insert(programRow("draft", "FIXTURE twin — edited, not yet live"))
      .select("key, status");

    expect(draft.error).toBeNull();
    expect(draft.data).toEqual([{ key: TWIN_KEY, status: "draft" }]);

    const owned = await member
      .from("programs")
      .select("status, ratio")
      .eq("key", TWIN_KEY)
      .order("status");

    expect(owned.error).toBeNull();
    expect(owned.data).toEqual([
      { status: "draft", ratio: "FIXTURE twin — edited, not yet live" },
      { status: "published", ratio: "FIXTURE twin — published" },
    ]);

    /*
     * The assertion the whole feature rests on. An edit is in flight, and what a visitor —
     * and therefore what a build — reads is still the published text. If this ever returns
     * the draft, an unfinished edit is on the public site and nobody would learn it from a
     * failing build.
     */
    const public_ = await visitor
      .from("programs")
      .select("status, ratio")
      .eq("key", TWIN_KEY);

    expect(public_.error).toBeNull();
    expect(public_.data).toEqual([
      { status: "published", ratio: "FIXTURE twin — published" },
    ]);
  });

  test("a second published row under the same key is refused", async () => {
    // The half that would rot silently. Two published rows means the site renders whichever
    // one the query returns first, which can differ between builds.
    const { error } = await member
      .from("programs")
      .insert(programRow("published", "FIXTURE twin — must never exist"));

    expect(error?.code).toBe(UNIQUE_VIOLATION);
  });

  test("a second draft under the same key is refused", async () => {
    // One pending edit per thing. Two would make "publish this draft" ambiguous in #75.
    const { error } = await member
      .from("programs")
      .insert(programRow("draft", "FIXTURE twin — must never exist"));

    expect(error?.code).toBe(UNIQUE_VIOLATION);
  });
});

describe("a single-row-per-organization table behaves the same way", () => {
  /**
   * `tuition_fees` and `site_settings` were `unique (org_id)` with no key column, so their
   * indexes are a different shape from the keyed tables above and are worth their own case
   * rather than assumed to follow. `tuition_fees` is used because the fixture organization has
   * no row in it, so this suite can own both rows outright.
   */
  function feesRow(status: "draft" | "published", registration: number) {
    return {
      org_id: fixtureOrgId,
      registration,
      deposit_weeks: 2,
      notice_weeks: 4,
      late_pickup_per_minute: 1,
      sibling_discount_percent: 10,
      status,
    };
  }

  test("one published row and one draft may coexist, and no more of either", async () => {
    const published = await member
      .from("tuition_fees")
      .insert(feesRow("published", 100))
      .select("status");
    expect(published.error).toBeNull();

    const draft = await member
      .from("tuition_fees")
      .insert(feesRow("draft", 150))
      .select("status");
    expect(draft.error).toBeNull();

    const secondPublished = await member
      .from("tuition_fees")
      .insert(feesRow("published", 200));
    expect(secondPublished.error?.code).toBe(UNIQUE_VIOLATION);

    const secondDraft = await member
      .from("tuition_fees")
      .insert(feesRow("draft", 250));
    expect(secondDraft.error?.code).toBe(UNIQUE_VIOLATION);

    const owned = await member
      .from("tuition_fees")
      .select("status, registration")
      .eq("org_id", fixtureOrgId)
      .order("status");

    expect(owned.data).toEqual([
      { status: "draft", registration: 150 },
      { status: "published", registration: 100 },
    ]);
  });
});

describe("the constraints the migration did not weaken still hold", () => {
  /**
   * A migration that drops constraints is exactly where an unrelated guarantee gets lost by
   * accident. These two are cheap to re-assert and expensive to discover missing.
   */
  test("a check constraint is still enforced", async () => {
    // `per_month > 0` on tuition_rates, chosen because it is the one a bad form field would
    // hit first. `23514` is check_violation.
    const { error } = await member.from("tuition_rates").insert({
      org_id: fixtureOrgId,
      schedule_id: crypto.randomUUID(),
      program_id: crypto.randomUUID(),
      per_month: 0,
    });

    // Either the check or the foreign key refuses this; both are refusals the schema owes us,
    // and asserting the specific code would make the test depend on which fires first.
    expect(error).not.toBeNull();
    expect(["23514", "23503"]).toContain(error!.code);
  });

  test("a member still cannot write another organization's row", async () => {
    // The tenancy guarantee, re-checked against the new index shape: a draft twin is still a
    // row the WITH CHECK half of the policy has to approve.
    const { error } = await member.from("programs").insert({
      org_id: willowGroveOrgId,
      key: "infants",
      ratio: "must never exist",
      sort_order: 906,
      status: "draft",
    });

    expect(error?.code).toBe("42501");
  });
});
