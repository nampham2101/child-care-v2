/**
 * The three age bands and the shape of a day here, as facts.
 *
 * Ratios and ages are the numbers a parent writes down when comparing centers, and they
 * now appear in two places — the home page's summary cards and the full `/programs` page.
 * A ratio that says 1:4 on one page and 1:5 on the other is worse than no ratio at all,
 * so the numbers are defined once here and both pages read them, the same way
 * `@/lib/center` owns the license number.
 *
 * Only facts live here. The visible prose — band names, the label on each clock time —
 * lives in `messages/en.json` under the `Programs` and `Day` namespaces, keyed by the
 * `key` and `labelKey` fields below, so the copy is translatable while the numbers stay
 * a plain fact in code.
 *
 * Order is youngest-first, and that ordering is asserted in the end-to-end tests: a
 * parent arrives knowing their child's age and nothing else, so the first band they see
 * must be the youngest.
 */
export const PROGRAM_BANDS = [
  {
    key: "infants",
    ageLabel: "6 weeks – 15 months",
    ratio: "1:4",
    groupSize: "8 children",
  },
  {
    key: "toddlers",
    ageLabel: "15 months – 3 years",
    ratio: "1:5",
    groupSize: "10 children",
  },
  {
    key: "preschool",
    ageLabel: "3 – 5 years",
    ratio: "1:9",
    groupSize: "18 children",
  },
] as const;

export type ProgramBandKey = (typeof PROGRAM_BANDS)[number]["key"];

/**
 * The daily rhythm, in the order it happens.
 *
 * Times are 12-hour without a meridiem because the whole list runs 7:00 to 4:30 in one
 * day and the column reads faster without seven repetitions of "AM". The center's opening
 * and closing hours are stated in full in `@/lib/center`.
 */
export const DAILY_RHYTHM = [
  { time: "7:00", labelKey: "arrival" },
  { time: "8:30", labelKey: "breakfast" },
  { time: "9:30", labelKey: "centers" },
  { time: "11:30", labelKey: "lunch" },
  { time: "12:30", labelKey: "nap" },
  { time: "3:00", labelKey: "snack" },
  { time: "4:30", labelKey: "pickup" },
] as const;
