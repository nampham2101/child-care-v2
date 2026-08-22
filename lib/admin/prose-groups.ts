/**
 * The site's copy, grouped the way a staff member looks for it.
 *
 * #77's acceptance bar is *a staff member can find and fix a typo on `/faq` without help*, and
 * that is a statement about navigation, not about editing. 279 strings on one page is a find
 * problem: the person knows which **page of the website** the typo is on, and knows nothing
 * about namespaces.
 *
 * So the grouping is by where the words appear, and `namespace` — which is a database column —
 * never reaches the screen. The `slug` is what appears in a URL; the namespace does not, so
 * renaming a namespace later is not a broken bookmark.
 *
 * ## Why this list is hand-written rather than derived
 *
 * `select distinct namespace from prose` would produce the same 13 entries and could not
 * produce `where`, which is the only column that makes the list useful. A namespace appearing
 * with no entry here is a real event worth failing on — someone added copy and did not say
 * where a staff member would go looking for it — so `assertGroupsCoverAll` exists rather than a
 * silent fallback that files strays under "Other".
 */

export type ProseGroup = {
  /** URL segment. Stable, and deliberately not the namespace. */
  slug: string;
  /** The namespace in `public.prose` this group edits. Never shown. */
  namespace: string;
  /** What a staff member reads in the list. */
  label: string;
  /** Where these words show up, in the words a staff member would use. */
  where: string;
};

/**
 * Ordered the way `lib/admin/nav.ts` orders the editor: the pages a parent walks through, then
 * the copy that repeats across all of them. Not alphabetical, and not the order the namespaces
 * happen to come back from Postgres.
 */
export const PROSE_GROUPS: readonly ProseGroup[] = [
  {
    slug: "home",
    namespace: "HomePage",
    label: "Home page",
    where:
      "The first thing a parent reads — the headline, the room summaries, and the quote.",
  },
  {
    slug: "programs",
    namespace: "ProgramsPage",
    label: "Programs page",
    where: "What each room is like, beyond the ratios and group sizes.",
  },
  {
    slug: "about",
    namespace: "AboutPage",
    label: "About page",
    where:
      "Your approach, the licence, and what safety looks like on an ordinary day.",
  },
  {
    slug: "staff",
    namespace: "StaffPage",
    label: "Staff page",
    where:
      "The headings and the section about why people stay — not the people themselves.",
  },
  {
    slug: "tuition",
    namespace: "TuitionPage",
    label: "Tuition page",
    where:
      "How the rates are explained, and the fees a rate sheet usually leaves out.",
  },
  {
    slug: "contact",
    namespace: "ContactPage",
    label: "Contact page",
    where: "Getting here, parking, and what to call about.",
  },
  {
    slug: "faq",
    namespace: "FaqPage",
    label: "FAQ page",
    where: "Every question and its answer.",
  },
  {
    slug: "people",
    namespace: "Staff",
    label: "Roles and bios",
    where:
      "Each person's job title and their few lines. Their name and start year are on the Staff editor instead.",
  },
  {
    slug: "rooms",
    namespace: "Programs",
    label: "Room names",
    where:
      "What the three rooms are called, everywhere they appear. Short — these are names, not descriptions.",
  },
  {
    slug: "day",
    namespace: "Day",
    label: "The day",
    where:
      "What each moment of the day is called. The times beside them are on the Rooms editor.",
  },
  {
    slug: "visit",
    namespace: "Visit",
    label: "Planning a visit",
    where: "The visit card, which repeats at the bottom of most pages.",
  },
  {
    slug: "navigation",
    namespace: "Nav",
    label: "Menu links",
    where: "The links in the header, on every page.",
  },
  {
    slug: "footer",
    namespace: "Footer",
    label: "Footer",
    where: "The line at the very bottom, on every page.",
  },
];

export function groupBySlug(slug: string): ProseGroup | undefined {
  return PROSE_GROUPS.find((group) => group.slug === slug);
}

/**
 * A readable name for one string's field, derived from its key.
 *
 * ## This bends #74's "never show a column name" rule, deliberately
 *
 * For a program band the rule is easy: the row has a `name` column, so the editor shows the
 * name and hides the key. **A prose row has no such column** — its key is the only handle it
 * has, and a form field still needs a label a screen reader can announce.
 *
 * So the key is transformed into a phrase: `placeWaitlistAnswer` → "Place waitlist answer".
 * What the rule protects against is a staff member being asked to understand, or worse type, a
 * database identifier. Here it is neither editable nor presented as an identifier, and the real
 * way a person recognises which string is which is the copy itself, sitting in the box directly
 * below. The label is an accessible name, not the thing being read.
 *
 * The alternative — a hand-written label for all 279 — would be 279 more strings to keep in
 * step with the rows, in a repository that has just spent a whole ticket removing exactly that
 * kind of duplicated join.
 */
export function fieldLabel(key: string): string {
  const words = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .toLowerCase()
    .trim();

  return words.charAt(0).toUpperCase() + words.slice(1);
}

/**
 * The character limit for one group, derived from the copy already in it.
 *
 * A fixed limit across all thirteen groups would be useless at both ends: 600 characters is not
 * a meaningful ceiling for a room name that is currently "Infants", and would be a real
 * constraint on the longest FAQ answer, which is 276.
 *
 * So the limit is half again the longest string the group holds, rounded up, never below 120.
 * That gives room to rewrite and expand while still saying something true about what the page
 * design accommodates — a bio at four times its current length breaks the staff card layout,
 * and the person should learn that here rather than from the published page.
 *
 * Derived server-side in both the form and the action, from the same rows, so the number a
 * staff member is shown is exactly the number their save is checked against.
 */
export function proseLimitFor(values: readonly string[]): number {
  const longest = values.reduce((max, value) => Math.max(max, value.length), 0);
  return Math.max(120, Math.ceil((longest * 1.5) / 10) * 10);
}

/**
 * Every namespace in the database has a group, and every group points at a real namespace.
 *
 * Both directions matter and they fail differently. A namespace with no group is **copy a staff
 * member cannot reach** — invisible, because nothing renders an editor for it. A group with no
 * namespace is a dead link in the list. Neither is loud on its own, so
 * `tests/content/prose-groups.test.ts` asserts this against the live rows.
 */
export function assertGroupsCoverAll(namespaces: readonly string[]): void {
  const known = new Set(PROSE_GROUPS.map((group) => group.namespace));
  const present = new Set(namespaces);

  const unreachable = [...present].filter((name) => !known.has(name)).sort();
  const empty = [...known].filter((name) => !present.has(name)).sort();

  const problems = [
    unreachable.length > 0
      ? `no editor group for ${unreachable.join(", ")} — that copy cannot be reached by a staff member`
      : null,
    empty.length > 0 ? `groups pointing at nothing: ${empty.join(", ")}` : null,
  ].filter(Boolean);

  if (problems.length > 0) {
    throw new Error(
      `lib/admin/prose-groups.ts is out of step with the database — ${problems.join("; ")}.`,
    );
  }
}
