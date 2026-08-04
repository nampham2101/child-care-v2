import { test, expect } from "@playwright/test";

/**
 * `/faq`, loaded cold — usually the last page a parent reads before calling, and often the
 * one they arrive on from a search for a specific worry.
 *
 * `context.clearCookies()` plus a fresh page means no warm cache and no locale cookie, so
 * the middleware redirect is exercised rather than skipped.
 *
 * The disclosure is native `<details>`/`<summary>` with no client JavaScript, so these
 * cases check the two things that actually matter about that choice: every answer is in
 * the DOM whether or not it has been opened (a parent using find-in-page, and a search
 * engine, both depend on it), and the control is genuinely operable — opened by keyboard,
 * not only by mouse.
 */

// One question from each topic group, with the phrase its answer must contain. The
// awkward group is represented on purpose: a center that quietly drops the biting and
// complaints questions has turned this page back into a brochure, and that regression
// would otherwise look like a passing page with four fewer entries.
const SAMPLED = [
  {
    question: "How does the waiting list work?",
    answer: /by room and by date/i,
  },
  { question: "What do we need to bring?", answer: /change of clothes/i },
  { question: "Is there screen time?", answer: /no screens in any room/i },
  {
    question: "How do we complain about you?",
    answer: /state licensing office/i,
  },
];

test.describe("faq page, cold load", () => {
  test("an unlocalized /faq lands a first-time visitor on /en/faq", async ({
    page,
    context,
  }) => {
    await context.clearCookies();

    const response = await page.goto("/faq", { waitUntil: "load" });

    await expect(page).toHaveURL(/\/en\/faq$/);

    // The status, not just the URL: Next serves its not-found page with content on screen
    // and a 404 behind it, so a route that never got built would still look like a page.
    expect(response?.status()).toBe(200);
  });

  test("every question is a real disclosure, and its answer is in the page unopened", async ({
    page,
    context,
  }) => {
    await context.clearCookies();

    await page.goto("/en/faq", { waitUntil: "load" });

    await expect(
      page.getByRole("heading", {
        level: 1,
        name: /questions parents actually ask/i,
      }),
    ).toBeVisible();

    // Sixteen questions, each its own disclosure. The count is asserted so a topic group
    // silently dropped from the page fails here rather than looking like a shorter list.
    const entries = page.locator("details");
    await expect(entries).toHaveCount(16);

    // Nothing is open on arrival — the page's argument for a disclosure list is that a
    // parent can scan the questions first.
    await expect(page.locator("details[open]")).toHaveCount(0);

    for (const { question, answer } of SAMPLED) {
      const entry = page.locator("details").filter({ hasText: question });
      await expect(entry).toHaveCount(1);

      // The question is a heading as well as a summary, so it appears in the outline a
      // screen-reader user navigates by rather than only as a clickable row.
      await expect(
        entry.getByRole("heading", { name: question }),
      ).toBeVisible();

      // The answer is present in the DOM while collapsed. This is what makes
      // find-in-page and search indexing work, and it is the thing a JavaScript
      // accordion would quietly break.
      await expect(entry).toContainText(answer);
    }
  });

  test("a question opens from the keyboard, not only the mouse", async ({
    page,
    context,
  }) => {
    await context.clearCookies();

    await page.goto("/en/faq", { waitUntil: "load" });

    const entry = page
      .locator("details")
      .filter({ hasText: "How does the waiting list work?" });
    const summary = entry.locator("summary");

    // The real path for a parent who does not use a mouse: focus the control and press
    // Enter. A div-and-onClick accordion would fail this while looking identical.
    await summary.focus();
    await page.keyboard.press("Enter");

    await expect(entry).toHaveAttribute("open", "");
    await expect(entry.getByText(/by room and by date/i)).toBeVisible();
  });

  test("the page title tells a searcher which page this is", async ({
    page,
  }) => {
    await page.goto("/en/faq", { waitUntil: "load" });

    // The layout's title template appends the center name to the page's own title.
    await expect(page).toHaveTitle(/^FAQ · Willow Grove/);
  });
});
