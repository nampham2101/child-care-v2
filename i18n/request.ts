import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { getProse, mergeCatalogues, type Messages } from "@/lib/prose";

import { routing } from "./routing";

/**
 * Per-request i18n config, read by next-intl on the server for every locale route. It
 * resolves the active locale from the URL segment, falls back to the default if the segment
 * is not a locale we ship, and assembles that locale's catalogue.
 *
 * **The catalogue is now two halves.** #76 moved the site's 279 editable strings into the
 * database so staff can fix a sentence and not only a phone number; `messages/<locale>.json`
 * keeps the three chrome strings that describe the interface rather than the center.
 * `@/lib/prose` explains that boundary and does the merge. Everything downstream —
 * `useTranslations`, `getTranslations`, ICU interpolation — is unchanged and cannot tell the
 * two halves apart.
 *
 * **This does not put the database in a visitor's request path.** `docs/PLAN.md` rules that
 * out, and it still holds: every public route is prerendered, so this runs at build time, the
 * same moment `@/lib/programs` and the other fact queries run. `/admin` is not locale-prefixed
 * and uses no translations at all, so the one dynamic part of the site never reaches this file.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  const [prose, chrome] = await Promise.all([
    getProse(locale),
    import(`../messages/${locale}.json`).then(
      (module) => module.default as Messages,
    ),
  ]);

  return {
    locale,
    messages: mergeCatalogues(prose, chrome),

    /**
     * Turn a missing message into a failed build.
     *
     * next-intl's default is to log and render the key path, which is the behaviour #76
     * names as the thing to prevent: "A missing string is a blank region, not an error."
     * While the catalogue was a file in the bundle that could barely happen. Now a string
     * can be missing because a row was deleted, because a translation is incomplete, or
     * because someone renamed a key in the editor — none of which a reviewer would notice
     * on a Deploy Preview, because the page still renders and simply says less.
     *
     * Throwing here makes it as loud as a missing fact already is. The message names the
     * key, so the fix is a row, not a hunt.
     */
    onError(error) {
      throw error;
    },
  };
});
