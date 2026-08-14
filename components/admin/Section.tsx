import type { ReactNode } from "react";

/**
 * A card grouping one set of fields, with an optional badge saying it holds an unpublished
 * edit.
 *
 * Marking pending edits is not decoration. Until #75 lands there is no way to publish, so a
 * staff member could otherwise edit a rate, look at the live site, see the old number, and
 * reasonably conclude the editor is broken. The badge and the save message both exist to make
 * "saved but not live" a state the interface admits to rather than one the person has to infer.
 */
export function Section({
  title,
  description,
  pending = false,
  children,
}: {
  title: string;
  description?: string;
  pending?: boolean;
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
