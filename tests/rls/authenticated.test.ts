/**
 * What a signed-in staff member can and cannot do, asserted against the real database with a
 * real session.
 *
 * `tests/rls/anon.test.ts` covers the visitor. This file covers the other half of the model
 * that #72 switched on: `public.current_org_id()` now reads `public.profiles`, so every
 * `to authenticated` policy written in the first migration started meaning something without
 * a single one of them being edited. This suite is what proves that.
 *
 * ## Why it signs in for real
 *
 * `current_org_id()` reads `auth.uid()`, which comes from the JWT on the request. There is no
 * way to fake that from the client side, and faking it from the server side would test
 * Postgres rather than the path a staff member actually takes. So the suite holds a real
 * account's password, supplied by the environment, and calls `signInWithPassword`.
 *
 * The account belongs to the **fixture** organization, never to Willow Grove. A member can
 * write every content row its organization owns, so an account inside willow-grove would make
 * `SUPABASE_TEST_PASSWORD` a credential that can rewrite the live site. See the reasoning in
 * `supabase/fixtures/rls.sql`, which is also where the account and its profile row are set up.
 *
 * ## The claim, precisely
 *
 * A signed-in member reads and writes exactly its own organization's rows — drafts included,
 * which is the whole point of an editor — and is refused on every other organization's, in
 * both directions. Plus one guarantee that is not about content at all: **a member cannot
 * move itself between organizations**, because `profiles` grants SELECT and nothing else.
 *
 * Note the asymmetry with the anonymous suite, which deliberately does *not* claim
 * cross-organization isolation. It cannot: the anonymous policy is `status = 'published'` and
 * the key is public. This suite can, and does, because the authenticated policies are written
 * against a server-derived org id rather than anything the caller supplies.
 */
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import type { Database } from "@/lib/database.types";
import { requireFixtureSetup } from "./fixture-setup";

const PROJECT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TEST_PASSWORD = process.env.SUPABASE_TEST_PASSWORD;

/** Hardcoded, and matching the address `supabase/fixtures/rls.sql` joins on. The two have to
 *  agree or the profile row belongs to a different account than the one signing in here; the
 *  fixture raises rather than inserting nothing, so the mismatch surfaces there. */
const TEST_EMAIL = "rls-fixture@example.com";

if (!PROJECT_URL || !ANON_KEY || !TEST_PASSWORD) {
  throw new Error(
    "The authenticated row-level security suite needs NEXT_PUBLIC_SUPABASE_URL, " +
      "NEXT_PUBLIC_SUPABASE_ANON_KEY and SUPABASE_TEST_PASSWORD. The first two are public " +
      "and live in .env.local or CI variables; the password is a real credential and is a " +
      "GitHub secret. Skipping this suite when they are absent would turn a missing gate " +
      "into a green run — see the same reasoning in anon.test.ts.",
  );
}

/** The signed-in client. Built from the anonymous key on purpose: that is what the admin app
 *  will ship with. What separates this client from the visitor's is the session, not the key
 *  — which is the property under test. The service-role key would bypass every policy here
 *  and must never appear in this file. */
