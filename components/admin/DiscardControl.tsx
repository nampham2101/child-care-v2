"use client";

import { useContext } from "react";
import { useFormStatus } from "react-dom";

import { DiscardConfirmContext } from "@/components/admin/EditorForm";
import { encodeTarget, type DiscardTarget } from "@/lib/admin/discard";

/**
 * "Discard" beside a pending edit, and the confirmation it turns into — issue #121.
 *
 * ## Why the confirmation is a second press, not a dialog
 *
 * `EditorForm` is written to work before JavaScript has loaded — the action is a server action,
 * so submitting is a plain POST until React takes over. A `window.confirm` would simply not run
 * in that state, leaving the one irreversible control in the editor a single click from firing
 * with no gate at all. A round trip gates it in both cases, and it is the only version that can
 * word the prompt from what the database actually holds rather than from what the page assumed.
 *
 * The first press posts `discard_request` and writes nothing. The server reads the row, decides
 * whether this destroys an edit or the thing itself, and sends back the matching sentence; this
 * component recognises the prompt as its own by comparing the encoded target, and swaps itself
 * for it. The second press posts `discard_confirm`.
 *
 * ## The palette rule this obeys, which rules out the obvious styling
 *
 * `app/globals.css` states it twice: **terracotta is warmth only — a rule, an eyebrow, a
 * highlight — and NEVER on a control.** Sage is the single accent so that a person never has to
 * work out what is clickable. A red or terracotta destructive button is the reflex here and it
 * would break that.
 *
 * So the warning is carried by the panel — terracotta border and tint, the same treatment the
 * "Unpublished edit" badge already uses — and the buttons stay inside the system:
 *
 *   - **"Discard"** is a quiet ink text button. Findable, not prominent; the eye should still
 *     land on Save.
 *   - **"Keep it" takes the sage**, not "Yes, discard". Sage marks the call to action, and on a
 *     confirmation for something irreversible the action being encouraged is the safe one.
 *     Putting the accent on the destructive button would make the dangerous path the obvious
 *     one, which is how someone discards an afternoon's work by reflex.
 *   - **"Yes, discard"** is bordered and neutral: available, unmistakable, and requiring a
 *     deliberate look.
 */
export function DiscardControl({ target }: { target: DiscardTarget }) {
  const encoded = encodeTarget(target);
  const confirming = useContext(DiscardConfirmContext);

  // Only the section whose own target is being confirmed swaps into the prompt. Comparing the
  // encoded string rather than table and identity separately keeps this a single equality and
  // cannot drift from what the button submits, because it *is* what the button submits.
  if (confirming?.target !== encoded) {
    return (
      <DiscardButton
        name="discard_request"
        value={encoded}
        label="Discard"
        // Named for the thing: a page shows several of these, and "Discard" alone tells a
        // screen-reader user nothing about which one they have landed on.
        accessibleName={`Discard the unpublished change to ${target.label}`}
        tone="quiet"
      />
    );
  }

  return (
    <div
      // `alert` rather than `status`: this is a question that has replaced the control the
      // person just pressed, and it should interrupt rather than wait for a pause.
      role="alert"
      className="flex flex-col gap-3 rounded-xl border border-terracotta-500 bg-terracotta-100 p-4"
    >
      <p className="max-w-prose text-sm font-medium text-terracotta-700">
        {confirming.prompt}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        {/*
         * "Keep it" is an ordinary submit carrying no discard field, so the section's action
         * takes its normal path and saves. Since nothing was typed, it reports that nothing had
         * changed and the prompt clears. No second action and no client state — the way out is
         * the form's existing behaviour.
         */}
        <KeepButton />
        <DiscardButton
          name="discard_confirm"
          value={encoded}
          label="Yes, discard"
          accessibleName={`Yes, discard ${target.label}`}
          tone="deliberate"
        />
      </div>
    </div>
  );
}

/** Split out because `useFormStatus` reports the status of the form *above* it in the tree. */
function KeepButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center rounded-full bg-sage-700 px-5 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-sage-900 focus-visible:ring-2 focus-visible:ring-sage-900 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-70"
    >
      Keep it
    </button>
  );
}

function DiscardButton({
  name,
  value,
  label,
  accessibleName,
  tone,
}: {
  name: string;
  value: string;
  label: string;
  accessibleName: string;
  tone: "quiet" | "deliberate";
}) {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      aria-label={accessibleName}
      className={
        tone === "deliberate"
          ? "inline-flex shrink-0 items-center justify-center rounded-full border border-ink-700 bg-cream-50 px-5 py-2.5 text-sm font-semibold text-ink-900 transition-colors hover:bg-cream-100 focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-70"
          : "inline-flex shrink-0 items-center justify-center rounded-full px-3 py-1.5 text-sm font-medium text-ink-700 underline underline-offset-4 transition-colors hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-ink-900 focus-visible:outline-none disabled:opacity-70"
      }
    >
      {pending ? "Working…" : label}
    </button>
  );
}
