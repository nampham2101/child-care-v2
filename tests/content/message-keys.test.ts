/**
 * Every key in the database has a matching message in every catalogue.
 *
 * This is the guarantee the compiler used to make and cannot any more. `PROGRAM_BANDS`,
 * `STAFF`, and `SCHEDULES` were `as const` arrays, so their keys were literal union types and
 * a room with no matching copy was a type error. The keys come from the database now, and
 * `t("infants")` against a key nothing translates renders a card with no name.
 *
 * **That failure is quiet and it looks like something else.** A band with no message reaches a
 * Deploy Preview as a blank heading — which reads as a CSS bug, or as a page that half-loaded,
 * and sends whoever finds it looking in the wrong place entirely. So it is asserted here
 * instead, against both halves of the join for real: the live rows on one side, the shipped
 * catalogues on the other.
 *
 * It runs over **every** file in `messages/`, not just `en.json`. There is one locale today;
 * the German and Italian catalogues are already ticketed, and a translation that forgets a
 * staff bio should fail here rather than shipping a nameless person to that locale's visitors.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, test } from "vitest";

import { getDailyRhythm, getProgramBands } from "@/lib/programs";
import { getStaff } from "@/lib/staff";
import { getSchedules } from "@/lib/tuition";

const MESSAGES_DIR = path.resolve(import.meta.dirname, "../../messages");

type Catalogue = Record<string, Record<string, unknown>>;

const catalogues = readdirSync(MESSAGES_DIR)
  .filter((file) => file.endsWith(".json"))
  .map((file) => ({
    locale: path.basename(file, ".json"),
    messages: JSON.parse(
      readFileSync(path.join(MESSAGES_DIR, file), "utf8"),
    ) as Catalogue,
  }));

test("there is at least one catalogue to check against", () => {
  // Otherwise every assertion below would iterate an empty list and pass, which is the one
  // way this whole file could go green while proving nothing.
  expect(catalogues.length).toBeGreaterThan(0);
});

/**
 * The keys each row type must resolve to. `namespace` is the block in the catalogue, and
 * `suffixes` are the message names built from the row's key — `maria` needs `mariaRole` and
 * `mariaBio`, while a program band's name is the bare key.
 */
const JOINS = [
  {
    what: "program band",
    keys: async () => (await getProgramBands()).map((band) => band.key),
    expected: [
      { namespace: "Programs", suffixes: [""] },
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
  test.each(catalogues)("in $locale", async ({ messages }) => {
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
 */
describe("copy that no database row renders", () => {
  test.each(catalogues)("in $locale", async ({ messages }) => {
    const bandKeys = (await getProgramBands()).map((band) => band.key);
    const rhythmKeys = (await getDailyRhythm()).map((slot) => slot.labelKey);

    expect(Object.keys(messages.Programs ?? {}).sort()).toEqual(
      [...bandKeys].sort(),
    );
    expect(Object.keys(messages.Day ?? {}).sort()).toEqual(
      [...rhythmKeys].sort(),
    );
  });
});
