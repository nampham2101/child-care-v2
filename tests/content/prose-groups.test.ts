/**
 * Every namespace the database actually stores has an editor group pointing at it.
 *
 * `lib/admin/prose-groups.test.ts` proves the function; this proves the **list**, against real
 * rows, which is the only place the answer can come from. The two failures it catches are not
 * symmetrical:
 *
 *   - **Copy with no group is unreachable.** Nothing renders an editor for it, so a staff
 *     member cannot fix a typo in it and the interface gives no hint that it exists. This is
 *     the one that matters, and it is completely silent — the site renders that copy perfectly
 *     well, so nobody finds out until someone asks why a sentence cannot be changed.
 *   - **A group with no copy is a dead link** in the list, which 404s. Louder, but still worth
 *     failing here rather than on a click.
 *
 * It runs in the database suite because both halves have to be real for the answer to mean
 * anything — the same reasoning `vitest.db.config.mts` gives for `tests/content/`.
 */
import { describe, expect, test } from "vitest";

import { routing } from "@/i18n/routing";
import { assertGroupsCoverAll, PROSE_GROUPS } from "@/lib/admin/prose-groups";
import { CENTER_ORG_SLUG } from "@/lib/content";
import { getProse } from "@/lib/prose";

/**
 * Namespaces are read through `getProse` rather than by a fresh query, so this asserts against
 * the same catalogue the site builds from. A namespace that exists in the table but is filtered
 * out of the read path is not reachable copy, and should not count as covered.
 */
async function namespacesFor(locale: string): Promise<string[]> {
  return Object.keys(await getProse(locale)).sort();
}

describe.each(routing.locales.map((locale) => ({ locale })))(
  "the editor reaches every stored string in $locale",
  ({ locale }) => {
    test("every namespace has a group, and every group has a namespace", async () => {
      const namespaces = await namespacesFor(locale);

      // A locale that returned nothing would make the assertion below vacuously true.
      expect(namespaces.length).toBeGreaterThan(0);

      expect(() => assertGroupsCoverAll(namespaces)).not.toThrow();
    });

    test("the group list and the database agree exactly", async () => {
      const namespaces = await namespacesFor(locale);
      const groups = PROSE_GROUPS.map((group) => group.namespace).sort();

      // Stated as an equality as well as through the assert, because this is the line whose
      // diff names both sides when someone adds copy in a new namespace.
      expect(groups).toEqual(namespaces);
    });
  },
);

test("the organization under test is the one the site renders", () => {
  // Guards against this suite quietly passing against a fixture org whose copy is not the
  // site's — the failure mode supabase/fixtures/rls.sql exists to make visible.
  expect(CENTER_ORG_SLUG).toBe("willow-grove");
});
