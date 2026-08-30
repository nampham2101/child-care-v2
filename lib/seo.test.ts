/**
 * `hreflang` and sitemap URLs — issue #52.
 *
 * These assertions look fussy and are not. A multilingual site that declares its alternates
 * wrongly does not merely fail to gain from them, it **loses** visibility it already had: three
 * URLs carrying the same page with nothing tying them together read as three thin competing
 * documents. And the failure is completely silent from inside the application — every page
 * renders perfectly while the site quietly ranks worse.
 *
 * So the two things easiest to get backwards are pinned here: which way a canonical points, and
 * whether anything is hand-listed rather than derived.
 */
import { describe, expect, it } from "vitest";

import { DEFAULT_LOCALE, LOCALES } from "@/lib/locales";
import { alternatesFor, localeUrl, resolveSiteUrl, SITE_URL } from "@/lib/seo";

/**
 * The regression that shipped in v0.5.0 and was found on the live site.
 *
 * `release.yml` deploys from a detached checkout of a tag, so Netlify set `DEPLOY_PRIME_URL` to
 * `https://head--child-care-v2.netlify.app`. The old precedence preferred it over everything, so
 * production shipped every canonical and every `hreflang` pointing at a hostname that is not the
 * site — the exact failure `lib/seo.ts` exists to prevent.
 *
 * There was no test here because `SITE_URL` was a module constant read straight from
 * `process.env`, which is not reachable from a test. Making it a function of an env object is
 * most of the fix; these are the cases that would have caught it.
 */
describe("resolveSiteUrl", () => {
  it("ignores a DEPLOY_PRIME_URL from a tag deploy", () => {
    // Verbatim from the v0.5.0 release run.
    expect(
      resolveSiteUrl({
        DEPLOY_PRIME_URL: "https://head--child-care-v2.netlify.app",
        URL: "https://child-care-v2.netlify.app",
      }),
    ).toBe("https://child-care-v2.netlify.app");
  });

  it("defaults to production when the context says nothing", () => {
    // Nothing is inferred INTO production. An unrecognised or absent CONTEXT — a local build,
    // a CLI deploy, a runner — must never produce a preview hostname on the real site.
    expect(resolveSiteUrl({})).toBe("https://child-care-v2.netlify.app");
    expect(
      resolveSiteUrl({
        CONTEXT: "production",
        DEPLOY_PRIME_URL: "https://head--child-care-v2.netlify.app",
      }),
    ).toBe("https://child-care-v2.netlify.app");
  });

  it("lets a real preview describe itself", () => {
    expect(
      resolveSiteUrl({
        CONTEXT: "deploy-preview",
        DEPLOY_PRIME_URL:
          "https://deploy-preview-118--child-care-v2.netlify.app",
      }),
    ).toBe("https://deploy-preview-118--child-care-v2.netlify.app");
  });

  it("still falls back to production if a preview has no URL to offer", () => {
    expect(resolveSiteUrl({ CONTEXT: "deploy-preview" })).toBe(
      "https://child-care-v2.netlify.app",
    );
  });

  it("honours an explicit override above everything", () => {
    expect(
      resolveSiteUrl({
        NEXT_PUBLIC_SITE_URL: "https://example.test/",
        CONTEXT: "deploy-preview",
        DEPLOY_PRIME_URL: "https://deploy-preview-1--x.netlify.app",
      }),
    ).toBe("https://example.test");
  });

  it("never leaves a trailing slash for the URL builders to double up", () => {
    expect(
      resolveSiteUrl({ NEXT_PUBLIC_SITE_URL: "https://example.test/" }),
    ).toBe("https://example.test");
  });
});

describe("localeUrl", () => {
  it("is absolute — a relative hreflang is ignored, silently", () => {
    expect(localeUrl("/tuition", "en")).toMatch(/^https?:\/\//);
  });

  it("puts the locale first, matching localePrefix: always", () => {
    expect(localeUrl("/tuition", "en")).toBe(`${SITE_URL}/en/tuition`);
  });

  it("does not leave a trailing slash on the home page", () => {
    // `/en/` and `/en` are two URLs to a crawler. The sitemap and the alternates must name the
    // same one the router serves, which is the unslashed form.
    expect(localeUrl("/", "en")).toBe(`${SITE_URL}/en`);
  });
});

describe("alternatesFor", () => {
  it("canonicalises each locale to ITSELF, not to the default", () => {
    // The expensive mistake. A German page whose canonical points at the English one tells a
    // crawler it is a duplicate to be dropped — which deindexes every translation the moment
    // it ships. Pages that are alternates of one another each canonicalise to themselves.
    for (const locale of LOCALES) {
      expect(alternatesFor("/tuition", locale).canonical).toBe(
        localeUrl("/tuition", locale),
      );
    }
  });

  it("lists every routed locale, derived rather than written down", () => {
    const { languages } = alternatesFor("/faq", DEFAULT_LOCALE);

    for (const locale of LOCALES) {
      expect(languages[locale]).toBe(localeUrl("/faq", locale));
    }
    // Every key is either a routed locale or x-default — nothing hand-added, so #53 and #54
    // are one entry each in `routing` and nothing here changes.
    expect(Object.keys(languages).sort()).toEqual(
      [...LOCALES, "x-default"].sort(),
    );
  });

  it("points x-default at the default locale, because nothing negotiates", () => {
    // `i18n/routing.ts` sets `localeDetection: false`, so there is no URL that serves a
    // language-negotiated response. x-default has to name what a visitor with no expressed
    // preference actually gets, and that is English.
    expect(alternatesFor("/", DEFAULT_LOCALE).languages["x-default"]).toBe(
      localeUrl("/", DEFAULT_LOCALE),
    );
  });

  it("keeps every alternate on the same page it was asked about", () => {
    // The switcher's whole promise: `/en/tuition` offers `/de/tuition`, never `/de`. If this
    // ever regressed, a parent comparing fees would be dropped on the home page.
    for (const url of Object.values(
      alternatesFor("/tuition", "en").languages,
    )) {
      expect(url.endsWith("/tuition")).toBe(true);
    }
  });
});
