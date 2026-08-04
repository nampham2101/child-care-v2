/**
 * The people who work here, as facts.
 *
 * The home page shows three of them in its staff strip and `/staff` shows all seven with
 * bios, which is the second use that brings this list out of a page file and into `lib/`.
 * Tenure is the number a parent is really reading — a center where nobody stays is a
 * center where nobody knows your child — so it must not say twelve years on one page and
 * eleven on the other.
 *
 * Only facts live here. Roles and bios are prose and live in `messages/en.json` under the
 * `Staff` namespace, keyed by `key` below, the same split `@/lib/programs` uses.
 *
 * `since` is the year they joined rather than a tenure in years, because a hardcoded "12
 * years" silently becomes wrong on the first of January. Order is the order a parent meets
 * them: leadership, then room by room youngest-first, then the kitchen.
 *
 * Placeholder people for a fictional center, per `docs/PLAN.md`.
 */
export const STAFF = [
  { key: "maria", name: "Maria Delgado", since: 2014, isFeatured: true },
  { key: "nadia", name: "Nadia Okonkwo", since: 2017, isFeatured: false },
  { key: "aisha", name: "Aisha Bello", since: 2018, isFeatured: true },
  { key: "grace", name: "Grace Lim", since: 2021, isFeatured: false },
  { key: "daniel", name: "Daniel Ruiz", since: 2019, isFeatured: false },
  { key: "tom", name: "Tom Fischer", since: 2020, isFeatured: true },
  { key: "sofia", name: "Sofia Marchetti", since: 2015, isFeatured: false },
] as const;

export type StaffMember = (typeof STAFF)[number];

/** The three the home page's strip introduces, in the same order as the full list. */
export const FEATURED_STAFF = STAFF.filter((person) => person.isFeatured);

/**
 * Initials stand in for a photo until real portraits are commissioned. A calm monogram
 * reads better than a generic stock smile, which `docs/PLAN.md` rules out anyway.
 */
export function initialsOf(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("");
}

/** Whole years with the center, counted the same way `/about` counts the license. */
export function yearsWith(person: StaffMember) {
  return new Date().getFullYear() - person.since;
}

/**
 * Mean tenure across the whole team, rounded to a whole year.
 *
 * This is the single number the `/staff` hero is built around: a parent comparing centers
 * is trying to find out whether the person greeting their child in March is the one who
 * greeted them in September, and an average is the honest way to say it — one long-serving
 * director cannot hide a room that turns over every year.
 */
export function averageTenure() {
  const total = STAFF.reduce((sum, person) => sum + yearsWith(person), 0);
  return Math.round(total / STAFF.length);
}
