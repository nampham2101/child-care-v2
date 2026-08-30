import { getTranslations, setRequestLocale } from "next-intl/server";
import { CallButton } from "@/components/site/CallButton";
import { DayTimeline } from "@/components/site/DayTimeline";
import { HeroFacts } from "@/components/site/HeroFacts";
import { PageHero } from "@/components/site/PageHero";
import { StaffCard } from "@/components/site/StaffCard";
import { getCenter } from "@/lib/center";
import { getProgramBands } from "@/lib/programs";
import { featuredStaff, getStaff } from "@/lib/staff";

/**
 * The home page — the single page v0.1.0 shipped, now living under `/[locale]`.
 *
 * Written for one reader: an anxious parent comparing centers late at night on a phone.
 * Every section answers a question that parent is actually asking, in the order they ask
 * it. The page is built mobile-first; the `sm:` and `lg:` steps only widen a layout that
 * already works in a narrow column.
 *
 * Its prose comes from next-intl, whose catalogue `@/lib/prose` reads out of `public.prose`
 * at build time — staff edit it at `/admin/copy`, not in a file. The age bands and the day's
 * rhythm now come from `@/lib/programs`, shared with `/programs` — the ratios and clock
 * times a parent compares must read the same on both pages, so they are defined once
 * there rather than typed into each page. The staff strip reads `@/lib/staff` on the same
 * terms, shared with `/staff`, so a tenure cannot say twelve years here and eleven there.
 *
 * It is a Server Component with no interactivity — nothing here needs `"use client"`.
 */

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("HomePage");
  const tBands = await getTranslations("Programs");
  // The ages, hours and neighbourhood are copy, not facts — #110 moved them out of
  // `site_settings` and into the catalogue so a translated page does not carry an English
  // clause through the middle of a German sentence.
  const tCenter = await getTranslations("Center");
  const center = await getCenter();
  const bands = await getProgramBands();
  const featured = featuredStaff(await getStaff());

  // Derived here rather than at module scope, where it used to sit: the facts are now
  // fetched per render, and a module-level constant would also have frozen "this year" at
  // the moment the module was first imported.
  const yearsOperating = new Date().getFullYear() - center.yearsOperatingSince;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5">
      {/* Hero — a promise about your child on the left, the four things parents compare
          on the right. The trust strip used to be its own band under the hero; it moved
          in here so the hero's right half carries proof instead of empty space, and so
          the same four facts are not stated twice within one screen. */}
      <PageHero
        eyebrow={t("heroEyebrow", { ageRange: tCenter("ageRange") })}
        heading={t("heroHeading")}
        headingId="hero-heading"
        intro={t("heroBody", { neighborhood: tCenter("neighborhood") })}
        card={
          <HeroFacts
            variant="stat"
            facts={[
              { value: center.infantRatio, label: t("trustInfantRatio") },
              {
                value: `${yearsOperating} years`,
                label: t("trustYearsCaring"),
              },
              { value: "7am–6pm", label: t("trustOpenWeekdays") },
              { value: center.licenseNumber, label: t("trustStateLicense") },
            ]}
          />
        }
      >
        <CallButton />
        <a
          href="#visit"
          className="rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-medium text-ink-700 transition-colors hover:border-ink-300 focus-visible:ring-2 focus-visible:ring-sage-900 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
        >
          {t("planVisit")}
        </a>
      </PageHero>

      {/* Programs — sorted by age. */}
      <section className="py-14 sm:py-20" aria-labelledby="programs-heading">
        <h2
          id="programs-heading"
          className="text-2xl font-semibold text-ink-900 sm:text-3xl"
        >
          {t("programsHeading")}
        </h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {bands.map((band) => (
            <article
              key={band.key}
              className="flex flex-col rounded-2xl border border-border bg-surface p-6"
            >
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-lg font-semibold text-ink-900">
                  {tBands(band.key)}
                </h3>
                <span className="text-sm font-medium text-sage-700 tabular-nums">
                  {band.ratio}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink-500">{band.ageLabel}</p>
              <p className="mt-3 text-ink-700">{t(`${band.key}Blurb`)}</p>
            </article>
          ))}
        </div>
      </section>

      {/* A day here — the simple timeline. */}
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

      {/* Staff — faces and roles; caregiver consistency is what parents worry about. */}
      <section
        className="border-t border-border py-14 sm:py-20"
        aria-labelledby="staff-heading"
      >
        <h2
          id="staff-heading"
          className="text-2xl font-semibold text-ink-900 sm:text-3xl"
        >
          {t("staffHeading")}
        </h2>
        {/* Three of the seven, without bios — this is an introduction, and `/staff` is
            where the question of who these people are actually gets answered. */}
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {featured.map((person) => (
            <StaffCard key={person.key} person={person} />
          ))}
        </div>
      </section>

      {/* Testimonial — one small, specific, believable moment. */}
      <section
        className="border-t border-border py-14 sm:py-20"
        aria-labelledby="parent-heading"
      >
        <h2 id="parent-heading" className="sr-only">
          {t("testimonialHeading")}
        </h2>
        {/* Centred rather than given a companion card: a quotation is the one thing on
            this page that wants to sit on its own, and a fact panel beside it would turn
            a parent's sentence into an exhibit. So the leftover width becomes symmetric
            margin instead of a hole on the right — see `docs/CONVENTIONS.md`. */}
        <blockquote className="mx-auto max-w-2xl text-center">
          <p className="text-xl text-ink-900 text-balance sm:text-2xl">
            {t("testimonialQuote")}
          </p>
          <footer className="mt-4 text-sm text-ink-500">
            {t("testimonialAttribution")}
          </footer>
        </blockquote>
      </section>

      {/* Contact — address, hours, map, and the action we want. */}
      <section
        id="visit"
        className="scroll-mt-20 border-t border-border py-14 sm:py-20"
        aria-labelledby="visit-heading"
      >
        <h2
          id="visit-heading"
          className="text-2xl font-semibold text-ink-900 sm:text-3xl"
        >
          {t("visitHeading")}
        </h2>
        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <div>
            <dl className="space-y-4">
              <div>
                <dt className="text-sm font-medium text-ink-500">
                  {t("contactAddress")}
                </dt>
                <dd className="text-ink-900">
                  {center.address.line1}
                  <br />
                  {center.address.line2}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-ink-500">
                  {t("contactHours")}
                </dt>
                <dd className="text-ink-900">{tCenter("hoursShort")}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-ink-500">
                  {t("contactPhone")}
                </dt>
                <dd>
                  <a
                    href={center.phoneHref}
                    className="text-sage-700 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-sage-900 focus-visible:outline-none"
                  >
                    {center.phoneDisplay}
                  </a>
                </dd>
              </div>
            </dl>
            <div className="mt-7">
              <CallButton />
            </div>
          </div>
          {/* Placeholder for a real map embed — a calm block, not a stock photo. */}
          <div
            aria-hidden="true"
            className="flex min-h-48 items-center justify-center rounded-2xl border border-border bg-sage-50 text-sm text-sage-700"
          >
            {t("mapLabel", { neighborhood: tCenter("neighborhood") })}
          </div>
        </div>
      </section>
    </main>
  );
}
