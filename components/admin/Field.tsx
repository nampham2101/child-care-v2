"use client";

import { useContext, useId } from "react";

import { FieldErrorContext } from "@/components/admin/EditorForm";

const INPUT_CLASS =
  "w-full rounded-lg border border-border bg-cream-50 px-3.5 py-2.5 text-base text-ink-900 focus-visible:border-sage-500 focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:outline-none";

const INVALID_CLASS = "border-terracotta-500";

type FieldProps = {
  /** The form field name. Matches what the server action reads — and is the only place a
   *  database column name is allowed to appear, because it never reaches the screen. */
  name: string;
  /** What the person reads. #74: nobody should be shown a column name. */
  label: string;
  /** One line explaining what this value is *for*, where the label alone would not. */
  hint?: string;
  defaultValue?: string | number;
  type?: "text" | "number";
  inputMode?: "text" | "numeric" | "tel" | "email";
};

export function Field({
  name,
  label,
  hint,
  defaultValue,
  type = "text",
  inputMode,
}: FieldProps) {
  const errors = useContext(FieldErrorContext);
  const error = errors[name];
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;

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
        type={type}
        inputMode={inputMode}
        defaultValue={defaultValue}
        /* The browser's own validation is deliberately not used. It fires before the server
           action runs, so a field it rejects never reaches the validator that writes the
           readable message — and the two would then disagree about what is acceptable. */
        aria-invalid={error ? true : undefined}
        aria-describedby={
          [hint ? hintId : null, error ? errorId : null]
            .filter(Boolean)
            .join(" ") || undefined
        }
        className={`${INPUT_CLASS} ${error ? INVALID_CLASS : ""}`}
      />
      {error ? (
        <p id={errorId} className="text-sm font-medium text-terracotta-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function CheckboxField({
  name,
  label,
  hint,
  defaultChecked,
}: {
  name: string;
  label: string;
  hint?: string;
  defaultChecked?: boolean;
}) {
  const id = useId();

  return (
    <div className="flex items-start gap-3">
      <input
        id={id}
        name={name}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-1 h-4 w-4 rounded border-border text-sage-700 focus-visible:ring-2 focus-visible:ring-sage-500 focus-visible:outline-none"
      />
      <div>
        <label htmlFor={id} className="text-sm font-medium text-ink-700">
          {label}
        </label>
        {hint ? <p className="text-sm text-ink-500">{hint}</p> : null}
      </div>
    </div>
  );
}
