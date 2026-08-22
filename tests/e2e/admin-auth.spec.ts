import { test, expect } from "@playwright/test";

import { formAlert } from "./announcer";

/**
 * Staff sign-in, on a cold first-time load — no cookies, no warm cache, which is how anyone
 * actually arrives at a sign-in page.
 *
 * Two halves, and they need different things to run:
 *
 *   - THE LOCKED DOOR. That an unauthenticated request never reaches admin content. Needs no
 *     credential, runs everywhere, and is the half that matters most: it is the assertion a
 *     Deploy Preview cannot make for you, because a preview shows what a *permitted* user
 *     sees rather than what an unauthorised one can reach.
 *   - THE ROUND TRIP. Sign in, land, refresh, sign out. Needs the real password of
 *     `rls-fixture@example.com`, which is a GitHub secret and is deliberately not in most
 *     working copies.
 *
 * The second half runs in CI, where the secret exists, and is skipped locally rather than
 * failing. `docs/CONVENTIONS.md` warns that skipping turns a missing gate into a green run —
 * so the skip is conditional on *not* being in CI, and CI throws instead of skipping. The
 * gate stays real exactly where merges are gated.
 */
const TEST_EMAIL = "rls-fixture@example.com";
const TEST_PASSWORD = process.env.SUPABASE_TEST_PASSWORD;

/**
 * The marker for "admin content rendered": the sign-out control.
 *
 * **It is deliberately a thing in the protected *layout*, not on a page.** This started out as
 * the admin home's heading and broke the moment #74 replaced that page — which is the failure
 * mode to design against, because the locked-door cases below assert this marker is *hidden*
 * and a locator matching nothing is always hidden. A page-level marker would therefore go
 * quietly vacuous every time a page is redesigned, and those cases would keep passing while
 * testing nothing.
 *
 * Two properties make the layout the right place. It cannot render for an unauthenticated
 * request, because the layout is what turns one away. And it survives #75, #77 and #78
 * rewriting everything inside it.
 *
 * The same locator is asserted visible when signed in and hidden when not, so neither half can
 * go vacuous without the other failing — which is what caught this.
 */
function adminShellMarker(page: import("@playwright/test").Page) {
  return page.getByRole("button", { name: "Sign out" });
}

if (!TEST_PASSWORD && process.env.CI) {
  throw new Error(
    "SUPABASE_TEST_PASSWORD is not set. In CI it is a repository secret and the signed-in " +
      "half of the admin suite cannot run without it — silently skipping here would report a " +
      "green run for a gate that never executed. See supabase/fixtures/rls.sql.",
  );
}

