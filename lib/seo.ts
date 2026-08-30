/**
 * The absolute URLs search engines need — `hreflang` alternates and the sitemap — issue #52.
 *
 * ## Why this is not optional polish
 *
 * A multilingual site that does not declare its alternates does not merely fail to gain from
 * them; it **loses** visibility it already had. Three URLs carrying the same page in three
 * languages, with nothing saying they are the same page, look to a crawler like three thin
 * competing documents. `hreflang` is what turns them back into one page with three versions.
 *
 * So this ships in #52 with the switcher, before any catalogue exists, rather than in the
 * translation tickets — the machinery has to be right before there is traffic to lose.
 *
 * ## Everything is derived from `routing.locales`
 *
 * Adding a locale must not mean remembering to touch this file. `alternatesFor` and the sitemap
 * both iterate `LOCALES`, so #53 and #54 are one entry each in the routing config and nothing
 * here changes. A hand-kept list would be the copy that goes stale, and the failure would be
 * silent: a language that exists, is linked from the switcher, and is invisible to search.
 */
import { DEFAULT_LOCALE, LOCALES } from "@/lib/locales";

/**
 * Where the site actually lives. Absolute URLs are required in `hreflang` and in a sitemap —
 * a relative one is ignored, silently.
 *
 * Overridable by environment so a Deploy Preview describes itself rather than claiming to be
 * production, which would invite a crawler to index the preview's URLs as the canonical ones.
 * Netlify sets `URL` on production builds and `DEPLOY_PRIME_URL` on previews.
 */
export const SITE_URL: string = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  process.env.DEPLOY_PRIME_URL ??
  process.env.URL ??
  "https://child-care-v2.netlify.app"
).replace(/\/$/, "");

/**
 * The absolute URL of one unlocalized route in one locale.
 *
 * `path` is the route as `lib/nav.ts` writes it — `/programs`, or `/` for the home page — never
 * carrying a locale prefix. This is the one place that knows the prefix shape, so
 * `localePrefix: "always"` is honoured identically by the sitemap and by every alternate.
 */
export function localeUrl(path: string, locale: string): string {
  const suffix = path === "/" ? "" : path;
  return `${SITE_URL}/${locale}${suffix}`;
}

/**
 * The `alternates` block for one page in one locale: a canonical, every locale's variant, and
 * `x-default`.
 *
 * **The canonical is self-referential** — `/de/tuition` declares itself canonical, not the
 * English page. This is the detail that is easy to get backwards and expensive when it is: a
 * canonical pointing at English would tell a crawler the German page is a duplicate to be
 * dropped, which deindexes every translation the moment it ships. A set of pages that are
 * alternates of one another each canonicalise to themselves; only a genuine duplicate points
 * elsewhere.
 *
 * **`x-default` points at the default locale, not at a negotiating URL**, because this site
 * deliberately does not negotiate — #52 settled that there is no automatic redirect, and
 * `i18n/routing.ts` carries the reasoning. Naming a URL that does not exist would be worse
 * than omitting the tag, so it names the English page, which is exactly what a visitor with no
 * expressed preference is served.
 *
 * Returns `languages` even with one locale configured. A single self-referential alternate is
 * harmless and correct, and means there is nothing here to remember the day #53 lands.
 */
export function alternatesFor(
  path: string,
  locale: string,
): {
  canonical: string;
  languages: Record<string, string>;
} {
  const languages: Record<string, string> = {};
  for (const option of LOCALES) {
    languages[option] = localeUrl(path, option);
  }
  languages["x-default"] = localeUrl(path, DEFAULT_LOCALE);

  return { canonical: localeUrl(path, locale), languages };
}
