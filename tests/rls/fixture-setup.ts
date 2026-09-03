import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

/**
 * The setup check both signed-in suites run before asserting anything.
 *
 * ## Why this exists
 *
 * `current_org_id()` returns `NULL` when the signed-in account has no `profiles` row, and
 * `org_id = NULL` is never true — so **missing setup looks exactly like perfect isolation**.
 * Every assertion downstream either passes for the wrong reason or fails with something
 * uninformative. The first suite to notice reports `expected null to be "<uuid>"`, which reads
 * like a policy regression and sends whoever finds it into the migrations.
 *
 * It has happened twice. The second time, the account had been deleted and recreated in the
 * dashboard while debugging a sign-in problem — and `profiles.id` references `auth.users` with
 * **`on delete cascade`**, so removing the account silently took its profile row with it. The
 * account then exists, the password is right, sign-in succeeds, and the profile is gone.
 *
 * `supabase/fixtures/rls.sql` already guards the other direction: it raises if the account is
 * missing rather than inserting nothing. This is the same guard from the test side, for the
 * case the fixture cannot see — setup that *was* correct and later came apart.
 */
type Client = SupabaseClient<Database>;

export type FixtureOrgIds = {
  fixtureOrgId: string;
  willowGroveOrgId: string;
};

/**
 * Confirms the signed-in member resolves to an organization, and returns the two organization
 * ids the suites compare against.
 *
 * `visitor` does the `orgs` lookup rather than `member`: the authenticated policy on `orgs`
 * grants a member only its own row, so the member cannot see the organization it is about to
 * be refused on.
 */
export async function requireFixtureSetup(
  member: Client,
  visitor: Client,
): Promise<FixtureOrgIds> {
  const { data: orgId, error } = await member.rpc("current_org_id");

  if (error) {
    throw new Error(
      `current_org_id() could not be called: ${error.message}. The signed-in role needs ` +
        "EXECUTE on it — see the migration that restricted the grant.",
    );
  }

  if (!orgId) {
    throw new Error(
      "SETUP, NOT A POLICY FAILURE: the signed-in account has no row in public.profiles, so " +
        "current_org_id() returns NULL and matches nothing. Every assertion in this suite " +
        "would then pass or fail for the wrong reason.\n\n" +
        "Re-run supabase/fixtures/rls.sql against the project. Note that creating the account " +
        "is not enough and never was — the profile row is a separate step. And if the account " +
        "was deleted and recreated in the dashboard, the old profile row was cascaded away " +
        "with it (profiles.id references auth.users on delete cascade), so this is expected " +
        "rather than mysterious.",
    );
  }

  const { data: orgs, error: orgsError } = await visitor
    .from("orgs")
    .select("id, slug");

  if (orgsError) {
    throw new Error(`Cannot reach the project: ${orgsError.message}`);
  }

  const fixtureOrgId = orgs?.find((row) => row.slug === "rls-fixture")?.id;
  const willowGroveOrgId = orgs?.find((row) => row.slug === "willow-grove")?.id;

  if (!fixtureOrgId || !willowGroveOrgId) {
    throw new Error(
      "Both the fixture organization and willow-grove must exist for these suites to compare " +
        "them. Apply supabase/fixtures/rls.sql and supabase/seed.sql.",
    );
  }

  if (orgId !== fixtureOrgId) {
    throw new Error(
      `The signed-in account resolves to organization ${orgId}, which is not the fixture ` +
        "organization. The test account must belong to rls-fixture and never to willow-grove: " +
        "a member can write everything its organization owns, so an account inside the live " +
        "center would make SUPABASE_TEST_PASSWORD a credential that can rewrite the site.",
    );
  }

  return { fixtureOrgId, willowGroveOrgId };
}

/**
 * The prefixes every suite-owned scratch row is named with.
 *
 * `rlsFixture*` is written by `authenticated.test.ts`, `draft-twins.test.ts` and
 * `discard.test.ts`; `rlsPublish*` by `publish.test.ts`. Each of those creates its rows in the
 * test and removes them in `afterAll`, so a row carrying one of these prefixes that is still
 * here at the start of a later run did not get cleaned up.
 */
const SCRATCH_PREFIXES = ["rlsFixture", "rlsPublish"];

/**
 * Names the cause when a whole-table sweep finds rows the fixture is not supposed to hold.
 *
 * ## Why this is not just `toEqual`
 *
 * A sweep like "the fixture organization holds exactly these two programs" is the right
 * assertion — it is what proves the tenancy boundary rather than asking about one key. But when
 * it fails it reports `expected [ 'rlsFixtureDraft', …(2) ] to deeply equal […(1)]`, which
 * reads as a policy regression in the suite that happened to run first, and sends whoever finds
 * it into the migrations.
 *
 * The far commoner cause is #134: clean-up lives in `afterAll`, a cancelled job never reaches
 * it, and the stranded row fails the *next* run. That cost a red v0.7.0 dry run and about an
 * hour of looking in the wrong place. `cancel-in-progress: false` in `ci.yml` is the fix, and
 * this is the message for the times a run is still killed some other way — a runner dying, or
 * someone pressing cancel by hand.
 *
 * The distinction it draws is the useful one: a stray key carrying a suite's own prefix is
 * left-over state, and a stray key carrying anything else is a real finding — another
 * organization's row became visible, which is the thing these suites exist to catch. Only the
 * first gets explained away.
 */
export function requireNoStrandedFixtureRows(
  table: string,
  actualKeys: string[],
  expectedKeys: string[],
): void {
  const strays = actualKeys.filter((key) => !expectedKeys.includes(key));

  if (strays.length === 0) return;

  const leftOver = strays.filter((key) =>
    SCRATCH_PREFIXES.some((prefix) => key.startsWith(prefix)),
  );

  if (leftOver.length < strays.length) {
    // At least one stray is not a scratch key, so this is not a clean-up story. Say nothing
    // reassuring — a row appearing here that no suite wrote is exactly the failure the sweep
    // is for.
    throw new Error(
      `${table} holds rows the fixture organization should not be able to see: ` +
        `${strays.join(", ")}. Expected only ${expectedKeys.join(", ")}. Keys that do not ` +
        "start with a suite's own scratch prefix have no innocent explanation — check the " +
        "authenticated policies before assuming this is test litter.",
    );
  }

  throw new Error(
    `LEFT-OVER FIXTURE STATE, NOT A POLICY FAILURE: ${table} holds ` +
      `${leftOver.join(", ")} on top of the ${expectedKeys.length} rows the fixture owns ` +
      "permanently. Those keys belong to a suite that creates them in a test and deletes them " +
      "in afterAll, so finding them at rest means a run died before its afterAll — a cancelled " +
      "job, a killed runner. See #134: this is why ci.yml sets cancel-in-progress: false.\n\n" +
      "Nothing is wrong with the change under test. Clear the strays and re-run:\n" +
      `  delete from public.${table} where key in (${leftOver
        .map((key) => `'${key}'`)
        .join(", ")});`,
  );
}
