/**
 * Every string the default locale publishes exists in every other locale the site routes.
 *
 * ## Why this is not the assertion #53 was originally written with
 *
 * #53 first asked for key-for-key parity between `messages/en.json` and `messages/de.json`.
 * Since the prose migration (#76, #77) those files hold three chrome strings each, so that
 * check would have passed cleanly while all 282 translated rows were missing — it would have
 * guarded the three strings that never change and ignored the ones that do. The ticket was
 * rewritten on 2026-08-29 to move the check to where the strings now live, and this is it.
 *
 * The chrome files keep their own parity assertion in `message-keys.test.ts`, which pins every
 * `messages/<locale>.json` to exactly the three chrome keys. This file is deliberately built on
 * that rather than beside it: chrome is asserted there, database copy is asserted here.
 *
 * ## What a missing row actually does
 *
 * It does not leave a gap. next-intl falls back to the default locale, so one absent German row
 * renders an English sentence in the middle of a German page — which reads as a broken site
 * rather than as a partial translation, and is the failure a reviewer skims straight past on a
 * Deploy Preview. `i18n/request.ts` throws on a key that is missing *everywhere*, but a key
 * present in `en` and absent in `de` is exactly the case it cannot see.
 *
 * ## Two properties #53 asked to keep
 *
 * **The locale list is derived from `routing.locales`, never written down here.** A third
 * catalogue needs no edit in this file — it is checked the moment it is routed.
 *
 * **Placeholders are compared, not just keys.** Twenty strings interpolate a value, and
 * next-intl throws on a message missing one, which fails the build. A translation that quietly
 * dropped `{ageRange}` would satisfy a key-only check and take production down on the next
 * publish, so the ICU argument names are part of what parity means.
 */
import { describe, expect, test } from "vitest";

import { routing } from "@/i18n/routing";
import { getProse, type Messages } from "@/lib/prose";

/** `Namespace.key` for every string in a catalogue, sorted. */
function keysOf(messages: Messages): string[] {
  return Object.entries(messages)
    .flatMap(([namespace, entries]) =>
      Object.keys(entries).map((key) => `${namespace}.${key}`),
    )
    .sort();
}

/** The ICU argument names a message interpolates, sorted and de-duplicated. */
function placeholdersOf(value: string): string[] {
  return [...new Set(value.match(/\{([a-zA-Z]+)\}/g) ?? [])].sort();
}

const OTHER_LOCALES = routing.locales.filter(
  (locale) => locale !== routing.defaultLocale,
);

describe("every locale carries the whole catalogue", () => {
  /*
   * With one locale routed there is nothing to compare, and `test.each([])` would report a
   * green file that asserted nothing. That is the correct state before #53 or #54 lands, so it
   * is stated rather than hidden: this file is inert until a second catalogue is routed, and
   * `message-keys.test.ts` is what guards the single-locale case.
   */
  test("the default locale is routed and has copy", async () => {
    const base = await getProse(routing.defaultLocale);
    expect(keysOf(base).length).toBeGreaterThan(0);
  });

  test.each(OTHER_LOCALES)(
    "%s has every key the default has",
    async (locale) => {
      const [base, translated] = await Promise.all([
        getProse(routing.defaultLocale),
        getProse(locale),
      ]);

      const baseKeys = keysOf(base);
      const translatedKeys = keysOf(translated);

      expect(
        baseKeys.filter((key) => !translatedKeys.includes(key)),
        `keys published for ${routing.defaultLocale} with no ${locale} row — these fall back to ${routing.defaultLocale} mid-page`,
      ).toEqual([]);

      // The other direction is a row nothing renders: harmless on the page, but it means a key
      // was renamed or removed in the default locale and its translation was left behind.
      expect(
        translatedKeys.filter((key) => !baseKeys.includes(key)),
        `${locale} rows with no ${routing.defaultLocale} counterpart — orphaned copy`,
      ).toEqual([]);
    },
  );

  test.each(OTHER_LOCALES)(
    "%s preserves every ICU placeholder",
    async (locale) => {
      const [base, translated] = await Promise.all([
        getProse(routing.defaultLocale),
        getProse(locale),
      ]);

      const mismatched: string[] = [];
      for (const [namespace, entries] of Object.entries(base)) {
        for (const [key, value] of Object.entries(entries)) {
          const expected = placeholdersOf(value);
          if (expected.length === 0) continue;

          const actual = placeholdersOf(translated[namespace]?.[key] ?? "");
          if (actual.join(",") !== expected.join(",")) {
            mismatched.push(
              `${namespace}.${key}: expected ${expected.join(" ")}, got ${actual.join(" ") || "none"}`,
            );
          }
        }
      }

      expect(
        mismatched,
        `${locale} messages whose placeholders do not match ${routing.defaultLocale} — next-intl throws on these and the build fails`,
      ).toEqual([]);
    },
  );
});
