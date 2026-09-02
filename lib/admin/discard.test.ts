/**
 * Parsing a discard target, and the wording that depends on which case it is.
 *
 * The parser is the interesting half. Its input arrives in a form field, so every case below is
 * something a person with a session could post by hand — which is exactly why they are tested
 * here against crafted strings rather than only through the interface, where only the
 * well-formed one ever occurs.
 *
 * What these do **not** test is tenancy. A target naming another organization's row is refused by
 * row-level security, not by this module, and `tests/rls/discard.test.ts` is where that is
 * asserted against a real database. Testing it here would only prove the mock agrees.
 */
import { describe, expect, test } from "vitest";

import {
  discardPrompt,
  discardResult,
  encodeTarget,
  parseTarget,
  type DiscardTarget,
} from "@/lib/admin/discard";

const VALID: DiscardTarget = {
  table: "programs",
  identity: { key: "infants" },
  label: "the Infants room",
};

describe("a target survives the round trip", () => {
  test("what the button submits is what the server reads back", () => {
    expect(parseTarget(encodeTarget(VALID))).toEqual(VALID);
  });

  test("a table with no identity columns is a target too", () => {
    // `site_settings` and `tuition_fees` are one row per organization, so `{}` is their whole
    // identity — the same empty match `readTwins` already takes.
    const target: DiscardTarget = {
      table: "site_settings",
      identity: {},
      label: "the centre's details",
    };
    expect(parseTarget(encodeTarget(target))).toEqual(target);
  });

  test("the label is trimmed, so a padded one still matches its own control", () => {
    const parsed = parseTarget(
      JSON.stringify({ ...VALID, label: "  the Infants room  " }),
    );
    expect(parsed?.label).toBe("the Infants room");
  });
});

describe("a target that was tampered with is refused", () => {
  /*
   * Each of these returns null rather than throwing, and the action turns null into one flat
   * refusal. The distinction matters: an error message that explained which part was malformed
   * would be describing the internals back to whoever crafted the post.
   */
  const rejected: [string, unknown][] = [
    ["not a string at all", { table: "programs" }],
    ["not JSON", "programs:infants"],
    ["a JSON array", "[]"],
    ["JSON null", "null"],
    ["a bare string", '"programs"'],
    [
      "a table that is not discardable",
      JSON.stringify({ ...VALID, table: "profiles" }),
    ],
    [
      "a table that does not exist",
      JSON.stringify({ ...VALID, table: "orgs; drop table programs" }),
    ],
    ["a missing label", JSON.stringify({ table: "programs", identity: {} })],
    ["a blank label", JSON.stringify({ ...VALID, label: "   " })],
    ["a non-string label", JSON.stringify({ ...VALID, label: 7 })],
    ["a missing identity", JSON.stringify({ table: "programs", label: "x" })],
    ["an array identity", JSON.stringify({ ...VALID, identity: [] })],
    [
      "a nested identity value",
      // The one that would actually do something. PostgREST's `match()` builds an equality
      // filter per entry; an object here is not an equality test any more.
      JSON.stringify({ ...VALID, identity: { key: { gt: "" } } }),
    ],
    [
      "a numeric identity value",
      JSON.stringify({ ...VALID, identity: { key: 1 } }),
    ],
    [
      "an absurdly long value",
      JSON.stringify({ ...VALID, label: "x".repeat(3000) }),
    ],
  ];

  test.each(rejected)("%s", (_name, value) => {
    expect(parseTarget(value)).toBeNull();
  });
});

describe("the two cases read differently", () => {
  /*
   * ADR 0001's promote cases in mirror image. If these two sentences ever converge, the
   * confirmation stops carrying the only information it exists to convey — whether the
   * published version comes back or there is no published version at all.
   */
  test("reverting says the published version stays", () => {
    const prompt = discardPrompt("reverted", "the Infants room");
    expect(prompt).toContain("published version stays");
    expect(prompt).toContain("cannot be undone");
  });

  test("removing says there is nothing to go back to", () => {
    const prompt = discardPrompt("removed", "the photograph of Infants");
    expect(prompt).toContain("never been published");
    expect(prompt).toContain("cannot be undone");
  });

  test("both name the thing, so a page of them is not ambiguous", () => {
    for (const outcome of ["reverted", "removed"] as const) {
      expect(discardPrompt(outcome, "the Toddlers room")).toContain(
        "the Toddlers room",
      );
      expect(discardResult(outcome, "the Toddlers room")).toContain(
        "the Toddlers room",
      );
    }
  });

  test("the result never claims the public site changed", () => {
    // Discarding a draft cannot alter the published row, so neither message may imply a visitor
    // sees anything new. `docs/PLAN.md` is emphatic that the admin must not imply that.
    expect(discardResult("reverted", "x")).toContain(
      "what the public site has been showing all along",
    );
    expect(discardResult("removed", "x")).toContain(
      "the public site is unchanged",
    );
  });
});
