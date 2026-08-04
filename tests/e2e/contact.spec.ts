import { test, expect } from "@playwright/test";

/**
 * `/contact`, loaded cold — the page a parent reaches at the moment they have decided to
 * act, usually from the nav rather than from a search.
 *
 * `context.clearCookies()` plus a fresh page means no warm cache and no locale cookie, so
 * the middleware redirect is exercised rather than skipped. The assertions cover the two
 * things this page exists to deliver: a phone link a phone can dial, and an address that
 * gets a parent to the door. A contact page that renders every paragraph but drops either
 * of those has failed at its only job while still looking fine.
 *
 * One case follows the nav link rather than typing the URL, because that is how a parent
 * on this site actually arrives here — and until this ticket the link 404'd. `nav.spec.ts`
 * deliberately stops at asserting the href; the no-404 assertion belongs with the page.
 */
test.describe("contact page, cold load", () => {
  test("an unlocalized /contact lands a first-time visitor on /en/contact", async ({
    page,
    context,
  }) => {
    await context.clearCookies();

    const response = await page.goto("/contact", { waitUntil: "load" });

    await expect(page).toHaveURL(/\/en\/contact$/);

    // The status, not just the URL: Next serves its not-found page with content on screen
    // and a 404 behind it, so a route that never got built would still look like a page.
    // Until this ticket, every nav link to `/contact` landed exactly there.
    expect(response?.status()).toBe(200);
  });

  test("the nav link reaches the page, the way a parent gets here", async ({
    page,
    context,
  }) => {
    await context.clearCookies();

    await page.goto("/en", { waitUntil: "load" });

    // Phone width, so the destinations sit behind the menu button. Clicking through is a
    // client-side navigation rather than a document request, which is why the status is
    // asserted on the cold load above and this case checks where the parent ends up.
    await page.getByRole("button", { name: "Open menu" }).click();
    await page
      .getByRole("navigation", { name: "Primary" })
      .getByRole("link", { name: "Contact", exact: true })
      .click();

    await expect(page).toHaveURL(/\/en\/contact$/);
    await expect(
      page.getByRole("heading", { level: 1, name: /call us/i }),
    ).toBeVisible();
  });

  test("publishes a dialable number and the address a parent needs", async ({
    page,
    context,
  }) => {
    await context.clearCookies();

    await page.goto("/en/contact", { waitUntil: "load" });

    await expect(
      page.getByRole("heading", { level: 1, name: /call us/i }),
    ).toBeVisible();

    // The tap-to-call link, in the hero rather than at the foot of the page: there is no
    // form on this site by decision, so this link is the entire conversion path. If it
    // regresses to plain text, the page still looks complete and converts nothing.
    const hero = page.getByRole("region", { name: /call us/i });
    const callLink = hero.getByRole("link", { name: /call .*503/i });
    await expect(callLink).toBeVisible();
    await expect(callLink).toHaveAttribute("href", "tel:+15035550142");

    // The address, in the hero's card rather than only in the footer every page carries —
    // a parent on this page should not have to scroll past three sections to find it.
    await expect(
      hero.getByText("428 Alder Street, Portland, OR 97210", { exact: true }),
    ).toBeVisible();
    await expect(
      hero.getByText("Mon–Fri, 7:00 AM – 6:00 PM", { exact: true }),
    ).toBeVisible();

    // Email is the slow second path, and only useful if it is tappable rather than typed
    // out by hand. The `.example` domain is reserved, so this can never reach a real inbox.
    const emailLink = hero.getByRole("link", {
      name: "hello@willowgrove.example",
    });
    await expect(emailLink).toBeVisible();
    await expect(emailLink).toHaveAttribute(
      "href",
      "mailto:hello@willowgrove.example",
    );

    // The two sections that do work the contact details alone do not: how to physically
    // get here, and what to say when someone answers.
    await expect(
      page.getByRole("heading", { name: /getting here/i }),
    ).toBeVisible();
    // Parking is the thing that goes wrong on a first drop-off, and it is a term in a
    // definition list rather than a heading — so match the text, not a role.
    await expect(page.getByText("Driving and parking")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: /what to call about/i }),
    ).toBeVisible();

    // The card beside the closing call to action is shared with `/about` and `/programs`,
    // so a regression here is a regression on every page that renders it.
    const visit = page.getByRole("region", { name: /part that decides it/i });
    await expect(visit.getByText("Maria, the director")).toBeVisible();
    await expect(visit.getByText("No appointment needed")).toBeVisible();
  });

  test("the page title tells a searcher which page this is", async ({
    page,
  }) => {
    await page.goto("/en/contact", { waitUntil: "load" });

    // The layout's title template appends the center name to the page's own title.
    await expect(page).toHaveTitle(/^Contact · Willow Grove/);
  });
});
