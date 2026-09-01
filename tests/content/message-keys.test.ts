/**
 * Every key in the database has a matching message in the catalogue every locale assembles.
 *
 * This is the guarantee the compiler used to make and cannot any more. `PROGRAM_BANDS`,
 * `STAFF`, and `SCHEDULES` were `as const` arrays, so their keys were literal union types and
 * a room with no matching copy was a type error. The keys come from the database now, and
 * `t("infants")` against a key nothing translates renders a card with no name.
 *
 * **That failure is quiet and it looks like something else.** A band with no message reaches a
 * Deploy Preview as a blank heading — which reads as a CSS bug, or as a page that half-loaded,
 * and sends whoever finds it looking in the wrong place entirely.
 *
 * ## What #76 changed here
 *
 * Both halves of this join used to be different kinds of thing: rows on one side, the shipped
 * `messages/*.json` files on the other. The copy moved into the database, so the join is now
 * row-to-row — and the catalogue this asserts against is **assembled the way the site
 * assembles it**, through `getProse` and `mergeCatalogues`, rather than by reading a file.
 * That is strictly better: it now also proves the merge itself, which is the step that could
 * drop a namespace.
 *
 * It iterates `routing.locales` rather than the contents of `messages/`, because that list is
 * what the site actually builds pages for. A locale with no rows fails in `getProse`, naming
 * the locale — which is the correct outcome for adding `"de"` to the routing before the German
 * rows exist.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { routing } from "@/i18n/routing";
import { getProse, mergeCatalogues, type Messages } from "@/lib/prose";
import { getDailyRhythm, getProgramBands } from "@/lib/programs";
import { getStaff } from "@/lib/staff";
import { getSchedules } from "@/lib/tuition";

const MESSAGES_DIR = path.resolve(import.meta.dirname, "../../messages");

/** The same two halves `i18n/request.ts` puts together, assembled the same way. */
async function catalogueFor(locale: string): Promise<Messages> {
  const chrome = JSON.parse(
    readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), "utf8"),
  ) as Messages;
  return mergeCatalogues(await getProse(locale), chrome);
}

const catalogues = routing.locales.map((locale) => ({ locale }));

test("there is at least one locale to check", () => {
  // Otherwise every assertion below would iterate an empty list and pass, which is the one
  // way this whole file could go green while proving nothing.
  expect(catalogues.length).toBeGreaterThan(0);
});

/**
 * The keys each row type must resolve to. `namespace` is the block in the catalogue, and
 * `suffixes` are the message names built from the row's key — `maria` needs `mariaRole` and
 * `mariaBio`, while a program band's name is the bare key.
 */
/**
 * What the `Programs` namespace holds for one band, and the single place it is written down.
 *
 * The bare key is the room's name. `Ages` and `GroupSize` arrived with #123, which moved them
 * out of `programs` columns because they are English sentences rather than facts and that table
 * has no locale. Shared with the reverse check below so the two cannot drift: one of them says
 * every band has these, the other says nothing else is in there.
 */
const PROGRAM_SUFFIXES = ["", "Ages", "GroupSize"] as const;

const JOINS = [
  {
    what: "program band",
    keys: async () => (await getProgramBands()).map((band) => band.key),
    expected: [
      { namespace: "Programs", suffixes: PROGRAM_SUFFIXES },
      { namespace: "ProgramsPage", suffixes: ["Detail", "Staffing"] },
      { namespace: "HomePage", suffixes: ["Blurb"] },
    ],
  },
  {
    what: "daily rhythm slot",
    keys: async () => (await getDailyRhythm()).map((slot) => slot.labelKey),
    expected: [{ namespace: "Day", suffixes: [""] }],
  },
  {
    what: "staff member",
    keys: async () => (await getStaff()).map((person) => person.key),
    expected: [{ namespace: "Staff", suffixes: ["Role", "Bio"] }],
  },
  {
    what: "tuition schedule",
    keys: async () => (await getSchedules()).map((schedule) => schedule.key),
    expected: [
      { namespace: "TuitionPage", suffixes: ["Name", "Days", "Body"] },
    ],
  },
] as const;

describe.each(JOINS)("every $what key has copy", ({ keys, expected }) => {
  test.each(catalogues)("in $locale", async ({ locale }) => {
    const messages = await catalogueFor(locale);
    const rowKeys = await keys();

    // A query that returned nothing would make every loop below vacuous.
    expect(rowKeys.length).toBeGreaterThan(0);

    const missing: string[] = [];
    for (const key of rowKeys) {
      for (const { namespace, suffixes } of expected) {
        for (const suffix of suffixes) {
          const messageKey = `${key}${suffix}`;
          const value = messages[namespace]?.[messageKey];
          // An empty string is as blank on the page as a missing key, so it fails too.
          // The prose table rejects blanks with a check constraint; this still catches one
          // arriving from the chrome file.
          if (typeof value !== "string" || value.trim() === "") {
            missing.push(`${namespace}.${messageKey}`);
          }
        }
      }
    }

    expect(missing, "database keys with no message").toEqual([]);
  });
});

