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
});
