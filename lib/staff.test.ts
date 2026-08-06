import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  averageTenure,
  featuredStaff,
  initialsOf,
  type StaffMember,
  yearsWith,
} from "@/lib/staff";

/**
 * Tenure is date arithmetic against the wall clock, which makes it the one piece of logic
 * here that can be correct all year and wrong on the first of January. `lib/staff.ts` stores
 * a joining year rather than a tenure precisely so that rollover is computed instead of
 * going stale — these tests hold the clock still and step it over the boundary to prove it.
 *
 * Only `Date` is faked. Nothing under test schedules a timer, and leaving the rest of the
 * clock real keeps a hung test hanging visibly rather than silently.
 */
const MID_2026 = new Date(2026, 5, 15);
const LAST_DAY_OF_2026 = new Date(2026, 11, 31);
const FIRST_DAY_OF_2027 = new Date(2027, 0, 1);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(MID_2026);
});

afterEach(() => {
  vi.useRealTimers();
});

/**
 * A fixture rather than the real team, which these tests used to import as a constant.
 *
 * The team now comes from the database, and reaching for it here would trade a suite that
 * answers in milliseconds for one that needs a network and a seeded project — and would fail
 * for reasons that have nothing to do with the arithmetic under test. These functions take
 * their rows as an argument specifically so this can stay a pure unit test.
 *
 * The joining years mirror the seeded team exactly, so the worked averages below stay
 * checkable against the real site. `tests/content/` is what asserts the two still agree.
 */
const TEAM: StaffMember[] = [
  { key: "maria", name: "Maria Delgado", since: 2014, isFeatured: true },
  { key: "nadia", name: "Nadia Okonkwo", since: 2017, isFeatured: false },
  { key: "aisha", name: "Aisha Bello", since: 2018, isFeatured: true },
  { key: "grace", name: "Grace Lim", since: 2021, isFeatured: false },
  { key: "daniel", name: "Daniel Ruiz", since: 2019, isFeatured: false },
  { key: "tom", name: "Tom Fischer", since: 2020, isFeatured: true },
  { key: "sofia", name: "Sofia Marchetti", since: 2015, isFeatured: false },
];

const maria = TEAM.find((person) => person.key === "maria")!;
const grace = TEAM.find((person) => person.key === "grace")!;

describe("yearsWith", () => {
  it("counts whole years from the joining year", () => {
    expect(maria.since).toBe(2014);
    expect(yearsWith(maria)).toBe(12);

    expect(grace.since).toBe(2021);
    expect(yearsWith(grace)).toBe(5);
  });

  it("does not roll over until the new year actually starts", () => {
    vi.setSystemTime(LAST_DAY_OF_2026);
    expect(yearsWith(maria)).toBe(12);
  });

  it("rolls over on the first of January without anyone editing a file", () => {
    vi.setSystemTime(FIRST_DAY_OF_2027);
    expect(yearsWith(maria)).toBe(13);
  });
});

describe("averageTenure", () => {
  /**
   * Seven people joining 2014, 2015, 2017, 2018, 2019, 2020 and 2021 have 58 years between
   * them in 2026 — a mean of 8.28, which a parent reads as eight.
   */
  it("is the mean tenure across the whole team, rounded to a whole year", () => {
    expect(TEAM).toHaveLength(7);
    expect(averageTenure(TEAM)).toBe(8);
  });

  it("always reports a whole number of years", () => {
    expect(Number.isInteger(averageTenure(TEAM))).toBe(true);
  });

  it("advances with the calendar, like every tenure it averages", () => {
    vi.setSystemTime(FIRST_DAY_OF_2027);
    expect(averageTenure(TEAM)).toBe(9);
  });

  it("cannot be carried by one long-serving director", () => {
    const longest = Math.max(...TEAM.map(yearsWith));
    expect(averageTenure(TEAM)).toBeLessThan(longest);
  });

  /**
   * The rows now arrive from a query, so the function can be handed a shorter list than the
   * one it was written against — a filtered result, or a team of one. The mean of a single
   * tenure is that tenure.
   */
  it("handles a team of one, which a query can now return", () => {
    expect(averageTenure([maria])).toBe(12);
  });
});

describe("initialsOf", () => {
  it("takes the first letter of each part of the name", () => {
    expect(initialsOf("Maria Delgado")).toBe("MD");
    expect(initialsOf("Sofia Marchetti")).toBe("SM");
  });

  it("produces initials for every member of the team", () => {
    for (const person of TEAM) {
      expect(initialsOf(person.name)).toMatch(/^[A-Z]+$/);
    }
  });
});

describe("featuredStaff", () => {
  it("is the three the home page strip introduces", () => {
    expect(featuredStaff(TEAM).map((person) => person.key)).toEqual([
      "maria",
      "aisha",
      "tom",
    ]);
  });

  it("keeps the order of the full list, so both pages agree", () => {
    const order = TEAM.map((person) => person.key);
    const featuredOrder = featuredStaff(TEAM).map((person) =>
      order.indexOf(person.key),
    );
    expect(featuredOrder).toEqual([...featuredOrder].sort((a, b) => a - b));
  });

  /**
   * It filters rather than reordering. The order is `sort_order` from the query now, not an
   * array literal, so a change to that column must not be able to reshuffle the strip
   * independently of the full list.
   */
  it("preserves the order it was given rather than imposing one", () => {
    const reversed = [...TEAM].reverse();
    expect(featuredStaff(reversed).map((person) => person.key)).toEqual([
      "tom",
      "aisha",
      "maria",
    ]);
  });
});
