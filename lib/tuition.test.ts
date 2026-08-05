import { describe, expect, it } from "vitest";

import { PROGRAM_BANDS } from "@/lib/programs";
import { formatRate, lowestFullTimeRate, SCHEDULES } from "@/lib/tuition";

/**
 * The two pieces of money logic on the tuition page. Playwright already asserts the rendered
 * strings in the rate table, but it does so by matching whole cells — a formatting change
 * would fail there as an unrelated-looking selector error, and only for the handful of
 * figures that page happens to print. These test the functions directly.
 */

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
  const fiveDay = SCHEDULES[0].perMonth;

  it("is the 'from' figure the hero prints", () => {
    expect(formatRate(lowestFullTimeRate())).toBe("$1,565");
  });

  /**
   * Found rather than typed is the whole point of the function, so these assert the
   * relationship to the rate sheet instead of only the number above. A copy-paste that
   * returned the highest rate, or read the three-day column, would pass the test above if
   * the sheet ever changed to match — it cannot pass these.
   */
  it("reads the five-day column, not another schedule", () => {
    expect(Object.values(fiveDay)).toContain(lowestFullTimeRate());
  });

  it("is the lowest of the five-day rates, not the highest", () => {
    const rates = PROGRAM_BANDS.map((band) => fiveDay[band.key]);
    for (const rate of rates) {
      expect(lowestFullTimeRate()).toBeLessThanOrEqual(rate);
    }
    expect(rates.length).toBeGreaterThan(1);
  });
});
