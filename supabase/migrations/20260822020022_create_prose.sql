-- Editable prose: one row per translated string, so staff can fix a sentence and not only a
-- phone number.
--
-- ---------------------------------------------------------------------------------------
-- WHY THIS MIGRATION EXISTS
-- ---------------------------------------------------------------------------------------
--
-- v0.3.0 made every FACT editable and not one SENTENCE. The initial schema said so in its
-- own header — "prose stays in messages/*.json, which is why there is no faq or about
-- table" — and the consequence is that `/faq` and `/about`, which are almost entirely
-- copy, gained nothing at all from having a database. A staff member can today correct a
-- ratio but not a typo.
--
-- This table closes that gap for all 282 strings.
--
-- ---------------------------------------------------------------------------------------
-- THE SHAPE, AND THE TWO IT IS NOT
-- ---------------------------------------------------------------------------------------
--
-- One row per (locale, namespace, key). The two rejected alternatives, both of which look
-- tidier and both of which break something this project already relies on:
--
--   * A JSONB column keyed by locale — one row per string, values {"en": ..., "de": ...}.
--     Fewer rows, and it breaks PUBLISHING. Draft and published are per row, so the whole
--     multi-locale blob promotes as a unit: you could not ship an English typo fix without
--     also publishing a half-finished German translation sitting in the same value. The
--     draft/published twin from the previous migration is what makes that a real loss
--     rather than a theoretical one.
--
--   * A separate translations table joined to a key table. Correct, and it buys nothing
--     here — the key table would carry no column the join key does not already carry, so
--     it is a second table and a second RLS policy to maintain in exchange for nothing.
--
-- One row per (locale, namespace, key) also degenerates gracefully. With one shipped
-- locale it is exactly one row per string, which is what a locale-less table would have
-- been. The locale column costs nothing today and is the thing that would be expensive to
-- retrofit later, once the rows hold copy.
--
-- ---------------------------------------------------------------------------------------
-- WHY namespace AND key ARE SEPARATE COLUMNS
-- ---------------------------------------------------------------------------------------
--
-- The catalogue is exactly two levels deep — `FaqPage.q1Answer`, never deeper, checked
-- against all 282 leaves. Storing "FaqPage.q1Answer" in one column would work and would
-- make the editor in #77 parse a string to group a page's copy together. Two columns let
-- it `order by namespace, key` and be done.
--
-- ---------------------------------------------------------------------------------------
-- WHAT THIS TABLE DOES NOT HOLD
-- ---------------------------------------------------------------------------------------
--
-- UI chrome. Three strings — the primary-nav aria-label and the open/close menu labels —
-- describe the interface rather than the center, and no staff member editing the center's
-- copy wants to rename "Open menu". They stay in messages/*.json. The pull request states
-- that boundary in prose, because the next person adding a string has to decide which side
-- it falls on.

-- ---------------------------------------------------------------------------------------
-- prose
-- ---------------------------------------------------------------------------------------

create table public.prose (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,

  -- The locale this string is written in. Matched against `routing.locales` by the read
  -- path, not by a constraint here: the database has no business knowing which locales the
  -- site currently ships, and a row for a locale that is not routed yet is a translation in
  -- progress rather than an error.
  locale text not null,

  -- The two levels of the message catalogue. Together with locale they identify a string.
  namespace text not null,
  key text not null,

  value text not null,

  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- An empty string renders exactly as blank as a missing row, so it is rejected here
  -- rather than discovered on a Deploy Preview as a heading that is not there. The same
  -- reasoning the key-coverage test already applies to the catalogues.
  constraint prose_value_not_blank check (btrim(value) <> ''),
  constraint prose_locale_not_blank check (btrim(locale) <> ''),
  constraint prose_namespace_not_blank check (btrim(namespace) <> ''),
  constraint prose_key_not_blank check (btrim(key) <> '')
);

alter table public.prose enable row level security;

create trigger prose_set_updated_at
  before update on public.prose
  for each row execute function public.set_updated_at();

-- At most one published row and at most one draft per string, as two partial unique
-- indexes rather than one constraint over `status`. Same reasoning as the twin migration:
-- the invariant worth enforcing is "at most one PUBLISHED row", which survives a third
-- status being added, where unique (org_id, locale, namespace, key, status) would silently
-- start permitting one row of each new status.
create unique index prose_one_published_per_key
  on public.prose (org_id, locale, namespace, key)
  where status = 'published';

create unique index prose_one_draft_per_key
  on public.prose (org_id, locale, namespace, key)
  where status = 'draft';

-- The read path fetches every published string for one organization and one locale in a
-- single query, once per build. This is the index for that query; without it the whole
-- table is scanned, which is survivable at 282 rows and is not the shape to leave behind.
create index prose_published_by_locale
  on public.prose (org_id, locale)
  where status = 'published';

create policy "published prose is readable by anyone"
  on public.prose for select to anon
  using (status = 'published');

create policy "prose is managed by its own organization"
  on public.prose for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

comment on table public.prose is
  'Editable copy, one row per (locale, namespace, key). Facts live in the other content tables; UI chrome stays in messages/*.json.';
