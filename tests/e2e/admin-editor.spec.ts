import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";

import { formAlert, formStatus } from "./announcer";

/**
 * The editor, driven the way a staff member drives it: sign in, change a number, save, and
 * check that the public site did not move.
 *
 * ## What this covers that nothing else can
 *
 * `tests/rls/draft-twins.test.ts` proves the *schema* allows a draft beside its published twin.
 * `lib/admin/validation.test.ts` proves the rules refuse what the database would refuse. Neither
 * proves the application actually creates a draft when a person presses Save — which is the
 * whole of #74, and the one thing a mistake in `lib/admin/drafts.ts` would break silently while
 * every other suite stayed green.
 *
 * ## It edits the fixture organization, and cleans up after itself
 *
 * The signed-in account belongs to `rls-fixture`, so everything here happens to two rows whose
 * text reads "FIXTURE — must never be visible". Willow Grove's content is untouched — which is
 * also the assertion at the end.
 *
 * The clean-up is not optional. `tests/rls/authenticated.test.ts` asserts the fixture
 * organization holds exactly two program rows; a draft twin left behind by this suite would
 * make that a three-row scan and fail a suite that has nothing to do with the editor. So the
 * twin created here is deleted afterwards, through the same member session that made it.
 */
/**
 * **Every test in this file runs in order, on one worker.**
 *
 * `playwright.config.ts` sets `fullyParallel: true`, which parallelises across describe blocks
 * as well as across files. Every block here mutates the *same* fixture rows and each one calls
 * `restoreFixtureState` in its own `beforeAll` and `afterAll` — so run concurrently they reset
 * the database underneath each other, and the symptom is a test failing on a value some other
 * block had just restored.
 *
 * This was latent while there were two blocks and surfaced when #78 added a third: the facts
 * editor started failing on a signed-out page, nowhere near the code that changed. Configuring
 * it at file scope rather than per describe is what makes it stay fixed when a fourth is added.
 *
 * The cost is real — this file is the slowest in the suite and it no longer shares out — and it
 * is the price of one shared database. Per-test isolation would need a scratch organization per
 * worker, which is a bigger change than #78 should carry.
 */
test.describe.configure({ mode: "serial" });

const PROJECT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TEST_PASSWORD = process.env.SUPABASE_TEST_PASSWORD;
const TEST_EMAIL = "rls-fixture@example.com";

/** The fixture organization's published program. Editing it creates a draft twin. */
const PUBLISHED_KEY = "rlsFixturePublished";
const ORIGINAL_RATIO = "9:9";
const EDITED_RATIO = "1:2";

if (!TEST_PASSWORD && process.env.CI) {
  throw new Error(
    "SUPABASE_TEST_PASSWORD is not set. The editor suite signs in for real, and skipping it in " +
      "CI would report a green run for a gate that never executed.",
  );
}

/** The fixture organization's permanently-draft program. Other suites depend on its status. */
const DRAFT_KEY = "rlsFixtureDraft";

/**
 * The fixture organization's prose, added by #77 in `supabase/fixtures/rls.sql`.
 *
 * `PROSE_ROOM_LABEL` is the one that guards a regression rather than a feature: #76 emptied
 * `messages/en.json` while `lib/admin/labels.ts` was still reading it, so every heading in the
 * facts editor fell back to its raw database key. Asserting this text appears is asserting that
 * labels come from the database.
 */
const PROSE_NAMESPACE = "FaqPage";
const PROSE_KEY = "rlsFixtureAnswer";
const PROSE_FIELD_LABEL = "Rls fixture answer";
const ORIGINAL_ANSWER =
  "FIXTURE answer holding {count} — must never be visible";
const EDITED_ANSWER = "FIXTURE answer holding {count} — edited by the suite";
const PROSE_ROOM_LABEL = "FIXTURE room name — other org, not ours";

