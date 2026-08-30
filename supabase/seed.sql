-- The fictional center's facts, transcribed from lib/ into the tables that will replace it.
--
-- Every value below is a copy of one that lib/center.ts, lib/programs.ts, lib/staff.ts, or
-- lib/tuition.ts holds today. Nothing here is invented or rounded. Once the read-path
-- tickets land, the site renders these rows instead of those constants, and a rate that
-- shifted by five dollars during transcription becomes a content bug that surfaces as a
-- failing end-to-end assertion pointing at nothing in particular. The values are quoted
-- beside each block so a reviewer can diff them against the source without leaving the file.
--
-- This file is DATA, not schema, which is why it is not a migration. Migrations run once and
-- forward only; this is designed to be re-run whenever the seeded facts change. Every
-- statement upserts on the natural key the schema already enforces — (org_id, key) for the
-- content tables, org_id alone for the two single-row tables, and (schedule_id, program_id)
-- for rates — so running it twice leaves identical row counts and identical values.
--
-- EVERY `on conflict` HERE CARRIES `where status = 'published'`, AND MUST. The twin-rows
-- migration replaced each of those unique constraints with two partial unique indexes, one
-- per status. `on conflict (cols)` alone can no longer tell which of the two it means, and
-- Postgres refuses to plan the statement at all — 42P10, at plan time, so the whole file
-- fails rather than one row. Supplying the index predicate names the published index and is
-- the only form that works. See #93; the same form is in migrations/*backfill_prose*.sql.
--
-- What that choice means, beyond making the file run: a re-seed conflicts against published
-- rows only, so a staff member's unpublished DRAFT is left exactly as it was. Re-seeding
-- restores the live site to these values without discarding an edit somebody has in flight.
--
-- For the same reason, the two joins in tuition_rates filter on `status = 'published'`.
-- Without that filter a draft schedule or a draft program would be a second join match, and
-- the seed would write an extra published rate row pointing at a draft parent.
--
-- WHAT RE-RUNNING DOES NOT DO: it never deletes. Removing a program band from this file
-- leaves the row in the database, because a seed that deletes whatever it does not recognise
-- is one careless edit away from destroying rows an admin UI wrote. Deletions are done
-- deliberately, by hand, not as a side effect of seeding.
--
-- All rows are inserted `published`. Draft rows exist to be tested against, not to be seeded;
-- the row-level security suite creates its own.
--
-- HOW TO APPLY IT: see supabase/README.md. There is no local database on this project —
-- Docker is not installed — so `supabase db reset`, which is the usual way this file would
-- run, is unavailable. It is applied against the hosted project directly.

-- ---------------------------------------------------------------------------------------
-- orgs — the tenancy root
-- ---------------------------------------------------------------------------------------
--
-- The slug is the seed's anchor: every statement below finds its org by looking this value
-- up, rather than by pasting a UUID that would differ between any two databases. The name is
-- lib/center.ts's `name`.

insert into public.orgs (slug, name)
values ('willow-grove', 'Willow Grove Children''s Center')
on conflict (slug) do update
  set name = excluded.name;

-- ---------------------------------------------------------------------------------------
-- site_settings — from lib/center.ts
-- ---------------------------------------------------------------------------------------
--
-- The phone number is in the 555-01xx range reserved for fiction and the email is on a
-- .example domain reserved by RFC 2606, both deliberately, so placeholder copy can never
-- reach a real line or a real inbox. Keep it that way when these values change.

insert into public.site_settings (
  org_id,
  phone_display, phone_href,
  email_display, email_href,
  license_number, years_operating_since,
  infant_ratio,
  address_line1, address_line2,
  status
)
select
  o.id,
  '(503) 555-0142', 'tel:+15035550142',
  'hello@willowgrove.example', 'mailto:hello@willowgrove.example',
  'C-1094872', 2009,
  '1:4',
  '428 Alder Street', 'Portland, OR 97210',
  'published'::public.content_status
