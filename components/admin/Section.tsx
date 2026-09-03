import type { ReactNode } from "react";

import { DiscardControl } from "@/components/admin/DiscardControl";
import type { DiscardTarget } from "@/lib/admin/discard";

/**
 * A card grouping one set of fields, with an optional badge saying it holds an unpublished
 * edit.
 *
 * Marking pending edits is not decoration. Until #75 lands there is no way to publish, so a
 * staff member could otherwise edit a rate, look at the live site, see the old number, and
 * reasonably conclude the editor is broken. The badge and the save message both exist to make
 * "saved but not live" a state the interface admits to rather than one the person has to infer.
 *
 * ## Discard sits here because the badge does (#121)
 *
 * The badge is the one place the interface says "this has an edit waiting", so it is where a
 * person looks when they want that edit gone. Passing `discard` renders the control beside it;
 * omitting it renders nothing, which is what a section with no pending edit gets. The two are
 * driven by the same `pending` flag rather than by two independent decisions, so a section can
 * never advertise an unpublished edit it offers no way to take back.
 *
 * ## The exception, and what the badge means there (#132)
 *
 * Two sections cover many rows at once — "A day here" holds seven `daily_rhythm` slots, and each
 * tuition schedule holds one `tuition_rates` cell per room. A discard at that level would be a
 * *bulk* discard, which is a different and riskier action than #121 built, so those sections pass
 * no `discard`. Each row carries its own `PendingEdit` instead.
 *
 * That leaves the section badge saying "Unpublished edit" directly above rows saying the same
 * words, which is noise. `pendingCount` is the resolution #132 asks for: where rows carry their
 * own controls, the section badge becomes a **summary** — "3 unpublished edits" — so it answers a
 * question the rows cannot, which is how much is waiting in a section a person has not scrolled
 * through yet. Sections that own a single thing keep the plain badge and the discard beside it.
 */
export function Section({
  title,
  description,
  pending = false,
  pendingCount,
  discard,
  children,
}: {
  title: string;
  description?: string;
  pending?: boolean;
  /**
   * How many rows inside are pending, for a section whose rows carry their own controls. Turns
   * the badge into a count. Omit it wherever the section itself is the thing being edited.
   */
  pendingCount?: number;
  /** The thing a discard would apply to. Rendered only while `pending`. */
  discard?: DiscardTarget;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-cream-50 p-6">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
          {description ? (
            <p className="mt-1 max-w-prose text-sm text-ink-500">
              {description}
            </p>
          ) : null}
        </div>
        {pending ? <DraftBadge count={pendingCount} /> : null}
      </div>

      {/*
       * Below the header rather than beside the badge, because this renders as two very
       * different things: a small text button most of the time, and a full-width confirmation
       * panel once pressed. Inline in the header the panel would be squeezed into whatever the
       * badge left over; here both states get the room they need and neither needs the layout
       * to know which one it is showing.
       */}
      {pending && discard ? (
        <div className="mb-5">
          <DiscardControl target={discard} />
        </div>
      ) : null}

      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}

/**
 * Terracotta, not sage. `docs/CONVENTIONS.md` reserves sage for controls — every call to action
 * on this project is sage and nothing else is — so a status marker in sage would read as
 * something to click.
 *
 * `count` is for the summary case only (#132), and one is still written as "Unpublished edit"
 * rather than "1 unpublished edit": a section holding a single pending row says the same thing
 * as a section that *is* one pending thing, because to the person reading it, it is.
 */
export function DraftBadge({ count }: { count?: number }) {
  return (
    <span className="rounded-full bg-terracotta-100 px-3 py-1 text-xs font-semibold tracking-wide text-terracotta-700 uppercase">
      {count !== undefined && count > 1
        ? `${count} unpublished edits`
        : "Unpublished edit"}
    </span>
  );
}