/**
 * Puts the fixture organization's two program rows back exactly as `supabase/fixtures/rls.sql`
 * leaves them, whatever happened to the assertions above.
 *
 * This is stronger than deleting what the suite created, and it has to be. The publish test
 * **promotes every pending draft**, which is the one operation here that changes rows this
 * suite did not create: `rlsFixtureDraft` becomes published, and `tests/rls/authenticated.test.ts`
 * asserts it is a draft. A clean-up that only removed twins would leave that suite red on the
 * next run, for a reason nowhere near the editor.
 *
 * Uses a member session rather than the service role, so a restore that row-level security
 * would refuse fails here instead of quietly hiding a policy problem.
 */
async function restoreFixtureState() {
  if (!PROJECT_URL || !ANON_KEY || !TEST_PASSWORD) return;

  const member = createClient(PROJECT_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await member.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  // Any twin created by editing, published or not.
  await member
    .from("programs")
    .delete()
    .eq("key", PUBLISHED_KEY)
    .eq("status", "draft");

  await member
    .from("programs")
    .update({ ratio: ORIGINAL_RATIO, status: "published" })
    .eq("key", PUBLISHED_KEY);

  // Promoted by a publish, or left alone. Either way it goes back to being a draft.
  await member
    .from("programs")
    .update({ status: "draft" })
    .eq("key", DRAFT_KEY);

  /*
   * Prose, restored on the same principle: remove any draft twin this suite created, then put
   * the published row back to its fixture wording. The publish test promotes every pending
   * draft, so an edited value can end up published rather than sitting as a twin — which is why
   * the update runs unconditionally rather than only when a draft was found.
   */
  await member
    .from("prose")
    .delete()
    .eq("key", PROSE_KEY)
    .eq("status", "draft");

  await member
    .from("prose")
    .update({ value: ORIGINAL_ANSWER, status: "published" })
    .eq("key", PROSE_KEY);

  /*
   * Photographs (#78). The suite uploads real objects into the bucket, so both halves are
   * cleared: the media rows, and the bytes they point at. Storage is not covered by
   * publish_org_drafts or by any other restore, so an object left behind here would accumulate
   * silently on every CI run.
   */
  const { data: strayMedia } = await member
    .from("media")
    .select("storage_path");

  if (strayMedia && strayMedia.length > 0) {
    await member.storage
      .from("spaces")
      .remove(strayMedia.map((row) => row.storage_path));
  }
  await member.from("media").delete().neq("key", "");

  await member.auth.signOut();
}

async function signIn(page: import("@playwright/test").Page) {
  await page.goto("/admin/sign-in", { waitUntil: "load" });
  await page.getByLabel("Email").fill(TEST_EMAIL);
  await page.getByLabel("Password").fill(TEST_PASSWORD!);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin$/);
}

