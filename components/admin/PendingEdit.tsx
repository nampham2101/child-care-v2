import { DiscardControl } from "@/components/admin/DiscardControl";
import { DraftBadge } from "@/components/admin/Section";
import type { DiscardTarget } from "@/lib/admin/discard";

/**
 * "Unpublished edit", and the way to take it back, for **one row inside a section** — issue #132.
 *
 * ## Why this exists rather than another `Section`
 *
 * `Section` already pairs the badge with a discard, and that pairing is deliberate: the badge is
 * where a person looks when they want an edit gone, so a section can never advertise a pending
 * edit it offers no way to undo. Three places need the same pairing for something smaller than a
 * section — a clock time, a rate, a sentence — where a card of its own would be chrome around a
 * single field.
 *
 * The copy editor did it inline first (#121). #132 needed the same thing for `daily_rhythm` slots
 * and `tuition_rates` cells, which would have been the second and third copy, so it moved here
 * and the copy editor now calls it too.
 *
 * ## `pending` is a prop rather than the caller's `&&`
 *
 * Same invariant as `Section`, held the same way: the badge and the control are driven by one
 * flag instead of two decisions, so a row cannot show one without the other. A caller that
 * guarded the badge itself and forgot the control would produce exactly the state #132 was filed
 * about — an interface saying an edit is waiting and offering nothing to do about it.
 */
export function PendingEdit({
  pending,
  discard,
}: {
  pending: boolean;
  /** The row a discard would apply to. Its `label` is read aloud in the confirmation. */
  discard: DiscardTarget;
}) {
  if (!pending) return null;

  return (
    <div className="mb-2 flex flex-col gap-2">
      <DraftBadge />
      <DiscardControl target={discard} />
    </div>
  );
}
