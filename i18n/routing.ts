import { defineRouting } from "next-intl/routing";

/**
 * The site's locale routing, defined once and shared by the middleware, the request
 * config, and the navigation helpers so they can never disagree about what a locale is.
 *
 * `en` is the default and, today, the only shipped locale — but every public route is
 * still locale-prefixed (`localePrefix: "always"`), so `/` redirects to `/en` and the URL
 * shape is already correct for the day a second locale lands. Adding that locale is then
 * mostly a new file under `messages/`, not a routing change. This is the "English now,
 * structured for a second later" decision in `docs/PLAN.md`.
 */
export const routing = defineRouting({
  locales: ["en"],
  defaultLocale: "en",
  localePrefix: "always",
  /*
   * **No automatic redirect based on `Accept-Language`** — settled on #52.
   *
   * next-intl will happily negotiate a locale from the browser header, and it is the wrong
   * default here for two reasons:
   *
   *   - **It surprises people.** A browser's language is not reliably the language someone
   *     wants to read a licensing detail in. A parent who reads German at home and does
   *     business in English gets German, having asked for nothing, and the way back is a
   *     control they now have to find in a language they did not choose.
   *   - **It breaks caching.** A response that varies on a request header cannot be one static
   *     file at the edge. Every public page here is prerendered, which `docs/PLAN.md` treats
   *     as load-bearing, and negotiation would put a decision in front of all of them.
   *
   * So: everyone gets `en` unless they say otherwise, and saying otherwise is the switcher in
   * the header. `x-default` in `lib/seo.ts` points at English for the same reason — it names
   * what a visitor with no preference is actually served.
   */
  localeDetection: false,
});
