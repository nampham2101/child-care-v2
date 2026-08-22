import { describe, expect, it } from "vitest";

import {
  FieldReader,
  errorsByField,
  placeholdersIn,
  type Validated,
} from "@/lib/admin/validation";

/**
 * The editor's validation, tested as the things a staff member actually types.
 *
 * These rules have counterparts in the schema — that is the point of them, per #74: the
 * database enforces, this layer explains. So the cases worth writing are the ones where a
 * plausible entry would otherwise reach the database as something the person did not mean.
 * `Number("")` is `0` and `Number("12abc")` is `NaN`; both would pass a naive parse, and the
 * first would silently store a zero where a year belongs.
 */
function read(fields: Record<string, string>): FieldReader {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  return new FieldReader(form);
}

function errorsOf<T>(result: Validated<T>): Record<string, string> {
  return result.ok ? {} : errorsByField(result.errors);
}

describe("text", () => {
  it("accepts a value and trims it", () => {
    const reader = read({ name: "  Willow Grove  " });
    const value = reader.text("name", "Center name");

    expect(value).toBe("Willow Grove");
    expect(reader.finish(value).ok).toBe(true);
  });

  it("refuses an empty value by the label a person sees, not the column name", () => {
    const reader = read({ license_number: "   " });
    reader.text("license_number", "Licence number");

    // #74: "A staff member can complete the whole edit without being told a database column
    // name." That applies to error messages too, which is where column names usually leak.
    expect(errorsOf(reader.finish(null))).toEqual({
      license_number: "Licence number cannot be empty.",
    });
  });

  it("refuses a value past its limit and says how far past", () => {
    const reader = read({ hours: "x".repeat(30) });
    reader.text("hours", "Opening hours", { max: 20 });

    expect(errorsOf(reader.finish(null)).hours).toBe(
      "Opening hours is too long — 30 characters, and the limit is 20.",
    );
  });
});

describe("integer", () => {
  it("accepts a whole number in range", () => {
    const reader = read({ since: "2009" });
    const value = reader.integer("since", "Year opened", {
      min: 1900,
      max: 2100,
    });

    expect(value).toBe(2009);
    expect(reader.finish(value).ok).toBe(true);
  });

  /** `Number("")` is 0. A blank year field would otherwise store the year zero. */
  it("refuses an empty value rather than reading it as zero", () => {
    const reader = read({ since: "" });
    reader.integer("since", "Year opened", { min: 1900, max: 2100 });

    expect(errorsOf(reader.finish(null)).since).toBe(
      "Year opened cannot be empty.",
    );
  });

  it("refuses a decimal rather than truncating it", () => {
    const reader = read({ rate: "1450.50" });
    reader.integer("rate", "Monthly rate", { min: 1 });

    expect(errorsOf(reader.finish(null)).rate).toBe(
      "Monthly rate must be a whole number.",
    );
  });

  it("refuses digits with something stuck to them", () => {
    const reader = read({ rate: "1450abc" });
    reader.integer("rate", "Monthly rate", { min: 1 });

    expect(errorsOf(reader.finish(null)).rate).toBe(
      "Monthly rate must be a whole number.",
    );
  });

  /** Mirrors `sibling_discount_percent between 0 and 100` in the schema. */
  it("refuses a value outside the range the database would refuse", () => {
    const reader = read({ discount: "150" });
    reader.integer("discount", "Sibling discount", { min: 0, max: 100 });

    expect(errorsOf(reader.finish(null)).discount).toBe(
      "Sibling discount must be between 0 and 100.",
    );
  });

  /** Mirrors `per_month > 0`, which zero does not satisfy. */
  it("refuses zero where the database requires a positive number", () => {
    const reader = read({ rate: "0" });
    reader.integer("rate", "Monthly rate", { min: 1 });

    expect(errorsOf(reader.finish(null)).rate).toBe(
      "Monthly rate must be between 1 and 9007199254740991.",
    );
  });
});

describe("boolean", () => {
  it("reads a ticked checkbox as true and an absent one as false", () => {
    expect(read({ featured: "on" }).boolean("featured")).toBe(true);
    // An unchecked checkbox submits nothing at all, which is why absence is the false case
    // rather than an error.
    expect(read({}).boolean("featured")).toBe(false);
  });
});

describe("phone", () => {
  /**
   * The invariant this exists to hold: `site_settings` stores the display format and the dial
   * target side by side, and the schema comment says they must never disagree. A staff member
   * therefore types one field and the `tel:` is derived, rather than being asked to keep two
   * in sync.
   */
  it("derives the dial target from what was typed", () => {
    const reader = read({ phone: "(503) 555-0142" });
    const { display, href } = reader.phone("phone", "Phone number");

    expect(display).toBe("(503) 555-0142");
    expect(href).toBe("tel:+15035550142");
    expect(reader.finish(null).ok).toBe(true);
  });

  it("keeps an existing country code rather than adding a second one", () => {
    const reader = read({ phone: "+44 20 7946 0018" });

    expect(reader.phone("phone", "Phone number").href).toBe(
      "tel:+442079460018",
    );
  });

  it("refuses something with too few digits to dial", () => {
    const reader = read({ phone: "555-0142" });
    reader.phone("phone", "Phone number");

    expect(errorsOf(reader.finish(null)).phone).toBe(
      "Phone number does not look like a phone number — it has 7 digits.",
    );
  });
});