test.describe("the admin area is locked", () => {
  test("an unauthenticated visitor is sent to sign in, not to content", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.goto("/admin", { waitUntil: "load" });

    await expect(page).toHaveURL(/\/admin\/sign-in/);

    // The destination is preserved, so signing in resumes rather than dumping everyone home.
    expect(new URL(page.url()).searchParams.get("next")).toBe("/admin");

    // The assertion that matters: no admin content was rendered on the way past.
    await expect(adminShellMarker(page)).toBeHidden();
    await expect(page.getByText(TEST_EMAIL)).toBeHidden();
  });

  /**
   * The guard is a path prefix, not a list of routes. A page that does not exist yet must
   * still be behind it — otherwise every ticket that adds an admin page has to remember to
   * protect it, and one of them eventually will not.
   */
  test("a deeper admin path that does not exist yet is still guarded", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.goto("/admin/facts/programs", { waitUntil: "load" });

    await expect(page).toHaveURL(/\/admin\/sign-in/);
    expect(new URL(page.url()).searchParams.get("next")).toBe(
      "/admin/facts/programs",
    );
  });

  test("the sign-in page offers no way to create an account", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.goto("/admin/sign-in", { waitUntil: "load" });

    await expect(page.getByLabel("Email")).toBeVisible();
    await expect(page.getByLabel("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();

    /*
     * Self-service signup is off in the Supabase dashboard — that setting is the control,
     * not this assertion. This catches the other half: a link or button added here later
     * that implies an account can be created, which would send a stranger down a path that
     * dead-ends in an error.
     */
    await expect(
      page.getByRole("link", { name: /sign up|create an account|register/i }),
    ).toHaveCount(0);
    await expect(
      page.getByRole("button", { name: /sign up|create an account|register/i }),
    ).toHaveCount(0);
  });

  test("wrong credentials say so without revealing whether the account exists", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.goto("/admin/sign-in", { waitUntil: "load" });

    await page.getByLabel("Email").fill("nobody@example.com");
    await page.getByLabel("Password").fill("not-the-password");
    await page.getByRole("button", { name: "Sign in" }).click();

    const alert = formAlert(page);
    /*
     * A longer wait than the default, because this one assertion sits behind a real network
     * round trip: the server action calls Supabase's auth server, which is deliberate — a
     * stubbed sign-in would prove nothing about the failure message a person actually sees.
     * It flaked at 5 seconds on an otherwise green run, which is a slow dependency rather than
     * a broken assertion, so the wait is widened instead of the test being weakened.
     */
    await expect(alert).toBeVisible({ timeout: 15_000 });
    /*
     * One message for every failure. Distinguishing "no such account" from "wrong password"
     * would make this form an oracle for which email addresses have accounts here — at a
     * child care center, a list of who works with the children.
     */
    await expect(alert).toHaveText(
      "That email and password did not match an account.",
    );
    await expect(page).toHaveURL(/\/admin\/sign-in/);
  });

  /**
   * The public site must be untouched by any of this. The admin sits outside the locale tree
   * and the middleware branches before either half runs, so a regression that sent `/` down
   * the auth path would show up here.
   */
  test("the public site still redirects to its locale and needs no session", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.goto("/", { waitUntil: "load" });

    await expect(page).toHaveURL(/\/en$/);
    await expect(
      page.getByRole("navigation", { name: "Primary" }),
    ).toBeVisible();
  });
});

test.describe("a staff member can get in and out", () => {
  test.skip(
    !TEST_PASSWORD,
    "Needs SUPABASE_TEST_PASSWORD. It is a GitHub secret and runs in CI; see the note at the top of this file.",
  );

  test("sign in, land on admin, survive a refresh, sign out", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.goto("/admin", { waitUntil: "load" });
    await expect(page).toHaveURL(/\/admin\/sign-in/);

    await page.getByLabel("Email").fill(TEST_EMAIL);
    await page.getByLabel("Password").fill(TEST_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();

    // Landed inside, on the destination the `next` parameter carried.
    await expect(page).toHaveURL(/\/admin$/);
    await expect(adminShellMarker(page)).toBeVisible();
    await expect(page.getByText(TEST_EMAIL)).toBeVisible();

    /*
     * The refresh is the point of the cookie-based session, and the thing a token held in
     * memory would fail. A staff member who reloads mid-edit must not be thrown out.
     */
    await page.reload({ waitUntil: "load" });
    await expect(page).toHaveURL(/\/admin$/);
    await expect(adminShellMarker(page)).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/admin\/sign-in/);

    // And out means out — going back to the admin does not resurrect the session.
    await page.goto("/admin", { waitUntil: "load" });
    await expect(page).toHaveURL(/\/admin\/sign-in/);
    await expect(adminShellMarker(page)).toBeHidden();
  });

  /**
   * The open-redirect case, end to end. `lib/admin-paths.test.ts` proves the function
   * rejects an off-site destination; this proves the running application actually uses it,
   * which is the half a unit test cannot claim.
   */
  test("a hostile ?next= does not send a signed-in staff member off-site", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.goto("/admin/sign-in?next=https://example.com/", {
      waitUntil: "load",
    });

    await page.getByLabel("Email").fill(TEST_EMAIL);
    await page.getByLabel("Password").fill(TEST_PASSWORD!);
    await page.getByRole("button", { name: "Sign in" }).click();

    await expect(page).toHaveURL(/\/admin$/);
  });
});
