import { CallButton } from "@/components/site/CallButton";
import { VisitCard } from "@/components/site/VisitCard";

/**
 * The band every page closes with: come and see the place.
 *
 * There is no form anywhere on this site by decision, so this section carries the only
 * conversion action there is. It repeats on `/programs`, `/about`, and the pages still to
 * come, which is why it is one component — the heading and the paragraph are the page's
 * own, and everything around them is the same everywhere.
 *
 * The layout is `PageHero`'s, one level down: prose held at its readable measure in a 3/5
 * column, the visit card filling the 2/5 the cap leaves over, stacked below `sm` with the
 * prose first. See `docs/CONVENTIONS.md` for the rule this implements.
 *
 * `headingId` defaults to the one every page uses, and is a prop only so a page that
 * already spends that id elsewhere can pass its own rather than emit a duplicate.
 */
export function VisitSection({
  heading,
  body,
  headingId = "visit-heading",
}: {
  heading: string;
  body: string;
  headingId?: string;
}) {
  return (
    <section
      className="border-t border-border py-14 sm:py-20"
      aria-labelledby={headingId}
    >
      <h2
        id={headingId}
        className="text-2xl font-semibold text-ink-900 sm:text-3xl"
      >
        {heading}
      </h2>

      <div className="mt-2 grid items-start gap-10 sm:grid-cols-5">
        <div className="sm:col-span-3">
          <p className="text-ink-700">{body}</p>
          <div className="mt-7">
            <CallButton />
          </div>
        </div>

        <div className="sm:col-span-2">
          <VisitCard />
        </div>
      </div>
    </section>
  );
}
