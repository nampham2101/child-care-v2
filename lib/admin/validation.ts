/**
 * Form validation for the editor — pure functions over strings, with no database and no React.
 *
 * ## Validation next to the constraints, not instead of them
 *
 * #74 is explicit about this and it is worth restating where the code lives: **the database
 * remains the thing that enforces.** Every rule here has a counterpart in the schema —
 * `per_month > 0`, `sibling_discount_percent between 0 and 100`, `not null` on every text
 * column. This layer exists so a staff member gets a readable sentence instead of a Postgres
 * error code, not so the constraint can be relaxed. If a value slips past here, the insert
 * still fails; `lib/admin/drafts.ts` turns that into a message that says the form has a gap
 * rather than blaming the person typing.
 *
 * The pairing is deliberate and asymmetric: a rule may exist here without one in the schema
 * (a maximum length that is taste rather than integrity), but **a rule must never exist only
 * here** when it protects the data.
 */

export type FieldError = { field: string; message: string };

export type Validated<T> =
  { ok: true; value: T } | { ok: false; errors: FieldError[] };

/**
 * Accumulates every problem with a submission rather than stopping at the first.
 *
 * A form that reports one error per save makes a staff member submit five times to fix five
 * fields, and each round trip is a page they have to re-read. All of them, at once.
 */
export class FieldReader {
  private readonly errors: FieldError[] = [];

  constructor(private readonly form: FormData) {}

  private raw(field: string): string {
    return String(this.form.get(field) ?? "").trim();
  }

  private fail(field: string, message: string): void {
    this.errors.push({ field, message });
  }

  /** A required line of text. `label` is what the person sees, never a column name. */
  text(field: string, label: string, options: { max?: number } = {}): string {
    const value = this.raw(field);
    const max = options.max ?? 200;

    if (!value) {
      this.fail(field, `${label} cannot be empty.`);
      return "";
    }
    if (value.length > max) {
      this.fail(
        field,
        `${label} is too long — ${value.length} characters, and the limit is ${max}.`,
      );
      return value;
    }
    return value;
  }

  /**
   * A whole number within a range.
   *
   * Rejects `1.5` and `12abc` rather than truncating them. `Number("")` is `0` and
   * `Number("12abc")` is `NaN`, and both would otherwise reach the database as something the
   * person did not type — the first silently, which is worse.
   */
  integer(
    field: string,
    label: string,
    options: { min?: number; max?: number } = {},
  ): number {
    const value = this.raw(field);
    const { min = 0, max = Number.MAX_SAFE_INTEGER } = options;

    if (!value) {
      this.fail(field, `${label} cannot be empty.`);
      return min;
    }
    if (!/^-?\d+$/.test(value)) {
      this.fail(field, `${label} must be a whole number.`);
      return min;
    }

    const parsed = Number(value);
    if (parsed < min || parsed > max) {
      this.fail(field, `${label} must be between ${min} and ${max}.`);
      return min;
    }
    return parsed;
  }

  /** A checkbox. Absent means false — an unchecked box submits nothing at all. */
  boolean(field: string): boolean {
    return this.form.get(field) !== null;
  }

  /**
   * A phone number, returned with the dial target derived from it.
   *
   * **The staff member types one field, not two.** `site_settings` stores `phone_display` and
   * `phone_href` side by side precisely so the pretty format and the dial target cannot
   * disagree, and asking a person to keep two fields in sync is how they come to disagree.
   * `tel:` wants digits, so the digits are taken from what was typed.
   */
  phone(field: string, label: string): { display: string; href: string } {
    const display = this.text(field, label);
    const digits = display.replace(/\D/g, "");

    if (display && (digits.length < 10 || digits.length > 15)) {
      this.fail(
        field,
        `${label} does not look like a phone number — it has ${digits.length} digits.`,
      );
      return { display, href: "" };
    }

    // A US number without a country code gets one, because `tel:` on a phone dials literally.
    const e164 = digits.length === 10 ? `+1${digits}` : `+${digits}`;
    return { display, href: `tel:${e164}` };
  }

  /**
   * An email address, with its `mailto:` derived the same way and for the same reason.
   *
   * The pattern is deliberately loose. Email addresses that look wrong are frequently valid,
   * and the cost of rejecting a real one here is a staff member who cannot save; the cost of
   * accepting a typo is a link that does not work, which they will see on the page.
   */
  email(field: string, label: string): { display: string; href: string } {
    const display = this.text(field, label);

    if (display && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(display)) {
      this.fail(field, `${label} does not look like an email address.`);
      return { display, href: "" };
    }

    return { display, href: `mailto:${display}` };
  }

  /** Everything that went wrong, or the value, once every field has been read. */
  finish<T>(value: T): Validated<T> {
    return this.errors.length > 0
      ? { ok: false, errors: this.errors }
      : { ok: true, value };
  }
}

/** Turns the error list into the shape a form renders: one message per field. */
export function errorsByField(
  errors: readonly FieldError[],
): Record<string, string> {
  const byField: Record<string, string> = {};
  for (const { field, message } of errors) {
    // First message wins — a field with two problems reports the one found first, and the
    // second surfaces on the next save rather than stacking two sentences under one input.
    byField[field] ??= message;
  }
  return byField;
}
