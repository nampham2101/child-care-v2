/**
 * `public.publish_org_drafts()` — what it promotes, what it refuses, and the one case that
 * fails silently.
 *
 * ## The assertion that earns this file
 *
 * `docs/adr/0001-draft-and-published-twin-rows.md` records two promote cases. Case 1 (a draft
 * with a published twin) is loud when wrong — the wrong value appears. **Case 2 is not.** A
 * draft with no published twin must be flipped to `published` in place, never replaced by a
 * copy, because its id is already referenced by any draft `tuition_rates` row and that foreign
 * key cascades on delete. Replace instead of flip and the rate sheet loses cells: no error, no
 * failed build, just a price table with a hole in it that nobody looks for.
 *
 * So the case-2 test below creates a rate against a twin-less draft program and asserts the
 * rate is still there afterwards. That single assertion is the reason this suite exists.
 *
 * ## Why a real session, again
 *
 * The function is `security invoker`, so row-level security decides what it may touch. Running
 * it as the service role would bypass exactly the thing under test and pass unconditionally.
 */
import { createClient } from "@supabase/supabase-js";
import { afterAll, afterEach, beforeAll, describe, expect, test } from "vitest";

import type { Database } from "@/lib/database.types";
import { requireFixtureSetup } from "./fixture-setup";

const PROJECT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TEST_PASSWORD = process.env.SUPABASE_TEST_PASSWORD;
const TEST_EMAIL = "rls-fixture@example.com";

if (!PROJECT_URL || !ANON_KEY || !TEST_PASSWORD) {
  throw new Error(
    "The publish suite needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and " +
      "SUPABASE_TEST_PASSWORD, for the same reasons authenticated.test.ts does.",
  );
}

