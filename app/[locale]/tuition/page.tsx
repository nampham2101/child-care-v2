import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { HeroFacts } from "@/components/site/HeroFacts";
import { PageHero } from "@/components/site/PageHero";
import { VisitSection } from "@/components/site/VisitSection";
import { getProgramBands } from "@/lib/programs";
import {
  formatRate,
  getFees,
  getSchedules,
  lowestFullTimeRate,
} from "@/lib/tuition";

/**
 * `/tuition` — the page most centers do not have, because most centers make you call.
 *
 * The whole argument of this site is evidence rather than adjectives, and a center that
 * will not publish its rates has picked the moment of maximum sunk cost — the end of a
 * tour — to name a number. So every rate is on the page, and the fees that usually surface
 * at signing are in the hero rather than a footnote: late pickup, the deposit, the notice
 * period, what the annual increase looks like.
 *
 * Rates come from `@/lib/tuition` and the rooms from `@/lib/programs`, shared with
 * `/programs` and `/about`, so the rate table cannot list a room the rest of the site does
 * not have. Copy is placeholder in the home page voice; real rates are a v1.0.0 task.
 *
 * A Server Component with no interactivity — nothing here needs `"use client"`.
 */

type PageProps = { params: Promise<{ locale: string }> };

// What a rate sheet leaves out, in the order it costs a family money. Keys name strings in the
// catalogue — `public.prose` rows since #76 — rather than repeating the block markup five times.
const HIDDEN_KEYS = [
  "Late",
  "Closures",
  "Increase",
  "Sibling",
  "Help",
] as const;

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "TuitionPage" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function Tuition({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("TuitionPage");
  const tBands = await getTranslations("Programs");

  // `getSchedules` guarantees every schedule carries a rate for every band, so the grid
  // below cannot render a blank cell where a price belongs — a guarantee the type system
  // used to make and the schema cannot. See `@/lib/tuition`.
  const [bands, schedules, fees] = await Promise.all([
    getProgramBands(),
    getSchedules(),
    getFees(),
  ]);

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5">
      {/* The card holds the sums that are not the monthly rate. Every figure in the table
          below is deliberately absent from it — the table is where rates are read, and
          printing two of them up here would be the same fact twice. What a parent cannot
          get from the table is what else they will be charged, so that is what sits
          beside the promise. See `docs/CONVENTIONS.md`. */}
      <PageHero
        eyebrow={t("eyebrow", {
          lowest: formatRate(lowestFullTimeRate(schedules)),
        })}
        heading={t("heading")}
        headingId="tuition-heading"
        intro={t("intro")}
        card={
          <HeroFacts
            facts={[
              {
                label: t("factRegistrationLabel"),
                value: t("factRegistrationValue", {
                  amount: formatRate(fees.registration),
                }),
              },
              {
                label: t("factDepositLabel"),
                value: t("factDepositValue", { weeks: fees.depositWeeks }),
              },
              {
                label: t("factIncludedLabel"),
                value: t("factIncludedValue"),
              },
              {
                label: t("factNoticeLabel"),
                value: t("factNoticeValue", { weeks: fees.noticeWeeks }),
              },
            ]}
          />
        }
      />

      {/* The rates themselves, as a grid a parent can read in either direction: across a
          row to price their own child's room, or down a column to see what dropping to
          three days would save. Two separate lists could not do the second. */}
      <section
        className="border-t border-border py-14 sm:py-20"
        aria-labelledby="rates-heading"
      >
        <h2
          id="rates-heading"
          className="text-2xl font-semibold text-ink-900 sm:text-3xl"
        >
          {t("ratesHeading")}
        </h2>
        <p className="mt-2 max-w-xl text-ink-700">{t("ratesBody")}</p>

        {/* Four columns of short values — a room name and three prices — so every column
            fits at phone width without a horizontal scroll. A parent comparing centers
            should see the whole sheet at once rather than discover a column by swiping. */}
        <div className="mt-8">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">{t("ratesTableCaption")}</caption>
            <thead>
              <tr className="border-b border-border">
                <th
                  scope="col"
                  className="py-3 pr-4 text-sm font-medium text-ink-500 sm:pr-6"
                >
                  {t("ratesRoom")}
                </th>
                {schedules.map((schedule) => (
                  <th
                    key={schedule.key}
                    scope="col"
                    className="py-3 pr-4 text-sm font-medium text-ink-500 sm:pr-6"
                  >
                    {t(`${schedule.key}Name`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bands.map((band) => (
                <tr key={band.key} className="border-b border-border">
                  <th
                    scope="row"
                    className="py-4 pr-4 font-semibold text-ink-900 sm:pr-6"
                  >
                    {tBands(band.key)}
                  </th>
                  {schedules.map((schedule) => (
                    <td
                      key={schedule.key}
                      className="py-4 pr-4 whitespace-nowrap text-ink-900 tabular-nums sm:pr-6"
                    >
                      {formatRate(schedule.perMonth[band.key])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-xl text-sm text-ink-500">
          {t("ratesFootnote")}
        </p>
      </section>

      {/* Schedules — the table prices them, this says what buying one is actually like,
          which is mostly about which days and whether they can be changed. */}
      <section
        className="border-t border-border py-14 sm:py-20"
        aria-labelledby="schedules-heading"
      >
        <h2
          id="schedules-heading"
          className="text-2xl font-semibold text-ink-900 sm:text-3xl"
        >
          {t("schedulesHeading")}
        </h2>
        <p className="mt-2 max-w-xl text-ink-700">{t("schedulesBody")}</p>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {schedules.map((schedule) => (
            <article
              key={schedule.key}
              className="rounded-2xl border border-border bg-surface p-6"
            >
              <h3 className="text-lg font-semibold text-ink-900">
                {t(`${schedule.key}Name`)}
              </h3>
              {/* The days, not the price: the price is one section up, and a parent
                  choosing a schedule is choosing which mornings are theirs. */}
              <p className="mt-1 text-sm text-sage-700">
                {t(`${schedule.key}Days`)}
              </p>
              <p className="mt-3 text-ink-700">{t(`${schedule.key}Body`)}</p>
            </article>
          ))}
        </div>
        <p className="mt-6 max-w-xl text-sm text-ink-500">
          {t("schedulesSwitching")}
        </p>
      </section>

      {/* The honest part. This section is the reason the page exists in this voice — a
          rate a parent cannot trust is worth less than no rate at all. */}
      <section
        className="border-t border-border py-14 sm:py-20"
        aria-labelledby="hidden-heading"
      >
        <h2
          id="hidden-heading"
          className="text-2xl font-semibold text-ink-900 sm:text-3xl"
        >
          {t("hiddenHeading")}
        </h2>
        <p className="mt-2 max-w-xl text-ink-700">{t("hiddenBody")}</p>
        {/* Five items in a two-column grid leave the last one alone in a half-empty row,
            so it spans both instead — the same treatment `/about` gives its five safety
            routines, for the same reason. */}
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {HIDDEN_KEYS.map((key) => (
            <article
              key={key}
              className="rounded-2xl border border-border bg-surface p-6 sm:last:col-span-2"
            >
              <h3 className="text-lg font-semibold text-ink-900">
                {t(`hidden${key}Title`)}
              </h3>
              <p className="mt-3 text-ink-700">
                {t(`hidden${key}Body`, {
                  amount: formatRate(fees.latePickupPerMinute),
                  percent: fees.siblingDiscountPercent,
                })}
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* The conversion action. Shared with every other page, so the four things standing
          in front of the call are answered the same way here as on `/about`. */}
      <VisitSection heading={t("visitHeading")} body={t("visitBody")} />
    </main>
  );
}