test.describe("the facts editor", () => {
  test.skip(
    !TEST_PASSWORD,
    "Needs SUPABASE_TEST_PASSWORD. It is a GitHub secret and runs in CI.",
  );

  test.beforeAll(restoreFixtureState);
  test.afterAll(restoreFixtureState);

  test("the index says how many edits are waiting, and links to every section", async ({
    page,
  }) => {
    await signIn(page);

    for (const section of [
      "The center",
      "Rooms and the day",
      "Staff",
      "Tuition",
      "The words",
      "Photographs",
    ]) {
      await expect(
        page.getByRole("link", { name: section, exact: true }).first(),
      ).toBeVisible();
    }

    // The site is prerendered, so there is always a window where a staff member can look at it
    // and see the old value. The interface has to say so rather than let them conclude the
    // editor is broken.
    await expect(
      page.getByText(/not published|Nothing is waiting/),
    ).toBeVisible();
  });

  /**
   * A smoke test over all four sections, and it is here for an honest reason: this suite is the
   * only place the editor is ever rendered. The working copy that wrote it cannot sign in — the
   * fixture account's password is a CI secret — so without this, three of the four pages would
   * reach `main` having never been rendered by anything.
   *
   * The fixture organization has no settings, staff or rate rows of its own, so those pages
   * render their empty state. That is the point: it proves the page survives having nothing to
   * show, which is the branch most likely to throw and the one a seeded organization would
   * never exercise.
   */
  test("every section renders, including with nothing to show", async ({
    page,
  }) => {
    await signIn(page);

    const sections = [
      { path: "/admin/center", heading: /The center|no details to edit/ },
      { path: "/admin/programs", heading: /Rooms and the day/ },
      { path: "/admin/staff", heading: /Staff/ },
      { path: "/admin/tuition", heading: /Tuition/ },
    ];

    for (const { path, heading } of sections) {
      await page.goto(path, { waitUntil: "load" });
      await expect(page).toHaveURL(new RegExp(`${path}$`));
      await expect(page.getByText(heading).first()).toBeVisible();
    }
  });

  test("saving an edit writes a draft and says the site has not changed", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/admin/programs", { waitUntil: "load" });

    const ratio = page.getByLabel("Ratio").first();
    await expect(ratio).toBeVisible();

    // The fixture's published row is the one that starts with no draft, so saving it is what
    // exercises the copy-the-published-row-and-insert-a-draft path.
    const target = page.getByRole("textbox", { name: "Ratio" }).last();
    await target.fill(EDITED_RATIO);
    await page.getByRole("button", { name: "Save draft" }).click();

    /*
     * The message is the assertion, not just that a save happened. #74 and docs/PLAN.md both
     * require the interface never to imply an edit is live when it is not.
     */
    await expect(formStatus(page)).toContainText("saved as a draft");
    await expect(formStatus(page)).toContainText(
      "public site still shows the old version",
    );
  });

  test("the draft is what the editor shows on the next visit", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/admin/programs", { waitUntil: "load" });

    // Reading is draft-preferring: the edit made above is what a staff member sees now.
    await expect(
      page.getByRole("textbox", { name: "Ratio" }).last(),
    ).toHaveValue(EDITED_RATIO);

    // And the row admits that it is not live.
    await expect(page.getByText("Unpublished edit").first()).toBeVisible();
  });

  test("the published row is untouched, so a visitor still sees the old value", async () => {
    // Checked against the database with a signed-out client rather than through the editor,
    // which would report its own draft-preferring view either way. This is the guarantee the
    // whole draft mechanism exists for.
    const visitor = createClient(PROJECT_URL!, ANON_KEY!);
    const { data, error } = await visitor
      .from("programs")
      .select("ratio, status")
      .eq("key", PUBLISHED_KEY);

    expect(error).toBeNull();
    expect(data).toEqual([{ ratio: ORIGINAL_RATIO, status: "published" }]);
  });

  test("the public site is unaffected", async ({ page, context }) => {
    // Willow Grove's programs page, on a cold load. The fixture organization's rows are not
    // rendered here at all, and this is the check that editing one cannot change that.
    await context.clearCookies();
    await page.goto("/en/programs", { waitUntil: "load" });

    await expect(page.getByText(EDITED_RATIO)).toHaveCount(0);
    await expect(page.getByText("FIXTURE")).toHaveCount(0);
  });

  test("a value the database would refuse is refused with a readable sentence", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/admin/programs", { waitUntil: "load" });

    await page.getByRole("textbox", { name: "Ratio" }).last().fill("");
    await page.getByRole("button", { name: "Save draft" }).click();

    const alert = formAlert(page);
    await expect(alert).toBeVisible();

    /*
     * #74's acceptance bar: "a staff member can complete the whole edit without being told a
     * database column name". Error messages are where column names usually leak, so the
     * assertion is both that the label appears and that the column does not.
     */
    await expect(page.getByText("Ratio cannot be empty.")).toBeVisible();
    // `age_label` and `group_size` were in this list until #123 dropped the columns. Naming a
    // column that no longer exists would make the assertion pass for the wrong reason, so what
    // is left is what this form can actually leak.
    await expect(page.getByText(/ratio|sort_order/)).toHaveCount(0);
  });

  /**
   * Publishing (#75), and it runs LAST on purpose: it promotes every pending draft in the
   * fixture organization, which is the only operation in this file that changes rows the other
   * tests rely on. `restoreFixtureState` puts them back afterwards.
   *
   * **CI has no `GITHUB_PUBLISH_TOKEN`, deliberately** — a test run has no business rebuilding
   * production, and giving CI that credential would be the single most expensive mistake
   * available here. So this exercises the partial path, which is the more interesting one to
   * get right: the drafts *are* promoted, the rebuild is *not* started, and the message has to
   * say both without sending a staff member off to retype work that is already saved.
   *
   * The happy path's two halves are covered where they can be: `tests/rls/publish.test.ts`
   * proves the promotion, including that a signed-out visitor then reads the new value, and the
   * owner verifies the real rebuild on production once (see the pull request).
   */
  test("publishing promotes the drafts and is honest when the rebuild cannot start", async ({
    page,
  }) => {
    await signIn(page);

    // Make something to publish, so the button is not in its disabled state.
    await page.goto("/admin/programs", { waitUntil: "load" });
    await page.getByRole("textbox", { name: "Ratio" }).last().fill("1:3");
    await page.getByRole("button", { name: "Save draft" }).click();
    await expect(formStatus(page)).toContainText("saved as a draft");

    await page.goto("/admin", { waitUntil: "load" });

    // The count is on the control, which is what makes publishing a deliberate act over a batch
    // rather than an ambiguous button pressed once per edit.
    const publish = page.getByRole("button", { name: /^Publish \d+ change/ });
    await expect(publish).toBeEnabled();
    await publish.click();

    const result = formAlert(page);
    await expect(result).toBeVisible();
    // Published — so nothing was lost, and the message must not suggest otherwise.
    await expect(result).toContainText("published");
    await expect(result).toContainText("Nothing has been lost");
    // And honest that the site has not caught up.
    await expect(result).toContainText("rebuild could not be started");

    // Promotion really happened: there is nothing left pending.
    await page.reload({ waitUntil: "load" });
    await expect(
      page.getByRole("button", { name: "Nothing to publish" }),
    ).toBeDisabled();
  });
});

