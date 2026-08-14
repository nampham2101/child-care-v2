-- Let a draft row sit alongside its published twin, so content can be edited without the
-- edit reaching the public site.
--
-- ---------------------------------------------------------------------------------------
-- WHY THIS MIGRATION EXISTS
-- ---------------------------------------------------------------------------------------
--
-- The initial schema gave every content table one row per thing — unique (org_id) for the
-- single-row tables, unique (org_id, key) for the keyed ones — and a single `status` column
-- on that row. That is a correct shape for a seeded, read-only site and it makes the editor
-- in #74 impossible to build: there is nowhere to put an edit that is not yet live.
--
-- Both ways out of it without this migration are wrong:
--
--   * Overwrite the published row. That is editing the live site, which #74 forbids and
--     which no reviewer could safely approve.
--   * Flip the row to 'draft'. The row then disappears from the anonymous read, and
--     lib/content.ts raises on a missing published row — so editing the phone number would
--     FAIL THE NEXT BUILD, with an error pointing at seed data rather than at the edit.
--
-- A third answer is tempting and also wrong: the public site is prerendered, so an edit to a
-- published row does not reach a visitor until a rebuild. True, and it fails on a case this
-- project will hit — merging a code change and publishing a release would ship whatever
-- half-finished content edits happened to be sitting in the database. Releases are the one
-- thing with two human gates on them; content must not route around both.
--
-- ---------------------------------------------------------------------------------------
-- WHAT CHANGES, AND WHAT DELIBERATELY DOES NOT
-- ---------------------------------------------------------------------------------------
--
-- Each unique constraint becomes TWO partial unique indexes over the same columns, one
-- scoped to published rows and one to drafts. So a key may have at most one published row
-- and at most one draft, and the two coexist.
--
-- Partial indexes rather than folding `status` into the constraint — unique (org_id, key,
-- status) would be equivalent today and says something weaker. The invariant worth keeping
-- is "at most one PUBLISHED row per key", which stays true and stays enforced if a third
-- status is ever added; the composite would instead silently start permitting one row of
-- each new status.
--
-- NOT CHANGED, on purpose:
--
--   * No policy is touched. The anonymous policy is already `status = 'published'`, so
--     drafts are invisible to a visitor for the same reason they always were, and
--     tests/rls/anon.test.ts already proves it. The authenticated policy is already
--     `org_id = current_org_id()` for all commands, so a member can write its own drafts.
--   * No column is added. A draft is linked to its published twin by the same key the
--     unique index is built on, not by a pointer that could disagree with it.
--   * The public read path is untouched. lib/*.ts keeps issuing exactly the queries it
--     issues today.
--
-- ---------------------------------------------------------------------------------------
-- THE PROMOTE ALGORITHM #75 INHERITS
-- ---------------------------------------------------------------------------------------
--
-- Publishing is the next ticket, but the shape is decided here because the schema is what
-- constrains it. Two cases, and the difference matters:
--
--   1. The draft HAS a published twin — copy the draft's values onto the published row and
--      delete the draft. The published row keeps its id, so every tuition_rates row already
--      pointing at it keeps pointing at it.
--   2. The draft has NO published twin (a newly added program, a new staff member) — flip
--      that row's status to 'published'. Do NOT insert a copy: the row's id is already
--      referenced by any draft rate created against it, and a copy would strand them.
--
-- Getting case 2 wrong is silent. tuition_rates cascades on delete, so replacing a row
-- instead of promoting it would take the rates with it and the rate sheet would lose cells
-- rather than raise anything.

-- ---------------------------------------------------------------------------------------
-- site_settings — one row per organization
-- ---------------------------------------------------------------------------------------

alter table public.site_settings
  drop constraint site_settings_one_row_per_org;

create unique index site_settings_one_published_per_org
  on public.site_settings (org_id)
  where status = 'published';

create unique index site_settings_one_draft_per_org
  on public.site_settings (org_id)
  where status = 'draft';

-- ---------------------------------------------------------------------------------------
-- tuition_fees — one row per organization
-- ---------------------------------------------------------------------------------------

alter table public.tuition_fees
  drop constraint tuition_fees_one_row_per_org;

create unique index tuition_fees_one_published_per_org
  on public.tuition_fees (org_id)
  where status = 'published';

create unique index tuition_fees_one_draft_per_org
  on public.tuition_fees (org_id)
  where status = 'draft';

-- ---------------------------------------------------------------------------------------
-- programs — keyed per organization
-- ---------------------------------------------------------------------------------------

alter table public.programs
  drop constraint programs_key_unique_per_org;

create unique index programs_one_published_per_key
  on public.programs (org_id, key)
  where status = 'published';

create unique index programs_one_draft_per_key
  on public.programs (org_id, key)
  where status = 'draft';

-- ---------------------------------------------------------------------------------------
-- staff — keyed per organization
-- ---------------------------------------------------------------------------------------

alter table public.staff
  drop constraint staff_key_unique_per_org;

create unique index staff_one_published_per_key
  on public.staff (org_id, key)
  where status = 'published';

create unique index staff_one_draft_per_key
  on public.staff (org_id, key)
  where status = 'draft';

-- ---------------------------------------------------------------------------------------
-- daily_rhythm — keyed per organization on label_key
-- ---------------------------------------------------------------------------------------

alter table public.daily_rhythm
  drop constraint daily_rhythm_label_unique_per_org;

create unique index daily_rhythm_one_published_per_key
  on public.daily_rhythm (org_id, label_key)
  where status = 'published';

create unique index daily_rhythm_one_draft_per_key
  on public.daily_rhythm (org_id, label_key)
  where status = 'draft';

-- ---------------------------------------------------------------------------------------
-- tuition_schedules — keyed per organization
-- ---------------------------------------------------------------------------------------

alter table public.tuition_schedules
  drop constraint tuition_schedules_key_unique_per_org;

create unique index tuition_schedules_one_published_per_key
  on public.tuition_schedules (org_id, key)
  where status = 'published';

create unique index tuition_schedules_one_draft_per_key
  on public.tuition_schedules (org_id, key)
  where status = 'draft';

-- ---------------------------------------------------------------------------------------
-- tuition_rates — one cell per (schedule, program) pair
-- ---------------------------------------------------------------------------------------
--
-- The pair still identifies the cell; status decides whether it is the live cell or the
-- pending one. Both point at the SAME schedule and program rows — a draft rate does not get
-- its own copy of the program it prices, which is what keeps the rate sheet unambiguous
-- while an edit is in flight.

alter table public.tuition_rates
  drop constraint tuition_rates_one_per_pair;

create unique index tuition_rates_one_published_per_pair
  on public.tuition_rates (schedule_id, program_id)
  where status = 'published';

create unique index tuition_rates_one_draft_per_pair
  on public.tuition_rates (schedule_id, program_id)
  where status = 'draft';