/**
 * The reverse direction, and only for the namespaces keyed entirely by database rows.
 *
 * A message with no row is the tamer half of the problem — nothing renders it, so nobody sees
 * anything wrong. It is still worth catching: it means a band or a person was removed from the
 * database and their copy was left behind, and the next person to read the catalogue will
 * reasonably assume the site still shows it.
 *
 * Only `Programs` and `Day` are checked. The other namespaces hold page furniture — headings,
 * intros, labels — alongside their row-keyed entries, so "every key here belongs to a row" is
 * simply not true of them and asserting it would be noise.
 *
 * `Programs` used to be one key per band. Since #123 it is three, and the assertion is built
 * from `PROGRAM_SUFFIXES` rather than loosened to a prefix match — the property being kept is
 * that **every** key in this namespace belongs to a row, which is still exactly true, and a
 * `toEqual` is what makes an orphan visible. Widening it to "starts with a band key" would let
 * a stray `infantsWhatever` live here forever.
 */
describe("copy that no database row renders", () => {
  test.each(catalogues)("in $locale", async ({ locale }) => {
    const messages = await catalogueFor(locale);
    const bandKeys = (await getProgramBands()).map((band) => band.key);
    const rhythmKeys = (await getDailyRhythm()).map((slot) => slot.labelKey);

    expect(Object.keys(messages.Programs ?? {}).sort()).toEqual(
      bandKeys
        .flatMap((key) => PROGRAM_SUFFIXES.map((suffix) => `${key}${suffix}`))
        .sort(),
    );
    expect(Object.keys(messages.Day ?? {}).sort()).toEqual(
      [...rhythmKeys].sort(),
    );
  });
});

/**
 * The chrome file holds chrome and nothing else.
 *
 * Without this, the backfill's boundary decays: the next person adding a string picks the
 * file because editing JSON is easier than writing a row, and the copy drifts back out of the
 * database one string at a time until the editor is missing things again for no stated reason.
 *
 * The list is duplicated from `scripts/generate-prose-backfill.mjs` on purpose. That script is
 * a one-shot tool; this is the standing assertion, and it should fail if someone edits the
 * catalogue without touching the generator.
 */
describe("the catalogue file holds only chrome", () => {
  test.each(catalogues)("in $locale", ({ locale }) => {
    const chrome = JSON.parse(
      readFileSync(path.join(MESSAGES_DIR, `${locale}.json`), "utf8"),
    ) as Messages;

    const keys = Object.entries(chrome).flatMap(([namespace, entries]) =>
      Object.keys(entries).map((key) => `${namespace}.${key}`),
    );

    expect(keys.sort()).toEqual(["Nav.closeMenu", "Nav.label", "Nav.openMenu"]);
  });
});

/**
 * The three strings that get written into other sentences exist in every locale the site routes.
 *
 * #110 moved the age range, the opening hours and the neighbourhood out of `site_settings` and
 * into `prose`, because they are sentences rather than facts. They are not like the rest of the
 * copy in one specific way: **they are interpolated into other prose at render time.**
 *
 *     HomePage.heroEyebrow   'Licensed child care · Ages {ageRange}'
 *     HomePage.heroBody      'A small, licensed center in {neighborhood}, where …'
 *     ProgramsPage.eyebrow   'Ages {ageRange}'
 *
 * So a German catalogue missing `Center.hoursShort` does not leave a quiet gap at the edge of a
 * page — it breaks the sentence that was supposed to contain it. The assertions above join rows
 * to keys and cannot see these three, because no database row renders them; they are standalone
 * strings that only the pages ask for.
 *
 * `i18n/request.ts` does already throw on a missing key, so this cannot ship silently. But that
 * throw happens part-way through a Netlify build, and the point of this suite is to answer the
 * question here instead — in seconds, naming the locale and the key. It matters most for #53 and
 * #54, where the failure would otherwise be a red deploy of an otherwise finished translation.
 */
describe("the strings that other strings interpolate", () => {
  test.each(catalogues)("all present in $locale", async ({ locale }) => {
    const messages = await catalogueFor(locale);

    expect(Object.keys(messages.Center ?? {}).sort()).toEqual([
      "ageRange",
      // Added by #53. `hoursShort` is the full 'Mon–Fri, 7:00 AM – 6:00 PM' for the contact
      // page; `hoursCompact` is the '7am–6pm' the home page's stat card has room for, and it
      // was an English literal in `app/[locale]/page.tsx` until a German page made the
      // difference between a value and a translated value visible.
      "hoursCompact",
      "hoursShort",
      "neighborhood",
    ]);
  });
});