from public.orgs o
where o.slug = 'willow-grove'
on conflict (org_id) where status = 'published' do update set
  phone_display = excluded.phone_display,
  phone_href = excluded.phone_href,
  email_display = excluded.email_display,
  email_href = excluded.email_href,
  license_number = excluded.license_number,
  years_operating_since = excluded.years_operating_since,
  infant_ratio = excluded.infant_ratio,
  address_line1 = excluded.address_line1,
  address_line2 = excluded.address_line2,
  status = excluded.status;

-- ---------------------------------------------------------------------------------------
-- programs — from lib/programs.ts (PROGRAM_BANDS)
-- ---------------------------------------------------------------------------------------
--
-- sort_order is youngest-first and the end-to-end tests assert that ordering against the
-- rendered page: a parent arrives knowing their child's age and nothing else, so the first
-- band they see must be the youngest. The array order in PROGRAM_BANDS is what carries that
-- today; here it has to be written down explicitly.
--
-- The age dashes are en dashes (–), not hyphens, exactly as in lib/programs.ts. They are
-- rendered to the page verbatim.

insert into public.programs (org_id, key, age_label, ratio, group_size, sort_order, status)
select
  o.id, v.key, v.age_label, v.ratio, v.group_size, v.sort_order,
  'published'::public.content_status
from public.orgs o
cross join (values
  ('infants',   '6 weeks – 15 months', '1:4', '8 children',  1),
  ('toddlers',  '15 months – 3 years', '1:5', '10 children', 2),
  ('preschool', '3 – 5 years',         '1:9', '18 children', 3)
) as v(key, age_label, ratio, group_size, sort_order)
where o.slug = 'willow-grove'
on conflict (org_id, key) where status = 'published' do update set
  age_label = excluded.age_label,
  ratio = excluded.ratio,
  group_size = excluded.group_size,
  sort_order = excluded.sort_order,
  status = excluded.status;

-- ---------------------------------------------------------------------------------------
-- daily_rhythm — from lib/programs.ts (DAILY_RHYTHM)
-- ---------------------------------------------------------------------------------------
--
-- Times are 12-hour with no meridiem because the whole list runs 7:00 to 4:30 within one
-- day and the column reads faster without seven repetitions of "AM". sort_order is the order
-- the day happens in, which is the array order in DAILY_RHYTHM.

insert into public.daily_rhythm (org_id, label_key, "time", sort_order, status)
select
  o.id, v.label_key, v."time", v.sort_order,
  'published'::public.content_status
from public.orgs o
cross join (values
  ('arrival',   '7:00',  1),
  ('breakfast', '8:30',  2),
  ('centers',   '9:30',  3),
  ('lunch',     '11:30', 4),
  ('nap',       '12:30', 5),
  ('snack',     '3:00',  6),
  ('pickup',    '4:30',  7)
) as v(label_key, "time", sort_order)
where o.slug = 'willow-grove'
on conflict (org_id, label_key) where status = 'published' do update set
  "time" = excluded."time",
  sort_order = excluded.sort_order,
  status = excluded.status;

-- ---------------------------------------------------------------------------------------
-- staff — from lib/staff.ts (STAFF)
-- ---------------------------------------------------------------------------------------
--
-- `since` is the year they joined, not a tenure: lib/staff.ts derives years from it so that
-- a stored "12 years" cannot silently become wrong on the first of January. is_featured
-- picks the three the home page's strip introduces. sort_order is the order a parent meets
-- them — leadership, then room by room youngest-first, then the kitchen — which is the array
-- order in STAFF.

insert into public.staff (org_id, key, name, since, is_featured, sort_order, status)
select
  o.id, v.key, v.name, v.since, v.is_featured, v.sort_order,
  'published'::public.content_status
