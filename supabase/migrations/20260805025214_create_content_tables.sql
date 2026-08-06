-- Initial content schema: orgs, settings, programs, staff, tuition — with row-level
-- security on every table from the moment it exists.
--
-- The tables mirror the modules in lib/ that currently hold these facts in TypeScript.
-- Facts move to the database this release; prose stays in messages/*.json, which is why
-- there is no faq or about table — those two pages are entirely copy.
--
-- Every table is created, has RLS enabled, and has its policies attached before the next
-- table is created. A table that exists for even one statement without RLS is a table that
-- was readable by anyone holding the anonymous key — and that key ships in the client
-- bundle by design.

-- ---------------------------------------------------------------------------------------
-- Shared building blocks
-- ---------------------------------------------------------------------------------------

-- draft | published, as a type rather than a text column with a check constraint, so a
-- typo in a future INSERT is a hard error instead of a row nothing will ever publish.
create type public.content_status as enum ('draft', 'published');

-- The tenancy hook every authenticated policy is written against.
--
-- It returns NULL for now: there is no profiles table until authentication arrives in
-- v0.4.0, so there is no way to map a session to an organization yet. NULL is the correct
-- answer rather than a placeholder — `org_id = NULL` is never true, so the authenticated
-- policies below currently grant nothing, which is exactly right while no one can log in.
--
-- v0.4.0 replaces this one function body with a lookup against profiles, and every policy
-- on every table starts working without being rewritten. That is the whole point of the
-- indirection.
--
-- NOTE for v0.4.0: once this reads from profiles, it will need `security definer`, because
-- profiles will itself carry an RLS policy that calls this function and would otherwise
-- recurse. It is left out now because a function that reads nothing needs no elevation.
create function public.current_org_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select null::uuid;
$$;

comment on function public.current_org_id() is
  'The caller''s organization. Returns NULL until v0.4.0 adds profiles; see the migration that created it.';

-- Keeps updated_at honest. Without this the column would record the row's creation time
-- forever and quietly lie the first time anything edits a row — which is worse than not
-- having the column, because the wrong value looks like a real one.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------------------
-- orgs — the tenancy root
-- ---------------------------------------------------------------------------------------
--
-- One row in v1. The column exists on every content table from this migration rather than
-- being retrofitted, because adding a tenancy key to tables that already hold live child
-- records is a data migration under production data, and this is the one moment it is free.

create table public.orgs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.orgs enable row level security;

create trigger orgs_set_updated_at
  before update on public.orgs
  for each row execute function public.set_updated_at();

-- orgs has no status column: it is not content, it is the tenant list, and a draft tenant
-- is not a thing. Anonymous read is allowed because the build needs to resolve the center's
-- slug to its id before it can fetch anything else, and because the only two columns here
-- are a slug and a name already printed in the site header.
create policy "orgs are readable by anyone"
  on public.orgs for select to anon
  using (true);

create policy "orgs are managed by their own members"
  on public.orgs for all to authenticated
  using (id = public.current_org_id())
  with check (id = public.current_org_id());

-- ---------------------------------------------------------------------------------------
-- site_settings — mirrors lib/center.ts
-- ---------------------------------------------------------------------------------------
--
-- One row per organization, enforced by the unique constraint rather than by convention.
-- Every value here appears in at least two places on the site — the license number is in
-- the header and the footer, the phone number in the nav and the contact block — so the
-- single-row shape is what keeps a parent from seeing two different license numbers.

create table public.site_settings (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,

  -- Display/href pairs, kept adjacent so the pretty format and the dial target can never
  -- disagree. This is the shape lib/center.ts already uses.
  phone_display text not null,
  phone_href text not null,
  email_display text not null,
  email_href text not null,

  license_number text not null,
  years_operating_since integer not null,

  age_range text not null,
  infant_ratio text not null,
  hours_short text not null,

  address_line1 text not null,
  address_line2 text not null,
  neighborhood text not null,

  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint site_settings_one_row_per_org unique (org_id)
);

alter table public.site_settings enable row level security;

create trigger site_settings_set_updated_at
  before update on public.site_settings
  for each row execute function public.set_updated_at();

create policy "published settings are readable by anyone"
  on public.site_settings for select to anon
  using (status = 'published');

create policy "settings are managed by their own organization"
  on public.site_settings for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- ---------------------------------------------------------------------------------------
-- programs — mirrors lib/programs.ts (PROGRAM_BANDS)
-- ---------------------------------------------------------------------------------------
--
-- sort_order is stored rather than derived, and the seed sets it youngest-first. A parent
-- arrives knowing their child's age and nothing else, so the first band they see must be
-- the youngest — an ordering the end-to-end tests already assert against the rendered page.

create table public.programs (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,

  -- Joins this row to its translated name in messages/*.json under the Programs namespace.
  -- The copy is translatable; the numbers below are facts and stay here.
  key text not null,

  age_label text not null,
  ratio text not null,
  group_size text not null,
  sort_order integer not null,

  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint programs_key_unique_per_org unique (org_id, key)
);

alter table public.programs enable row level security;

create trigger programs_set_updated_at
  before update on public.programs
  for each row execute function public.set_updated_at();

create policy "published programs are readable by anyone"
  on public.programs for select to anon
  using (status = 'published');

create policy "programs are managed by their own organization"
  on public.programs for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- ---------------------------------------------------------------------------------------
-- daily_rhythm — mirrors lib/programs.ts (DAILY_RHYTHM)
-- ---------------------------------------------------------------------------------------

create table public.daily_rhythm (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,

  -- Joins to the Day namespace in messages/*.json, the same split programs uses.
  label_key text not null,

  -- Text, not a time type, because the source is a display string: the whole list runs 7:00
  -- to 4:30 in one day and reads faster without seven repetitions of "AM". Storing a real
  -- time would push that formatting decision back out into every caller.
  "time" text not null,

  sort_order integer not null,

  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint daily_rhythm_label_unique_per_org unique (org_id, label_key)
);

alter table public.daily_rhythm enable row level security;

create trigger daily_rhythm_set_updated_at
  before update on public.daily_rhythm
  for each row execute function public.set_updated_at();

create policy "published daily rhythm is readable by anyone"
  on public.daily_rhythm for select to anon
  using (status = 'published');

create policy "daily rhythm is managed by its own organization"
  on public.daily_rhythm for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- ---------------------------------------------------------------------------------------
-- staff — mirrors lib/staff.ts
-- ---------------------------------------------------------------------------------------

create table public.staff (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,

  -- Joins to the Staff namespace in messages/*.json, where the role and bio prose lives.
  key text not null,

  name text not null,

  -- The year they joined, not a tenure in years: a stored "12 years" silently becomes wrong
  -- on the first of January. lib/staff.ts derives tenure from this for the same reason.
  since integer not null,

  is_featured boolean not null default false,
  sort_order integer not null,

  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint staff_key_unique_per_org unique (org_id, key)
);

alter table public.staff enable row level security;

create trigger staff_set_updated_at
  before update on public.staff
  for each row execute function public.set_updated_at();

create policy "published staff are readable by anyone"
  on public.staff for select to anon
  using (status = 'published');

create policy "staff are managed by their own organization"
  on public.staff for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- ---------------------------------------------------------------------------------------
-- tuition_schedules — mirrors lib/tuition.ts (SCHEDULES)
-- ---------------------------------------------------------------------------------------

create table public.tuition_schedules (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,

  -- Joins to the TuitionPage namespace in messages/*.json for the schedule's name.
  key text not null,

  -- Widest schedule first, matching the order the rate table is read.
  sort_order integer not null,

  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tuition_schedules_key_unique_per_org unique (org_id, key)
);

alter table public.tuition_schedules enable row level security;

create trigger tuition_schedules_set_updated_at
  before update on public.tuition_schedules
  for each row execute function public.set_updated_at();

create policy "published tuition schedules are readable by anyone"
  on public.tuition_schedules for select to anon
  using (status = 'published');

create policy "tuition schedules are managed by their own organization"
  on public.tuition_schedules for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- ---------------------------------------------------------------------------------------
-- tuition_rates — mirrors lib/tuition.ts (SCHEDULES[].perMonth)
-- ---------------------------------------------------------------------------------------
--
-- One row per schedule-and-room pair. A part-time place costs more per day than a full-time
-- one because the room is staffed either way, so rates are stored per pair rather than
-- derived from a percentage of the full-time rate — the tuition page's whole argument is
-- that the arithmetic is shown rather than hidden.
--
-- WHAT THIS TABLE CANNOT ENFORCE: lib/tuition.ts guarantees in the type system that every
-- room has a rate in every schedule, so adding a fourth room is a compile error rather than
-- an empty cell a parent finds in the table. A unique constraint stops duplicate pairs but
-- cannot require that every pair exists — total coverage is not expressible as a table
-- constraint. That guarantee has to be re-established where the rates are read; see the
-- pull request that added this file.

create table public.tuition_rates (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,

  schedule_id uuid not null references public.tuition_schedules (id) on delete cascade,
  program_id uuid not null references public.programs (id) on delete cascade,

  -- Whole dollars. Every published rate is a whole dollar and formatRate() deliberately
  -- prints no cents, so an integer makes a stray cents value impossible rather than merely
  -- unusual. Charging cents would be a real product change and deserves its own migration.
  per_month integer not null check (per_month > 0),

  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tuition_rates_one_per_pair unique (schedule_id, program_id)
);

alter table public.tuition_rates enable row level security;

create trigger tuition_rates_set_updated_at
  before update on public.tuition_rates
  for each row execute function public.set_updated_at();

create policy "published tuition rates are readable by anyone"
  on public.tuition_rates for select to anon
  using (status = 'published');

create policy "tuition rates are managed by their own organization"
  on public.tuition_rates for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- ---------------------------------------------------------------------------------------
-- tuition_fees — mirrors lib/tuition.ts (FEES)
-- ---------------------------------------------------------------------------------------
--
-- The sums that are not the monthly rate — what a rate sheet usually omits and a parent
-- discovers at signing. One row per organization, like site_settings.

create table public.tuition_fees (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,

  registration integer not null check (registration >= 0),
  deposit_weeks integer not null check (deposit_weeks >= 0),
  notice_weeks integer not null check (notice_weeks >= 0),
  late_pickup_per_minute integer not null check (late_pickup_per_minute >= 0),
  sibling_discount_percent integer not null
    check (sibling_discount_percent between 0 and 100),

  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint tuition_fees_one_row_per_org unique (org_id)
);

alter table public.tuition_fees enable row level security;

create trigger tuition_fees_set_updated_at
  before update on public.tuition_fees
  for each row execute function public.set_updated_at();

create policy "published tuition fees are readable by anyone"
  on public.tuition_fees for select to anon
  using (status = 'published');

create policy "tuition fees are managed by their own organization"
  on public.tuition_fees for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

-- ---------------------------------------------------------------------------------------
-- Privileges
-- ---------------------------------------------------------------------------------------
--
-- Row-level security decides which rows; these decide which verbs. Supabase grants the
-- anonymous role write privileges on new tables in public by default, which RLS then
-- refuses for want of a matching policy. Revoking them as well means a future policy added
-- without thinking cannot quietly turn a public key into a write credential — two
-- independent things would have to go wrong instead of one.

revoke all on public.orgs from anon;
revoke all on public.site_settings from anon;
revoke all on public.programs from anon;
revoke all on public.daily_rhythm from anon;
revoke all on public.staff from anon;
revoke all on public.tuition_schedules from anon;
revoke all on public.tuition_rates from anon;
revoke all on public.tuition_fees from anon;

grant select on public.orgs to anon;
grant select on public.site_settings to anon;
grant select on public.programs to anon;
grant select on public.daily_rhythm to anon;
grant select on public.staff to anon;
grant select on public.tuition_schedules to anon;
grant select on public.tuition_rates to anon;
grant select on public.tuition_fees to anon;

-- ---------------------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------------------
--
-- Every read the site makes is "the published rows for this organization". The unique
-- constraints above already cover org_id for most tables; these fill the gaps so no query
-- added later falls back to a sequential scan on a foreign key.

create index tuition_rates_org_id_idx on public.tuition_rates (org_id);
create index tuition_rates_program_id_idx on public.tuition_rates (program_id);
create index programs_org_sort_idx on public.programs (org_id, sort_order);
create index daily_rhythm_org_sort_idx on public.daily_rhythm (org_id, sort_order);
create index staff_org_sort_idx on public.staff (org_id, sort_order);
create index tuition_schedules_org_sort_idx on public.tuition_schedules (org_id, sort_order);
