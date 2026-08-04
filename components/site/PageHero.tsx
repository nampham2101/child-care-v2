/**
 * The hero band every public page opens with.
 *
 * Prose on the left, an evidence card on the right. The prose column is deliberately
 * narrow — around 70 characters a line, which is where body text stops being tiring to
 * read — and the card fills the space that cap leaves over. Before this component the
 * cap was there and the space was simply empty, which read as a page that had failed to
 * load rather than as considered whitespace.
 *
 * The split is 3/5 to 2/5 rather than an even half: the headline needs the wider column,
 * and a fact panel that matches the prose block for width starts competing with it for
 * attention. Below `sm` the two stack, prose first — a parent on a phone should reach the
 * promise before the proof.
 *
 * `headingId` wires the page's `<h1>` to the `aria-labelledby` on the band, so every page
 * exposes one named landmark instead of an anonymous opening section.
 *
 * See `docs/CONVENTIONS.md` for the rule this implements and `HeroFacts` for the card.
 */
export function PageHero({
  eyebrow,
  heading,
  headingId,
  intro,
  card,
  children,
}: {
  eyebrow: string;
  heading: string;
  headingId: string;
  intro: string;
  card: React.ReactNode;
  /** Optional calls to action, rendered under the intro. */
  children?: React.ReactNode;
}) {
  return (
    <section
      className="grid items-start gap-10 py-14 sm:grid-cols-5 sm:py-20"
      aria-labelledby={headingId}
    >
      <div className="sm:col-span-3">
        <p className="text-sm font-medium tracking-wide text-terracotta-700 uppercase">
          {eyebrow}
        </p>
        <h1
          id={headingId}
          className="mt-3 text-4xl font-semibold text-balance text-ink-900 sm:text-5xl"
        >
          {heading}
        </h1>
        <p className="mt-4 text-lg text-ink-700">{intro}</p>
        {children ? (
          <div className="mt-7 flex flex-wrap items-center gap-4">
            {children}
          </div>
        ) : null}
      </div>

      <div className="sm:col-span-2">{card}</div>
    </section>
  );
}
