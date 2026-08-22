"use client";

import { useContext, useId, useState } from "react";

import { FieldErrorContext } from "@/components/admin/EditorForm";
import { MAX_UPLOAD_BYTES } from "@/lib/admin/image";

/**
 * A file picker that says what it has, before anything is uploaded.
 *
 * A bare `<input type="file">` shows a filename in a font the page does not control and says
 * nothing about size — so a staff member selecting a 12 MB photograph off a camera learns it is
 * too big only after waiting for the whole transfer to fail. The size is known the instant the
 * file is chosen, so it is shown then.
 *
 * **This is a courtesy, not the check.** `lib/admin/image.ts` reads the actual bytes on the
 * server and the bucket enforces its own limit; both stay in force whatever this does. #78 puts
 * it plainly — a content-type header is a claim, not a fact — and so is anything a client
 * component believes about a file.
 *
 * `accept` is likewise a hint. It filters the picker's dialogue and is trivially bypassed, which
 * is fine: its job is to stop a person choosing a PDF by accident, not to stop anyone choosing
 * one on purpose.
 */
export function PhotoField({
  name,
  label,
  hint,
  required = false,
}: {
  name: string;
  label: string;
  hint?: string;
  required?: boolean;
}) {
  const errors = useContext(FieldErrorContext);
  const error = errors[name];
  const id = useId();
  const hintId = `${id}-hint`;
  const chosenId = `${id}-chosen`;
  const errorId = `${id}-error`;

  const [chosen, setChosen] = useState<{ name: string; size: number } | null>(
    null,
  );
  const tooBig = chosen !== null && chosen.size > MAX_UPLOAD_BYTES;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink-700">
        {label}
      </label>
      {hint ? (
        <p id={hintId} className="text-sm text-ink-500">
          {hint}
        </p>
      ) : null}

      <input
        id={id}
        name={name}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        /* `required` only on the first upload for a room — afterwards a submit that changes
           only the description is a legitimate edit, and the server treats it as one. */
        required={required}
        onChange={(event) => {
          const file = event.target.files?.[0];
          setChosen(file ? { name: file.name, size: file.size } : null);
        }}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [
            hint ? hintId : null,
            chosen ? chosenId : null,
            error ? errorId : null,
          ]
            .filter(Boolean)
            .join(" ") || undefined
        }
        className="w-full rounded-lg border border-border bg-cream-50 px-3.5 py-2.5 text-sm text-ink-900 file:mr-4 file:rounded-full file:border-0 file:bg-sage-700 file:px-4 file:py-1.5 file:text-sm file:font-semibold file:text-cream-50 hover:file:bg-sage-900 focus-visible:border-sage-500 focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:outline-none"
      />

      {chosen ? (
        <p
          id={chosenId}
          aria-live="polite"
          className={
            tooBig
              ? "text-sm font-medium text-terracotta-700"
              : "text-sm text-ink-500"
          }
        >
          {chosen.name} — {(chosen.size / 1024 / 1024).toFixed(1)} MB
          {tooBig ? ". That is over the 5 MB limit and will be refused." : ""}
        </p>
      ) : null}

      {error ? (
        <p id={errorId} className="text-sm font-medium text-terracotta-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
