import type { Metadata } from "next";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { CallButton } from "@/components/site/CallButton";
import { HeroFacts } from "@/components/site/HeroFacts";
import { PageHero } from "@/components/site/PageHero";
import { VisitSection } from "@/components/site/VisitSection";
import { getCenter } from "@/lib/center";

/**
 * `/contact` — the page a parent opens once they have decided to act.
 *
 * Every other page is arguing. This one has stopped arguing and is trying to remove
 * friction, so it is ordered by what stands between a parent and the call: the number and
 * the address first, then how to physically get here, then what to say when someone picks
 * up. There is no form anywhere on this site by decision — the conversion action is a
 * phone call — which is why the tap-to-call link sits in the hero rather than at the foot
 * of the page.
 *
 * Contact details come from `@/lib/center`, shared with the header, footer, and the home
 * page's contact block, so the number a parent dials from here is the number the footer
 * shows on every other page. Copy is placeholder in the home page voice; real copy is a
 * v1.0.0 task, and the map block is a placeholder rather than a live embed.
 *
 * A Server Component with no interactivity — nothing here needs `"use client"`.
 */

type PageProps = { params: Promise<{ locale: string }> };

// The three ways a parent actually arrives, in the order the block is most useful: the one
// that goes wrong on a first drop-off is parking. Keys name strings in the catalogue —
// `public.prose` rows since #76 — rather than repeating the block markup three times.
const ROUTE_KEYS = ["driving", "transit", "foot"] as const;

// What the call is about, in descending order of how much it matters that it reaches the
// right person. Same key-driven shape as the routes above.
const CALL_KEYS = ["Place", "Illness", "Hours"] as const;

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "ContactPage" });

  return {
    title: t("metaTitle"),
    description: t("metaDescription"),
  };
}

export default async function Contact({ params }: PageProps) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("ContactPage");
  // Copy, not a fact — see #110 and the note in `lib/center.ts`.
  const tCenter = await getTranslations("Center");
  const center = await getCenter();

  const address = `${center.address.line1}, ${center.address.line2}`;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5">
      {/* The phone number is in the button rather than the card beside it: on this page of
          all pages it should be one tap, not a value to transcribe, and printing it in
          both places would be the same fact twice within one screen. The card carries what
          the button cannot — where we are, when we are open, and the slower way to write. */}
      <PageHero
        eyebrow={t("eyebrow")}
        heading={t("heading")}
        headingId="contact-heading"
        intro={t("intro")}
        card={
          <HeroFacts
            facts={[
              { label: t("factAddressLabel"), value: address },
              { label: t("factHoursLabel"), value: tCenter("hoursShort") },
              { label: t("factClosedLabel"), value: t("factClosedValue") },
              {
                label: t("factEmailLabel"),
                value: (
                  <a
                    href={center.emailHref}
                    className="text-sage-700 underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:ring-sage-900 focus-visible:outline-none"
                  >
                    {center.emailDisplay}
                  </a>
                ),
              },
            ]}
          />
        }
      >
        <CallButton />
      </PageHero>

      {/* Getting here — prose about the three routes, with the map beside it rather than
          under it, so the block does not leave the empty half the measure cap creates.
          See `docs/CONVENTIONS.md`. */}
      <section
        className="border-t border-border py-14 sm:py-20"
        aria-labelledby="getting-here-heading"
      >
        <h2
          id="getting-here-heading"
          className="text-2xl font-semibold text-ink-900 sm:text-3xl"
        >
          {t("gettingHereHeading")}
        </h2>

        {/* Stretched rather than top-aligned, which is the one place this section departs
            from `PageHero` and `VisitSection`. Three routes of prose run more than twice
            the height of a fixed-height map, so a top-aligned card would leave exactly the
            empty half `docs/CONVENTIONS.md` exists to prevent — only lower down the page,
            where it reads worse. A map is the one companion that can honestly fill it. */}
        <div className="mt-2 grid gap-10 sm:grid-cols-5">
          <div className="sm:col-span-3">
            <p className="text-ink-700">{t("gettingHereBody")}</p>
            <dl className="mt-7">
              {ROUTE_KEYS.map((key) => (
                <div key={key} className="not-first:mt-5">
                  <dt className="font-semibold text-ink-900">
                    {t(`${key}Title`)}
                  </dt>
                  <dd className="mt-1 text-ink-700">{t(`${key}Body`)}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Placeholder for a real map embed — a calm block, not a stock photo. Hidden
              from assistive tech: it carries no information the address above has not
              already given, so announcing it only adds noise to the page. */}
          <div
            aria-hidden="true"
            className="flex min-h-64 items-center justify-center rounded-2xl border border-border bg-sage-50 p-6 text-center text-sm text-sage-700 sm:col-span-2"
          >
            {t("mapLabel", { address })}
          </div>
        </div>
      </section>

      {/* What to call about — the friction the phone number itself does not remove, which
          is not knowing whether you are about to bother the right person. */}
      <section
        className="border-t border-border py-14 sm:py-20"
        aria-labelledby="call-heading"
      >
        <h2
          id="call-heading"
          className="text-2xl font-semibold text-ink-900 sm:text-3xl"
        >
          {t("callHeading")}
        </h2>
        <p className="mt-2 max-w-xl text-ink-700">{t("callBody")}</p>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {CALL_KEYS.map((key) => (
            <article
              key={key}
              className="rounded-2xl border border-border bg-surface p-6"
            >
              <h3 className="text-lg font-semibold text-balance text-ink-900">
                {t(`call${key}Title`)}
              </h3>
              <p className="mt-3 text-ink-700">{t(`call${key}Body`)}</p>
            </article>
          ))}
        </div>
        {/* Said plainly rather than left for a parent to discover by waiting: the email
            address in the hero card is real, and it is also the slow path. */}
        <p className="mt-6 max-w-xl text-sm text-ink-500">{t("emailNote")}</p>
      </section>

      {/* The conversion action. Shared with every other page, so the four things standing
          in front of the call are answered the same way here as on `/about`. */}
      <VisitSection heading={t("visitHeading")} body={t("visitBody")} />
    </main>
  );
}
