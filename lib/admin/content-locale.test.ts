/**
 * The rules that decide which language's words the editor is pointed at — issue #111.
 *
 * Two of these assertions are about **security**, not tidiness. The locale arrives from a query
 * string and from a form field, and both are attacker-controlled: `resolveContentLocale` is the
 * only thing standing between a typed URL and a query for rows in a language the site does not
 * ship. The rest are about the failure #111 names as the one that matters — a staff member
 * carefully rewriting a paragraph in the wrong language and publishing it.
 */
import { describe, expect, it } from "vitest";

import {
  CONTENT_LOCALES,
  contentLocaleName,
  DEFAULT_CONTENT_LOCALE,
  isLocaleSwitchable,
  localeHref,
  resolveContentLocale,
} from "@/lib/admin/content-locale";
import { routing } from "@/i18n/routing";

describe("what the editor may be pointed at", () => {
  it("offers exactly the locales the site routes, and no separate list", () => {
    // The whole point of deriving from `routing`: #52 adds a locale in one place and the public
    // switcher, the hreflang tags, the sitemap and this control all learn about it together. A
    // hand-kept list here would be the one that goes stale.
    expect([...CONTENT_LOCALES]).toEqual([...routing.locales]);
    expect(DEFAULT_CONTENT_LOCALE).toBe(routing.defaultLocale);
  });

  it("offers the control only when there is more than one locale to choose", () => {
    // Derived from the routing rather than asserted as a constant, which is why this survived
    // #53 unchanged: it read "renders no control while one locale is shipped" and was true of
    // a one-locale site, and it is now true of a two-locale one for the same reason. A picker
    // with one option implies a choice that is not there.
    expect(isLocaleSwitchable()).toBe(routing.locales.length > 1);
  });
});

describe("resolveContentLocale", () => {
  it("accepts a locale the site actually routes", () => {
    expect(resolveContentLocale(DEFAULT_CONTENT_LOCALE)).toBe(
      DEFAULT_CONTENT_LOCALE,
    );
  });

  it("refuses a locale the site does not ship", () => {
    // The security case. Without this, `?locale=fr` would reach `getEditableProse` and then
    // `saveDraft`, and a staff member could read and write rows for a language nothing renders
    // — content that no page would ever show and no test would ever check.
    //
    // This example was `"de"` until #53 shipped the German catalogue, at which point the
    // assertion started failing for the right reason: `de` is routed now, so resolving it is
    // correct rather than a refusal. `fr` is the stand-in because it is a well-formed tag the
    // site does not route — deliberately not gibberish, since the case worth guarding is a
    // plausible locale, not a malformed one.
    expect(resolveContentLocale("fr")).toBe(DEFAULT_CONTENT_LOCALE);
    expect(resolveContentLocale("../../etc/passwd")).toBe(
      DEFAULT_CONTENT_LOCALE,
    );
    expect(resolveContentLocale("en; drop table prose")).toBe(
      DEFAULT_CONTENT_LOCALE,
    );
  });

  it("falls back rather than throwing on anything that is not a string", () => {
    // `searchParams` and `FormData.get` can both hand over something that is not a string —
    // `?locale=a&locale=b`, or a file part. A view preference is not worth an error page.
    for (const value of [undefined, null, 42, [], {}, ["en", "de"]]) {
      expect(resolveContentLocale(value)).toBe(DEFAULT_CONTENT_LOCALE);
    }
  });
});

describe("localeHref", () => {
  it("leaves the default locale's URL clean", () => {
    // Every bookmark a staff member already has keeps working, and the single-locale site never
    // grows a query string it has no use for.
    expect(localeHref("/admin/copy", DEFAULT_CONTENT_LOCALE)).toBe(
      "/admin/copy",
    );
    expect(localeHref("/admin/copy/faq", DEFAULT_CONTENT_LOCALE)).toBe(
      "/admin/copy/faq",
    );
  });

  it("carries a non-default locale as a parameter, not a path segment", () => {
    // A path segment would be a locale prefix on an admin URL, which `app/admin/layout.tsx`
    // rules out — it would put the locale middleware in front of an authenticated area and
    // imply a translated admin that nothing intends to build.
    expect(localeHref("/admin/copy/faq", "de")).toBe(
      "/admin/copy/faq?locale=de",
    );
    expect(localeHref("/admin/copy/faq", "de")).not.toContain("/de/");
  });

  it("encodes the value it puts in the URL", () => {
    expect(localeHref("/admin/copy", "pt BR")).toBe(
      "/admin/copy?locale=pt%20BR",
    );
  });
});

describe("contentLocaleName", () => {
  it("names a locale in English, because the admin chrome is English", () => {
    // "Deutsch" here would be the first step toward a half-translated interface, which
    // `lib/admin/nav.ts` rules out. The admin says "German".
    expect(contentLocaleName("de")).toBe("German");
    expect(contentLocaleName("it")).toBe("Italian");
    expect(contentLocaleName("en")).toBe("English");
  });

  it("never returns an empty label, whatever it is handed", () => {
    // A blank option is worse than an ugly one — it would be an unlabelled control. An
    // unrecognised but well-formed tag gets a synthesised name from Intl ("zz (NONSENSE)"),
    // which is odd-looking and perfectly usable.
    expect(contentLocaleName("zz-nonsense")).not.toBe("");
  });

  it("does not throw on a malformed tag", () => {
    // `Intl.DisplayNames.of` raises a RangeError rather than returning undefined for a tag it
    // cannot parse. Unreachable through the resolver, but one bad entry in `routing.locales`
    // should not take the copy editor down with a stack trace.
    expect(() => contentLocaleName("pt BR")).not.toThrow();
    expect(contentLocaleName("pt BR")).toBe("pt BR");
  });
});
