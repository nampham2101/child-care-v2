import { getTranslations } from "next-intl/server";

/**
 * The panel that sits beside a "come and visit" call to action.
 *
 * The call button asks a parent to phone a stranger about their child, which is a bigger
 * ask than it looks. Everything here is the friction that sits in front of that call —
 * when to come, who to ask for, how long it takes, and whether they need to arrange it
 * first. Answering those beside the button is worth more than another sentence of prose
 * telling them the visit is welcome.
 *
 * The four facts are identical wherever the CTA appears, so they live under one `Visit`
 * namespace rather than being restated per page. A page's own prose must not repeat them;
 * see `docs/CONVENTIONS.md`.
 *
 * Not `HeroFacts`: this panel is titled and sits mid-page, where a bare list of values
 * with no heading above it would read as a stray table rather than an answer to the
 * paragraph next to it.
 */

// The order a parent's hesitation actually arrives in: when could I go, who do I speak
// to, how much of my day is this, and do I have to set it up first.
const VISIT_FACT_KEYS = ["when", "ask", "length", "booking"] as const;

export async function VisitCard() {
  const t = await getTranslations("Visit");

  return (
    <div className="rounded-2xl border border-border bg-surface p-6">
      <h3 className="text-sm font-medium text-ink-500">{t("cardHeading")}</h3>
      <dl className="mt-3">
        {VISIT_FACT_KEYS.map((key) => (
          <div key={key} className="not-first:mt-4">
            <dt className="text-sm text-ink-500">{t(`${key}Label`)}</dt>
            <dd className="mt-1 text-ink-900">{t(`${key}Value`)}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
