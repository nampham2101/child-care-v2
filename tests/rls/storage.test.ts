/**
 * The Storage policies on the `spaces` bucket (#78).
 *
 * ## Why this suite exists separately from the table policies
 *
 * `media` is an ordinary content table and `authenticated.test.ts` already covers that shape.
 * **The bytes are not in that table.** They are objects in a bucket, governed by policies on
 * `storage.objects` — a different table, with a different tenancy expression, written against a
 * path string rather than a column.
 *
 * #78 names the hazard exactly: *an authenticated member of one organization must not be able to
 * write into another's prefix.* Nothing in the `media` policies prevents that, because the
 * `media` row and the object it points at are enforced independently. A member could hold a
 * perfectly legitimate row and still overwrite somebody else's photograph, if the object policy
 * were missing or wrong.
 *
 * ## The bucket is public, and that is not the same as writable
 *
 * Reads are open by design — the site is prerendered and a signed URL would expire, which the
 * migration explains at length. This suite is what makes "public" mean *readable*: every write
 * path is asserted to be refused unless the first path segment is the caller's own organization.
 *
 * Uploads here are a handful of bytes with a PNG signature, not real photographs. What is under
 * test is who may write where, and a 40-byte file exercises the policy exactly as a 4 MB one
 * would.
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
    "The storage suite needs NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and " +
      "SUPABASE_TEST_PASSWORD, for the same reasons authenticated.test.ts does. Skipping when " +
      "they are absent would turn a missing gate into a green run.",
  );
}

const BUCKET = "spaces";

/** Eight bytes that are a valid PNG signature. Enough to be a real object; not a photograph. */
const PIXEL = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

const member = createClient<Database>(PROJECT_URL, ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Signed out, and used both as the visitor under test and to confirm refusals independently. */
const visitor = createClient<Database>(PROJECT_URL, ANON_KEY);

let fixtureOrgId: string;
let willowGroveOrgId: string;

/** Everything this suite writes, removed in `afterAll` whatever happened. */
const written: string[] = [];

function scratchPath(orgId: string, suffix: string): string {
  return `${orgId}/rlsFixtureStorage-${suffix}-${Date.now()}.png`;
}

beforeAll(async () => {
  const { error } = await member.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  if (error) {
    throw new Error(
      `Could not sign in as ${TEST_EMAIL}: ${error.message}. This is setup missing, not a ` +
        "policy failure — see the header of supabase/fixtures/rls.sql.",
    );
  }

  ({ fixtureOrgId, willowGroveOrgId } = await requireFixtureSetup(
    member,
    visitor,
  ));
});

afterAll(async () => {
  // Only the member can delete these, and only its own — which is itself the policy working.
  for (const path of written) {
    await member.storage.from(BUCKET).remove([path]);
  }
  await member.auth.signOut();
});

describe("a member writes only into its own organization's folder", () => {
  test("uploading under its own organization id succeeds", async () => {
    const path = scratchPath(fixtureOrgId, "own");
    const { error } = await member.storage
      .from(BUCKET)
      .upload(path, PIXEL, { contentType: "image/png" });

    expect(error).toBeNull();
    written.push(path);
  });

  /**
   * The assertion this whole suite exists for.
   *
   * Willow Grove is the organization the public site renders. A member of the fixture
   * organization writing into that prefix would be putting bytes onto the live site — and
   * because the bucket is public, those bytes would be served to anyone who reached the URL.
   */
  test("uploading under another organization's id is refused", async () => {
    const path = scratchPath(willowGroveOrgId, "other-org");
    const { error } = await member.storage
      .from(BUCKET)
      .upload(path, PIXEL, { contentType: "image/png" });

    expect(error).not.toBeNull();

    // Confirmed against the bucket rather than against the member's own view of it: a refusal
    // that still wrote the object would be the worst possible pass.
    const { data } = await visitor.storage.from(BUCKET).download(path);
    expect(data).toBeNull();
  });

  test("uploading to the bucket root, outside any organization, is refused", async () => {
    const { error } = await member.storage
      .from(BUCKET)
      .upload(`rlsFixtureStorage-root-${Date.now()}.png`, PIXEL, {
        contentType: "image/png",
      });

    expect(error).not.toBeNull();
  });

  /*
   * A path segment that merely *starts with* the caller's organization id must not pass. The
   * policy compares the first folder for equality; a `like` or a prefix check would let
   * `<uuid>-evil/` through, and that is the classic way this kind of rule is written wrongly.
   */
  test("a folder that only begins with the organization id is refused", async () => {
    const { error } = await member.storage
      .from(BUCKET)
      .upload(`${fixtureOrgId}-evil/photo-${Date.now()}.png`, PIXEL, {
        contentType: "image/png",
      });

    expect(error).not.toBeNull();
  });
});

describe("a signed-out visitor", () => {
  test("can read a published photograph, because the bucket is public", async () => {
    const path = scratchPath(fixtureOrgId, "readable");
    const { error: uploadError } = await member.storage
      .from(BUCKET)
      .upload(path, PIXEL, { contentType: "image/png" });
    expect(uploadError).toBeNull();
    written.push(path);

    // Through the public URL, which is what the prerendered site and Netlify's Image CDN use.
    const { data } = visitor.storage.from(BUCKET).getPublicUrl(path);
    const response = await fetch(data.publicUrl);

    expect(response.ok).toBe(true);
  });

  test("cannot upload anything, anywhere", async () => {
    const { error } = await visitor.storage
      .from(BUCKET)
      .upload(`${fixtureOrgId}/anon-${Date.now()}.png`, PIXEL, {
        contentType: "image/png",
      });

    expect(error).not.toBeNull();
  });

  test("cannot delete an object that exists", async () => {
    const path = scratchPath(fixtureOrgId, "undeletable");
    await member.storage
      .from(BUCKET)
      .upload(path, PIXEL, { contentType: "image/png" });
    written.push(path);

    await visitor.storage.from(BUCKET).remove([path]);

    // `remove` reports success for objects the policy filtered out, so the refusal is confirmed
    // by the object still being there rather than by the call's own return value.
    const { data } = await visitor.storage.from(BUCKET).download(path);
    expect(data).not.toBeNull();
  });
});

describe("the bucket's own limits", () => {
  test("a type outside the allow-list is refused even by a member", async () => {
    const { error } = await member.storage
      .from(BUCKET)
      .upload(`${fixtureOrgId}/rlsFixtureStorage-${Date.now()}.svg`, PIXEL, {
        // The bucket's `allowed_mime_types` is the second gate; lib/admin/image.ts is the
        // first. This asserts the database half, so removing the application check could never
        // silently open the door.
        contentType: "image/svg+xml",
      });

    expect(error).not.toBeNull();
  });
});
