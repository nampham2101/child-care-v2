"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { publishAll } from "@/app/admin/(protected)/actions";
import { isLocaleSwitchable } from "@/lib/admin/content-locale";
import { IDLE } from "@/lib/admin/form-state";

/**
 * The Publish button, and the panel that says what publishing will do.
 *
 * ## Why the count is on the button
 *
 * #75 requires publish to be "an explicit, deliberate action over a batch of drafts, not an
 * autosave", and the reason is cost: every publish is one to two minutes of Netlify build
 * minutes. Naming the number on the control is what makes it deliberate — a staff member sees
 * that six edits go out together, rather than pressing something ambiguous six times.
 *
 * ## Why it names languages once there is more than one (#111)
 *
 * `publish_org_drafts` promotes **every** pending draft in the organization. The locale is part
 * of how a draft is matched to its published twin, so a German edit can never overwrite the
 * English row — but it is not part of what the sweep selects, so there is no such thing as
 * publishing one language.
 *
 * That is the same all-or-nothing this button has always had: a half-edited tuition rate goes
 * out with a half-edited FAQ answer. Language is not a special case of it. But it is the one a
 * staff member is most likely to get wrong, because the copy editor now has a control that
 * makes it feel as though they are working *inside* one language — so the panel says plainly
 * that publishing leaves that scope. Saying it here is cheaper and more honest than a
 * per-locale publish that the machinery does not support.
 */
export function PublishPanel({ pending }: { pending: number }) {
  const [state, formAction] = useActionState(publishAll, IDLE);
  const nothingWaiting = pending === 0;

  return (
    <div className="rounded-2xl border border-border bg-cream-50 p-5">
      {nothingWaiting ? (
        <p className="text-ink-700">
          Nothing is waiting. Everything here matches what the public site
          shows.
        </p>
      ) : (
        <>
          <p className="font-medium text-ink-900">
            {pending} {pending === 1 ? "change is" : "changes are"} saved but
            not published.
          </p>
          <p className="mt-1.5 text-sm text-ink-700">
            The public site still shows the old versions. Publishing sends them
            all out together and takes about two minutes.
          </p>
          {isLocaleSwitchable() ? (
            <p className="mt-1.5 text-sm text-ink-700">
              That includes every language — there is no way to publish one on
              its own. If a translation is half-finished, it goes out
              half-finished.
            </p>
          ) : null}
        </>
      )}

      <form
        action={formAction}
        className="mt-4 flex flex-wrap items-center gap-4"
      >
        <PublishButton pending={pending} disabled={nothingWaiting} />
        {state.status !== "idle" && state.message ? (
          <p
            role={state.status === "error" ? "alert" : "status"}
            className={
              state.status === "error"
                ? "max-w-prose text-sm font-medium text-terracotta-700"
                : "max-w-prose text-sm text-ink-700"
            }
          >
            {state.message}
          </p>
        ) : null}
      </form>
    </div>
  );
}

/**
 * Split out because `useFormStatus` reports the status of the form above it in the tree.
 *
 * Disabling while in flight is the cheap half of "publishing twice in quick succession does not
 * produce two competing builds". The real half is in `lib/admin/publish.ts`: the first press
 * promotes every draft, so a second finds nothing to promote and starts no build at all.
 */
function PublishButton({
  pending,
  disabled,
}: {
  pending: number;
  disabled: boolean;
}) {
  const { pending: submitting } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={disabled || submitting}
      className="inline-flex items-center justify-center rounded-full bg-sage-700 px-5 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-sage-900 focus-visible:ring-2 focus-visible:ring-sage-900 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
    >
      {submitting
        ? "Starting the rebuild…"
        : disabled
          ? "Nothing to publish"
          : `Publish ${pending} ${pending === 1 ? "change" : "changes"}`}
    </button>
  );
}
