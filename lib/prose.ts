/**
 * The site's copy, read from the database at build time and handed to next-intl as its
 * message catalogue.
 *
 * **Every existing `t("FaqPage.answer")` call site keeps working unchanged.** That is the
 * point of doing it here rather than in the components. next-intl takes a plain nested object
 * as `messages`; where that object came from is not its concern. So moving 279 strings out of
 * a JSON file and into Postgres touches this module, `i18n/request.ts`, and nothing else —
 * no page, no component, and no test that asserts a rendered string.
 *
 * The alternative was a `getProse()` helper called from every page, which would have meant
 * editing all seven pages, losing next-intl's ICU interpolation for the 19 strings that carry
 * placeholders like `{years}` and `{licenseNumber}`, and rewriting the end-to-end suite that
 * #76 requires to pass unedited. Merging into the catalogue keeps all three.
 *
 * ## What stays in messages/*.json
 *
 * Chrome: the three strings that name the interface rather than the center — the primary-nav
 * aria-label and the open/close menu buttons. They are merged underneath the database rows
 * here, so a component reads one flat catalogue and never knows which half a string came
 * from. `scripts/generate-prose-backfill.mjs` holds the same boundary as a list and explains
 * it; `tests/content/message-keys.test.ts` is what keeps the file from drifting back across it.
 *
 * ## The build must die on missing copy
 *
 * A missing fact already fails the build (`@/lib/content`). A missing *string* used to be
 * impossible — the catalogue shipped inside the bundle — and now it is merely invisible: a
 * blank heading reads as a CSS bug and sends whoever finds it looking in the wrong place.
 * Two guards, because they catch different failures:
 *
 *   1. `requireRows` here — an unseeded, unreachable, or wrong-locale query returns nothing
 *      and stops the build naming the locale.
 *   2. `onError` in `i18n/request.ts` — the catalogue loaded, but one key a component asked
 *      for is not in it.
 */
import { cache } from "react";

import { CENTER_ORG_SLUG, requireRows } from "@/lib/content";

/** A next-intl catalogue: namespace → key → string. */
export type Messages = Record<string, Record<string, string>>;

/**
 * Every published string for one locale, shaped into a catalogue.
 *
 * Read as one query rather than one per namespace. There are 13 namespaces and this runs
 * once per locale per build, so 13 round trips would buy nothing; the partial index
 * `prose_published_by_locale` is built for exactly this access pattern.
 *
 * The organization filter is the same filtered inner join every other content query uses,
 * and for the same non-obvious reason `@/lib/content` documents: the anonymous policy is
 * `status = 'published'` and carries no organization scope, so an unfiltered read would
 * return every tenant's published rows.
 */
export const getProse = cache(async (locale: string): Promise<Messages> => {
  const { supabase } = await import("@/lib/supabase");

  const { data, error } = await supabase
    .from("prose")
    .select("namespace, key, value, orgs!inner (slug)")
    .eq("orgs.slug", CENTER_ORG_SLUG)
    .eq("locale", locale);

  const rows = requireRows(data, error, `Could not read ${locale} prose`);

  const messages: Messages = {};
  for (const row of rows) {
    (messages[row.namespace] ??= {})[row.key] = row.value;
  }
  return messages;
});

/**
 * Database copy underneath, chrome on top, one namespace at a time.
 *
 * A plain spread would be wrong: `{...prose, ...chrome}` replaces the whole `Nav` namespace
 * with the chrome file's three keys and silently drops the seven navigation labels that live
 * in the database. The namespaces overlap by design, so the merge has to reach one level
 * deeper — which is exactly as deep as the catalogue goes.
 *
 * Chrome wins a collision. There should never be one: the backfill excludes precisely the
 * keys the chrome file holds. If one appears anyway, the file in the repository is the half a
 * developer can see in a diff, so it is the half that should win.
 */
export function mergeCatalogues(prose: Messages, chrome: Messages): Messages {
  const merged: Messages = {};
  for (const namespace of new Set([
    ...Object.keys(prose),
    ...Object.keys(chrome),
  ])) {
    merged[namespace] = {
      ...prose[namespace],
      ...chrome[namespace],
    };
  }
  return merged;
}
