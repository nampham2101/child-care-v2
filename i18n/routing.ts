import { defineRouting } from "next-intl/routing";

/**
 * The site's locale routing, defined once and shared by the middleware, the request
 * config, and the navigation helpers so they can never disagree about what a locale is.
 *
 * `en` is the default; `de` joined it with the German catalogue (#53). Every public route is
 * locale-prefixed (`localePrefix: "always"`), so `/` redirects to `/en` and the URL shape was
 * already correct on the day the second locale landed — this list is the whole routing change
 * that shipping one takes. That is the "English now, structured for a second later" decision
 * in `docs/PLAN.md`, paying out as designed.
 *
 * **This list is the gate, and it comes last.** A locale is invisible to visitors until it
 * appears here, so the 282 German rows could land, be reviewed and be corrected while nothing
 * routed to them. #53 and #54 both order their work that way deliberately, and
 * `docs/adr/0002-publishing-stays-organization-wide.md` leans on it: it is the reason a
 * half-finished translation sitting in the database reaches nobody. Adding a locale here
 * before its rows exist fails the build in `getProse`, naming the locale.
 */
export const routing = defineRouting({
  locales: ["en", "de"],
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
