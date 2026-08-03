import { test, expect } from "@playwright/test";

/**
 * The shared primary navigation, checked on a cold first-time load — the same arrival the
 * home test models, because the nav is chrome every visitor sees before they click anything.
 *
 * Scope note for this milestone: the six destinations are not built yet (#18–23), so these
 * links 404 if followed. That is expected. The acceptance bar here is deliberately "the nav
 * is present and every href is the correct locale-prefixed path," not "the links resolve."
 * The no-404 assertion belongs with the tickets that add the pages, and returns then — a test
 * that clicked through now would fail on missing pages and tell us nothing about the nav.
 *
 * Why href strings and not clicks: next-intl adds the active locale prefix to each Link, so
 * an href authored as `/programs` must render as `/en/programs`. If that prefixing ever
 * regressed, the links would point at unlocalized paths that the middleware bounces — a real
 * bug this test catches without navigating.
 */
test.describe("primary nav, cold load", () => {
  // The canonical destinations, in the order the header renders them, each with the
  // locale-prefixed href it must expose. Kept beside the test so a new page ticket updates
  // one list here when it adds its route.
  const EXPECTED = [
    { name: "Programs", href: "/en/programs" },
    { name: "About", href: "/en/about" },
    { name: "Staff", href: "/en/staff" },
    { name: "Tuition", href: "/en/tuition" },
    { name: "FAQ", href: "/en/faq" },
    { name: "Contact", href: "/en/contact" },
  ];

  test("the primary nav renders on a first-time load", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.goto("/en", { waitUntil: "load" });

    await expect(
      page.getByRole("navigation", { name: "Primary" }),
    ).toBeVisible();
  });

  test("every nav link points at its locale-prefixed path", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.goto("/en", { waitUntil: "load" });

    const nav = page.getByRole("navigation", { name: "Primary" });

    for (const { name, href } of EXPECTED) {
      const link = nav.getByRole("link", { name, exact: true });
      await expect(link).toBeVisible();
      // The locale prefix is the whole point — assert the exact path, not a substring, so a
      // regression to an unlocalized `/programs` fails here.
      await expect(link).toHaveAttribute("href", href);
    }
  });
});
