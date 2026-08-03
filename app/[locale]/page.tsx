import { getTranslations, setRequestLocale } from "next-intl/server";
import { CallButton } from "@/components/site/CallButton";
import { DayTimeline } from "@/components/site/DayTimeline";
import { CENTER } from "@/lib/center";
import { PROGRAM_BANDS, type ProgramBandKey } from "@/lib/programs";

/**
 * The home page — the single page v0.1.0 shipped, now living under `/[locale]`.
 *
 * Written for one reader: an anxious parent comparing centers late at night on a phone.
 * Every section answers a question that parent is actually asking, in the order they ask
 * it. The page is built mobile-first; the `sm:` and `lg:` steps only widen a layout that
 * already works in a narrow column.
 *
 * Its prose comes from `messages/en.json` via next-intl. The age bands and the day's
 * rhythm now come from `@/lib/programs`, shared with `/programs` — the ratios and clock
 * times a parent compares must read the same on both pages, so they are defined once
 * there rather than typed into each page.
 *
 * It is a Server Component with no interactivity — nothing here needs `"use client"`.
 */

const yearsOperating = new Date().getFullYear() - CENTER.yearsOperatingSince;

// One sentence per band — the summary that makes a parent open `/programs`, where the
// full detail lives. Keyed by band so it cannot fall out of step with the shared list.
const BAND_BLURBS: Record<ProgramBandKey, string> = {
  infants:
    "One primary caregiver per child, so feeds, naps, and first words are tracked by someone who knows your baby — not whoever is free.",
  toddlers:
    "Room to move and language everywhere. Days are predictable so a toddler learning the world can count on what comes next.",
  preschool:
    "Early literacy, numbers, and the harder work of taking turns and naming feelings — the groundwork for kindergarten.",
};

const STAFF = [
  {
    name: "Maria Delgado",
    role: "Director",
    tenure: "with Willow Grove 12 years",
  },
  {
    name: "Aisha Bello",
    role: "Lead Infant Teacher",
    tenure: "with Willow Grove 8 years",
  },
  {
    name: "Tom Fischer",
    role: "Lead Preschool Teacher",
    tenure: "with Willow Grove 6 years",
  },
];

// Initials stand in for a photo until real staff portraits are commissioned. A calm
// monogram reads better than a generic stock smile, which the design brief rules out.
function initialsOf(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("");
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("HomePage");
  const tBands = await getTranslations("Programs");

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5">
      {/* Hero — a promise about your child, not a claim about the business. */}
      <section className="py-14 sm:py-20" aria-labelledby="hero-heading">
        <p className="text-sm font-medium tracking-wide text-terracotta-700 uppercase">
          {t("heroEyebrow", { ageRange: CENTER.ageRange })}
        </p>
        <h1
          id="hero-heading"
          className="mt-3 max-w-2xl text-4xl font-semibold text-balance text-ink-900 sm:text-5xl"
        >
          {t("heroHeading")}
        </h1>
        <p className="mt-4 max-w-xl text-lg text-ink-700">
          {t("heroBody", { neighborhood: CENTER.neighborhood })}
        </p>
        <div className="mt-7 flex flex-wrap items-center gap-4">
          <CallButton />
          <a
            href="#visit"
            className="rounded-full border border-border bg-surface px-5 py-2.5 text-sm font-medium text-ink-700 transition-colors hover:border-ink-300 focus-visible:ring-2 focus-visible:ring-sage-900 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
          >
            {t("planVisit")}
          </a>
        </div>
      </section>

      {/* Trust strip — the four things parents compare, license number included. */}
      <section
        aria-label="At a glance"
        className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-4"
      >
        {[
          { value: CENTER.infantRatio, label: t("trustInfantRatio") },
          { value: `${yearsOperating} years`, label: t("trustYearsCaring") },
          { value: "7am–6pm", label: t("trustOpenWeekdays") },
          { value: CENTER.licenseNumber, label: t("trustStateLicense") },
        ].map((stat) => (
          <div key={stat.label} className="bg-surface px-5 py-6">
            <div className="text-2xl font-semibold text-ink-900 tabular-nums">
              {stat.value}
            </div>
            <div className="mt-1 text-sm text-ink-500">{stat.label}</div>
          </div>
        ))}
      </section>

      {/* Programs — sorted by age. */}
      <section className="py-14 sm:py-20" aria-labelledby="programs-heading">
        <h2
          id="programs-heading"
          className="text-2xl font-semibold text-ink-900 sm:text-3xl"
        >
          {t("programsHeading")}
        </h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {PROGRAM_BANDS.map((band) => (
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
              <p className="mt-3 text-ink-700">{BAND_BLURBS[band.key]}</p>
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
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {STAFF.map((person) => (
            <figure
              key={person.name}
              className="rounded-2xl border border-border bg-surface p-6"
            >
              <div
                aria-hidden="true"
                className="flex h-16 w-16 items-center justify-center rounded-full bg-sage-50 text-lg font-semibold text-sage-700"
              >
                {initialsOf(person.name)}
              </div>
              <figcaption className="mt-4">
                <div className="font-semibold text-ink-900">{person.name}</div>
                <div className="text-sm text-ink-700">{person.role}</div>
                <div className="mt-1 text-sm text-ink-500">{person.tenure}</div>
              </figcaption>
            </figure>
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
        <blockquote className="max-w-2xl">
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
                  {CENTER.address.line1}
                  <br />
                  {CENTER.address.line2}
                </dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-ink-500">
                  {t("contactHours")}
                </dt>
                <dd className="text-ink-900">{CENTER.hoursShort}</dd>
              </div>
              <div>
                <dt className="text-sm font-medium text-ink-500">
                  {t("contactPhone")}
                </dt>
                <dd>
                  <a
                    href={CENTER.phoneHref}
                    className="text-sage-700 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-sage-900 focus-visible:outline-none"
                  >
                    {CENTER.phoneDisplay}
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
            {t("mapLabel", { neighborhood: CENTER.neighborhood })}
          </div>
        </div>
      </section>
    </main>
  );
}
