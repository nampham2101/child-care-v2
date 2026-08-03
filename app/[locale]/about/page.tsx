import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CallButton } from "@/components/site/CallButton";
import { HeroFacts } from "@/components/site/HeroFacts";
import { PageHero } from "@/components/site/PageHero";
import { CENTER } from "@/lib/center";
import { PROGRAM_BANDS } from "@/lib/programs";

/**
 * `/about` — the page a parent opens when they have decided the center looks plausible
 * and now want to know whether to believe it.
 *
 * `/programs` answers "which room would my child be in". This page answers the question
 * underneath it: is this place actually careful. So it leads with the beliefs that explain
 * the staffing decisions, then puts the evidence a parent can check — ratios, the license
 * number, the safety routines — directly under each one. Claim first, then the fact that
 * backs it, in that order on purpose.
 *
 * The ratios table reads `@/lib/programs`, the same list the home and programs pages use,
 * so a parent who compares this page against `/programs` never finds two different
 * numbers. Copy is placeholder in the home page's voice; real copy is a v1.0.0 task.
 *
 * A Server Component with no interactivity — nothing here needs `"use client"`.
 */

type PageProps = { params: Promise<{ locale: string }> };

// ICU renders a raw 2009 as "2,009" — the year is a label, so it is passed as a string.
const licensedSince = String(CENTER.yearsOperatingSince);

// The three beliefs, in the order a parent's worry arrives: who holds my child, what
// their day is like, and whether I will be told the truth about it. Keys name the strings
// in `messages/en.json` rather than repeating the block markup three times.
const PHILOSOPHY_KEYS = ["Known", "Rhythm", "Plain"] as const;

// Safety, as the routines it actually consists of. Same key-driven shape as above.
const SAFETY_KEYS = [
  "Entry",
  "SignIn",
  "Allergy",
  "Illness",
  "Drills",
] as const;

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "AboutPage" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription", { since: licensedSince }),
  };
}

