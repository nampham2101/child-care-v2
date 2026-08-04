import { PROGRAM_BANDS, type ProgramBandKey } from "@/lib/programs";

/**
 * What a place costs, as facts.
 *
 * Rates are the numbers a parent writes down beside the ratios from `@/lib/programs`, and
 * they belong in code for the same reason those do: the moment a figure is typed into a
 * page it can drift from the figure typed into another one. `@/lib/center` owns the
 * license number on the same terms.
 *
 * Only facts live here. Room names come from the `Programs` namespace in
 * `messages/en.json` and schedule names from `TuitionPage`, keyed by the fields below, so
 * the copy stays translatable while the money stays a plain fact in code.
 *
 * Placeholder figures for a fictional center, in the range a Portland center actually
 * charges — a rate sheet of round numbers reads as invented, and the point of publishing
 * rates at all is that a parent can compare them against the center down the road.
 */

/**
 * The schedules a family can buy, widest first.
 *
 * `perMonth` is keyed by room rather than derived from a full-time rate: a part-time place
 * costs more per day than a full-time one, because the room still has to staff the day
 * whether or not a particular child is in it. Deriving these from a percentage would hide
 * that, and the whole argument of this page is that the arithmetic is shown.
 */
export const SCHEDULES = [
  {
    key: "fiveDay",
    perMonth: { infants: 2140, toddlers: 1840, preschool: 1565 },
  },
  {
    key: "threeDay",
    perMonth: { infants: 1490, toddlers: 1285, preschool: 1095 },
  },
  {
    key: "twoDay",
    perMonth: { infants: 1075, toddlers: 925, preschool: 790 },
  },
] as const satisfies readonly {
  key: string;
  // Every room in `PROGRAM_BANDS` must have a rate. Adding a fourth band is then a type
  // error here rather than an empty cell a parent discovers in the table.
  perMonth: Record<ProgramBandKey, number>;
}[];

export type ScheduleKey = (typeof SCHEDULES)[number]["key"];

/**
 * The one-off and recurring sums that are not the monthly rate.
 *
 * These are what a rate sheet usually omits and a parent finds out about at signing, which
 * is why they sit in the hero rather than in a footnote.
 */
export const FEES = {
  registration: 75,
  depositWeeks: 2,
  noticeWeeks: 4,
  latePickupPerMinute: 2,
  siblingDiscountPercent: 10,
} as const;

/** The lowest full-time rate on the sheet — the "from" figure, found rather than typed. */
export function lowestFullTimeRate(): number {
  const fiveDay = SCHEDULES[0].perMonth;
  return Math.min(...PROGRAM_BANDS.map((band) => fiveDay[band.key]));
}

/**
 * A rate as a parent reads it. `en-US` explicitly rather than the active locale: these are
 * US dollars at a Portland center, so the currency and its grouping do not change when a
 * second locale ships — only the prose around them will.
 */
export function formatRate(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}
