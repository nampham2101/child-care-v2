/**
 * `mergeCatalogues` — the one piece of #76 that is pure logic, and the one with a bug that
 * would have been invisible on the page it broke.
 *
 * This runs in the fast unit suite rather than beside the database tests, which is only
 * possible because `@/lib/prose` imports the Supabase client inside `getProse` rather than at
 * the top of the module. `@/lib/programs` documents why that import is written that way; this
 * file is the thing that benefits.
 */
import { describe, expect, test } from "vitest";

import { mergeCatalogues } from "@/lib/prose";

describe("mergeCatalogues", () => {
  /**
   * The bug this function exists to avoid.
   *
   * `{...prose, ...chrome}` is the obvious one-liner and it is wrong: `Nav` exists in both
   * halves, so the chrome object's `Nav` replaces the database's `Nav` wholesale and the
   * seven navigation labels vanish. On the page that is a header with three invisible
   * aria-labels and no links — which looks like a CSS failure, not a merge failure.
   */
  test("merges namespaces that exist in both halves, key by key", () => {
    const merged = mergeCatalogues(
      { Nav: { home: "Willow Grove home", programs: "Programs" } },
      { Nav: { label: "Primary", openMenu: "Open menu" } },
    );

    expect(merged.Nav).toEqual({
      home: "Willow Grove home",
      programs: "Programs",
      label: "Primary",
      openMenu: "Open menu",
    });
  });

  test("keeps namespaces that exist in only one half", () => {
    const merged = mergeCatalogues(
      { FaqPage: { answer: "Yes." } },
      { Nav: { label: "Primary" } },
    );

    expect(merged).toEqual({
      FaqPage: { answer: "Yes." },
      Nav: { label: "Primary" },
    });
  });

  /**
   * Chrome wins, and the comment on the function says why: the file is the half a reviewer
   * can see in a diff. This should never fire — the backfill excludes exactly the keys the
   * chrome file holds — so it is pinned here to make the tie-break a decision rather than an
   * accident of argument order.
   */
  test("chrome wins a key collision", () => {
    const merged = mergeCatalogues(
      { Nav: { label: "from the database" } },
      { Nav: { label: "from the file" } },
    );

    expect(merged.Nav.label).toBe("from the file");
  });

  test("an empty database half leaves chrome intact", () => {
    expect(mergeCatalogues({}, { Nav: { label: "Primary" } })).toEqual({
      Nav: { label: "Primary" },
    });
  });

  /** Neither input is mutated — both are cached values in the real call path. */
  test("does not mutate its arguments", () => {
    const prose = { Nav: { home: "Home" } };
    const chrome = { Nav: { label: "Primary" } };

    mergeCatalogues(prose, chrome);

    expect(prose).toEqual({ Nav: { home: "Home" } });
    expect(chrome).toEqual({ Nav: { label: "Primary" } });
  });
});
