import { test, expect, type Page } from "@playwright/test";

/**
 * The German locale, loaded the way a visitor actually arrives — cold, on a phone, straight
 * onto a `/de` URL.
 *
 * #53 asks for exactly this rather than for a click-through from the English pages via the
 * switcher. A visitor who wants German mostly arrives from a search result already pointing at
 * `/de/...` (that is what the `hreflang` entries from #52 are for), and that path prerenders
 * the page from the database at build time. Driving it through the switcher instead would test
 * a client-side navigation and quietly skip the thing most likely to break: a `de` page that
 * never built.
 *
 * ## What this suite is really guarding
 *
 * **Not translation quality.** #53 settled that machine translation is sufficient here, and no
 * assertion in a test file can judge a German sentence anyway.
 *
 * **A missing row, and a broken one.** A `de` key with no row falls back to English mid-page,
 * and an ICU placeholder lost in translation throws during the build. The database-level
 * version of both lives in `tests/content/locale-parity.test.ts`, which is faster and names the
 * key. This is the other end of the same guarantee: that what parity proved about the rows is
 * actually what reaches a rendered page.
 *
 * **The layout, at 360px.** German runs 10–30% longer than English and its compounds do not
 * wrap, so the second half of this file is the width check #53 requires — on the four places
 * the ticket names, because those are where a long word meets a narrow box.
 */

/** Where German copy has to survive a narrow phone. Straight from #53's layout check. */
const NARROW = { width: 360, height: 780 };

/**
 * Nothing on the page may push the document wider than the viewport.
 *
 * This is the assertion that actually catches an unwrappable compound noun. A too-long word
 * does not clip quietly — it widens its container, which widens the document, and the whole
 * page starts scrolling sideways. One number therefore covers every element at once, including
 * the ones no selector here names.
 *
 * A 1px tolerance, because sub-pixel layout rounding can report 360.5 on a 360px viewport and
 * that is not a bug anyone can see.
 */
async function expectNoHorizontalOverflow(page: Page, where: string) {
  const overflow = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth,
    viewport: window.innerWidth,
  }));

  expect(
    overflow.document,
    `${where} scrolls sideways at ${NARROW.width}px — German copy has widened something past the viewport`,
  ).toBeLessThanOrEqual(overflow.viewport + 1);
}