from public.orgs o
cross join (values
  ('maria',  'Maria Delgado',   2014, true,  1),
  ('nadia',  'Nadia Okonkwo',   2017, false, 2),
  ('aisha',  'Aisha Bello',     2018, true,  3),
  ('grace',  'Grace Lim',       2021, false, 4),
  ('daniel', 'Daniel Ruiz',     2019, false, 5),
  ('tom',    'Tom Fischer',     2020, true,  6),
  ('sofia',  'Sofia Marchetti', 2015, false, 7)
) as v(key, name, since, is_featured, sort_order)
where o.slug = 'willow-grove'
on conflict (org_id, key) where status = 'published' do update set
  name = excluded.name,
  since = excluded.since,
  is_featured = excluded.is_featured,
  sort_order = excluded.sort_order,
  status = excluded.status;

-- ---------------------------------------------------------------------------------------
-- tuition_schedules — from lib/tuition.ts (SCHEDULES)
-- ---------------------------------------------------------------------------------------
--
-- Widest first, matching the order the rate table is read. The keys are camelCase because
-- they join to messages/en.json, where the schedule names live as `fiveDayName` and friends;
-- they are message keys, not column names, so the snake_case rule in docs/CONVENTIONS.md
-- does not apply to them.

insert into public.tuition_schedules (org_id, key, sort_order, status)
select
  o.id, v.key, v.sort_order,
  'published'::public.content_status
from public.orgs o
cross join (values
  ('fiveDay',  1),
  ('threeDay', 2),
  ('twoDay',   3)
) as v(key, sort_order)
where o.slug = 'willow-grove'
on conflict (org_id, key) where status = 'published' do update set
  sort_order = excluded.sort_order,
  status = excluded.status;

-- ---------------------------------------------------------------------------------------
-- tuition_rates — from lib/tuition.ts (SCHEDULES[].perMonth)
-- ---------------------------------------------------------------------------------------
--
-- Nine rows: every schedule against every room. lib/tuition.ts guarantees that coverage in
-- the type system — a fourth band is a compile error there rather than an empty cell in the
-- table — and no table constraint can express it, so the count is the thing to check. A
-- part-time place costs more per day than a full-time one because the room is staffed either
-- way, which is why these are stored per pair rather than derived from a percentage.
--
-- Whole dollars. The schema rejects cents and formatRate() prints none.

insert into public.tuition_rates (org_id, schedule_id, program_id, per_month, status)
select
  o.id, s.id, p.id, v.per_month,
  'published'::public.content_status
from public.orgs o
cross join (values
  ('fiveDay',  'infants',   2140),
  ('fiveDay',  'toddlers',  1840),
  ('fiveDay',  'preschool', 1565),
  ('threeDay', 'infants',   1490),
  ('threeDay', 'toddlers',  1285),
  ('threeDay', 'preschool', 1095),
  ('twoDay',   'infants',   1075),
  ('twoDay',   'toddlers',  925),
  ('twoDay',   'preschool', 790)
) as v(schedule_key, program_key, per_month)
join public.tuition_schedules s
  on s.org_id = o.id and s.key = v.schedule_key and s.status = 'published'
join public.programs p
  on p.org_id = o.id and p.key = v.program_key and p.status = 'published'
where o.slug = 'willow-grove'
on conflict (schedule_id, program_id) where status = 'published' do update set
  per_month = excluded.per_month,
  status = excluded.status;

-- ---------------------------------------------------------------------------------------
-- tuition_fees — from lib/tuition.ts (FEES)
-- ---------------------------------------------------------------------------------------
--
-- The sums that are not the monthly rate. These sit in the tuition hero rather than a
-- footnote, because they are what a rate sheet usually omits and a parent finds out at
-- signing.

insert into public.tuition_fees (
  org_id,
  registration, deposit_weeks, notice_weeks,
  late_pickup_per_minute, sibling_discount_percent,
  status
)
select
  o.id,
  75, 2, 4,
  2, 10,
  'published'::public.content_status
from public.orgs o
where o.slug = 'willow-grove'
on conflict (org_id) where status = 'published' do update set
  registration = excluded.registration,
  deposit_weeks = excluded.deposit_weeks,
  notice_weeks = excluded.notice_weeks,
  late_pickup_per_minute = excluded.late_pickup_per_minute,
  sibling_discount_percent = excluded.sibling_discount_percent,
  status = excluded.status;