/**
 * The copy editor (#77), and the regression #76 left behind.
 *
 * Separate from the facts describe block because it touches a different table and needs its own
 * serial ordering, but it shares `restoreFixtureState` — the prose row it edits is put back by
 * the same helper, for the same cross-suite reason.
 */
test.describe("the copy editor", () => {
  test.skip(
    !TEST_PASSWORD,
    "Needs SUPABASE_TEST_PASSWORD. It is a GitHub secret and runs in CI.",
  );

  test.beforeAll(restoreFixtureState);
  test.afterAll(restoreFixtureState);

  /**
   * The assertion that should have existed before #76 and did not.
   *
   * `/admin/programs` heads each room with its name, looked up from the site's copy. When that
   * copy moved into the database and `lib/admin/labels.ts` kept reading the emptied JSON file,
   * every heading became a raw column value and the whole suite stayed green — because it only
   * ever asserted on fields.
   *
   * So: the readable name must be on the page, and the raw key must not be.
   */
  test("room headings show the name, not the database key", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/admin/programs", { waitUntil: "load" });

    await expect(page.getByText(PROSE_ROOM_LABEL)).toBeVisible();
    await expect(page.getByText(PUBLISHED_KEY, { exact: true })).toHaveCount(0);
  });

  test("the words index lists somewhere to go, with a count", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/admin/copy", { waitUntil: "load" });

    await expect(
      page.getByRole("link", { name: /FAQ page/ }).first(),
    ).toBeVisible();

    // The index groups by where the words appear. A namespace is a column name and must not
    // reach the screen — the same rule the facts editor follows for `key`.
    await expect(page.getByText(PROSE_NAMESPACE, { exact: true })).toHaveCount(
      0,
    );
  });

  /**
   * The whole of #77's acceptance bar: *a staff member can find and fix a typo on `/faq`
   * without help.* Navigated by clicking, not by URL, because "find" is half the requirement.
   */
  test("a typo can be found and fixed, and does not go live", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/admin/copy", { waitUntil: "load" });
    await page
      .getByRole("link", { name: /FAQ page/ })
      .first()
      .click();

    const field = page.getByLabel(PROSE_FIELD_LABEL);
    await expect(field).toHaveValue(ORIGINAL_ANSWER);

    await field.fill(EDITED_ANSWER);
    await page.getByRole("button", { name: "Save draft" }).click();

    // Saved as a draft, and the message has to say the site has not moved — `docs/PLAN.md` is
    // emphatic that this interface never implies a change is live when it is not.
    await expect(formStatus(page)).toContainText(/draft/i);
    await expect(formStatus(page)).toContainText(/still shows/i);

    await page.reload({ waitUntil: "load" });
    await expect(page.getByLabel(PROSE_FIELD_LABEL)).toHaveValue(EDITED_ANSWER);
    await expect(page.getByText("Unpublished edit").first()).toBeVisible();
  });

  /**
   * The placeholder guard, end to end.
   *
   * `lib/admin/validation.test.ts` proves the rule; this proves the form is actually wired to
   * it. The failure it prevents is the worst one this editor can produce: next-intl throws on a
   * message missing its placeholder, and since #76 that throw **fails the build** — so removing
   * a brace here would publish successfully and break the next deploy, minutes later, with
   * nothing connecting the two.
   */
  test("removing a placeholder is refused, and says which one", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/admin/copy/faq", { waitUntil: "load" });

    /*
     * Read the current value rather than assuming it. These tests are serial and share this
     * row, so the test above may have left a saved draft against it — comparing to the fixture
     * wording would be asserting that the *previous* test did nothing, which is not the
     * property under test here. What matters is that a refused save changes nothing, whatever
     * the field happened to hold when this test began.
     */
    const before = await page.getByLabel(PROSE_FIELD_LABEL).inputValue();
    expect(before).toContain("{count}");

    await page
      .getByLabel(PROSE_FIELD_LABEL)
      .fill("FIXTURE answer with the placeholder taken out");
    await page.getByRole("button", { name: "Save draft" }).click();

    await expect(formAlert(page)).toContainText(/needs fixing/i);
    await expect(page.getByText(/\{count\}/).first()).toBeVisible();

    // Refused means nothing was written.
    await page.reload({ waitUntil: "load" });
    await expect(page.getByLabel(PROSE_FIELD_LABEL)).toHaveValue(before);
  });

  /** An empty box is not how you delete a sentence — the page would render a gap. */
  test("emptying a field is refused", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/copy/faq", { waitUntil: "load" });

    await page.getByLabel(PROSE_FIELD_LABEL).fill("   ");
    await page.getByRole("button", { name: "Save draft" }).click();

    await expect(formAlert(page)).toContainText(/needs fixing/i);
    await expect(page.getByText(/cannot be empty/i).first()).toBeVisible();
  });

  /** A slug with no group is a 404, not a form with no fields. */
  test("an unknown group is not found", async ({ page }) => {
    await signIn(page);
    const response = await page.goto("/admin/copy/not-a-real-group", {
      waitUntil: "load",
    });

    expect(response?.status()).toBe(404);
  });
});

