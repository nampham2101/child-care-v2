import { test, expect } from "@playwright/test";

/**
 * `/tuition`, loaded cold — the page a parent opens early, often before they have read a
 * word about the rooms, because cost decides whether the rest is worth their evening.
 *
 * `context.clearCookies()` plus a fresh page means no warm cache and no locale cookie, so
 * the middleware redirect is exercised rather than skipped. The assertions read every rate
 * in the table rather than sampling one: this page's entire claim is that the numbers are
 * published, and a table that renders eight of nine cells looks complete while quietly
 * hiding the one a particular parent came for.
 */

// Every cell of the published rate sheet, room by room, in the column order the table
// renders: five days, three days, two days. These come from `lib/tuition.ts` — if a rate
// is edited there, this is the test that says so.
const RATE_ROWS = [
  { room: "Infants", rates: ["$2,140", "$1,490", "$1,075"] },
  { room: "Toddlers", rates: ["$1,840", "$1,285", "$925"] },
  { room: "Preschool", rates: ["$1,565", "$1,095", "$790"] },
];

test.describe("tuition page, cold load", () => {
  test("an unlocalized /tuition lands a first-time visitor on /en/tuition", async ({
    page,
    context,
  }) => {
    await context.clearCookies();

    const response = await page.goto("/tuition", { waitUntil: "load" });

    await expect(page).toHaveURL(/\/en\/tuition$/);

    // The status, not just the URL: Next serves its not-found page with content on screen
    // and a 404 behind it, so a route that never got built would still look like a page.
    expect(response?.status()).toBe(200);
  });

  test("publishes every rate, room by room", async ({ page, context }) => {
    await context.clearCookies();

    await page.goto("/en/tuition", { waitUntil: "load" });

    await expect(
      page.getByRole("heading", { level: 1, name: /what a place here costs/i }),
    ).toBeVisible();

    // Read across one row per room. A row that renders its name but drops a price is the
    // failure this page cannot afford, so every cell is asserted rather than the row's
    // presence.
    const rows = page.getByRole("row");
    for (const { room, rates } of RATE_ROWS) {
      const row = rows.filter({ hasText: room });
      await expect(row).toHaveCount(1);
      for (const rate of rates) {
        await expect(row.getByRole("cell", { name: rate })).toBeVisible();
      }
    }

    // Rooms are youngest-first, the same order as `/programs` and the home page — a parent
    // arrives knowing their child's age and nothing else.
    const roomNames = await page
      .getByRole("rowheader")
      .allTextContents()
      .then((names) => names.map((name) => name.trim()));
    expect(roomNames).toEqual(["Infants", "Toddlers", "Preschool"]);
  });

  test("the fees that are not the monthly rate are on the page, not in a contract", async ({
    page,
    context,
  }) => {
    await context.clearCookies();

    await page.goto("/en/tuition", { waitUntil: "load" });

    // Registration, deposit, and notice sit in the hero's card rather than a footnote.
    // These are what a parent is charged beyond the table, and the page's argument is
    // that they are visible before the call rather than at signing.
    const hero = page.getByRole("region", { name: /what a place here costs/i });
    await expect(hero.getByText("$75, once, at enrolment")).toBeVisible();
    await expect(
      hero.getByText("2 weeks, refundable when you leave"),
    ).toBeVisible();
    await expect(hero.getByText("4 weeks, in writing")).toBeVisible();

    // The late pickup charge and the sibling discount are interpolated from
    // `lib/tuition.ts`, so a change to either figure surfaces here.
    await expect(page.getByText(/\$2 a minute after six/)).toBeVisible();
    await expect(
      page.getByText(/10% off the younger child's rate/),
    ).toBeVisible();

    await expect(
      page.getByRole("heading", { name: /schedule options/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /usually leaves out/i }),
    ).toBeVisible();
  });

  test("the page title tells a searcher which page this is", async ({
    page,
  }) => {
    await page.goto("/en/tuition", { waitUntil: "load" });

    // The layout's title template appends the center name to the page's own title.
    await expect(page).toHaveTitle(/^Tuition · Willow Grove/);
  });
});
