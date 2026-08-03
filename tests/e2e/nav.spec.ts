import { test, expect } from "@playwright/test";

/**
 * The shared primary navigation, checked on a cold first-time load — the same arrival the
 * home test models, because the nav is chrome every visitor sees before they click anything.
 *
 * The suite runs at phone width, where the six destinations sit behind a hamburger button.
 * So the phone cases drive the real path a parent takes: see the button, tap it, read the
 * menu. Asserting the links directly without opening the menu would test markup the visitor
 * cannot reach. A final case widens the viewport to confirm the inline row takes over.
 *
 * Scope note for this milestone: the destinations are not built yet (#18–23), so these links
 * 404 if followed. That is expected. The acceptance bar is "nav present and every href is the
 * correct locale-prefixed path," not "the links resolve" — the no-404 assertion belongs with
 * the tickets that add the pages.
 *
 * Why href strings and not clicks: next-intl adds the active locale prefix to each Link, so
 * an href authored as `/programs` must render as `/en/programs`. If that prefixing regressed,
 * the links would point at unlocalized paths the middleware bounces — a real bug this catches
 * without navigating.
 */

// The canonical destinations, in the order the header renders them, each with the
// locale-prefixed href it must expose. A new page ticket updates this one list.
const EXPECTED = [
  { name: "Programs", href: "/en/programs" },
  { name: "About", href: "/en/about" },
  { name: "Staff", href: "/en/staff" },
  { name: "Tuition", href: "/en/tuition" },
  { name: "FAQ", href: "/en/faq" },
  { name: "Contact", href: "/en/contact" },
];

test.describe("primary nav, cold load", () => {
  test("a phone visitor gets a menu button, not a cramped row", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.goto("/en", { waitUntil: "load" });

    await expect(
      page.getByRole("navigation", { name: "Primary" }),
    ).toBeVisible();

    // The control is labelled for screen readers and reports its own state, so the menu is
    // operable without sight of the animated bars.
    const toggle = page.getByRole("button", { name: "Open menu" });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-expanded", "false");

    // Closed means closed — a destination must not be reachable by tab before opening.
    await expect(page.getByRole("link", { name: "Programs" })).toBeHidden();
  });

  test("opening the menu reveals every destination, locale-prefixed", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.goto("/en", { waitUntil: "load" });

    await page.getByRole("button", { name: "Open menu" }).click();

    const nav = page.getByRole("navigation", { name: "Primary" });
    await expect(
      page.getByRole("button", { name: "Close menu" }),
    ).toHaveAttribute("aria-expanded", "true");

    for (const { name, href } of EXPECTED) {
      const link = nav.getByRole("link", { name, exact: true });
      await expect(link).toBeVisible();
      // The locale prefix is the whole point — assert the exact path, not a substring, so a
      // regression to an unlocalized `/programs` fails here.
      await expect(link).toHaveAttribute("href", href);
    }
  });

  test("escape closes the menu", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/en", { waitUntil: "load" });

    await page.getByRole("button", { name: "Open menu" }).click();
    await expect(page.getByRole("link", { name: "Programs" })).toBeVisible();

    await page.keyboard.press("Escape");

    await expect(page.getByRole("link", { name: "Programs" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Open menu" })).toBeVisible();
  });

  test("a wide screen shows the inline row instead of the menu button", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    // Above the `sm` breakpoint the six labels fit across the header, so the hamburger is
    // replaced by the inline row rather than duplicated alongside it.
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/en", { waitUntil: "load" });

    const nav = page.getByRole("navigation", { name: "Primary" });

    for (const { name, href } of EXPECTED) {
      const link = nav.getByRole("link", { name, exact: true });
      await expect(link).toBeVisible();
      await expect(link).toHaveAttribute("href", href);
    }

    await expect(page.getByRole("button", { name: "Open menu" })).toBeHidden();
  });
});
