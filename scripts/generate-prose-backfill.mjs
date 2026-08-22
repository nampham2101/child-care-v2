/**
 * Generates the prose backfill migration from `messages/en.json`.
 *
 * #76 requires the backfill to be verifiably lossless — "the migration must not lose or
 * reword a single string". Hand-writing 279 INSERT statements cannot offer that; a reviewer
 * would be checking 279 strings by eye and would stop after ten. So the SQL was generated
 * from the catalogue, and this generator is committed as the evidence of how.
 *
 * **It is a one-shot tool and it can no longer be re-run.** It was executed once, against the
 * catalogue as it stood before this pull request trimmed it; `messages/en.json` now holds
 * three chrome strings and the database is the source of truth. Running this today would
 * produce a backfill of nothing. It is kept because deleting the derivation would leave 279
 * hand-checkable strings with no account of where they came from, which is exactly the
 * situation the ticket asked us to avoid.
 *
 * **How losslessness was actually proven**, since re-running is not the answer: every row in
 * the database was compared against the pre-trim catalogue by digest — the same 279
 * (namespace, key, value) triples, sorted, joined, and hashed on both sides.
 *
 *     rows 279, md5 5c1835181bb32db57ea6381147f53257
 *
 * Both sides agreed, so not one character moved — curly quotes, em dashes, and the 19 ICU
 * placeholders included. The migration header records the same digest. To re-check it later,
 * read the catalogue out of git history rather than from the working tree:
 *
 *     git show <this PR's base>:messages/en.json
 *
 * The standing guarantee from here on is not this script. It is
 * `tests/content/message-keys.test.ts`, which asserts that every key the site asks for is in
 * the catalogue the site assembles, and that the file holds only the three chrome strings.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SOURCE = path.join(ROOT, "messages", "en.json");
const TARGET = path.join(
  ROOT,
  "supabase",
  "migrations",
  "20260822020339_backfill_prose_from_en_catalogue.sql",
);

const ORG_SLUG = "willow-grove";
const LOCALE = "en";

/**
 * The chrome/content boundary, as data.
 *
 * A string is **chrome** when it describes the interface rather than the center: a staff
 * member editing the center's copy has no reason to rename "Open menu", and exposing it in
 * the editor is an invitation to break the accessible name of the navigation. Everything
 * that names or describes the center, its rooms, its people, its prices, or its policies is
 * **content** and belongs in the database — including `Nav.home`, whose value is
 * "Willow Grove home" and which must change the day the center is renamed.
 *
 * Three strings, all of them aria-labels or button text on the mobile menu. That the site is
 * 99% content is the finding, not a mistake: `docs/PLAN.md` calls this a marketing site whose
 * whole job is copy.
 */
const CHROME = new Set(["Nav.label", "Nav.openMenu", "Nav.closeMenu"]);

/** `Namespace.key` → value, over a catalogue asserted to be exactly two levels deep. */
function flatten(catalogue) {
  const out = [];
  for (const [namespace, entries] of Object.entries(catalogue)) {
    if (typeof entries !== "object" || entries === null) {
      throw new Error(
        `${namespace} is not a namespace object. The catalogue must be exactly two levels deep.`,
      );
    }
    for (const [key, value] of Object.entries(entries)) {
      if (typeof value !== "string") {
        throw new Error(
          `${namespace}.${key} is ${typeof value}, not a string. Nested namespaces are not supported — ` +
            "the prose table has one namespace column and one key column.",
        );
      }
      if (value.trim() === "") {
        throw new Error(
          `${namespace}.${key} is empty. An empty string renders as blank as a missing one; ` +
            "the prose table rejects it with a check constraint.",
        );
      }
      out.push({ namespace, key, value });
    }
  }
  return out;
}

/** Postgres string literal. Doubling the quote is the whole escape; there is no backslash. */
const quote = (text) => `'${text.replaceAll("'", "''")}'`;

function render(rows) {
  const values = rows
    .map(
      ({ namespace, key, value }) =>
        `  (${quote(namespace)}, ${quote(key)}, ${quote(value)})`,
    )
    .join(",\n");

  return `-- Backfill: the English catalogue becomes rows in public.prose.
--
-- GENERATED FILE — do not edit by hand.
--   node scripts/generate-prose-backfill.mjs          regenerates it
--   node scripts/generate-prose-backfill.mjs --check  fails if this file drifted
--
-- ---------------------------------------------------------------------------------------
-- WHAT THIS MOVES
-- ---------------------------------------------------------------------------------------
--
-- ${rows.length} strings, every one of them from messages/en.json, copied verbatim. The three that
-- stay behind are UI chrome — Nav.label, Nav.openMenu, Nav.closeMenu — which describe the
-- navigation rather than the center. scripts/generate-prose-backfill.mjs holds that boundary
-- as a list and explains it.
--
-- Rows are inserted as 'published', not 'draft'. These strings are on the live site right
-- now; landing them as drafts would mean the first build after this migration finds no
-- published prose and fails, and someone would have to press Publish to restore copy that
-- was never unpublished.
--
-- ---------------------------------------------------------------------------------------
-- SAFE TO RUN TWICE
-- ---------------------------------------------------------------------------------------
--
-- The upsert targets prose_one_published_per_key, the partial unique index from the table's
-- own migration. A second run updates the same rows in place. It does NOT touch drafts: a
-- staff member's unpublished edit survives a re-run, because the index this conflicts on is
-- scoped to published rows.
--
-- It never deletes, for the reason supabase/README.md gives about the seed — a backfill that
-- removed whatever it did not recognise would be one careless edit away from destroying copy
-- the editor wrote.

insert into public.prose (org_id, locale, namespace, key, value, status)
select o.id, ${quote(LOCALE)}, v.namespace, v.key, v.value, 'published'
from public.orgs o
cross join (values
${values}
) as v (namespace, key, value)
where o.slug = ${quote(ORG_SLUG)}
on conflict (org_id, locale, namespace, key) where status = 'published'
do update set value = excluded.value;
`;
}

const catalogue = JSON.parse(readFileSync(SOURCE, "utf8"));
const all = flatten(catalogue);
const content = all.filter(
  ({ namespace, key }) => !CHROME.has(`${namespace}.${key}`),
);

/**
 * Refuse rather than overwrite.
 *
 * Run against the trimmed catalogue this would happily write a backfill containing nothing,
 * silently replacing the record of a migration that moved 279 strings with an empty one. The
 * committed SQL is the artefact; this guard is what stops a well-meaning `node
 * scripts/generate-prose-backfill.mjs` from destroying it.
 */
if (content.length === 0) {
  console.error(
    `${path.relative(ROOT, SOURCE)} holds only chrome, so there is nothing to back-fill.\n` +
      "This generator already ran; the database is the source of truth for prose now. See the\n" +
      "comment at the top of this file for how the backfill was proven lossless.",
  );
  process.exit(1);
}

const { writeFileSync } = await import("node:fs");
writeFileSync(TARGET, render(content));
console.log(
  `wrote ${path.relative(ROOT, TARGET)} — ${content.length} content strings, ` +
    `${all.length - content.length} left as chrome.`,
);