/**
 * Photographs of the spaces (#78).
 *
 * The first untrusted input this system accepts, so the case that matters most is the refusal:
 * `lib/admin/image.test.ts` proves the byte-sniffing in isolation, and this proves the upload
 * form is actually wired to it rather than trusting the browser's content type.
 *
 * Files are built in memory rather than committed as fixtures. A real photograph in the
 * repository would be a binary blob nobody can review in a diff, and what is under test is the
 * boundary — eight bytes of PNG signature exercise it exactly as a 4 MB photo would.
 */
test.describe("photographs of the spaces", () => {
  test.skip(
    !TEST_PASSWORD,
    "Needs SUPABASE_TEST_PASSWORD. It is a GitHub secret and runs in CI.",
  );

  test.beforeAll(restoreFixtureState);
  test.afterAll(restoreFixtureState);

  /**
   * A PNG signature, padded to a plausible file length.
   *
   * The padding is required, not cosmetic: `sniffImage` refuses anything under 12 bytes,
   * because WebP's format marker ends at byte 12 and a file too short to identify is not one to
   * guess at. A bare 8-byte signature is therefore correctly rejected — which cost a CI round
   * trip here, on a test whose own fixture was less realistic than the rule it was exercising.
   */
  const PNG_BYTES = Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    Buffer.alloc(56),
  ]);

  test("each room offers somewhere to put a picture, and says none is there yet", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/admin/photos", { waitUntil: "load" });

    await expect(page.getByText(/No photograph yet/).first()).toBeVisible();

    // The rule that keeps this feature free of any consent question belongs on the screen
    // where someone would otherwise break it, not only in docs/PLAN.md.
    await expect(
      page.getByText(/never of children or staff/i).first(),
    ).toBeVisible();
  });

  /**
   * A renamed file, which is the case #78 is written around: *a content-type header is a claim,
   * not a fact.* The browser will label this `image/png` because of its name; the bytes are a
   * PDF, and the server has to notice.
   */
  test("a file that only claims to be an image is refused", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/admin/photos", { waitUntil: "load" });

    await page
      .getByLabel(/Choose a photograph|Replace the photograph/)
      .first()
      .setInputFiles({
        name: "room.png",
        mimeType: "image/png",
        buffer: Buffer.from("%PDF-1.7 this is a document, not a room"),
      });

    // Filled in, so what this test proves is the byte check rather than the empty-description
    // rule. Both are reported together now, but a blank description here would leave it
    // ambiguous which rule actually fired.
    await page
      .getByLabel("Description of the photograph")
      .first()
      .fill("FIXTURE room, described");

    await page
      .getByRole("button", { name: /Upload|Save draft/ })
      .first()
      .click();

    // Under the file input, not as a page banner — the message is about that control.
    await expect(
      page.getByText(/not a JPEG, PNG or WebP/i).first(),
    ).toBeVisible();
    await expect(formAlert(page)).toContainText(/needs fixing/i);
  });

  test("a real image uploads, and stays out of the public site until publish", async ({
    page,
  }) => {
    await signIn(page);
    await page.goto("/admin/photos", { waitUntil: "load" });

    await page
      .getByLabel(/Choose a photograph|Replace the photograph/)
      .first()
      .setInputFiles({
        name: "room.png",
        mimeType: "image/png",
        buffer: PNG_BYTES,
      });

    await page
      .getByLabel("Description of the photograph")
      .first()
      .fill("FIXTURE room, uploaded by the suite");

    await page
      .getByRole("button", { name: /Upload|Save draft/ })
      .first()
      .click();

    /*
     * Matched against whichever message the form rendered — success OR failure — rather than
     * against `formStatus` alone. If the upload breaks, this fails printing the actual sentence
     * the admin showed; asserting only on the success locator fails with "element(s) not
     * found", which says nothing about why. That cost a CI round trip on this very test.
     */
    const message = page.locator("form [role='status'], form [role='alert']");

    // Saved as a draft, and the message says the site has not moved — the promise every other
    // editor page makes, kept here too.
    await expect(message).toContainText(/draft/i);
    await expect(message).toContainText(/still shows/i);

    await page.reload({ waitUntil: "load" });
    await expect(page.getByText("Unpublished edit").first()).toBeVisible();
  });

  /** An image needs a description, or it is invisible to a parent using a screen reader. */
  test("a photograph with no description is refused", async ({ page }) => {
    await signIn(page);
    await page.goto("/admin/photos", { waitUntil: "load" });

    await page.getByLabel("Description of the photograph").first().fill("   ");
    await page
      .getByRole("button", { name: /Upload|Save draft/ })
      .first()
      .click();

    await expect(formAlert(page)).toContainText(/needs fixing/i);
  });
});