const member = createClient<Database>(PROJECT_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const visitor = createClient<Database>(PROJECT_URL, ANON_KEY);

/** Keys owned by this suite alone, so a failure cannot leave another suite red. */
const TWIN_KEY = "rlsPublishTwin";
const NEW_KEY = "rlsPublishNew";
const SCHEDULE_KEY = "rlsPublishSchedule";

/** The suite-owned identity used by the every-table sweep below. */
const COVER_KEY = "rlsPublishCover";

let fixtureOrgId: string;

function program(
  key: string,
  status: "draft" | "published",
  ratio: string,
  sortOrder = 970,
) {
  return {
    org_id: fixtureOrgId,
    key,
    age_label: "FIXTURE publish probe",
    ratio,
    group_size: "0 children",
    sort_order: sortOrder,
    status,
  };
}

async function cleanUp() {
  // Rates first: they reference the programs and schedules below, and deleting a parent would
  // cascade rather than fail — which is the very behaviour this suite is characterising.
  const { data: schedules } = await member
    .from("tuition_schedules")
    .select("id")
    .eq("key", SCHEDULE_KEY);
  for (const schedule of schedules ?? []) {
    await member.from("tuition_rates").delete().eq("schedule_id", schedule.id);
  }
  await member.from("tuition_schedules").delete().eq("key", SCHEDULE_KEY);
  await member.from("programs").delete().in("key", [TWIN_KEY, NEW_KEY]);

  /*
   * The fixture's permanently-draft row, put back.
   *
   * Every `publish_org_drafts()` call here promotes **everything pending in the organization**,
   * including `rlsFixtureDraft` — a row this suite did not create and
   * `tests/rls/authenticated.test.ts` asserts is a draft.
   *
   * That was survivable only because of file ordering: Vitest runs test files largest-first, and
   * `authenticated.test.ts` used to be bigger than this one, so it asserted before this suite ran.
   * Adding the every-table sweep below made this file the largest, it ran first, and
   * `authenticated.test.ts` failed on a row nowhere near what it was testing.
   *
   * `tests/e2e/admin-editor.spec.ts` has a restore for the same reason, but it is a different
   * command in a later step — no use to a `test:db` run that fails before reaching it. So the
   * suite that breaks the row is the suite that repairs it, and the ordering stops mattering.
   */
  await member
    .from("programs")
    .update({ status: "draft" })
    .eq("key", "rlsFixtureDraft");
}

beforeAll(async () => {
  const { error } = await member.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (error)
    throw new Error(`Could not sign in as ${TEST_EMAIL}: ${error.message}`);

  ({ fixtureOrgId } = await requireFixtureSetup(member, visitor));
  await cleanUp();
  // Rows a crashed earlier run may have left behind; the sweep below inserts on identities
  // whose partial unique index would otherwise refuse the second attempt with 23505.
  await cleanUpCoverage();
});

afterEach(cleanUp);

afterAll(async () => {
  await cleanUp();
  await cleanUpCoverage();
  await member.auth.signOut();
});

describe("promoting a draft that has a published twin", () => {
  test("copies the draft onto the published row and removes the draft", async () => {
    await member.from("programs").insert(program(TWIN_KEY, "published", "OLD"));
    await member.from("programs").insert(program(TWIN_KEY, "draft", "NEW"));

    const { data: promoted, error } = await member.rpc("publish_org_drafts");
    expect(error).toBeNull();
    expect(promoted).toBeGreaterThanOrEqual(1);

    const { data: after } = await member
      .from("programs")
      .select("ratio, status")
      .eq("key", TWIN_KEY);

    // One row, published, carrying the draft's value.
    expect(after).toEqual([{ ratio: "NEW", status: "published" }]);
  });

  test("the promoted value is what a signed-out visitor now reads", async () => {
    await member.from("programs").insert(program(TWIN_KEY, "published", "OLD"));
    await member.from("programs").insert(program(TWIN_KEY, "draft", "NEW"));
    await member.rpc("publish_org_drafts");

    // The whole point of publishing: the anonymous read changes. Checked with a signed-out
    // client, because the member's own view is draft-preferring and would look the same either
    // way.
    const { data } = await visitor
      .from("programs")
      .select("ratio")
      .eq("key", TWIN_KEY);

    expect(data).toEqual([{ ratio: "NEW" }]);
  });
});

describe("promoting a draft with no published twin", () => {
  /**
   * The silent one. If this ever fails by returning zero rates rather than one, the promote
   * algorithm has started replacing rows instead of flipping them, and the production symptom
   * is a tuition table with missing cells and no error anywhere.
   */
  test("flips the row in place, so rows referencing it survive", async () => {
    const { data: inserted } = await member
      .from("programs")
      .insert(program(NEW_KEY, "draft", "1:1", 971))
      .select("id")
      .single();
    const programId = inserted!.id;

    const { data: schedule } = await member
      .from("tuition_schedules")
      .insert({
        org_id: fixtureOrgId,
        key: SCHEDULE_KEY,
        sort_order: 972,
        status: "draft",
      })
      .select("id")
      .single();

    await member.from("tuition_rates").insert({
      org_id: fixtureOrgId,
      schedule_id: schedule!.id,
      program_id: programId,
      per_month: 1234,
      status: "draft",
    });

    const { error } = await member.rpc("publish_org_drafts");
    expect(error).toBeNull();

    // The program kept its id — that is what "flipped in place" means, and what the rate's
    // foreign key depends on.
    const { data: afterProgram } = await member
      .from("programs")
      .select("id, status")
      .eq("key", NEW_KEY);
    expect(afterProgram).toEqual([{ id: programId, status: "published" }]);

    // And the rate is still there, published, with its value intact.
    const { data: afterRate } = await member
      .from("tuition_rates")
      .select("per_month, status")
      .eq("program_id", programId);
    expect(afterRate).toEqual([{ per_month: 1234, status: "published" }]);
  });
});

/**
 * Every table the function promotes, not just the three the cases above happen to use.
 *
 * ## Why this block exists
 *
 * Until #94 the function was the same three statements written out once per table, and the
 * failure mode that mattered was **silent**: add a content table, forget to extend the function,
 * and nothing errors — the drafts simply never publish. The tests did not catch it either,
 * because they only ever exercised `programs`, `tuition_schedules` and `tuition_rates`.
 *
 * #94 replaced the repetition with a table list. That makes the omission smaller but not
 * impossible: a new table still has to be added to the list. So the guard is here, in the tests,
 * where forgetting is loud.
 *
 * **The list below must hold every member of `DraftableTable` in `lib/admin/drafts.ts`.** If you
 * add a table there, add it here, and the function's list will be the next thing that fails if
 * you missed it.
 */
type CoverageSpec = {
  table: string;
  /** Columns shared by both twins, beyond org_id and status. */
  identity: Record<string, string>;
  /** The remaining columns, with the marked field set to `marker`. */
  row: (marker: string) => Record<string, unknown>;
  /** The column carrying the marker, asserted after publishing. */
  field: string;
  /** Extra columns both twins need, resolved at test time (foreign keys). */
  setUp?: () => Promise<Record<string, unknown>>;
};

/**
 * `supabase.from()` over a union of table names does not resolve to one callable signature —
 * the same problem, and the same narrowing, as `lib/admin/drafts.ts`. Every method used is still
 * named and typed.
 */
type LooseClient = {
  from(table: string): {
    insert(values: Record<string, unknown>): PromiseLike<{
      error: { message: string } | null;
    }>;
    select(columns: string): {
      match(criteria: Record<string, unknown>): PromiseLike<{
        data: Record<string, unknown>[] | null;
        error: { message: string } | null;
      }>;
    };
    delete(): {
      match(criteria: Record<string, unknown>): PromiseLike<{
        error: { message: string } | null;
      }>;
    };
  };
};

const COVERAGE: CoverageSpec[] = [
  {
    table: "site_settings",
    identity: {},
    field: "phone_display",
    row: (marker) => ({
      phone_display: marker,
      phone_href: "tel:+15035550000",
      email_display: marker,
      email_href: "mailto:fixture@example.com",
      license_number: marker,
      years_operating_since: 2000,
      age_range: marker,
      infant_ratio: "9:9",
      hours_short: marker,
      address_line1: marker,
      address_line2: marker,
      neighborhood: marker,
    }),
  },
  {
    table: "programs",
    identity: { key: `${COVER_KEY}Program` },
    field: "ratio",
    row: (marker) => ({
      age_label: "FIXTURE coverage probe",
      ratio: marker,
      group_size: "0 children",
      sort_order: 981,
    }),
  },
  {
    table: "daily_rhythm",
    identity: { label_key: `${COVER_KEY}Rhythm` },
    field: "time",
    row: (marker) => ({ time: marker, sort_order: 982 }),
  },
  {
    table: "staff",
    identity: { key: `${COVER_KEY}Staff` },
    field: "name",
    row: (marker) => ({
      name: marker,
      since: 2000,
      is_featured: false,
      sort_order: 983,
    }),
  },
  {
    table: "tuition_schedules",
    identity: { key: `${COVER_KEY}Schedule` },
    field: "sort_order",
    row: (marker) => ({ sort_order: marker === "NEW" ? 985 : 984 }),
  },
  {
    /*
     * A rate is identified by the pair it prices rather than by a key of its own, so both twins
     * need the same published schedule and program to point at. Case 2 for this table — the
     * flip-in-place that keeps a rate's foreign key intact — is the separate test above.
     */
    table: "tuition_rates",
    identity: {},
    field: "per_month",
    row: (marker) => ({ per_month: marker === "NEW" ? 999 : 111 }),
    setUp: async () => {
      const loose = member as unknown as LooseClient;
      await loose.from("tuition_schedules").insert({
        org_id: fixtureOrgId,
        key: `${COVER_KEY}RateSchedule`,
        sort_order: 986,
        status: "published",
      });
      await loose.from("programs").insert({
        org_id: fixtureOrgId,
        key: `${COVER_KEY}RateProgram`,
        age_label: "FIXTURE coverage probe",
        ratio: "9:9",
        group_size: "0 children",
        sort_order: 987,
        status: "published",
      });

      const { data: schedule } = await loose
        .from("tuition_schedules")
        .select("id")
        .match({ key: `${COVER_KEY}RateSchedule` });
      const { data: program } = await loose
        .from("programs")
        .select("id")
        .match({ key: `${COVER_KEY}RateProgram` });

      return {
        schedule_id: schedule![0].id,
        program_id: program![0].id,
      };
    },
  },
  {
    table: "tuition_fees",
    identity: {},
    field: "registration",
    row: (marker) => ({
      registration: marker === "NEW" ? 99 : 11,
      deposit_weeks: 1,
      notice_weeks: 1,
      late_pickup_per_minute: 1,
      sibling_discount_percent: 1,
    }),
  },
  {
    /*
     * A suite-owned namespace, deliberately not the fixture's own prose rows. Publishing would
     * overwrite their values, and `tests/e2e/admin-editor.spec.ts` asserts on those.
     */
    table: "prose",
    identity: {
      locale: "en",
      namespace: "RlsPublishCover",
      key: `${COVER_KEY}Prose`,
    },
    field: "value",
    row: (marker) => ({ value: `FIXTURE ${marker} — must never be visible` }),
  },
  {
    table: "media",
    identity: { key: `${COVER_KEY}Media` },
    field: "alt",
    row: (marker) => ({
      // No object is uploaded: the row is what publish_org_drafts promotes, and storage is
      // untouched by it. See the note in tests/e2e/admin-editor.spec.ts about clearing bytes.
      storage_path: `${COVER_KEY}/never-uploaded.jpg`,
      alt: marker,
    }),
  },
];

async function cleanUpCoverage() {
  const loose = member as unknown as LooseClient;

  // Rates before the schedule and program they reference, for the same cascade reason as above.
  await loose.from("tuition_rates").delete().match({ per_month: 999 });
  await loose.from("tuition_rates").delete().match({ per_month: 111 });

  for (const spec of COVERAGE) {
    if (Object.keys(spec.identity).length > 0) {
      await loose.from(spec.table).delete().match(spec.identity);
    }
  }

  await loose
    .from("tuition_schedules")
    .delete()
    .match({ key: `${COVER_KEY}RateSchedule` });
  await loose
    .from("programs")
    .delete()
    .match({ key: `${COVER_KEY}RateProgram` });

  /*
   * site_settings and tuition_fees hold one row per organization and have no key to match on.
   * Row-level security has already scoped this to the fixture organization, which owns none of
   * either outside this suite — so deleting everything visible is deleting exactly what was
   * created here.
   */
  await loose.from("site_settings").delete().match({ org_id: fixtureOrgId });
  await loose.from("tuition_fees").delete().match({ org_id: fixtureOrgId });
}

describe("every table the function promotes", () => {
  afterEach(cleanUpCoverage);

  test.each(COVERAGE.map((spec) => [spec.table, spec] as const))(
    "%s: a draft's value reaches the published row",
    async (_name, spec) => {
      const extra = spec.setUp ? await spec.setUp() : {};
      const loose = member as unknown as LooseClient;
      const base = { org_id: fixtureOrgId, ...spec.identity, ...extra };

      const first = await loose
        .from(spec.table)
        .insert({ ...base, ...spec.row("OLD"), status: "published" });
      expect(first.error).toBeNull();

      const second = await loose
        .from(spec.table)
        .insert({ ...base, ...spec.row("NEW"), status: "draft" });
      expect(second.error).toBeNull();

      const { error } = await member.rpc("publish_org_drafts");
      expect(error).toBeNull();

      const { data: after } = await loose
        .from(spec.table)
        .select(`${spec.field}, status`)
        .match({ ...spec.identity, ...extra });

      // One row, published, carrying the draft's value. A table missing from the function's
      // list fails here with two rows — the draft never promoted.
      expect(after).toEqual([
        { [spec.field]: spec.row("NEW")[spec.field], status: "published" },
      ]);
    },
  );
});

describe("what publishing refuses and reports", () => {
  test("publishing with nothing pending promotes nothing", async () => {
    // The property #75 needs for "publishing twice in quick succession does not produce two
    // competing builds": the second call has nothing to do, so the application starts no
    // build. No lock, no queue — it falls out of promoting before rebuilding.
    await member.from("programs").insert(program(TWIN_KEY, "published", "OLD"));
    await member.from("programs").insert(program(TWIN_KEY, "draft", "NEW"));

    const first = await member.rpc("publish_org_drafts");
    expect(first.data).toBeGreaterThanOrEqual(1);

    const second = await member.rpc("publish_org_drafts");
    expect(second.error).toBeNull();
    expect(second.data).toBe(0);
  });

  test("an anonymous caller cannot publish at all", async () => {
    // Role-scoped: the grant is to `authenticated` only, so this is refused at the door rather
    // than by the policies inside the function.
    const { error } = await visitor.rpc("publish_org_drafts");

    expect(error).not.toBeNull();
    expect(error!.code).toBe("42501");
  });

  test("a member cannot publish another organization's drafts", async () => {
    /*
     * The tenancy guarantee for the one function that writes across every content table at
     * once. Willow Grove's published rows must be untouched by the fixture member publishing,
     * even though this call promotes "everything pending".
     */
    const before = await visitor
      .from("programs")
      .select("key, ratio")
      .eq("key", "infants")
      .single();

    await member.from("programs").insert(program(TWIN_KEY, "draft", "NEW"));
    await member.rpc("publish_org_drafts");

    const after = await visitor
      .from("programs")
      .select("key, ratio")
      .eq("key", "infants")
      .single();

    expect(after.data).toEqual(before.data);
  });
});
