import { test, expect } from "@playwright/test";

/**
 * `/about`, loaded cold — the way a parent checking whether to believe a center actually
 * arrives, usually from a search for the center's name plus "license" or "reviews".
 *
 * `context.clearCookies()` plus a fresh page means no warm cache and no locale cookie, so
 * the middleware redirect is exercised rather than skipped. The assertions cover the two
 * things this page exists to publish — the license number and the ratios — because those
 * are what a parent checks against the center down the road, and a page that renders
 * everything except them has failed at its job while still looking fine.
 */
test.describe("about page, cold load", () => {
  test("an unlocalized /about lands a first-time visitor on /en/about", async ({
    page,
    context,
  }) => {
    await context.clearCookies();

    await page.goto("/about", { waitUntil: "load" });

    await expect(page).toHaveURL(/\/en\/about$/);
  });

  test("publishes the license and the ratios a parent came to check", async ({
    page,
    context,
  }) => {
    await context.clearCookies();

    await page.goto("/en/about", { waitUntil: "load" });

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /how we care for children/i,
      }),
    ).toBeVisible();

    // The license number, in the hero's evidence card rather than the footer that every
    // page carries: a parent checking a license should not have to scroll for it, so
    // assert it inside the hero band specifically. Exact, because the eyebrow and the
    // licensing prose also mention the year — only the fact cells hold these on their own.
    const hero = page.getByRole("region", {
      name: /how we care for children/i,
    });
    await expect(hero.getByText("C-1094872", { exact: true })).toBeVisible();
    await expect(hero.getByText("2009", { exact: true })).toBeVisible();
    await expect(
      hero.getByText("Unannounced, at least annually", { exact: true }),
    ).toBeVisible();

    // Every ratio and group size, read across one row per room. These come from
    // `lib/programs.ts`, shared with the home and programs pages — if that list is ever
    // edited so the pages disagree, this fails.
    const ratioRows = page.getByRole("row");
    for (const [room, ages, ratio, group] of [
      ["Infants", "6 weeks – 15 months", "1:4", "8 children"],
      ["Toddlers", "15 months – 3 years", "1:5", "10 children"],
      ["Preschool", "3 – 5 years", "1:9", "18 children"],
    ]) {
      const row = ratioRows.filter({ hasText: room });
      await expect(row).toHaveCount(1);
      for (const cell of [ages, ratio, group]) {
        await expect(row.getByRole("cell", { name: cell })).toBeVisible();
      }
    }

    // The three sections a parent weighs, beyond the numbers.
    await expect(
      page.getByRole("heading", { name: /what we believe/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /safety, on an ordinary day/i }),
    ).toBeVisible();

    // No form anywhere on this site by decision: the next step is a phone call, so the
    // tap-to-call link must be a real dialable link rather than text.
    const callLink = page.getByRole("link", { name: /call .*503/i }).first();
    await expect(callLink).toBeVisible();
    await expect(callLink).toHaveAttribute("href", "tel:+15035550142");

    // The card beside that button is the friction in front of the call — who to ask for
    // and whether it has to be arranged first. Shared with `/programs`, so a regression
    // here is a regression on both pages.
    const visit = page.getByRole("region", { name: /standing in the room/i });
    await expect(visit.getByText("Maria, the director")).toBeVisible();
    await expect(visit.getByText("No appointment needed")).toBeVisible();
  });

  test("the page title tells a searcher which page this is", async ({
    page,
  }) => {
    await page.goto("/en/about", { waitUntil: "load" });

    // The layout's title template appends the center name to the page's own title.
    await expect(page).toHaveTitle(/^About · Willow Grove/);
  });
});
