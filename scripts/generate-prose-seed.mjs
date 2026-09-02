/**
 * Generates `supabase/seed-prose.sql` from the published copy in the hosted database.
 *
 * ## Why the catalogue is seed data and not a migration
 *
 * #126. Every prose migration is scoped `where o.slug = 'willow-grove'`, and `public.orgs` is
 * empty while migrations run on a fresh `supabase db reset` — `seed.sql` is what creates the
 * organization, and it runs afterwards. So all five of those migrations were no-ops on any
 * database but the hosted one, and a rebuilt database came out with no copy at all.
 *
 * A later migration cannot fix the earlier ones. Migrations run in filename order, so anything
 * added now lands *after* them and would have to carry the whole catalogue itself — which puts
 * the site's copy in two places with nothing keeping them in step. The copy is data, `seed.sql`
 * is the file that exists to be re-run whenever seeded data changes, and this is that file's
 * other half.
 *
 * ## Why this generator is not the one-shot that `generate-prose-backfill.mjs` was
 *
 * That script produced the #76 backfill from `messages/en.json` and can never run again, because
 * the file it read has since been trimmed to three chrome strings. This one reads the database,
 * which is the source of truth now, so it is **re-runnable and expected to be re-run**: whenever
 * staff publish a copy change worth carrying into the baseline, run it again and commit the
 * result.
 *
 * That is the same relationship `seed.sql` already has with the facts. Neither file tracks the
 * database automatically, and neither claims to — they are the restore point, refreshed
 * deliberately.
 *
 * ## The digest
 *
 * #76 required its backfill to be provably lossless, and proved it by digest rather than by eye,
 * because nobody checks 279 strings by hand and everybody says they did. The same applies here
 * with twice as many rows, so this prints an md5 over the sorted
 * `(locale, namespace, key, value)` tuples and writes it into the file header. Re-running the
 * generator and getting the same digest is what "the seed still matches the database" means.
 *
 * ## Reading rows with the anonymous key, on purpose
 *
 * The anon policy is `status = 'published'`, which is exactly the set that belongs in a seed: a
 * draft is somebody's unfinished edit and has no business in a restore point. So the narrowest
 * credential the project has is also the correct one, and no service-role key is needed or
 * wanted here.
 *
 * ## Usage
 *
 *     node --env-file=.env.local scripts/generate-prose-seed.mjs
 *
 * Writes `supabase/seed-prose.sql` and prints the row count and digest.
 */
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

const ORG_SLUG = "willow-grove";
const OUTPUT = path.resolve(import.meta.dirname, "../supabase/seed-prose.sql");

const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!projectUrl || !anonKey) {
  throw new Error(
    "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set. Run this with " +
      "`node --env-file=.env.local scripts/generate-prose-seed.mjs`.",
  );
}

/** Postgres string literal: double the single quotes and nothing else. */
function sqlString(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

const supabase = createClient(projectUrl, anonKey);

const { data, error } = await supabase
  .from("prose")
  .select("locale, namespace, key, value, orgs!inner (slug)")
  .eq("orgs.slug", ORG_SLUG);

if (error) {
  throw new Error(`Could not read prose: ${error.message}`);
}
if (!data || data.length === 0) {
  throw new Error(
    "The query returned no rows. That is not an empty catalogue to be written out — it is a " +
      "failed read, and writing the file anyway would replace the seed with nothing.",
  );
}

/*
 * Sorted before anything else is done with them, and the sort is load-bearing twice over: it
 * makes the digest reproducible, and it makes the generated file diff cleanly. Without it the
 * row order is whatever Postgres returned, and re-running the generator would produce a
 * thousand-line diff that hides the one string that actually changed.
 */
const rows = data
  .map(({ locale, namespace, key, value }) => ({
    locale,
    namespace,
    key,
    value,
  }))
  .sort(
    (a, b) =>
      a.locale.localeCompare(b.locale) ||
      a.namespace.localeCompare(b.namespace) ||
      a.key.localeCompare(b.key),
  );

const digest = createHash("md5")
  .update(
    rows.map((r) => `${r.locale}${r.namespace}${r.key}${r.value}`).join("\n"),
  )
  .digest("hex");

const locales = [...new Set(rows.map((r) => r.locale))].sort();
const perLocale = locales
  .map((l) => `${l} ${rows.filter((r) => r.locale === l).length}`)
  .join(", ");

const values = rows
  .map(
    (r) =>
      `  (${sqlString(r.locale)}, ${sqlString(r.namespace)}, ${sqlString(r.key)}, ${sqlString(r.value)})`,
  )
  .join(",\n");

const sql = `-- The site's copy: every published string, in every locale. GENERATED FILE -- do not hand-edit.
--
-- Written by scripts/generate-prose-seed.mjs from the published rows in the hosted database.
-- To refresh it after staff publish a copy change worth keeping in the restore point:
--
--     node --env-file=.env.local scripts/generate-prose-seed.mjs
--
-- ---------------------------------------------------------------------------------------
-- WHY THIS IS SEED DATA AND NOT A MIGRATION (#126)
-- ---------------------------------------------------------------------------------------
--
-- Five migrations insert prose, and every one is scoped \`where o.slug = 'willow-grove'\`. On a
-- fresh \`supabase db reset\` the migrations run BEFORE seed.sql, so \`public.orgs\` is empty, the
-- cross join matches nothing, and all five insert nothing. A database rebuilt from the
-- repository had no copy at all -- and since the site reads 293 of its 296 strings from this
-- table, that is not a degraded site, it is a build that fails.
--
-- A later migration cannot repair the earlier ones: migrations run in filename order, so a new
-- one lands after them and would have to carry the whole catalogue itself, putting the copy in
-- two places. It is data. It belongs here.
--
-- The five migrations stay as they are. They ran correctly against the hosted project, which is
-- the only database that existed when they were written, and rewriting applied migrations to
-- tidy up history is a worse habit than leaving them as no-ops on a rebuild.
--
-- ---------------------------------------------------------------------------------------
-- PROVENANCE
-- ---------------------------------------------------------------------------------------
--
--     rows ${rows.length} (${perLocale}), md5 ${digest}
--
-- The digest covers the sorted (locale, namespace, key, value) tuples. Re-run the generator; if
-- the digest matches, this file still says what the database says. #76 established the practice
-- and the reason: nobody verifies ${rows.length} strings by eye, and everybody reports that they did.
--
-- ---------------------------------------------------------------------------------------
-- RE-RUNNABLE, AND IT PRESERVES DRAFTS
-- ---------------------------------------------------------------------------------------
--
-- \`on conflict (cols) where status = 'published'\` names the published partial index explicitly.
-- #93 is why the predicate is spelled out: \`on conflict (cols)\` alone cannot choose between the
-- table's two partial indexes and Postgres refuses to plan the statement at all.
--
-- It also means re-seeding conflicts against published rows only, so a staff member's
-- unpublished draft survives untouched -- the same property every statement in seed.sql has.

insert into public.prose (org_id, locale, namespace, key, value, status)
select o.id, v.locale, v.namespace, v.key, v.value, 'published'
from public.orgs o
cross join (values
${values}
) as v (locale, namespace, key, value)
where o.slug = ${sqlString(ORG_SLUG)}
on conflict (org_id, locale, namespace, key) where status = 'published'
do update set value = excluded.value;
`;

writeFileSync(OUTPUT, sql, "utf8");

console.log(`Wrote ${OUTPUT}`);
console.log(`rows ${rows.length} (${perLocale}), md5 ${digest}`);
