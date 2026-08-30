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

/** The one hostname this site is actually served from. */
const PRODUCTION_URL = "https://child-care-v2.netlify.app";

/**
 * Netlify's own name for the kind of deploy being built. A CLI `--prod` deploy is not
 * guaranteed to report `production`, so this is used only to recognise a PREVIEW — never to
 * confirm production. See `resolveSiteUrl`.
 */
const PREVIEW_CONTEXTS = new Set(["deploy-preview", "branch-deploy", "dev"]);

/**
 * Where the site actually lives. Absolute URLs are required in `hreflang` and in a sitemap —
 * a relative one is ignored, silently.
 *
 * ## This got it wrong once, in production, and the shape of the mistake matters
 *
 * The first version preferred `DEPLOY_PRIME_URL` over everything, on the reasoning that a
 * Deploy Preview should describe itself rather than claim to be production. That is the right
 * goal and the wrong precedence.
 *
 * `release.yml` deploys from a **detached checkout of a tag**, so Netlify derived a branch name
 * of `HEAD` and set `DEPLOY_PRIME_URL` to `https://head--child-care-v2.netlify.app`. It won.
 * v0.5.0 therefore shipped every canonical and every `hreflang` on the live site pointing at a
 * hostname that is not the site — which is precisely the "extra languages COST you visibility"
 * failure this module was written to prevent, caused by the module itself.
 *
 * **It was invisible everywhere except production.** Locally none of these variables are set,
 * so the fallback produced the right answer; on a Deploy Preview `deploy-preview-118--…` is
 * exactly what a preview should say. Only a real release could expose it.
 *
 * ## So the precedence is inverted: production is the default, previews opt out
 *
 * Nothing is now inferred *into* production. The canonical hostname is what you get unless the
 * build says, explicitly, that it is a preview. The failure modes are deliberately asymmetric:
 *
 *   - Getting production wrong deindexes the real site. Unacceptable.
 *   - Getting a preview wrong makes a preview claim to be production — untidy, and harmless,
 *     because previews carry `X-Robots-Tag: noindex` from Netlify and are not crawled.
 *
 * When those are the two errors available, take the second one every time.
 */
export function resolveSiteUrl(
  env: Record<string, string | undefined>,
): string {
  const explicit = env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");

  if (PREVIEW_CONTEXTS.has(env.CONTEXT ?? "") && env.DEPLOY_PRIME_URL) {
    return env.DEPLOY_PRIME_URL.replace(/\/$/, "");
  }

  return PRODUCTION_URL;
}

export const SITE_URL: string = resolveSiteUrl(process.env);

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
