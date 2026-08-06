import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { DayTimeline } from "@/components/site/DayTimeline";
import { HeroFacts } from "@/components/site/HeroFacts";
import { PageHero } from "@/components/site/PageHero";
import { VisitSection } from "@/components/site/VisitSection";
import { getCenter } from "@/lib/center";
import { PROGRAM_BANDS } from "@/lib/programs";

/**
 * `/programs` — the page a parent opens second, after deciding the home page is worth
 * another minute.
 *
 * The home page answers "is this a real, careful place?" in three cards. This page
 * answers the question those cards raise: which room would my child be in, who is in it,
 * and what happens there all day. So each band gets a section of its own with the two
 * numbers a parent writes down — ratio and group size — pulled out where they can be
 * compared against the center down the road, and the day's rhythm sits underneath as the
 * spine all three rooms share.
 *
 * Bands render youngest-first from `@/lib/programs`, because a parent arrives knowing
 * their child's age and nothing else. Copy is placeholder in the home page's voice; real
 * copy is a v1.0.0 task.
 *
 * A Server Component with no interactivity — nothing here needs `"use client"`.
 */

type PageProps = { params: Promise<{ locale: string }> };

// Per-page title and description, read from the message catalogue rather than hardcoded,
// so a second locale gets a localized `<title>` without touching this file. The root
// layout's `title.template` appends the center name, so `metaTitle` is just "Programs".
export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ProgramsPage" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function Programs({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("ProgramsPage");
  const tBands = await getTranslations("Programs");
  const center = await getCenter();

  // Detail and staffing copy is per-band, so the key is built from the band key rather
  // than written out three times. `as const` on PROGRAM_BANDS keeps these keys checked.
  const bandCopy = {
    infants: {
      detail: t("infantsDetail"),
      staffing: t("infantsStaffing"),
    },
    toddlers: {
      detail: t("toddlersDetail"),
      staffing: t("toddlersStaffing"),
    },
    preschool: {
      detail: t("preschoolDetail"),
      staffing: t("preschoolStaffing"),
    },
  };

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5">
      {/* The card is the three ratios, which is what a parent opens this page to find.
          The rooms below give each one its context; the hero gives the numbers first. */}
      <PageHero
        eyebrow={t("eyebrow", { ageRange: center.ageRange })}
        heading={t("heading")}
        headingId="programs-heading"
        intro={t("intro")}
        card={
          <HeroFacts
            facts={PROGRAM_BANDS.map((band) => ({
              label: tBands(band.key),
              value: `${band.ratio} · ${band.groupSize}`,
            }))}
          />
        }
      />

      {/* One section per room, youngest-first. The facts panel repeats the age range that
          sits under the heading — a parent scanning only the panels should not have to
          look back up to know which ages it describes. */}
      {PROGRAM_BANDS.map((band) => (
        <article
          key={band.key}
          id={band.key}
          className="scroll-mt-20 border-t border-border py-12 sm:py-16"
          aria-labelledby={`${band.key}-heading`}
        >
          <div className="grid gap-8 sm:grid-cols-3">
            <div className="sm:col-span-2">
              <h2
                id={`${band.key}-heading`}
                className="text-2xl font-semibold text-ink-900 sm:text-3xl"
              >
                {tBands(band.key)}
              </h2>
              <p className="mt-1 text-sm text-ink-500">{band.ageLabel}</p>
              <p className="mt-4 text-ink-700">{bandCopy[band.key].detail}</p>
              <p className="mt-4 text-ink-700">{bandCopy[band.key].staffing}</p>
            </div>

            <dl className="h-fit rounded-2xl border border-border bg-surface p-6">
              {[
                { label: t("factRatio"), value: band.ratio },
                { label: t("factGroup"), value: band.groupSize },
                { label: t("factAges"), value: band.ageLabel },
              ].map((fact) => (
                <div key={fact.label} className="not-first:mt-4">
                  <dt className="text-sm font-medium text-ink-500">
                    {fact.label}
                  </dt>
                  <dd className="text-ink-900 tabular-nums">{fact.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </article>
      ))}

      {/* The shared rhythm, same component and same source list as the home page. */}
      <section
        className="border-t border-border py-14 sm:py-20"
        aria-labelledby="day-heading"
      >
        <h2
          id="day-heading"
          className="text-2xl font-semibold text-ink-900 sm:text-3xl"
        >
          {t("dayHeading")}
        </h2>
        <p className="mt-2 max-w-xl text-ink-700">{t("dayBody")}</p>
        <div className="mt-8">
          <DayTimeline />
        </div>
      </section>

      {/* The conversion action. There is no form anywhere on this site by decision — the
          next step is a phone call, and the card beside it answers what a parent wants to
          know before making one. */}
      <VisitSection heading={t("visitHeading")} body={t("visitBody")} />
    </main>
  );
}
