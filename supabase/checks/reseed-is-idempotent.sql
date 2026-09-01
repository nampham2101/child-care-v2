-- Applies seed.sql and fixtures/rls.sql a second and third time, and fails if either cannot be
-- re-run or if re-running changes anything it should not.
--
-- ---------------------------------------------------------------------------------------
-- WHY THIS EXISTS
-- ---------------------------------------------------------------------------------------
--
-- #93: both files had been unapplicable for several weeks and nothing reported it. The twin-rows
-- migration replaced each unique constraint with two partial unique indexes, `on conflict (cols)`
-- could no longer name one of them, and Postgres refused to plan the statements at all. Neither
-- file ran in CI. Both are applied by hand. The first person to hit it would most likely have
-- been someone restoring a broken database, which is the worst possible moment to find out the
-- recovery script does not run.
--
-- The fix was one predicate per statement. Nothing stopped the next index change breaking it the
-- same silent way. This is that guard.
--
-- ---------------------------------------------------------------------------------------
-- WHAT IT RUNS, AND WHY IT RUNS THE REAL FILES
-- ---------------------------------------------------------------------------------------
--
-- `\ir` includes the committed files themselves rather than a copy with the slug swapped. #98
-- asked for that specifically: a job that tests a rewritten copy proves less than it appears to,
-- because the rewriting is where the difference would hide.
--
-- The seed has already been applied once by `supabase db reset` before this script runs, so the
-- inclusions below are applications two and three. Two is the one that has broken before; three
-- is nearly free and catches anything that only accumulates.
--
-- ---------------------------------------------------------------------------------------
-- WHAT IS ASSERTED
-- ---------------------------------------------------------------------------------------
--
--   1. Both files apply without error. `ON_ERROR_STOP` in the workflow makes a 42P10 or a 23505
--      fail the job rather than scroll past.
--   2. No row identifier changes. A seed that replaced rows instead of updating them would take
--      every foreign key with it.
--   3. No content value changes — `updated_at` excluded, and deliberately: each content table has
--      a BEFORE UPDATE trigger, so an upsert writing an identical value still restamps the row.
--      `supabase/README.md` says the same thing in prose.
--   4. A draft twin planted before the re-seed is still a draft afterwards, still holding its own
--      value. This is the property that makes re-seeding safe to run while someone has an edit in
--      flight, and it is a consequence of every `on conflict` naming the *published* index.
--   5. The row counts are the ones supabase/README.md documents.

\set ON_ERROR_STOP on

-- ---------------------------------------------------------------------------------------
-- The fixture account, created here because there is no dashboard on a throwaway database
-- ---------------------------------------------------------------------------------------
--
-- `fixtures/rls.sql` raises unless `rls-fixture@example.com` exists in `auth.users`, and that
-- guard is right: on the hosted project the account is real and creating it from SQL would mean
-- committing a password hash to a public repository.
--
-- Neither half of that objection survives here. This database is created and destroyed inside
-- one CI job, and **no password is set** — `encrypted_password` is left null, so the row cannot
-- be signed in to at all. It exists only so the fixture's profile insert has something to join
-- to, which is what lets this script exercise the rest of the file.
insert into auth.users (
  instance_id, id, aud, role, email,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data
)
select
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated', 'authenticated', 'rls-fixture@example.com',
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb
where not exists (
  select 1 from auth.users where email = 'rls-fixture@example.com'
);

-- ---------------------------------------------------------------------------------------
-- Snapshot, before anything is re-applied
-- ---------------------------------------------------------------------------------------
--
-- `to_jsonb(t.*) - 'updated_at'` is the row without the column the trigger owns. Keyed by id, so
-- a replaced row shows up as a missing id rather than as a changed value.

create temp table seed_before as
  select 'orgs' as tbl, o.id::text as id, to_jsonb(o.*) - 'updated_at' as row
    from public.orgs o
  union all select 'site_settings', s.id::text, to_jsonb(s.*) - 'updated_at' from public.site_settings s
  union all select 'programs', p.id::text, to_jsonb(p.*) - 'updated_at' from public.programs p
  union all select 'daily_rhythm', d.id::text, to_jsonb(d.*) - 'updated_at' from public.daily_rhythm d
  union all select 'staff', st.id::text, to_jsonb(st.*) - 'updated_at' from public.staff st
  union all select 'tuition_schedules', ts.id::text, to_jsonb(ts.*) - 'updated_at' from public.tuition_schedules ts
  union all select 'tuition_rates', tr.id::text, to_jsonb(tr.*) - 'updated_at' from public.tuition_rates tr
  union all select 'tuition_fees', tf.id::text, to_jsonb(tf.*) - 'updated_at' from public.tuition_fees tf;

-- An unpublished edit, sitting against a row the seed is about to rewrite. A draft schedule as
-- well as a draft program, because the two exercise different things: the program is a plain
-- twin, and the schedule is a second join match for the tuition_rates statement, which would
-- write extra published rates pointing at a draft parent if the join stopped filtering.
-- The marker moved from `age_label` to `ratio` when #123 dropped that column. `ratio` is the
-- only free text column left on this table, and it is still the right place for the probe: the
-- seed rewrites it, so a draft that survives with this value proves the conflict target really
-- is the published index.
insert into public.programs (org_id, key, ratio, sort_order, status)
select o.id, 'infants', 'DRAFT EDIT in flight', 1, 'draft'
from public.orgs o where o.slug = 'willow-grove';

