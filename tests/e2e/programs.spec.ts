import { test, expect } from "@playwright/test";

/**
 * `/programs`, loaded cold — the way a parent actually arrives, often straight from a
 * search result rather than by clicking through the home page.
 *
 * `context.clearCookies()` plus a fresh page means no warm cache and no locale cookie, so
 * the middleware redirect is exercised rather than skipped. The assertions check content
 * that only renders if the page prerendered correctly, so a broken build fails here
 * instead of passing green.
 */
test.describe("programs page, cold load", () => {
  test("an unlocalized /programs lands a first-time visitor on /en/programs", async ({
    page,
    context,
  }) => {
    await context.clearCookies();

    await page.goto("/programs", { waitUntil: "load" });

    await expect(page).toHaveURL(/\/en\/programs$/);
  });

  test("renders the three rooms youngest-first for a parent on a phone", async ({
    page,
    context,
  }) => {
    await context.clearCookies();

    await page.goto("/en/programs", { waitUntil: "load" });

    await expect(
      page.getByRole("heading", { level: 1, name: /programs by age/i }),
    ).toBeVisible();

    // The ordering requirement: a parent arrives knowing only their child's age, so the
    // youngest band must come first. The three rooms are the page's first three level-2
    // headings — anything inserted above them would push the infant room down the page,
    // which is exactly the regression this asserts against.
    const sectionHeadings = await page
      .getByRole("heading", { level: 2 })
      .allTextContents();
    expect(sectionHeadings.slice(0, 3)).toEqual([
      "Infants",
      "Toddlers",
      "Preschool",
    ]);

    // The two numbers a parent writes down when comparing centers. They come from
    // `lib/programs.ts`, shared with the home page — if that list is ever edited to
    // disagree with itself, this fails.
    await expect(page.getByText("1:4", { exact: true })).toBeVisible();
    await expect(page.getByText("8 children", { exact: true })).toBeVisible();

    // The day's rhythm renders, including the last entry — a truncated list would
    // otherwise pass on the first row alone.
    await expect(page.getByText("Arrival and free play")).toBeVisible();
    await expect(page.getByText("Outdoor play until pickup")).toBeVisible();

    // No form anywhere on this site by decision: the next step is a phone call, so the
    // tap-to-call link must be a real dialable link rather than text.
    const callLink = page.getByRole("link", { name: /call .*503/i }).first();
    await expect(callLink).toBeVisible();
    await expect(callLink).toHaveAttribute("href", "tel:+15035550142");
  });

  test("the page title tells a searcher which page this is", async ({
    page,
  }) => {
    await page.goto("/en/programs", { waitUntil: "load" });

    // The layout's title template appends the center name to the page's own title.
    await expect(page).toHaveTitle(/^Programs · Willow Grove/);
  });
});
