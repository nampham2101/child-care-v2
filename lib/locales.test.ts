/**
 * Naming a language, and knowing whether there is a choice to offer — issue #52.
 *
 * The endonym rule is the one worth a test rather than a comment. It is the kind of detail that
 * reads as a typo to whoever meets it next ("why does this say Deutsch instead of German?") and
 * gets helpfully corrected, at which point the control stops working for the only person it was
 * ever for: someone who cannot read the page they are looking at.
 */
import { describe, expect, it } from "vitest";

import { routing } from "@/i18n/routing";
import {
  DEFAULT_LOCALE,
  isLocaleSwitchable,
  localeEnglishName,
  localeNativeName,
  LOCALES,
} from "@/lib/locales";

describe("the locale list", () => {
  it("is `routing.locales`, not a second copy of it", () => {
    // Everything in #52 derives from this: the switcher, hreflang, the sitemap. A hand-kept
    // list here would be the copy that goes stale, and a locale that exists but is invisible
    // to search is a silent failure.
    expect([...LOCALES]).toEqual([...routing.locales]);
    expect(DEFAULT_LOCALE).toBe(routing.defaultLocale);
  });

  it("offers a switcher only when there is more than one", () => {
    expect(isLocaleSwitchable()).toBe(routing.locales.length > 1);
  });
});

describe("localeNativeName", () => {
  it("names a language in ITS OWN language, not in English", () => {
    // The rule the public switcher exists on. "German" is no use to someone who reads only
    // German — which is precisely who reaches for this control.
    expect(localeNativeName("de")).toBe("Deutsch");
    expect(localeNativeName("en")).toBe("English");
  });

  it("capitalises a language that does not capitalise itself", () => {
    // Intl returns "italiano" — correct in running Italian prose, wrong as a standalone menu
    // label sitting beside "English" and "Deutsch", where it reads as a rendering bug.
    expect(localeNativeName("it")).toBe("Italiano");
  });

  it("never returns an empty label, and never throws", () => {
    // An unlabelled option is worse than an ugly one, and one malformed entry in `routing`
    // must not take every page's header down with a RangeError.
    expect(localeNativeName("zz")).not.toBe("");
    expect(() => localeNativeName("pt BR")).not.toThrow();
  });
});

describe("localeEnglishName", () => {
  it("names a language in English, for the admin", () => {
    // The admin's chrome is English by decision (`lib/admin/nav.ts`), so its content-locale
    // control says "German" where the public one says "Deutsch". Two rules, one list.
    expect(localeEnglishName("de")).toBe("German");
    expect(localeEnglishName("it")).toBe("Italian");
  });
});
