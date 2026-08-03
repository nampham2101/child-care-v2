import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";

import { routing } from "./routing";

/**
 * Per-request i18n config, read by next-intl on the server for every locale route. It
 * resolves the active locale from the URL segment, falls back to the default if the
 * segment is not a locale we ship, and loads that locale's message catalogue.
 *
 * Messages are imported lazily by locale so a build only bundles the catalogues it needs —
 * adding a second locale adds `messages/<locale>.json` and nothing here changes.
 */
export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../messages/${locale}.json`)).default,
  };
});
