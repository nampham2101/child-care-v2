/**
 * The three age bands and the shape of a day here, read from the database at build time.
 *
 * The ratio is the number a parent writes down when comparing centers, and it appears in four
 * places — the home page's summary cards, `/programs`, `/about`, and the tuition rate table. A
 * ratio that says 1:4 on one page and 1:5 on another is worse than no ratio at all, so it is
 * fetched once here and every page reads it, the same way `@/lib/center` owns the license
 * number.
 *
 * Only facts live here, and since #123 that is finally true of this table. It used to carry
 * the age range and the group size as well — '6 weeks – 15 months', '8 children' — which are
 * English sentences rather than facts, and `programs` has no locale, so a German room card
 * rendered them untranslated. They are `prose` rows now, under the same `Programs` namespace
 * as the band's name and keyed `${key}Ages` and `${key}GroupSize`. `ratio` stayed: '1:4' is
 * '1:4' in every language, and telling those apart is the whole point.
 *
 * The visible prose — band names, the ages, the group size, the label on each clock time —
 * lives under the `Programs` and `Day` namespaces of the message catalogue, keyed by the `key`
 * and `labelKey` fields below, so the copy is translatable while the numbers stay a fact.
 *
 * **That catalogue is the database, not a JSON file** (#76). `@/lib/prose` reads `public.prose`
 * at build time and hands it to next-intl, so a `t("Programs.infants")` call site is unchanged
 * — but a band name is edited by staff at `/admin/copy`, and editing `messages/en.json` would
 * change nothing. That file holds three chrome strings and none of this.
 *
 * **That join is now unchecked by the compiler.** These keys used to be a literal union from
 * `as const`, so a band with no matching message was a type error. They come from the
 * database now and a missing message renders a blank card instead. `tests/content/` asserts
 * the coverage that the type system can no longer prove.
 */
import { cache } from "react";

import { CENTER_ORG_SLUG, requireRows } from "@/lib/content";

export type ProgramBand = {
  /**
   * Joins to the `Programs` namespace of the catalogue — a `public.prose` row since #76, and
   * since #123 three rows rather than one: the room's name, `${key}Ages`, and
   * `${key}GroupSize`.
   */
  key: string;
  ratio: string;
};

export type DailyRhythmSlot = {
  /** Joins to the `Day` namespace of the catalogue — a `public.prose` row since #76. */
  labelKey: string;
  time: string;
};

/**
 * The client is imported inside the query rather than at the top of this module, and that is
 * load-bearing rather than stylistic.
 *
 * `@/lib/supabase` validates its configuration **at module load** and throws when the
 * environment variables are absent — a deliberate choice, so a misconfigured build dies
 * naming the missing variable instead of three frames inside a query. A top-level import here
 * would therefore make this whole module unloadable without credentials, and this module also
 * exports pure helpers that must stay testable without a database. Importing it here keeps
 * both promises: the guard still runs, on the first query, which is the first moment a build
 * actually needs it.
 */

/**
 * Youngest-first, and that ordering is asserted in the end-to-end tests: a parent arrives
 * knowing their child's age and nothing else, so the first band they see must be the
 * youngest. The order used to be the array's; it is now `sort_order`, which is why the column
 * is stored rather than derived.
 */
export const getProgramBands = cache(async (): Promise<ProgramBand[]> => {
  const { supabase } = await import("@/lib/supabase");

  const { data, error } = await supabase
    .from("programs")
    .select("key, ratio, orgs!inner (slug)")
    .eq("orgs.slug", CENTER_ORG_SLUG)
    .order("sort_order");

  return requireRows(data, error, "Could not read program bands").map(
    (row) => ({ key: row.key, ratio: row.ratio }),
  );
});

/**
 * The daily rhythm, in the order it happens.
 *
 * Times are 12-hour without a meridiem because the whole list runs 7:00 to 4:30 in one day
 * and the column reads faster without seven repetitions of "AM". The center's opening and
 * closing hours are stated in full by `@/lib/center`.
 */
export const getDailyRhythm = cache(async (): Promise<DailyRhythmSlot[]> => {
  const { supabase } = await import("@/lib/supabase");

  const { data, error } = await supabase
    .from("daily_rhythm")
    .select("label_key, time, orgs!inner (slug)")
    .eq("orgs.slug", CENTER_ORG_SLUG)
    .order("sort_order");

  return requireRows(data, error, "Could not read the daily rhythm").map(
    (row) => ({ labelKey: row.label_key, time: row.time }),
  );
});