const member = createClient<Database>(PROJECT_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** A second, deliberately signed-out client. Used to check the state of rows the member is
 *  not allowed to see, so a "the write was refused" assertion can be confirmed against the
 *  database rather than against the member's own filtered view of it. */
const visitor = createClient<Database>(PROJECT_URL, ANON_KEY);

/** Written and deleted by this suite. Kept distinct from the two rows anon.test.ts asserts
 *  against, so a failure here cannot leave that suite red for an unrelated reason. */
const SCRATCH_KEY = "rlsFixtureScratch";

let fixtureOrgId: string;
let willowGroveOrgId: string;

beforeAll(async () => {
  const { error } = await member.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (error) {
    throw new Error(
      `Could not sign in as ${TEST_EMAIL}: ${error.message}. The account is created by hand ` +
        "in the Supabase dashboard and its profile row by supabase/fixtures/rls.sql — see " +
        "the header of that file. This is setup missing, not a policy failure.",
    );
  }

  // Fails as *setup* rather than as a policy assertion when the profile row is missing —
  // which is a state this project reaches more easily than it looks, because deleting the
  // account in the dashboard cascades the profile away. See tests/rls/fixture-setup.ts.
  ({ fixtureOrgId, willowGroveOrgId } = await requireFixtureSetup(
    member,
    visitor,
  ));
});

afterAll(async () => {
  await member.from("programs").delete().eq("key", SCRATCH_KEY);
  await member.auth.signOut();
});

describe("the session resolves to an organization", () => {
  test("current_org_id() returns the member's own organization", async () => {
    // The function this entire ticket exists to rewrite, called directly. If this returns
    // null, every assertion below would pass for the wrong reason — `org_id = NULL` is never
    // true, so a broken lookup looks exactly like perfect isolation.
    const { data, error } = await member.rpc("current_org_id");

    expect(error).toBeNull();
    expect(data).toBe(fixtureOrgId);
  });

  test("the member sees its own organization and no other", async () => {
    // `orgs` is the one table whose anonymous policy is `true`. An authenticated session
    // evaluates only the `to authenticated` policies, so the visitor's two rows become one.
    const { data, error } = await member.from("orgs").select("slug");

    expect(error).toBeNull();
    expect(data).toEqual([{ slug: "rls-fixture" }]);
  });
});

describe("a member reads its own organization, drafts included", () => {
  test("the draft row invisible to a visitor is visible to its owner", async () => {
    // The same row anon.test.ts asserts is hidden. Being able to see it is what makes an
    // editor an editor, and it is the clearest single demonstration that the authenticated
    // policy is now live rather than closed.
    const { data, error } = await member
      .from("programs")
      .select("key, status")
      .eq("key", "rlsFixtureDraft");

    expect(error).toBeNull();
    expect(data).toEqual([{ key: "rlsFixtureDraft", status: "draft" }]);
  });

  test("a full scan returns the fixture organization's rows and none of Willow Grove's", async () => {
    // The cross-tenant read guarantee, swept rather than asked for by key. Willow Grove's
    // three programs are *published* and a visitor can read them — this member cannot, and
    // that difference is the whole tenancy model.
    const { data, error } = await member.from("programs").select("key, org_id");

    expect(error).toBeNull();
    expect(data!.map((row) => row.key).sort()).toEqual([
      "rlsFixtureDraft",
      "rlsFixturePublished",
    ]);
    expect(data!.every((row) => row.org_id === fixtureOrgId)).toBe(true);
  });
});

describe("a member writes its own organization's rows", () => {
  test("insert, update and delete all succeed", async () => {
    const inserted = await member
      .from("programs")
      .insert({
        org_id: fixtureOrgId,
        key: SCRATCH_KEY,
        ratio: "FIXTURE scratch — written by the RLS suite",
        sort_order: 903,
      })
      .select("key, status");

    expect(inserted.error).toBeNull();
    // Default 'draft', and readable back immediately — an insert whose row the policy then
    // hid would return an empty selection here rather than an error.
    expect(inserted.data).toEqual([{ key: SCRATCH_KEY, status: "draft" }]);

    const updated = await member
      .from("programs")
      .update({ ratio: "1:1" })
      .eq("key", SCRATCH_KEY)
      .select("ratio");

    expect(updated.error).toBeNull();
    expect(updated.data).toEqual([{ ratio: "1:1" }]);

    const deleted = await member
      .from("programs")
      .delete()
      .eq("key", SCRATCH_KEY)
      .select("key");

    expect(deleted.error).toBeNull();
    expect(deleted.data).toEqual([{ key: SCRATCH_KEY }]);
  });
});

describe("a member is refused on another organization's rows", () => {
  /** Postgres `insufficient_privilege`, which is also what a WITH CHECK violation surfaces
   *  as through PostgREST. */
  const INSUFFICIENT_PRIVILEGE = "42501";

  test("inserting a row stamped with another organization is rejected outright", async () => {
    // The forgery attempt worth caring about: the member supplies org_id itself, so nothing
    // stops it naming Willow Grove except the WITH CHECK half of the policy. Unlike the two
    // tests below this one is a hard error, because the row never satisfies the check.
    const { error } = await member.from("programs").insert({
      org_id: willowGroveOrgId,
      key: "rlsFixtureIntruder",
      ratio: "must never exist",
      sort_order: 904,
    });

    expect(error?.code).toBe(INSUFFICIENT_PRIVILEGE);
  });

  test("an update aimed at another organization's row changes nothing, silently", async () => {
    // Row-level security filters UPDATE rather than refusing it: the statement is legal, it
    // simply matches no rows the caller can see. So "no error" is the expected result and
    // asserting `error !== null` here would be wrong — what has to be checked is that
    // nothing moved. This is the failure mode most likely to be mistaken for success.
    const { data, error } = await member
      .from("programs")
      .update({ ratio: "9:9" })
      .eq("key", "infants")
      .select("key");

    expect(error).toBeNull();
    expect(data).toEqual([]);

    // Confirmed from outside the member's own filtered view, because the member cannot read
    // the row either way and would report the same emptiness whether or not it had changed.
    const after = await visitor
      .from("programs")
      .select("ratio")
      .eq("key", "infants");

    expect(after.error).toBeNull();
    expect(after.data).toEqual([{ ratio: "1:4" }]);
  });

  test("a delete aimed at another organization's row removes nothing", async () => {
    const { data, error } = await member
      .from("programs")
      .delete()
      .eq("org_id", willowGroveOrgId)
      .select("key");

    expect(error).toBeNull();
    expect(data).toEqual([]);

    const survivors = await visitor
      .from("programs")
      .select("key")
      .in("key", ["infants", "toddlers", "preschool"]);

    expect(survivors.error).toBeNull();
    expect(survivors.data!.map((row) => row.key).sort()).toEqual([
      "infants",
      "preschool",
      "toddlers",
    ]);
  });
});

describe("a member cannot change which organization it belongs to", () => {
  /** Postgres `insufficient_privilege`. `profiles` grants SELECT to authenticated and
   *  nothing else, so a write is refused on privilege before any policy is consulted. */
  const INSUFFICIENT_PRIVILEGE = "42501";

  test("its own profile row is readable", async () => {
    const { data, error } = await member
      .from("profiles")
      .select("org_id, role, display_name");

    expect(error).toBeNull();
    expect(data).toEqual([
      {
        org_id: fixtureOrgId,
        role: "editor",
        display_name: "RLS Fixture Test Account",
      },
    ]);
  });

  test("rewriting its own org_id is refused", async () => {
    // The escalation this schema has to make impossible. Every content policy trusts
    // current_org_id(), and current_org_id() trusts this column — so a member able to write
    // it would gain full write access to another organization through policies that are all
    // behaving exactly as designed. There would be no bug anywhere to find.
    const { error } = await member
      .from("profiles")
      .update({ org_id: willowGroveOrgId })
      .eq("org_id", fixtureOrgId);

    expect(error?.code).toBe(INSUFFICIENT_PRIVILEGE);

    // And the column is genuinely untouched, not merely reported as such.
    const { data } = await member.rpc("current_org_id");
    expect(data).toBe(fixtureOrgId);
  });

  test("inserting a second profile for itself is refused", async () => {
    // The way around an un-writable row: add another one. The primary key would stop a
    // duplicate for the same account, but the refusal should come earlier than that.
    const { error } = await member.from("profiles").insert({
      id: crypto.randomUUID(),
      org_id: willowGroveOrgId,
      display_name: "x",
    });

    expect(error?.code).toBe(INSUFFICIENT_PRIVILEGE);
  });

  test("deleting its profile is refused", async () => {
    const { error } = await member
      .from("profiles")
      .delete()
      .eq("org_id", fixtureOrgId);

    expect(error?.code).toBe(INSUFFICIENT_PRIVILEGE);
  });
});
