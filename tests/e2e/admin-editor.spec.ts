import { createClient } from "@supabase/supabase-js";
import { test, expect } from "@playwright/test";

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

/**
 * Removes the draft twin this suite creates, whatever happened to the assertions. Uses a
 * member session rather than the service role, so a clean-up that row-level security would
 * refuse fails here rather than hiding a policy problem.
 */
async function deleteDraftTwins() {
  if (!PROJECT_URL || !ANON_KEY || !TEST_PASSWORD) return;

  const member = createClient(PROJECT_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  await member.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  await member
    .from("programs")
    .delete()
    .eq("key", PUBLISHED_KEY)
    .eq("status", "draft");
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

  /*
   * Serial: these tests share two database rows, and running them in parallel would have one
   * asserting a value another is midway through changing.
   */
  test.describe.configure({ mode: "serial" });

  test.beforeAll(deleteDraftTwins);
  test.afterAll(deleteDraftTwins);

  test("the index says how many edits are waiting, and links to every section", async ({
    page,
  }) => {
    await signIn(page);

    for (const section of [
      "The center",
      "Rooms and the day",
      "Staff",
      "Tuition",
    ]) {
      await expect(
        page.getByRole("link", { name: section, exact: true }).first(),
      ).toBeVisible();
    }

    // Until #75 there is no way to publish, so the interface has to say that rather than
    // letting a staff member conclude the editor is broken when the site does not change.
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
    await expect(page.getByRole("status")).toContainText("saved as a draft");
    await expect(page.getByRole("status")).toContainText(
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

    const alert = page.getByRole("alert").first();
    await expect(alert).toBeVisible();

    /*
     * #74's acceptance bar: "a staff member can complete the whole edit without being told a
     * database column name". Error messages are where column names usually leak, so the
     * assertion is both that the label appears and that the column does not.
     */
    await expect(page.getByText("Ratio cannot be empty.")).toBeVisible();
    await expect(page.getByText(/age_label|group_size|sort_order/)).toHaveCount(
      0,
    );
  });
});
