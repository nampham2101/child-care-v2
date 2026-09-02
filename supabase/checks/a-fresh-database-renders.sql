-- Fails if a database built from `migrations/` and `seed.sql` alone could not render the site.
--
-- ---------------------------------------------------------------------------------------
-- WHY THIS EXISTS
-- ---------------------------------------------------------------------------------------
--
-- #126. Every migration that inserts copy finds its organization the same way:
--
--     insert into public.prose (...)
--     select o.id, 'en', v.namespace, v.key, v.value, 'published'
--     from public.orgs o
--     cross join (values ...) as v (namespace, key, value)
--     where o.slug = 'willow-grove'
--
-- On a fresh `supabase db reset` that is a no-op, because **`public.orgs` is empty when the
-- migrations run.** `db reset` replays every migration in filename order against an empty
-- database and applies `seed.sql` afterwards, and `seed.sql` is what creates the organization.
-- So the `cross join` matched nothing, five migrations inserted nothing, and the database came
-- out with zero rows in `public.prose`.
--
-- Those statements are correct against the hosted project, where the organization already
-- existed when they ran. They are no-ops everywhere else, and "everywhere else" is precisely
-- the restore-from-scratch case the recovery job exists to protect.
--
-- ---------------------------------------------------------------------------------------
-- WHY NOTHING CAUGHT IT
-- ---------------------------------------------------------------------------------------
--
-- `getProse` raises on an empty catalogue, so this is loud the moment anything reads it. Nothing
-- read it in the one place it happened:
--
--   * The CI seed job ran `db reset` and re-applied the files, proving they are RE-RUNNABLE. It
--     never queried a row, so an empty catalogue passed.
--   * `tests/content/` and `tests/rls/` run against the hosted project, which has the rows.
--   * The development machine has no local database at all.
--
-- The one environment that would notice was the one nobody built against. That is the general
-- lesson worth more than the fix: **"the files apply cleanly" and "the result is a working
-- database" are different claims, and only the first was being made.**
--
-- ---------------------------------------------------------------------------------------
-- WHAT IS ASSERTED, AND WHAT IS DELIBERATELY NOT
-- ---------------------------------------------------------------------------------------
--
--   1. Every table the public site reads has rows for the seeded organization. A missing fact
--      already fails the build via `lib/content.ts`, but it fails it part-way through a Netlify
--      deploy; this answers the same question in a second, against the database that is broken.
--   2. The catalogue is non-empty, and every locale in it carries the SAME (namespace, key) set.
--
-- **No expected row count appears here.** A total is a number somebody has to remember to update
-- and will not, and a stale one teaches the reader to shrug at a mismatch -- the same argument
-- `docs/RUNBOOK.md` makes about the end-to-end count. Parity is a property instead: it needs no
-- maintenance, it holds however many strings the site grows, and adding Italian changes nothing
-- in this file. `tests/content/locale-parity.test.ts` makes the same argument against the hosted
-- project and names the offending key; this is the structural half, run where that cannot reach.
--
-- `media` is deliberately absent from the table list. An empty bucket is an ordinary state (#78)
-- and `/programs` renders without a photograph.

\echo '--- checking that a fresh database could render the site ---'

do $$
declare
  seeded_org uuid;
  tbl text;
  row_count integer;
  empty_tables text;
  prose_rows integer;
  locales text;
  locale_count integer;
  mismatched text;
begin
  -- `seeded_org` rather than `org_id`: a PL/pgSQL variable sharing a name with a column makes
  -- `where org_id = org_id` ambiguous, and Postgres resolves it to the column, which is true for
  -- every row. The check would pass unconditionally and look like it was working.
  select o.id into seeded_org from public.orgs o where o.slug = 'willow-grove';

  if seeded_org is null then
    raise exception
      'The seeded organization does not exist. seed.sql creates it, so either the seed did not '
      'run or it failed earlier in this job.';
  end if;

  -- ---------------------------------------------------------------------------------------
  -- 1. Every table the site reads has rows.
  -- ---------------------------------------------------------------------------------------
  --
  -- The list is written out rather than derived from the catalog, because "does the site need
  -- this table to render?" is not a question Postgres can answer. A new content table should
  -- have to be added here deliberately.
  foreach tbl in array array[
    'site_settings', 'programs', 'daily_rhythm', 'staff',
    'tuition_schedules', 'tuition_rates', 'tuition_fees', 'prose'
  ] loop
    execute format('select count(*) from public.%I where org_id = $1', tbl)
      into row_count using seeded_org;

    if row_count = 0 then
      empty_tables := concat_ws(', ', empty_tables, tbl);
    end if;
  end loop;

  if empty_tables is not null then
    raise exception
      'A database built from migrations/ and seed.sql alone has no rows in: %. The site cannot '
      'render without them -- lib/content.ts raises on a missing fact and lib/prose.ts on an '
      'empty catalogue, so this database would fail a build rather than serve a page. See #126.',
      empty_tables;
  end if;

  -- ---------------------------------------------------------------------------------------
  -- 2. The catalogue is present in every locale it claims, key for key.
  -- ---------------------------------------------------------------------------------------
  select count(*), count(distinct p.locale), string_agg(distinct p.locale, ', ')
    into prose_rows, locale_count, locales
    from public.prose p
   where p.org_id = seeded_org and p.status = 'published';

  -- Keys that do not appear in as many locales as the catalogue has. Needs no default locale and
  -- no list of expected languages, so routing a third locale requires no edit here.
  select string_agg(t.k, ', ' order by t.k) into mismatched
    from (
      select p.namespace || '.' || p.key as k
        from public.prose p
       where p.org_id = seeded_org and p.status = 'published'
       group by p.namespace, p.key
      having count(distinct p.locale) <> locale_count
       limit 10
    ) as t;

  if mismatched is not null then
    raise exception
      'The catalogue is not at parity across its locales (%). Keys missing from at least one '
      'locale, up to ten shown: %. next-intl falls back to the default locale, so each of these '
      'renders an English sentence inside a translated page. See #126.',
      locales, mismatched;
  end if;

  raise notice
    'Fresh-database check passed: every content table has rows, and % published prose rows are '
    'at parity across %.', prose_rows, locales;
end $$;
