/**
 * The three age bands and the shape of a day here, read from the database at build time.
 *
 * Ratios and ages are the numbers a parent writes down when comparing centers, and they
 * appear in four places — the home page's summary cards, `/programs`, `/about`, and the
 * tuition rate table. A ratio that says 1:4 on one page and 1:5 on another is worse than no
 * ratio at all, so the numbers are fetched once here and every page reads them, the same way
 * `@/lib/center` owns the license number.
 *
 * Only facts live here. The visible prose — band names, the label on each clock time — lives
 * in `messages/en.json` under the `Programs` and `Day` namespaces, keyed by the `key` and
 * `labelKey` fields below, so the copy is translatable while the numbers stay a fact.
 *
 * **That join is now unchecked by the compiler.** These keys used to be a literal union from
 * `as const`, so a band with no matching message was a type error. They come from the
 * database now and a missing message renders a blank card instead. `tests/content/` asserts
 * the coverage that the type system can no longer prove.
 */
import { cache } from "react";

import { CENTER_ORG_SLUG, requireRows } from "@/lib/content";

export type ProgramBand = {
  /** Joins to the `Programs` namespace in `messages/en.json`. */
  key: string;
  ageLabel: string;
  ratio: string;
  groupSize: string;
};

export type DailyRhythmSlot = {
  /** Joins to the `Day` namespace in `messages/en.json`. */
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
    .select("key, age_label, ratio, group_size, orgs!inner (slug)")
    .eq("orgs.slug", CENTER_ORG_SLUG)
    .order("sort_order");

  return requireRows(data, error, "Could not read program bands").map(
    (row) => ({
      key: row.key,
      ageLabel: row.age_label,
      ratio: row.ratio,
      groupSize: row.group_size,
    }),
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
