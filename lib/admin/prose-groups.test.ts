/**
 * How the editor names and bounds a group of copy.
 *
 * Pure logic, so it runs in the fast suite. The half that needs a database — that every
 * namespace actually stored has a group pointing at it — is asserted in
 * `tests/content/prose-groups.test.ts` against the live rows, because that is the direction
 * that can only be wrong relative to real data.
 */
import { describe, expect, it } from "vitest";

import {
  PROSE_GROUPS,
  assertGroupsCoverAll,
  fieldLabel,
  groupBySlug,
  proseLimitFor,
} from "@/lib/admin/prose-groups";

describe("the group list itself", () => {
  it("has no duplicate slugs", () => {
    const slugs = PROSE_GROUPS.map((group) => group.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("has no duplicate namespaces", () => {
    const namespaces = PROSE_GROUPS.map((group) => group.namespace);
    expect(new Set(namespaces).size).toBe(namespaces.length);
  });

  /*
   * The slug is the URL and the namespace is a database column, and they are deliberately not
   * the same string. If they ever converge, renaming a namespace silently breaks bookmarks.
   */
  it("keeps slugs url-safe", () => {
    for (const { slug } of PROSE_GROUPS) {
      expect(slug).toMatch(/^[a-z][a-z0-9-]*$/);
    }
  });

  it("finds a group by its slug, and nothing by a made-up one", () => {
    expect(groupBySlug("faq")?.namespace).toBe("FaqPage");
    expect(groupBySlug("not-a-group")).toBeUndefined();
  });
});

describe("fieldLabel", () => {
  it("turns a camelCase key into a sentence", () => {
    expect(fieldLabel("placeWaitlistAnswer")).toBe("Place waitlist answer");
  });

  it("handles a single word", () => {
    expect(fieldLabel("intro")).toBe("Intro");
  });

  it("keeps runs of capitals together", () => {
    expect(fieldLabel("metaTitle")).toBe("Meta title");
    expect(fieldLabel("visitAria")).toBe("Visit aria");
  });

  it("does not lose digits", () => {
    expect(fieldLabel("addressLine1")).toBe("Address line1");
  });
});

describe("proseLimitFor", () => {
  /*
   * The limit has to be generous enough that the current copy is nowhere near it — a staff
   * member opening the FAQ and finding the longest answer already at its ceiling would
   * reasonably think the editor was refusing to let them work.
   */
  it("leaves room above the longest string it is given", () => {
    const longest = "a".repeat(276);
    expect(proseLimitFor([longest, "short"])).toBeGreaterThan(276 * 1.4);
  });

  it("never drops below a floor, however short the group", () => {
    expect(proseLimitFor(["Infants", "Toddlers"])).toBe(120);
  });

  it("is stable for the same input, so the form and the save agree", () => {
    const values = ["one", "a".repeat(200)];
    expect(proseLimitFor(values)).toBe(proseLimitFor(values));
  });

  it("handles an empty group without returning zero", () => {
    expect(proseLimitFor([])).toBe(120);
  });
});

describe("assertGroupsCoverAll", () => {
  it("passes when every stored namespace has a group", () => {
    const all = PROSE_GROUPS.map((group) => group.namespace);
    expect(() => assertGroupsCoverAll(all)).not.toThrow();
  });

  /*
   * The failure that matters: copy exists that no editor renders, so a staff member cannot
   * reach it and nothing says so. The message has to name the namespace, or whoever hits this
   * has 13 groups to check by hand.
   */
  it("fails, naming the namespace, when copy has no editor", () => {
    const all = [...PROSE_GROUPS.map((group) => group.namespace), "NewPage"];
    expect(() => assertGroupsCoverAll(all)).toThrow(/NewPage/);
  });

  it("fails when a group points at a namespace that is not there", () => {
    const missingFaq = PROSE_GROUPS.map((group) => group.namespace).filter(
      (namespace) => namespace !== "FaqPage",
    );
    expect(() => assertGroupsCoverAll(missingFaq)).toThrow(/FaqPage/);
  });
});
