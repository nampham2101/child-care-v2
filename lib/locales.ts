/**
 * What the site's locales are, and how to name one — the single source both switchers use.
 *
 * `i18n/routing.ts` decides which locales exist. This module is everything *else* that has to
 * agree with that list: whether there is a choice to offer at all, and what to call a language
 * in front of a person. Two switchers now need those answers — the public one in the header
 * (#52) and the content-locale control in the copy editor (#111) — and `docs/CONVENTIONS.md` is
 * explicit that a helper needed twice moves to a shared module rather than being pasted.
 *
 * ## Two ways to name a language, and they are not interchangeable
 *
 * **The public switcher uses the endonym** — the name of a language *in that language*.
 * "Deutsch", not "German". Someone who cannot read the page they are looking at cannot read
 * "German" either, so an English label would be useless to exactly the person the control
 * exists for.
 *
 * **The admin uses the English name** — "German", not "Deutsch". The admin's chrome is English
 * by decision (`lib/admin/nav.ts`), and it is a tool for the people who work at this one center
 * rather than a publication. A localised option there would be the first step toward a
 * half-translated interface nothing intends to build.
 *
 * Both are derived from `Intl`, so adding a locale to `routing` needs no new string here.
 */
import { routing } from "@/i18n/routing";

/** Every locale the site routes. Derived, never restated. */
export const LOCALES: readonly string[] = routing.locales;

/** The locale a visitor gets when they have expressed no preference. */
export const DEFAULT_LOCALE: string = routing.defaultLocale;

/**
 * Whether there is a choice worth offering.
 *
 * **A switcher with one option is worse than no switcher** — it implies a choice that does not
 * exist and takes the space where a real one would go. Gating on this is what lets #52 and #111
 * merge and release while English is the only catalogue, and light up on their own when #53 or
 * #54 lands: no follow-up pull request, no flag to remember to flip.
 */
export function isLocaleSwitchable(): boolean {
  return LOCALES.length > 1;
}

/**
 * `Intl.DisplayNames.of` THROWS a RangeError on a structurally malformed tag rather than
 * returning undefined. Every caller passes a locale from `routing`, so it should be
 * unreachable — it is caught anyway, because the alternative is that one bad entry in the
 * routing config takes down every page's header with a stack trace instead of showing an
 * unlovely label.
 */
function displayName(locale: string, inLocale: string): string {
  try {
    return (
      new Intl.DisplayNames([inLocale], { type: "language" }).of(locale) ??
      locale
    );
  } catch {
    return locale;
  }
}

/**
 * A language's name in its own language, for the public switcher: `de` → "Deutsch".
 *
 * ## Why the first letter is forced upper case
 *
 * Languages disagree about capitalising their own name, and `Intl` correctly follows each
 * one — German gives "Deutsch", Italian gives "italiano", lower case, because that is right in
 * running Italian prose. **This is not running prose.** It is a standalone menu label sitting
 * beside "English" and "Deutsch", and a lower-case entry in that row reads as a rendering bug
 * rather than as correct Italian orthography.
 *
 * So the first character is upper-cased *for display only*, with the locale's own casing rules
 * — `toLocaleUpperCase(locale)` rather than `toUpperCase()`, because the two differ in Turkish
 * and getting that wrong is the kind of detail this project would rather not ship.
 */
export function localeNativeName(locale: string): string {
  const name = displayName(locale, locale);
  try {
    return name.charAt(0).toLocaleUpperCase(locale) + name.slice(1);
  } catch {
    // `toLocaleUpperCase` raises its OWN RangeError on a malformed tag — a second throwing
    // call, separate from `Intl.DisplayNames`, and the one that is easy to miss because it
    // looks like plain string handling. Caught for the same reason: an unlovely label beats
    // taking every page's header down.
    return name;
  }
}

/** A language's name in English, for the admin: `de` → "German". */
export function localeEnglishName(locale: string): string {
  return displayName(locale, "en");
}
