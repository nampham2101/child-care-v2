/**
 * Discarding a pending edit leaves the published row exactly as it was — issue #121.
 *
 * ## Why this is a database test and not a unit test
 *
 * #121 asks for the published row to be "provably untouched by a discard, asserted in a test
 * rather than assumed". A mock cannot make that claim: what is being asserted is that a `delete`
 * scoped by one row's `id` did not reach a second row that shares its key, and the thing doing
 * the scoping is Postgres. So this runs `discardDraft` itself — the function the editor calls,
 * not a reimplementation of it — against real rows, as a real signed-in member, so row-level
 * security is exercised on the same path the admin uses.
 *
 * ## The four cases, and why each is here
 *
 *   1. **A draft with a published twin.** The ordinary case: the draft goes, the published row is
 *      byte-identical afterwards, and a signed-out visitor still reads the published value. This
 *      is the promise the whole editor rests on and it is the one an off-by-one predicate would
 *      break silently.
 *   2. **A draft with no published twin.** Deleting it removes the thing itself. That is correct
 *      and is what the interface warns about, so it is asserted rather than left as an
 *      implementation detail — and the outcome the function reports is what the wording depends
 *      on, so the wrong value here would produce a confirmation that lies.
 *   3. **Nothing pending.** Refused, rather than reporting a cheerful success for deleting
 *      nothing — which is indistinguishable from case 1 having already happened.
 *   4. **Only a published row.** The dangerous one. There is no code path that selects a
 *      published row for deletion, and this proves it from the outside: asking to discard
 *      something with no draft must refuse *and* leave the published row present.
 *
 * Everything written here belongs to the fixture organization and is deleted afterwards.
 */
import { createClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import { DraftError, discardDraft } from "@/lib/admin/drafts";
import type { Database } from "@/lib/database.types";
import { requireFixtureSetup } from "./fixture-setup";

const PROJECT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TEST_PASSWORD = process.env.SUPABASE_TEST_PASSWORD;

const TEST_EMAIL = "rls-fixture@example.com";

if (!PROJECT_URL || !ANON_KEY || !TEST_PASSWORD) {
  throw new Error(
    "The discard suite needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and " +
      "SUPABASE_TEST_PASSWORD, for the same reasons authenticated.test.ts does. Skipping when " +
      "they are absent would turn a missing gate into a green run.",
  );
}

const member = createClient<Database>(PROJECT_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Signed out, so "the public value did not move" is checked from outside the member's own
 *  filtered view rather than inferred from it. */
const visitor = createClient<Database>(PROJECT_URL, ANON_KEY);

/** Distinct from every other suite's keys, so a failure here cannot leave another one red. */
const TWIN_KEY = "rlsFixtureDiscardTwin";
const ORPHAN_KEY = "rlsFixtureDiscardOrphan";
const PUBLISHED_ONLY_KEY = "rlsFixtureDiscardPublishedOnly";
const ALL_KEYS = [TWIN_KEY, ORPHAN_KEY, PUBLISHED_ONLY_KEY];

let fixtureOrgId: string;

function programRow(
  key: string,
  status: "draft" | "published",
  ratio: string,
  sortOrder: number,
) {
  return { org_id: fixtureOrgId, key, ratio, sort_order: sortOrder, status };
}

async function cleanUp() {
  for (const key of ALL_KEYS) {
    await member.from("programs").delete().eq("key", key);
  }
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

  ({ fixtureOrgId } = await requireFixtureSetup(member, visitor));
  await cleanUp();
});

afterAll(async () => {
  await cleanUp();
  await member.auth.signOut();
});

describe("discarding an edit that has a published twin", () => {
  test("the draft goes, the published row is untouched, and the visitor never saw either", async () => {
    const published = await member
      .from("programs")
      .insert(programRow(TWIN_KEY, "published", "FIXTURE published", 950))
      .select("id, ratio, created_at, updated_at")
      .single();
    expect(published.error).toBeNull();

    const draft = await member
      .from("programs")
      .insert(programRow(TWIN_KEY, "draft", "FIXTURE edited, not live", 950))
      .select("id")
      .single();
    expect(draft.error).toBeNull();

    const { outcome } = await discardDraft(member, "programs", {
      key: TWIN_KEY,
    });

    // The word the confirmation was written from. "removed" here would mean a staff member had
    // been told the room itself was being deleted.
    expect(outcome).toBe("reverted");

    const after = await member
      .from("programs")
      .select("id, status, ratio, created_at, updated_at")
      .eq("key", TWIN_KEY);

    expect(after.error).toBeNull();
    expect(after.data).toHaveLength(1);

    /*
     * Same id, same value, and the same `updated_at`. The timestamp is the sharp one: every
     * content table has a BEFORE UPDATE trigger, so a discard that touched the published row at
     * all — even writing an identical value — would restamp it. An unchanged timestamp is
     * therefore evidence the row was not written to, not merely that it still reads the same.
     */
    expect(after.data?.[0]).toEqual({
      id: published.data?.id,
      status: "published",
      ratio: "FIXTURE published",
      created_at: published.data?.created_at,
      updated_at: published.data?.updated_at,
    });

    // And from outside the session, which is what a build would see.
    const public_ = await visitor
      .from("programs")
      .select("status, ratio")
      .eq("key", TWIN_KEY);

    expect(public_.error).toBeNull();
    expect(public_.data).toEqual([
      { status: "published", ratio: "FIXTURE published" },
    ]);
  });
});

describe("discarding a draft with no published twin", () => {
  test("removes the row, and says so", async () => {
    const created = await member
      .from("programs")
      .insert(programRow(ORPHAN_KEY, "draft", "FIXTURE never published", 951))
      .select("id");
    expect(created.error).toBeNull();

    const { outcome } = await discardDraft(member, "programs", {
      key: ORPHAN_KEY,
    });

    // The distinction the whole confirmation rests on: there was nothing to fall back to.
    expect(outcome).toBe("removed");

    const after = await member
      .from("programs")
      .select("id")
      .eq("key", ORPHAN_KEY);

    expect(after.error).toBeNull();
    expect(after.data).toEqual([]);
  });
});

describe("discarding when there is nothing to discard", () => {
  test("is refused rather than reported as a success", async () => {
    await expect(
      discardDraft(member, "programs", { key: "rlsFixtureNoSuchKey" }),
    ).rejects.toBeInstanceOf(DraftError);
  });

  test("cannot delete a published row that has no draft", async () => {
    /*
     * The assertion that matters most, and the reason it is phrased from the outside: nothing in
     * `discardDraft` selects a published row, so this should refuse. If a future change ever made
     * the delete fall back to "whatever row matches the identity", this is what would catch it —
     * and what it would be catching is the editor deleting live content.
     */
    const published = await member
      .from("programs")
      .insert(programRow(PUBLISHED_ONLY_KEY, "published", "FIXTURE live", 952))
      .select("id")
      .single();
    expect(published.error).toBeNull();

    await expect(
      discardDraft(member, "programs", { key: PUBLISHED_ONLY_KEY }),
    ).rejects.toBeInstanceOf(DraftError);

    const after = await member
      .from("programs")
      .select("id, status")
      .eq("key", PUBLISHED_ONLY_KEY);

    expect(after.error).toBeNull();
    expect(after.data).toEqual([
      { id: published.data?.id, status: "published" },
    ]);
  });
});
