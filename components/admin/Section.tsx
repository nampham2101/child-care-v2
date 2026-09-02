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
 */
export function Section({
  title,
  description,
  pending = false,
  discard,
  children,
}: {
  title: string;
  description?: string;
  pending?: boolean;
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
        {pending ? <DraftBadge /> : null}
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
 */
export function DraftBadge() {
  return (
    <span className="rounded-full bg-terracotta-100 px-3 py-1 text-xs font-semibold tracking-wide text-terracotta-700 uppercase">
      Unpublished edit
    </span>
  );
}
