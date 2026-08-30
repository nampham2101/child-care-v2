/**
 * Editing and publishing copy in a language that is not English — issue #111.
 *
 * ## Why this file exists when publish.test.ts already covers `prose`
 *
 * That suite proves a prose row drafts and publishes. It does so with one row in one locale, so
 * it cannot see what #111 is actually worried about: **that the locale is part of the identity,
 * and not an incidental column.**
 *
 * ## What confirming it turned up
 *
 * #111 asked for this to be confirmed rather than assumed, and the assumption was **half
 * right**. Two separate things were being conflated:
 *
 *   - **Twin matching IS per locale.** `publish_org_drafts` identifies a prose row by
 *     `array['org_id', 'locale', 'namespace', 'key']`, so a German draft pairs with the German
 *     published row and can never overwrite the English one. That half holds, and the first
 *     publishing test below proves it.
 *   - **The publish SWEEP is not per locale.** The function takes no arguments and ends each
 *     table with `update … set status='published' where org_id = $1 and status='draft'` — no
 *     locale filter. So pressing Publish promotes every pending draft in the organization, in
 *     every language, exactly as it already promotes every pending fact and photograph.
 *
 * #111's acceptance criterion "a publish promotes only the locale they were working in" is
 * therefore **not met by the current machinery**, and cannot be without changing
 * `publish_org_drafts` itself. The second publishing test below characterises what really
 * happens, so the gap is written down and asserted rather than discovered later by a staff
 * member who published a half-finished translation.
 *
 * ## Why a real session
 *
 * `publish_org_drafts` is `security invoker`, so row-level security decides what it may touch.
 * Running it as the service role would bypass the thing under test and pass unconditionally —
 * the same reason `publish.test.ts` signs in for real.
 *
 * ## The locale used here is deliberately one the site does not route
 *
 * `de` is not in `routing.locales` today. That is the point: this asserts the **database and
 * publish machinery** are locale-aware before any catalogue exists, which is what lets #111 ship
 * ahead of #53 and #54. Nothing renders these rows, and `resolveContentLocale` would refuse to
 * point the editor at them — `lib/admin/content-locale.test.ts` covers that half.
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
    "The prose locale suite needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY " +
      "and SUPABASE_TEST_PASSWORD, for the same reasons authenticated.test.ts does. " +
      "Skipping when they are absent would turn a missing gate into a green run.",
  );
}

const member = createClient<Database>(PROJECT_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const visitor = createClient<Database>(PROJECT_URL, ANON_KEY);

/** Owned by this suite alone, so a failure cannot leave another suite red. */
const NAMESPACE = "RlsProseLocale";
const KEY = "greeting";

const ENGLISH = "FIXTURE English — must never be visible";
const GERMAN = "FIXTURE German — must never be visible";

let fixtureOrgId: string;

function row(locale: string, value: string, status: "draft" | "published") {
  return {
    org_id: fixtureOrgId,
    locale,
    namespace: NAMESPACE,
    key: KEY,
    value,
    status,
  };
}

async function readAll() {
  const { data } = await member
    .from("prose")
    .select("locale, value, status")
    .eq("namespace", NAMESPACE);
  return data ?? [];
}

async function cleanUp() {
  await member.from("prose").delete().eq("namespace", NAMESPACE);
  // `publish_org_drafts` promotes everything pending in the organization, including the
  // fixture's permanently-draft program that `authenticated.test.ts` asserts on. The suite that
  // breaks it repairs it, so file ordering cannot matter — publish.test.ts says the same.
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
});

afterEach(cleanUp);

afterAll(async () => {
  await cleanUp();
  await member.auth.signOut();
});

describe("two locales of the same string", () => {
  test("coexist as separate published rows", async () => {
    // The partial unique index is on (org_id, locale, namespace, key), so the locale is what
    // makes these two rows rather than a conflict. If it were ever dropped from that index the
    // second insert would fail here, before any of the publish reasoning below could matter.
    const { error } = await member
      .from("prose")
      .insert([
        row("en", ENGLISH, "published"),
        row("de", GERMAN, "published"),
      ]);

    expect(error).toBeNull();
    expect(await readAll()).toHaveLength(2);
  });

  test("each can carry its own draft at the same time", async () => {
    await member
      .from("prose")
      .insert([
        row("en", ENGLISH, "published"),
        row("de", GERMAN, "published"),
        row("en", `${ENGLISH} edited`, "draft"),
        row("de", `${GERMAN} edited`, "draft"),
      ]);

    // Four rows: a published and a draft twin per locale. A staff member part-way through
    // German while someone else is part-way through English is an ordinary state, not a clash.
    expect(await readAll()).toHaveLength(4);
  });
});

describe("publishing", () => {
  test("promotes only the locale that was edited", async () => {
    // The assertion this file exists for.
    await member
      .from("prose")
      .insert([
        row("en", ENGLISH, "published"),
        row("de", GERMAN, "published"),
        row("de", `${GERMAN} edited`, "draft"),
      ]);

    const { error } = await member.rpc("publish_org_drafts");
    expect(error).toBeNull();

    const after = await readAll();

    // The German published row took the draft's value, and the draft is gone — case 1 of
    // docs/adr/0001, applied per locale.
    const german = after.filter((entry) => entry.locale === "de");
    expect(german).toHaveLength(1);
    expect(german[0]).toMatchObject({
      status: "published",
      value: `${GERMAN} edited`,
    });

    // English is untouched. Publishing a German edit must not republish, alter, or draft the
    // English sentence — that is what "the draft-then-publish path stays per-locale" means.
    const english = after.filter((entry) => entry.locale === "en");
    expect(english).toHaveLength(1);
    expect(english[0]).toMatchObject({ status: "published", value: ENGLISH });
  });

  test("ships EVERY language's pending draft, not only the one on screen", async () => {
    // The gap named in the header, asserted rather than described. Two languages in progress
    // and one press of Publish: both go live, because the sweep is scoped to the organization
    // and not to a locale.
    //
    // This is the failure #111 wanted to prevent — "a staff member editing German drafts must
    // not publish half-finished Italian" — and the machinery does not prevent it. Whether that
    // is fixed (a locale argument on publish_org_drafts) or accepted and made plain in the UI
    // is a decision above this file. Either way it must not be believed to already work, which
    // is what an absent test would have left everyone thinking.
    await member
      .from("prose")
      .insert([
        row("en", ENGLISH, "published"),
        row("de", GERMAN, "published"),
        row("en", `${ENGLISH} edited`, "draft"),
        row("de", `${GERMAN} edited`, "draft"),
      ]);

    await member.rpc("publish_org_drafts");

    const after = await readAll();
    expect(after).toHaveLength(2);
    expect(after.every((entry) => entry.status === "published")).toBe(true);
    expect(after.map((entry) => entry.value).sort()).toEqual(
      [`${ENGLISH} edited`, `${GERMAN} edited`].sort(),
    );
  });
});