insert into public.tuition_schedules (org_id, key, sort_order, status)
select o.id, 'fiveDay', 99, 'draft'
from public.orgs o where o.slug = 'willow-grove';

-- ---------------------------------------------------------------------------------------
-- Applications two and three
-- ---------------------------------------------------------------------------------------

\echo '--- applying supabase/seed.sql (second application) ---'
\ir ../seed.sql

\echo '--- applying supabase/seed.sql (third application) ---'
\ir ../seed.sql

\echo '--- applying supabase/fixtures/rls.sql (twice) ---'
\ir ../fixtures/rls.sql
\ir ../fixtures/rls.sql

-- ---------------------------------------------------------------------------------------
-- The assertions
-- ---------------------------------------------------------------------------------------

create temp table seed_after as
  select 'orgs' as tbl, o.id::text as id, to_jsonb(o.*) - 'updated_at' as row
    from public.orgs o
  union all select 'site_settings', s.id::text, to_jsonb(s.*) - 'updated_at' from public.site_settings s
  union all select 'programs', p.id::text, to_jsonb(p.*) - 'updated_at' from public.programs p
  union all select 'daily_rhythm', d.id::text, to_jsonb(d.*) - 'updated_at' from public.daily_rhythm d
  union all select 'staff', st.id::text, to_jsonb(st.*) - 'updated_at' from public.staff st
  union all select 'tuition_schedules', ts.id::text, to_jsonb(ts.*) - 'updated_at' from public.tuition_schedules ts
  union all select 'tuition_rates', tr.id::text, to_jsonb(tr.*) - 'updated_at' from public.tuition_rates tr
  union all select 'tuition_fees', tf.id::text, to_jsonb(tf.*) - 'updated_at' from public.tuition_fees tf;

do $$
declare
  vanished text;
  altered text;
  draft_label text;
  draft_schedules integer;
  rate_count integer;
  counts text;
begin
  -- 2. Every row that existed before still exists, under the same id.
  select string_agg(b.tbl || ' ' || b.id, ', ')
    into vanished
    from seed_before b
   where not exists (select 1 from seed_after a where a.tbl = b.tbl and a.id = b.id);

  if vanished is not null then
    raise exception
      'Re-seeding replaced rows instead of updating them. Missing after: %. Every foreign key '
      'pointing at those ids went with them — see the promote-case reasoning in '
      'docs/adr/0001-draft-and-published-twin-rows.md.', vanished;
  end if;

  -- 3. And carries the same values, `updated_at` aside.
  select string_agg(b.tbl || ' ' || b.id, ', ')
    into altered
    from seed_before b
    join seed_after a on a.tbl = b.tbl and a.id = b.id
   where a.row is distinct from b.row;

  if altered is not null then
    raise exception
      'Re-seeding changed values on rows that should have been rewritten identically: %.', altered;
  end if;

  -- 4. The draft twins are untouched, because the conflict target is the published index.
  select p.ratio into draft_label
    from public.programs p join public.orgs o on o.id = p.org_id
   where o.slug = 'willow-grove' and p.key = 'infants' and p.status = 'draft';

  if draft_label is distinct from 'DRAFT EDIT in flight' then
    raise exception
      'A draft twin did not survive the re-seed (found %). Re-seeding must not discard an edit '
      'somebody has in flight; that is what `on conflict (...) where status = ''published''` buys.',
      coalesce(draft_label, '<the draft is gone>');
  end if;

  select count(*) into draft_schedules
    from public.tuition_schedules s join public.orgs o on o.id = s.org_id
   where o.slug = 'willow-grove' and s.status = 'draft';

  if draft_schedules <> 1 then
    raise exception 'Expected the planted draft schedule to survive, found % of them.', draft_schedules;
  end if;

  -- The draft schedule must not have become a second join match for the rates statement.
  select count(*) into rate_count
    from public.tuition_rates tr join public.orgs o on o.id = tr.org_id
   where o.slug = 'willow-grove';

  if rate_count <> 9 then
    raise exception
      'Expected 9 tuition rates, found %. A draft schedule or program has been matched as a '
      'second join row, and the seed has written published rates pointing at a draft parent.',
      rate_count;
  end if;

  -- 5. The counts supabase/README.md documents, drafts excluded.
  select string_agg(t.label || '=' || t.n, ', ' order by t.label) into counts from (
    select 'daily_rhythm' as label, count(*) as n from public.daily_rhythm where status = 'published'
    union all select 'programs', count(*) from public.programs where status = 'published'
    union all select 'site_settings', count(*) from public.site_settings where status = 'published'
    union all select 'staff', count(*) from public.staff where status = 'published'
    union all select 'tuition_fees', count(*) from public.tuition_fees where status = 'published'
    union all select 'tuition_rates', count(*) from public.tuition_rates where status = 'published'
    union all select 'tuition_schedules', count(*) from public.tuition_schedules where status = 'published'
  ) t;

  if counts <> 'daily_rhythm=7, programs=4, site_settings=1, staff=7, tuition_fees=1, '
               'tuition_rates=9, tuition_schedules=3' then
    raise exception
      'Published row counts are not what supabase/README.md documents: %. (programs is 4, not 3: '
      'three seeded bands plus the fixture organization''s published tripwire row.)', counts;
  end if;

  raise notice 'Re-seed check passed: both files re-applied, no row replaced, no value changed, drafts intact.';
end
$$;