describe("email", () => {
  it("derives the mailto from what was typed", () => {
    const reader = read({ email: "hello@willowgrove.example" });
    const { display, href } = reader.email("email", "Email address");

    expect(display).toBe("hello@willowgrove.example");
    expect(href).toBe("mailto:hello@willowgrove.example");
  });

  it("refuses an address with no domain", () => {
    const reader = read({ email: "hello@willowgrove" });
    reader.email("email", "Email address");

    expect(errorsOf(reader.finish(null)).email).toBe(
      "Email address does not look like an email address.",
    );
  });
});

describe("finish", () => {
  it("reports every problem at once, not just the first", () => {
    // A form that reports one error per save makes a staff member submit five times to fix
    // five fields.
    const reader = read({ name: "", since: "abc", phone: "1" });
    reader.text("name", "Center name");
    reader.integer("since", "Year opened", { min: 1900, max: 2100 });
    reader.phone("phone", "Phone number");

    const result = reader.finish(null);
    expect(result.ok).toBe(false);
    expect(Object.keys(errorsOf(result)).sort()).toEqual([
      "name",
      "phone",
      "since",
    ]);
  });

  it("returns the value when nothing is wrong", () => {
    const reader = read({ name: "Willow Grove" });
    const name = reader.text("name", "Center name");

    expect(reader.finish({ name })).toEqual({
      ok: true,
      value: { name: "Willow Grove" },
    });
  });
});

/**
 * The placeholder guard, which is the one rule here with no counterpart in the schema.
 *
 * Everything else in this file explains a constraint the database also enforces. Postgres has
 * no opinion about `{since}` — the enforcement is next-intl, at build time, minutes after the
 * publish, in a place nothing connects back to the edit. So this layer is not the friendly
 * message for that failure; it is the only thing standing in front of it.
 */
describe("placeholdersIn", () => {
  it("finds each placeholder once, in order", () => {
    expect(placeholdersIn("Licensed since {since}, ages {ageRange}")).toEqual([
      "{since}",
      "{ageRange}",
    ]);
  });

  it("does not repeat one that appears twice", () => {
    expect(placeholdersIn("{count} of {count}")).toEqual(["{count}"]);
  });

  it("finds none in ordinary copy", () => {
    expect(placeholdersIn("No screens in any room, at any age.")).toEqual([]);
  });

  /*
   * Braces a person typed as punctuation are not placeholders, and must not be reported as
   * something to "keep" — that would be an error message demanding they restore nonsense.
   */
  it("ignores braces that are not an identifier", () => {
    expect(placeholdersIn("Open {} and { } and {two words}")).toEqual([]);
  });
});

describe("prose", () => {
  it("accepts a rewrite that keeps its placeholder", () => {
    const reader = read({ bio: "Licensed every year since {since}." });
    const value = reader.prose("bio", "Licence line", ["{since}"]);

    expect(reader.finish(value)).toEqual({
      ok: true,
      value: "Licensed every year since {since}.",
    });
  });

  it("refuses a rewrite that dropped one, and names it", () => {
    const reader = read({ bio: "Licensed every year since 2009." });
    reader.prose("bio", "Licence line", ["{since}"]);

    expect(errorsOf(reader.finish(null)).bio).toContain("{since}");
  });

  it("names both when two are missing", () => {
    const reader = read({ bio: "Nothing left." });
    reader.prose("bio", "Hero line", ["{count}", "{ageRange}"]);

    const message = errorsOf(reader.finish(null)).bio;
    expect(message).toContain("{count}");
    expect(message).toContain("{ageRange}");
  });

  it("allows longer copy than a one-line field would", () => {
    const long = "a".repeat(400);
    const reader = read({ bio: long });
    const value = reader.prose("bio", "Bio", [], { max: 600 });

    expect(reader.finish(value).ok).toBe(true);
  });

  it("reports the length and the limit when it is too long", () => {
    const reader = read({ bio: "a".repeat(130) });
    reader.prose("bio", "Room name", [], { max: 120 });

    const message = errorsOf(reader.finish(null)).bio;
    expect(message).toContain("130");
    expect(message).toContain("120");
  });

  /*
   * Emptying a string is not a way to delete it. The row still renders, so the page would show
   * a gap — and the database refuses it anyway with a check constraint.
   */
  it("refuses an empty value and says why", () => {
    const reader = read({ bio: "   " });
    reader.prose("bio", "Bio", []);

    expect(errorsOf(reader.finish(null)).bio).toContain("cannot be empty");
  });
});
