import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { HeroFacts } from "@/components/site/HeroFacts";
import { PageHero } from "@/components/site/PageHero";
import { StaffCard } from "@/components/site/StaffCard";
import { VisitSection } from "@/components/site/VisitSection";
import { averageTenure, getStaff, yearsWith } from "@/lib/staff";

/**
 * `/staff` — the page that expands the home page's three-person strip into the whole team.
 *
 * `/about` argues that the center is careful and `/programs` says which room a child would
 * be in. This page answers the question underneath both: who, specifically, will be
 * standing in that room in March. So the organizing fact is tenure rather than
 * qualifications — a parent cannot check a credential, but they can check whether people
 * stay, and staying is what makes "your child is known by name" true rather than a slogan.
 *
 * The team list comes from `@/lib/staff`, shared with the home page, so the two can never
 * introduce the same person with two different tenures. Copy is placeholder in the home
 * page's voice; real bios are a v1.0.0 task, and portraits replace the monograms then.
 *
 * A Server Component with no interactivity — nothing here needs `"use client"`.
 */

type PageProps = { params: Promise<{ locale: string }> };

// Stated as three positions on turnover, because the honest version of "our staff are
// wonderful" is what a center actually does to keep them. Keys name the strings in
// `messages/en.json` rather than repeating the block markup three times.
const STAY_KEYS = ["Pay", "Room", "Hiring"] as const;

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "StaffPage" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function Staff({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("StaffPage");
  const staff = await getStaff();

  // Derived rather than written down, so nothing here goes quietly stale on the first of
  // January. The list is ordered leadership-first, so the longest tenure is found rather
  // than assumed to be the director's.
  const longestTenure = Math.max(...staff.map(yearsWith));

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5">
      {/* The hero card is tenure, because that is the number this page exists to publish
          and the one a parent can hold up against the center down the road. `stack`
          rather than `stat`: the last value is a sentence, not a figure. */}
      <PageHero
        eyebrow={t("eyebrow", { count: staff.length })}
        heading={t("heading")}
        headingId="staff-heading"
        intro={t("intro")}
        card={
          <HeroFacts
            facts={[
              { label: t("factTeamLabel"), value: String(staff.length) },
              {
                label: t("factTenureLabel"),
                value: t("yearsValue", { years: averageTenure(staff) }),
              },
              {
                label: t("factLongestLabel"),
                value: t("yearsValue", { years: longestTenure }),
              },
              { label: t("factChecksLabel"), value: t("factChecksValue") },
            ]}
          />
        }
      />

      {/* The team itself. Two columns rather than three: each card carries a bio here, and
          a paragraph in a third-width column drops to a handful of words a line. */}
      <section
        className="border-t border-border py-14 sm:py-20"
        aria-labelledby="team-heading"
      >
        <h2
          id="team-heading"
          className="text-2xl font-semibold text-ink-900 sm:text-3xl"
        >
          {t("teamHeading")}
        </h2>
        <p className="mt-2 max-w-xl text-ink-700">{t("teamBody")}</p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {staff.map((person) => (
            <StaffCard key={person.key} person={person} showBio />
          ))}
        </div>
      </section>

      {/* Turnover, said out loud. A parent has no way to ask this question politely on a
          tour, so the page answers it unasked. */}
      <section
        className="border-t border-border py-14 sm:py-20"
        aria-labelledby="stay-heading"
      >
        <h2
          id="stay-heading"
          className="text-2xl font-semibold text-ink-900 sm:text-3xl"
        >
          {t("stayHeading")}
        </h2>
        <p className="mt-2 max-w-xl text-ink-700">{t("stayBody")}</p>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {STAY_KEYS.map((key) => (
            <article
              key={key}
              className="rounded-2xl border border-border bg-surface p-6"
            >
              <h3 className="text-lg font-semibold text-balance text-ink-900">
                {t(`stay${key}Title`)}
              </h3>
              <p className="mt-3 text-ink-700">{t(`stay${key}Body`)}</p>
            </article>
          ))}
        </div>
      </section>

      {/* The conversion action. There is no form anywhere on this site by decision — the
          next step is a phone call, and the card beside it answers what a parent wants to
          know before making one. */}
      <VisitSection heading={t("visitHeading")} body={t("visitBody")} />
    </main>
  );
}
