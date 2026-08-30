import type { MetadataRoute } from "next";

import { LOCALES } from "@/lib/locales";
import { NAV_LINKS } from "@/lib/nav";
import { alternatesFor, localeUrl } from "@/lib/seo";

/**
 * `/sitemap.xml` — every public page, in every locale the site routes. Issue #52.
 *
 * ## Derived, not listed
 *
 * The routes come from `NAV_LINKS` plus the home page, and the locales from `routing.locales`.
 * Nothing here is written down twice, which matters because a sitemap that has drifted from the
 * site is worse than none: it tells a crawler to spend its budget on URLs that 404, and stays
 * quiet about the pages that exist. A hand-kept list is the copy that goes stale, and the drift
 * is invisible from inside the application.
 *
 * So the day #53 adds German, this file needs no edit — 7 entries become 14 on their own. The
 * same is true of a page ticket that appends to `NAV_LINKS`.
 *
 * ## Why `alternates` is on every entry
 *
 * A sitemap can carry the same `hreflang` relationships the pages declare in their heads, and
 * saying it in both places is the recommendation rather than a belt-and-braces habit — a
 * crawler that has not yet fetched a page can still learn from the sitemap that its variants
 * exist. `alternatesFor` is shared with the page metadata, so the two cannot disagree.
 *
 * ## Static, like everything else public
 *
 * This is generated at build time. It reaches no database — the routes are facts in the
 * repository, not content — so it does not touch the constraint `docs/PLAN.md` sets about
 * keeping Supabase out of a visitor's request path.
 */

/** The home page is not in `NAV_LINKS`: nothing links to it from the primary nav but the brand. */
const ROUTES: readonly string[] = ["/", ...NAV_LINKS.map((link) => link.href)];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.flatMap((path) =>
    LOCALES.map((locale) => ({
      url: localeUrl(path, locale),
      lastModified: new Date(),
      // The home page is the entry point a parent is most likely to be shown; the rest are
      // equal to each other. Deliberately only two values — a priority ladder invented across
      // seven pages would be fiction, and crawlers treat it as a hint at best.
      priority: path === "/" ? 1 : 0.8,
      alternates: {
        languages: alternatesFor(path, locale).languages,
      },
    })),
  );
}