test.describe("German pages, cold load", () => {
  test("a first-time visitor lands on a fully German home page", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.goto("/de", { waitUntil: "load" });

    // The locale reached the document, not just the URL. Screen readers and search engines
    // both read this, and it is set from the routing segment rather than guessed.
    await expect(page.locator("html")).toHaveAttribute("lang", "de");

    // The hero promise, in German. If the `de` catalogue were missing, next-intl would fall
    // back and this would render the English heading instead — so this one assertion is also
    // the "did the translation actually load" check.
    await expect(
      page.getByRole("heading", { level: 1, name: /beim Namen gekannt/i }),
    ).toBeVisible();

    /*
     * The #110 failure mode, asserted directly.
     *
     * `HomePage.heroEyebrow` is 'Lizenzierte Kinderbetreuung · Alter {ageRange}' and
     * `{ageRange}` is itself a prose row — `Center.ageRange`. Before #110 that value lived in
     * `site_settings` with no locale, so a German page would have rendered "Alter 6 weeks to
     * 5 years": an English clause inside a German sentence, which reads as a broken page
     * rather than an untranslated one. Seeing the German value here proves the interpolated
     * row resolved in the right locale.
     */
    await expect(page.getByText(/6 Wochen bis 5 Jahre/)).toBeVisible();

    // The switcher exists now that a second locale is routed. It renders nothing while
    // `routing.locales` holds one entry, so its presence is what proves `de` is really routed
    // rather than merely reachable.
    await expect(
      page.getByRole("button", { name: /Language — currently Deutsch/i }),
    ).toBeVisible();

    // The tap-to-call number is a fact, not copy: it must be identical in every locale, and
    // it is the highest-converting element on the page. The verb in front of it is copy, and
    // was an English literal in the component until this ticket.
    const callLink = page.getByRole("link", { name: /Anrufen .*503/ }).first();
    await expect(callLink).toHaveAttribute("href", "tel:+15035550142");

    /*
     * #53 asks for translated metadata, not only body copy, and it is the half nobody sees on
     * a Deploy Preview: the page looks perfectly German while the search result and the share
     * card are English. The home page inherited the root layout's static English title until
     * this ticket, so this asserts the fix rather than the framework.
     */
    await expect(page).toHaveTitle(
      /Lizenzierte Kinderbetreuung in NW Portland/,
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      /Kindertagesstätte in Northwest Portland/,
    );
  });

  /**
   * A fallback to English is invisible to every assertion above — the page still renders, it
   * just says one thing in the wrong language. So the absence is asserted explicitly, using
   * English strings distinctive enough that they cannot appear in correct German copy.
   *
   * Proper nouns are deliberately not in this list. "Willow Grove", "Northwest Portland" and
   * "Wallace Park" are the same in German and finding them proves nothing either way.
   */
  test("no English copy leaks into a German page", async ({
    page,
    context,
  }) => {
    await context.clearCookies();

    for (const path of ["/de", "/de/programs", "/de/about", "/de/tuition"]) {
      await page.goto(path, { waitUntil: "load" });
      const body = await page.locator("body").innerText();

      /*
       * The last three entries are the ones this suite actually earned. They were English
       * LITERALS in components rather than missing rows — 'Call' in the header button,
       * '17 years' and '7am–6pm' in the hero stats — so no amount of catalogue parity would
       * have caught them, and the German page rendered them in English while every database
       * check was green. They are prose rows now; these assertions are what keeps the next
       * hardcoded string from getting as far.
       *
       * `" years"` and `" children"` are the two #123 earned, and they are the reason
       * `/de/about` joined the loop above: the age ranges and group sizes render on three
       * pages, and the comparison table on the about page is the third. They were
       * `programs.age_label` and `programs.group_size` — English sentences in a facts table
       * with no locale — until that ticket moved them into `prose` as `Programs.<key>Ages`
       * and `Programs.<key>GroupSize`. This suite excluded them by name until then; the
       * exclusion is gone and the assertion now covers them.
       *
       * A leading space on both, deliberately. "children" appears inside German copy on these
       * pages as part of nothing, but "Kinder" is not what is being looked for — the failure
       * being caught is the English NUMBER-plus-noun pair, "8 children" and "3 years", so the
       * space is what keeps this from matching a substring of an unrelated word.
       */
      for (const english of [
        "known by name",
        "Plan a visit",
        "Monday to Friday",
        "Programs by age",
        "6 weeks to 5 years",
        "Call (",
        "7am",
        " years",
        " children",
      ]) {
        expect(
          body,
          `${path} still renders the English string "${english}" — a missing de row fell back`,
        ).not.toContain(english);
      }
    }
  });

  test("the layout holds at 360px in German", async ({ page, context }) => {
    await context.clearCookies();
    await page.setViewportSize(NARROW);

    // The four places #53 names, each on the page that renders it.
    await page.goto("/de", { waitUntil: "load" });
    await expectNoHorizontalOverflow(page, "the home page");

    // The hero eyebrow carries the longest interpolated German string on the site.
    const eyebrow = page.getByText(/Lizenzierte Kinderbetreuung/);
    await expect(eyebrow).toBeVisible();

    // The nav labels, which sit in a row once opened and are the first thing a long German
    // word overflows.
    await page.getByRole("button", { name: "Menü öffnen" }).click();
    for (const label of ["Programme", "Über uns", "Team", "Gebühren"]) {
      await expect(page.getByRole("link", { name: label })).toBeVisible();
    }
    await expectNoHorizontalOverflow(page, "the home page with the menu open");

    // The day timeline labels, in narrow cards beside a fixed-width time column.
    await page.goto("/de/programs", { waitUntil: "load" });
    await expect(page.getByText("Frühstück, dann Morgenkreis")).toBeVisible();
    await expectNoHorizontalOverflow(page, "the programs page");

    // The tuition table headers — a table is the one element that cannot shrink below its
    // widest cell, so it is where a German compound noun does the most damage.
    await page.goto("/de/tuition", { waitUntil: "load" });
    await expect(
      page.getByRole("columnheader", { name: "Gruppe" }).first(),
    ).toBeVisible();
    await expectNoHorizontalOverflow(page, "the tuition page");

    // The remaining pages, for the same reason at less risk.
    for (const path of ["/de/about", "/de/staff", "/de/faq", "/de/contact"]) {
      await page.goto(path, { waitUntil: "load" });
      await expectNoHorizontalOverflow(page, path);
    }
  });
});
