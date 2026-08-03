/**
 * The evidence card that fills the right half of a page hero.
 *
 * Every page's hero states a claim in prose; this panel is the fact that backs it, put
 * where a parent sees it before scrolling — the license number on `/about`, the ratios on
 * `/programs`, the address on `/contact`. It exists as one component rather than per-page
 * markup so all seven heroes cannot drift into seven slightly different panels.
 *
 * Two presentations, because two kinds of fact live here:
 *
 *   - `stat` — short values worth reading as numbers. Two columns, value large and
 *     label under it. This is the treatment the home page's trust strip already used,
 *     kept intact when the strip moved into the hero.
 *   - `stack` — values that are phrases rather than numbers. One column, label above,
 *     value at body size, so a long value wraps without wrecking the panel.
 *
 * Pick by the content: if a value is longer than about three words, `stack` is the one.
 */

export type HeroFact = {
  label: string;
  value: string;
};

export function HeroFacts({
  facts,
  variant = "stack",
}: {
  facts: readonly HeroFact[];
  variant?: "stat" | "stack";
}) {
  if (variant === "stat") {
    return (
      // The gap-px-over-border trick draws hairline dividers between cells without a
      // border on the outer edge doubling up with the panel's own.
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-border bg-border">
        {facts.map((fact) => (
          // Reversed so the number reads first and the label sits under it, while the
          // DOM keeps the term before its definition for assistive tech.
          <div
            key={fact.label}
            className="flex flex-col-reverse bg-surface px-5 py-6"
          >
            <dt className="mt-1 text-sm text-ink-500">{fact.label}</dt>
            {/* `nowrap` because these values are single tokens a parent reads as one
                thing — a license number broken across two lines reads as two numbers.
                One step smaller on a phone, where two cells share 335px. */}
            <dd className="text-xl font-semibold whitespace-nowrap text-ink-900 tabular-nums sm:text-2xl">
              {fact.value}
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <dl className="rounded-2xl border border-border bg-surface p-6">
      {facts.map((fact) => (
        <div key={fact.label} className="not-first:mt-5">
          <dt className="text-sm font-medium text-ink-500">{fact.label}</dt>
          <dd className="mt-1 text-ink-900 tabular-nums">{fact.value}</dd>
        </div>
      ))}
    </dl>
  );
}