export default async function About({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("AboutPage");
  const tBands = await getTranslations("Programs");

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5">
      {/* The licensing facts sit here rather than beside the licensing prose below: they
          are what a parent scrolls this page to verify, and the section down there is
          where they are explained, not where they need to be listed a second time. */}
      <PageHero
        eyebrow={t("eyebrow", { since: licensedSince })}
        heading={t("heading")}
        headingId="about-heading"
        intro={t("intro")}
        card={
          <HeroFacts
            facts={[
              { label: t("licensingNumberLabel"), value: CENTER.licenseNumber },
              { label: t("licensingSinceLabel"), value: licensedSince },
              {
                label: t("licensingInspectionsLabel"),
                value: t("licensingInspectionsValue"),
              },
            ]}
          />
        }
      />

      {/* Philosophy — stated as three positions, because a belief a center will not put
          in a sentence is not one it runs on. */}
      <section
        className="border-t border-border py-14 sm:py-20"
        aria-labelledby="philosophy-heading"
      >
        <h2
          id="philosophy-heading"
          className="text-2xl font-semibold text-ink-900 sm:text-3xl"
        >
          {t("philosophyHeading")}
        </h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {PHILOSOPHY_KEYS.map((key) => (
            <article
              key={key}
              className="rounded-2xl border border-border bg-surface p-6"
            >
              <h3 className="text-lg font-semibold text-balance text-ink-900">
                {t(`philosophy${key}Title`)}
              </h3>
              <p className="mt-3 text-ink-700">{t(`philosophy${key}Body`)}</p>
            </article>
          ))}
        </div>
      </section>

      {/* Ratios — the numbers a parent writes down, as a table they can read across
          rather than three separate panels, since this page's job is comparison. */}
      <section
        className="border-t border-border py-14 sm:py-20"
        aria-labelledby="ratios-heading"
      >
        <h2
          id="ratios-heading"
          className="text-2xl font-semibold text-ink-900 sm:text-3xl"
        >
          {t("ratiosHeading")}
        </h2>
        <p className="mt-2 max-w-xl text-ink-700">{t("ratiosBody")}</p>

        {/* The ages column is allowed to wrap on a narrow phone; the ratio and group
            columns are short enough that they never do. Wrapping beats a horizontal
            scroll here — a parent comparing centers should see all four columns at once
            rather than discover the third one by swiping. */}
        <div className="mt-8">
          <table className="w-full border-collapse text-left">
            <caption className="sr-only">{t("ratiosTableCaption")}</caption>
            <thead>
              <tr className="border-b border-border">
                {[
                  t("ratiosRoom"),
                  t("ratiosAges"),
                  t("ratiosRatio"),
                  t("ratiosGroup"),
                ].map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className="py-3 pr-4 text-sm font-medium text-ink-500 sm:pr-6"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PROGRAM_BANDS.map((band) => (
                <tr key={band.key} className="border-b border-border">
                  <th
                    scope="row"
                    className="py-4 pr-4 font-semibold text-ink-900 sm:pr-6"
                  >
                    {tBands(band.key)}
                  </th>
                  <td className="py-4 pr-4 text-ink-700 tabular-nums sm:pr-6">
                    {band.ageLabel}
                  </td>
                  <td className="py-4 pr-4 text-ink-900 tabular-nums sm:pr-6">
                    {band.ratio}
                  </td>
                  <td className="py-4 pr-4 whitespace-nowrap text-ink-700 tabular-nums sm:pr-6">
                    {band.groupSize}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-4 max-w-xl text-sm text-ink-500">
          {t("ratiosFootnote")}
        </p>
      </section>

      {/* Licensing — the license number appears in the footer on every page; here it is
          shown with what it actually means, which the footer has no room to say. */}
      <section
        className="border-t border-border py-14 sm:py-20"
        aria-labelledby="licensing-heading"
      >
        <h2
          id="licensing-heading"
          className="text-2xl font-semibold text-ink-900 sm:text-3xl"
        >
          {t("licensingHeading")}
        </h2>
        {/* The number, the year, and the inspection cadence are in the hero card now, so
            this section explains rather than restates them. */}
        <p className="mt-2 max-w-xl text-ink-700">
          {t("licensingBody", { since: licensedSince })}
        </p>
        <p className="mt-4 max-w-xl text-ink-700">{t("licensingStaffLine")}</p>
        <p className="mt-4 max-w-xl text-sm text-ink-500">
          {t("licensingRecords")}
        </p>
      </section>

      {/* Safety — routines, not reassurance. */}
      <section
        className="border-t border-border py-14 sm:py-20"
        aria-labelledby="safety-heading"
      >
        <h2
          id="safety-heading"
          className="text-2xl font-semibold text-ink-900 sm:text-3xl"
        >
          {t("safetyHeading")}
        </h2>
        <p className="mt-2 max-w-xl text-ink-700">{t("safetyBody")}</p>
        {/* Five routines in a two-column grid leaves the last one alone in a half-empty
            row, which reads as an unfinished page rather than a deliberate one. It spans
            both columns instead — the count is odd because the routines are what they
            are, so the layout bends rather than the content. */}
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {SAFETY_KEYS.map((key) => (
            <article
              key={key}
              className="rounded-2xl border border-border bg-surface p-6 sm:last:col-span-2"
            >
              <h3 className="text-lg font-semibold text-ink-900">
                {t(`safety${key}Title`)}
              </h3>
              <p className="mt-3 text-ink-700">{t(`safety${key}Body`)}</p>
            </article>
          ))}
        </div>
      </section>

      {/* The conversion action. There is no form anywhere on this site by decision — the
          next step is a phone call. */}
      <section
        className="border-t border-border py-14 sm:py-20"
        aria-labelledby="visit-heading"
      >
        <h2
          id="visit-heading"
          className="text-2xl font-semibold text-ink-900 sm:text-3xl"
        >
          {t("visitHeading")}
        </h2>
        <p className="mt-2 max-w-xl text-ink-700">{t("visitBody")}</p>
        <div className="mt-7">
          <CallButton />
        </div>
      </section>
    </main>
  );
}
