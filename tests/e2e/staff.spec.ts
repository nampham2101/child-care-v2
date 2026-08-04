import { test, expect } from "@playwright/test";

/**
 * `/staff`, loaded cold — the way a parent who has already decided the center looks
 * plausible arrives, usually from the nav after `/programs` rather than from a search.
 *
 * `context.clearCookies()` plus a fresh page means no warm cache and no locale cookie, so
 * the middleware redirect is exercised rather than skipped. The assertions cover the two
 * things this page exists to publish — every named role, and the tenure figures — because
 * those are what a parent checks against the center down the road, and a page that renders
 * the headings but drops the people has failed at its job while still looking fine.
 */
test.describe("staff page, cold load", () => {
  test("an unlocalized /staff lands a first-time visitor on /en/staff", async ({
    page,
    context,
  }) => {
    await context.clearCookies();

    await page.goto("/staff", { waitUntil: "load" });

    await expect(page).toHaveURL(/\/en\/staff$/);
  });

  test("names every role a parent would meet", async ({ page, context }) => {
    await context.clearCookies();

    await page.goto("/en/staff", { waitUntil: "load" });

    await expect(
      page.getByRole("heading", { level: 1, name: /know your child/i }),
    ).toBeVisible();

    // Every role on the team, not a sample. The list comes from `lib/staff.ts` and its
    // copy from the `Staff` namespace — a member added to one and not the other renders
    // a raw message key, which this catches. Roles rather than names, because the role is
    // what a parent is actually scanning for: who is in my child's room.
    const team = page.getByRole("region", { name: /who is here/i });
    for (const role of [
      "Director",
      "Assistant Director",
      "Lead Infant Teacher",
      "Infant Teacher",
      "Lead Toddler Teacher",
      "Lead Preschool Teacher",
      "Cook",
    ]) {
      await expect(team.getByText(role, { exact: true })).toBeVisible();
    }

    // Tenure is the number this page is built around, so the hero must publish it rather
    // than leave it to be counted from the cards. Derived from the join years in
    // `lib/staff.ts` against the current year — if that derivation breaks, the hero shows
    // "NaN years" and this fails.
    const hero = page.getByRole("region", { name: /know your child/i });
    await expect(hero.getByText(/^\d+ years$/).first()).toBeVisible();
    await expect(
      hero.getByText("Background-checked, CPR and first aid current", {
        exact: true,
      }),
    ).toBeVisible();

    // Turnover, answered rather than left for a parent to ask about on a tour.
    await expect(
      page.getByRole("heading", { name: /why people stay/i }),
    ).toBeVisible();

    // No form anywhere on this site by decision: the next step is a phone call, so the
    // tap-to-call link must be a real dialable link rather than text.
    const callLink = page.getByRole("link", { name: /call .*503/i }).first();
    await expect(callLink).toBeVisible();
    await expect(callLink).toHaveAttribute("href", "tel:+15035550142");

    // The shared visit card, same component as `/programs` and `/about`.
    const visit = page.getByRole("region", { name: /come and meet them/i });
    await expect(visit.getByText("Maria, the director")).toBeVisible();
  });

  test("the home page strip and this page agree on the same people", async ({
    page,
  }) => {
    // Both read `lib/staff.ts`, so this asserts the thing that sharing exists to
    // guarantee: the three the home page introduces are described identically here. A
    // tenure that drifts between the two pages is exactly the bug that list prevents.
    await page.goto("/en", { waitUntil: "load" });
    const strip = page.getByRole("region", { name: /know your child/i });
    const introduced = await strip.locator("figcaption").allInnerTexts();

    await page.goto("/en/staff", { waitUntil: "load" });
    const team = page.getByRole("region", { name: /who is here/i });

    for (const caption of introduced) {
      const [name, role, tenure] = caption.split("\n");
      const card = team.locator("figure").filter({ hasText: name });
      await expect(card).toHaveCount(1);
      await expect(card.getByText(role, { exact: true })).toBeVisible();
      await expect(card.getByText(tenure, { exact: true })).toBeVisible();
    }
  });

  test("the page title tells a searcher which page this is", async ({
    page,
  }) => {
    await page.goto("/en/staff", { waitUntil: "load" });

    // The layout's title template appends the center name to the page's own title.
    await expect(page).toHaveTitle(/^Staff · Willow Grove/);
  });
});
