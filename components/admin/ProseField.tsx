"use client";

import { useContext, useId, useState } from "react";

import { FieldErrorContext } from "@/components/admin/EditorForm";

const TEXTAREA_CLASS =
  "w-full rounded-lg border border-border bg-cream-50 px-3.5 py-2.5 text-base leading-relaxed text-ink-900 focus-visible:border-sage-500 focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:outline-none";

const INVALID_CLASS = "border-terracotta-500";

/**
 * A field for writing sentences, not for typing a phone number.
 *
 * `Field` exists and is not enough here. #77 names length as the thing that makes prose
 * different — *"a staff member should be able to tell how long is too long before publishing
 * rather than after"* — and a single-line input answers that question by scrolling the text out
 * of sight. Three differences, each for a stated reason:
 *
 *   - **A textarea that grows with its content.** Rows are derived from the length of the copy,
 *     so a three-word room name is not given a six-line box and a bio is not given one line.
 *   - **A live count against the limit.** The server enforces it; this exists so the limit is
 *     known while writing rather than discovered on submit, which is the difference between an
 *     edit and a re-edit.
 *   - **Placeholders named in the hint.** See below — this is the important one.
 *
 * ## Why placeholders get their own line
 *
 * Nineteen of the site's strings interpolate a value: `Licensed since {since}`. To a staff
 * member that brace is meaningless punctuation and the obvious tidy-up is to replace it with
 * the actual year. Since #76 that would fail the next build, minutes later, in a place nothing
 * connects back to the edit.
 *
 * `FieldReader.prose` refuses the save, so this is not the guard — it is the part that stops
 * the person wasting the attempt. Naming the placeholder up front is cheaper than the clearest
 * possible error message after the fact.
 */
export function ProseField({
  name,
  label,
  value,
  placeholders,
  max,
}: {
  name: string;
  /** What the person reads. #74: nobody should be shown a column name. */
  label: string;
  value: string;
  /** ICU placeholders the current copy contains, which the edit has to keep. */
  placeholders: readonly string[];
  max: number;
}) {
  const errors = useContext(FieldErrorContext);
  const error = errors[name];
  const id = useId();
  const hintId = `${id}-hint`;
  const countId = `${id}-count`;
  const errorId = `${id}-error`;

  const [length, setLength] = useState(value.length);
  const over = length > max;

  // Roughly one row per 72 characters, floored at two and capped at twelve. The cap matters:
  // an unbounded box for the longest FAQ answer would push every field below it off the screen,
  // and this page is a list of many fields rather than one.
  const rows = Math.min(12, Math.max(2, Math.ceil(value.length / 72) + 1));

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium text-ink-700">
        {label}
      </label>

      {placeholders.length > 0 ? (
        <p id={hintId} className="text-sm text-ink-500">
          Keep{" "}
          {placeholders.map((placeholder, index) => (
            <span key={placeholder}>
              {index > 0 ? " and " : ""}
              <code className="rounded bg-cream-100 px-1 font-mono text-ink-700">
                {placeholder}
              </code>
            </span>
          ))}{" "}
          exactly as {placeholders.length === 1 ? "it is" : "they are"} — the
          site fills {placeholders.length === 1 ? "it" : "them"} in with a real
          value.
        </p>
      ) : null}

      <textarea
        id={id}
        name={name}
        rows={rows}
        defaultValue={value}
        onChange={(event) => setLength(event.target.value.length)}
        /* The browser's own validation is deliberately not used, for the reason `Field`
           documents: it fires before the server action runs, so a value it rejects never
           reaches the validator that writes the readable message. `maxLength` would be worse
           than most — it silently truncates rather than refusing, so a staff member would
           publish a sentence with its ending quietly removed. */
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [
            placeholders.length > 0 ? hintId : null,
            countId,
            error ? errorId : null,
          ]
            .filter(Boolean)
            .join(" ") || undefined
        }
        className={`${TEXTAREA_CLASS} ${error ? INVALID_CLASS : ""}`}
      />

      <p
        id={countId}
        /* Polite, and only while over: announcing every keystroke would make a screen reader
           unusable, and announcing nothing would hide the one state that blocks the save. */
        aria-live={over ? "polite" : "off"}
        className={
          over
            ? "text-sm font-medium text-terracotta-700"
            : "text-sm text-ink-500"
        }
      >
        {over
          ? `${length} characters — ${length - max} over the limit of ${max}.`
          : `${length} of ${max} characters.`}
      </p>

      {error ? (
        <p id={errorId} className="text-sm font-medium text-terracotta-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}
