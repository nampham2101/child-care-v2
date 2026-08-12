import { describe, expect, it } from "vitest";

import { formatRate, lowestFullTimeRate, type Schedule } from "@/lib/tuition";

/**
 * The two pieces of money logic on the tuition page. Playwright already asserts the rendered
 * strings in the rate table, but it does so by matching whole cells — a formatting change
 * would fail there as an unrelated-looking selector error, and only for the handful of
 * figures that page happens to print. These test the functions directly.
 *
 * The rates are a fixture rather than the real sheet, which this file used to import as a
 * constant. They come from the database now, and reaching for them here would trade a suite
 * that answers in milliseconds for one needing a network and a seeded project — failing for
 * reasons unrelated to the arithmetic. `lowestFullTimeRate` takes its schedules as an
 * argument precisely so this stays a pure unit test.
 *
 * The figures mirror the seeded sheet exactly, so the worked numbers below stay checkable
 * against the real site.
 */
const SHEET: Schedule[] = [
  {
    key: "fiveDay",
    perMonth: { infants: 2140, toddlers: 1840, preschool: 1565 },
  },
  {
    key: "threeDay",
    perMonth: { infants: 1490, toddlers: 1285, preschool: 1095 },
  },
  { key: "twoDay", perMonth: { infants: 1075, toddlers: 925, preschool: 790 } },
];

describe("formatRate", () => {
  it("prints whole dollars with a grouping separator and no cents", () => {
    expect(formatRate(2140)).toBe("$2,140");
    expect(formatRate(790)).toBe("$790");
    expect(formatRate(0)).toBe("$0");
  });

  it("rounds to the nearest dollar rather than truncating", () => {
    expect(formatRate(1234.56)).toBe("$1,235");
    expect(formatRate(1234.44)).toBe("$1,234");
  });

  /**
   * The exact shape is the assertion, not incidental to it. `en-US` is pinned in the source
   * on purpose: these are US dollars at a Portland center, so a second locale must not
   * re-render them as `2.140 $`. Asserting symbol-first with comma grouping is what catches
   * a well-meaning change to the active locale.
   */
  it("stays en-US, so a second locale cannot re-render the currency", () => {
    expect(formatRate(2140)).toBe("$2,140");
    expect(formatRate(2140)).not.toContain(".");
  });
});

describe("lowestFullTimeRate", () => {
  const fiveDay = SHEET[0].perMonth;

  it("is the 'from' figure the hero prints", () => {
    expect(formatRate(lowestFullTimeRate(SHEET))).toBe("$1,565");
  });

  /**
   * Found rather than typed is the whole point of the function, so these assert the
   * relationship to the rate sheet instead of only the number above. A copy-paste that
   * returned the highest rate, or read the three-day column, would pass the test above if
   * the sheet ever changed to match — it cannot pass these.
   */
  it("reads the five-day column, not another schedule", () => {
    expect(Object.values(fiveDay)).toContain(lowestFullTimeRate(SHEET));
  });

  it("is the lowest of the five-day rates, not the highest", () => {
    const rates = Object.values(fiveDay);
    for (const rate of rates) {
      expect(lowestFullTimeRate(SHEET)).toBeLessThanOrEqual(rate);
    }
    expect(rates.length).toBeGreaterThan(1);
  });

  /**
   * The widest schedule is first because `sort_order` says so, not because an array literal
   * did. If that ordering were ever reversed, the "from" figure would silently become the
   * cheapest two-day place — a number a parent would act on and no assertion above would
   * catch, since it would still be a real rate from a real column.
   */
  it("reads the first schedule it is given, whichever that is", () => {
    const reversed = [...SHEET].reverse();
    expect(lowestFullTimeRate(reversed)).toBe(790);
  });
});
