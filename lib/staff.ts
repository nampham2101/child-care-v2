/**
 * The people who work here, read from the database at build time.
 *
 * The home page shows three of them in its staff strip and `/staff` shows all seven with
 * bios. Tenure is the number a parent is really reading — a center where nobody stays is a
 * center where nobody knows your child — so it must not say twelve years on one page and
 * eleven on the other.
 *
 * Only facts live here. Roles and bios are prose and live under the `Staff` namespace of the
 * message catalogue, keyed by `key`, the same split `@/lib/programs` uses — and since #76 that
 * catalogue is `public.prose`, read at build time by `@/lib/prose`, not `messages/en.json`. A
 * role is changed by staff at `/admin/copy`. A staff row whose key has no matching message
 * renders a card with no role; `tests/content/` is what catches that now the compiler cannot.
 *
 * The derived helpers below are **pure functions over rows they are given**, deliberately.
 * They are the logic worth testing apart from the page rendering it, and they stay testable
 * without a database precisely because they take their input as an argument.
 */
import { cache } from "react";

import { CENTER_ORG_SLUG, requireRows } from "@/lib/content";

export type StaffMember = {
  /** Joins to the `Staff` namespace of the catalogue — `${key}Role`, `${key}Bio`, in `prose`. */
  key: string;
  name: string;
  /**
   * The year they joined, not a tenure in years: a stored "12 years" silently becomes wrong
   * on the first of January. `yearsWith` derives the number from this.
   */
  since: number;
  isFeatured: boolean;
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
 * Ordered the way a parent meets them — leadership, then room by room youngest-first, then
 * the kitchen. That was the array's order and is now `sort_order`.
 */
export const getStaff = cache(async (): Promise<StaffMember[]> => {
  const { supabase } = await import("@/lib/supabase");

  const { data, error } = await supabase
    .from("staff")
    .select("key, name, since, is_featured, orgs!inner (slug)")
    .eq("orgs.slug", CENTER_ORG_SLUG)
    .order("sort_order");

  return requireRows(data, error, "Could not read staff").map((row) => ({
    key: row.key,
    name: row.name,
    since: row.since,
    isFeatured: row.is_featured,
  }));
});

/**
 * The ones the home page's strip introduces, in the same order as the full list.
 *
 * A function over rows rather than the module-level constant it used to be: a constant would
 * now have to be computed at import time, before any query had run.
 */
export function featuredStaff(staff: readonly StaffMember[]): StaffMember[] {
  return staff.filter((person) => person.isFeatured);
}

/**
 * Initials stand in for a photo until real portraits are commissioned. A calm monogram reads
 * better than a generic stock smile, which `docs/PLAN.md` rules out anyway.
 */
export function initialsOf(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("");
}

/** Whole years with the center, counted the same way `/about` counts the license. */
export function yearsWith(person: Pick<StaffMember, "since">) {
  return new Date().getFullYear() - person.since;
}

/**
 * Mean tenure across the whole team, rounded to a whole year.
 *
 * This is the single number the `/staff` hero is built around: a parent comparing centers is
 * trying to find out whether the person greeting their child in March is the one who greeted
 * them in September, and an average is the honest way to say it — one long-serving director
 * cannot hide a room that turns over every year.
 */
export function averageTenure(staff: readonly StaffMember[]) {
  const total = staff.reduce((sum, person) => sum + yearsWith(person), 0);
  return Math.round(total / staff.length);
}
