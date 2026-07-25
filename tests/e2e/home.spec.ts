import { test, expect } from "@playwright/test";

/**
 * The home page, loaded the way every visitor actually arrives: a cold first-time load.
 *
 * `context.clearCookies()` plus a fresh page from Playwright's already-isolated context
 * means no warm cache and no logged-in state — the scenario a smoke test on a warm session
 * quietly skips. The assertions check real content that only renders if the page built and
 * prerendered correctly, so an empty or broken page fails here rather than passing green.
 */
test.describe("home page, cold load", () => {
  test("renders the real page for a first-time visitor on a phone", async ({
    page,
    context,
  }) => {
    await context.clearCookies();

    await page.goto("/", { waitUntil: "load" });

    // The hero promise — the page's reason to exist.
    await expect(
      page.getByRole("heading", { level: 1, name: /known by name/i }),
    ).toBeVisible();

    // The tap-to-call button must be a real tel: link, not text. It is the highest-
    // converting element on the page; if it regresses to plain text, conversion dies
    // silently. There is more than one call button, so assert the first is dialable.
    const callLink = page.getByRole("link", { name: /call .*503/i }).first();
    await expect(callLink).toBeVisible();
    await expect(callLink).toHaveAttribute("href", "tel:+15035550142");

    // Trust signals a parent compares — the published license number is deliberate. It
    // appears in the trust strip and again in the footer, so target the trust-strip cell
    // by its exact text rather than a substring that matches both.
    await expect(page.getByText("C-1094872", { exact: true })).toBeVisible();

    // Each section that does a distinct job for the parent actually rendered.
    await expect(
      page.getByRole("heading", { name: /programs by age/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /a day at willow grove/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /know your child/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /come see it for yourself/i }),
    ).toBeVisible();

    // Programs are sorted youngest-first — a parent arrives knowing only their child's age.
    const programNames = await page
      .getByRole("heading", { level: 3 })
      .allTextContents();
    expect(programNames).toEqual(["Infants", "Toddlers", "Preschool"]);
  });

  test("the page title tells a searcher what this is", async ({ page }) => {
    await page.goto("/", { waitUntil: "load" });
    await expect(page).toHaveTitle(/Willow Grove.*Portland/i);
  });
});
