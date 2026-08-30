import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { HeroFacts } from "@/components/site/HeroFacts";
import { PageHero } from "@/components/site/PageHero";
import { VisitSection } from "@/components/site/VisitSection";

/**
 * `/faq` — the questions parents ask on the phone, including the ones they cannot ask on
 * a tour without feeling rude.
 *
 * Every other page answers the questions a center wants to be asked. This one answers the
 * rest: what happens when a child bites, when a child is hurt, how to complain about us.
 * A center that only publishes the flattering questions has written a brochure, and the
 * whole argument of this site is that it is not one.
 *
 * The markup is native `<details>`/`<summary>` — a disclosure that works with no client
 * JavaScript, is keyboard operable and announced as expandable by a screen reader, and
 * keeps every answer in the DOM for search. Sixteen answers printed open would be a wall
 * on the phone this page is mostly read on; sixteen questions a parent can scan in two
 * screens, and open the two that are theirs, is the same information at a usable size.
 *
 * Copy is placeholder in the home page voice; real answers are a v1.0.0 task.
 *
 * A Server Component with no interactivity — the disclosure is the browser's, so nothing
 * here needs `"use client"`.
 */

type PageProps = { params: Promise<{ locale: string }> };

/**
 * The questions, grouped the way a parent's worry arrives: can we even get in, what is the
 * start like, what are the ordinary days, and what happens when something goes wrong. The
 * awkward group is last because it is the one a parent reads once they are already
 * interested, and it is deliberately not omitted.
 *
 * Each key names a `<topic><Question>Question` and `<topic><Question>Answer` pair in the
 * `FaqPage` namespace of the catalogue, so the copy stays translatable and the page carries
 * structure rather than fifteen copies of the same markup. Since #76 those are `public.prose`
 * rows edited at `/admin/copy`. The same namespace's `eyebrow` carries a `{count}` placeholder,
 * which is why the editor refuses to save a message that has lost one — next-intl throws on it,
 * and since #76 that throw fails the build.
 */
const TOPICS = [
  { key: "place", questions: ["Waitlist", "Ahead", "Hold", "Days"] },
  { key: "starting", questions: ["Settle", "Bring", "Hear"] },
  {
    key: "daily",
    questions: ["Food", "Nappies", "Sleep", "Outside", "Screens"],
  },
  { key: "trouble", questions: ["Sick", "Biting", "Injury", "Complaint"] },
] as const;

const QUESTION_COUNT = TOPICS.reduce(
  (total, topic) => total + topic.questions.length,
  0,
);

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "FaqPage" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function Faq({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("FaqPage");
  // The age range is copy, not a fact — see #110 and the note in `lib/center.ts`. With it in
  // the catalogue this page reads no `site_settings` row at all, so `getCenter` is gone from
  // here rather than left fetching a row nothing uses.
  const tCenter = await getTranslations("Center");

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5">
      {/* The card holds what the list below cannot: where these questions came from, and
          what to do when yours is not among them. Answering a question in the card that
          is also answered below would be the same fact twice — see `docs/CONVENTIONS.md`. */}
      <PageHero
        eyebrow={t("eyebrow", { count: QUESTION_COUNT })}
        heading={t("heading")}
        headingId="faq-heading"
        intro={t("intro")}
        card={
          <HeroFacts
            facts={[
              { label: t("factAgesLabel"), value: tCenter("ageRange") },
              {
                label: t("factCountLabel"),
                value: String(QUESTION_COUNT),
              },
              { label: t("factSourceLabel"), value: t("factSourceValue") },
              { label: t("factMissingLabel"), value: t("factMissingValue") },
            ]}
          />
        }
      />

      {TOPICS.map((topic) => (
        <section
          key={topic.key}
          className="border-t border-border py-14 sm:py-20"
          aria-labelledby={`${topic.key}-heading`}
        >
          <h2
            id={`${topic.key}-heading`}
            className="text-2xl font-semibold text-ink-900 sm:text-3xl"
          >
            {t(`${topic.key}Heading`)}
          </h2>

          <div className="mt-8 grid gap-3">
            {topic.questions.map((question) => (
              <details
                key={question}
                className="group rounded-2xl border border-border bg-surface px-6 open:pb-2"
              >
                {/* The heading lives inside the summary so the questions appear in the
                    document outline a screen-reader user navigates by, while the summary
                    keeps the native expandable semantics. `list-none` plus the WebKit
                    rule replace the default triangle with the chevron below, which can be
                    animated and sized to the text. */}
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-5 focus-visible:ring-2 focus-visible:ring-sage-900 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                  <h3 className="text-lg font-semibold text-ink-900">
                    {t(`${topic.key}${question}Question`)}
                  </h3>
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-5 w-5 shrink-0 text-sage-700 transition-transform group-open:rotate-180"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m6 9 6 6 6-6" />
                  </svg>
                </summary>
                {/* Held at the readable measure rather than the panel's full width: an
                    answer is prose, and prose does not widen to fill a container. */}
                <p className="max-w-xl pb-5 text-ink-700">
                  {t(`${topic.key}${question}Answer`)}
                </p>
              </details>
            ))}
          </div>
        </section>
      ))}

      {/* The conversion action. Shared with every other page, so the four things standing
          in front of the call are answered the same way here as on `/about`. */}
      <VisitSection heading={t("visitHeading")} body={t("visitBody")} />
    </main>
  );
}
