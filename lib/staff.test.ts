import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  averageTenure,
  FEATURED_STAFF,
  initialsOf,
  STAFF,
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

const maria = STAFF.find((person) => person.key === "maria")!;
const grace = STAFF.find((person) => person.key === "grace")!;

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
    expect(STAFF).toHaveLength(7);
    expect(averageTenure()).toBe(8);
  });

  it("always reports a whole number of years", () => {
    expect(Number.isInteger(averageTenure())).toBe(true);
  });

  it("advances with the calendar, like every tenure it averages", () => {
    vi.setSystemTime(FIRST_DAY_OF_2027);
    expect(averageTenure()).toBe(9);
  });

  it("cannot be carried by one long-serving director", () => {
    const longest = Math.max(...STAFF.map(yearsWith));
    expect(averageTenure()).toBeLessThan(longest);
  });
});

describe("initialsOf", () => {
  it("takes the first letter of each part of the name", () => {
    expect(initialsOf("Maria Delgado")).toBe("MD");
    expect(initialsOf("Sofia Marchetti")).toBe("SM");
  });

  it("produces initials for every member of the team", () => {
    for (const person of STAFF) {
      expect(initialsOf(person.name)).toMatch(/^[A-Z]+$/);
    }
  });
});

describe("FEATURED_STAFF", () => {
  it("is the three the home page strip introduces", () => {
    expect(FEATURED_STAFF.map((person) => person.key)).toEqual([
      "maria",
      "aisha",
      "tom",
    ]);
  });

  it("keeps the order of the full list, so both pages agree", () => {
    const order = STAFF.map((person) => person.key);
    const featuredOrder = FEATURED_STAFF.map((person) =>
      order.indexOf(person.key),
    );
    expect(featuredOrder).toEqual([...featuredOrder].sort((a, b) => a - b));
  });
});
