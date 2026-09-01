-- Move the two locale-dependent programs columns into public.prose — issue #123.
--
-- ---------------------------------------------------------------------------------------
-- WHICH TWO, AND WHY NOT THE THIRD
-- ---------------------------------------------------------------------------------------
--
-- `programs` holds three text columns per band, and #110's test tells them apart in one
-- question: *would this string be identical in German?*
--
--     age_label   '6 weeks – 15 months'   NO  — an English sentence
--     group_size  '8 children'            NO  — an English sentence
--     ratio       '1:4'                   YES — the same in every language
--
-- So `ratio` stays exactly where it is. Splitting a table's columns on that question is the
-- point of this migration rather than a compromise inside it: `programs` comes out holding
-- locale-neutral facts only, which is what #110 left `site_settings` holding.
--
-- The consequence being fixed is visible on the live site today. `/de/programs` and `/de`
-- render "15 months – 3 years" and "10 children" inside otherwise German room cards, and
-- `tests/e2e/german.spec.ts` names this issue where it excludes those two strings from its
-- English-leak assertion. That exclusion is deleted in the same pull request as this file.
--
-- ---------------------------------------------------------------------------------------
-- WHY THE `Programs` NAMESPACE AND NOT `ProgramsPage`
-- ---------------------------------------------------------------------------------------
--
-- #123 proposes `ProgramsPage`, beside the `<key>Detail` and `<key>Staffing` rows that already
-- exist per band. This migration uses `Programs` instead, and the reason is what the copy
-- editor would otherwise tell a staff member.
--
-- These strings are not programs-page copy. They render on THREE pages — the home page's room
-- cards, `/programs`, and the comparison table on `/about`. `lib/admin/prose-groups.ts` files
-- the `ProgramsPage` namespace under "Programs page", described as what each room is like
-- "beyond the ratios and group sizes"; a staff member who edited a group size there would be
-- told they were changing one page while in fact changing three.
--
-- The `Programs` namespace is already the per-room, every-page group — "What the three rooms
-- are called, everywhere they appear". An age range and a group size are per-room attributes
-- that appear everywhere the room does, which is the same shape as the room's name.
--
-- It also costs nothing at the call sites: all three pages ALREADY read this namespace as
-- `tBands`, because they all render the room's name. `ProgramsPage` would have meant teaching
-- the home page and the about page to read a namespace named after a page they are not.
--
-- The one thing it does cost is in `tests/content/message-keys.test.ts`, which asserted that
-- `Programs` holds exactly one key per band. That assertion is generalised rather than
-- dropped — it now expects the same suffix set the forward join uses, so it still catches copy
-- left behind by a removed band, and additionally catches a band whose ages or group size were
-- never written.
--
-- ---------------------------------------------------------------------------------------
-- ENGLISH IS COPIED; GERMAN IS AUTHORED. THAT ASYMMETRY IS DELIBERATE
-- ---------------------------------------------------------------------------------------
--
-- The `en` statements below read from `programs` rather than hard-coding the six English
-- strings, for the reason #110 gives: if a staff member has already corrected an age range,
-- that correction moves with it. Retyping the seed values here would silently revert their
-- edit and leave them no way to find out why.
--
-- German cannot work that way — there is no German source column to copy from, because not
-- having one is the entire bug. So the `de` values are written out. If someone HAD edited an
-- English age range before this ran, its German twin would be a translation of the seed value
-- rather than of their edit. That is worth stating plainly rather than hiding: it is the same
-- position every other row in the `de` catalogue is in, and the copy editor is where it gets
-- corrected. Checked before writing this, and there were no pending program drafts and no
-- edited values in the hosted database, so on the one database that matters it is moot.
--
-- Drafts move too, in their own statement. A staff member with an unpublished edit to a group
-- size would otherwise lose it the moment the columns are dropped, and the loss would look
-- like the admin quietly discarding their work.
--
-- The `en` statements are scoped by nothing but the table's own contents, so they are correct
-- for every organization in it rather than only for the one the site renders. The `de`
-- statement is scoped to `willow-grove`, exactly like the German catalogue migration beside
-- it, because German is that organization's locale and no other org has a catalogue.
--
-- ---------------------------------------------------------------------------------------
-- publish_org_drafts IS NOT TOUCHED
-- ---------------------------------------------------------------------------------------
--
-- Since #94 it derives the columns it copies from `pg_attribute` rather than listing them, so
-- dropping two of them needs no edit there and cannot silently skip the table. Verified in
-- `20260828030312_publish_org_drafts_from_a_table_list.sql` rather than assumed. `prose` is
-- already in its table list, so the six new rows are publishable the day they exist.
--
-- ---------------------------------------------------------------------------------------
-- SAFE TO RUN TWICE
-- ---------------------------------------------------------------------------------------
--
-- Each insert targets a partial unique index by predicate — `on conflict (cols) where
-- predicate`. #93 is why that form is spelled out: `on conflict (cols)` alone cannot choose
-- between the table's two partial indexes and Postgres refuses to plan the statement at all.
--
-- The column drop is `if exists`, so a second run is a no-op rather than an error. Note that
-- on a fresh `supabase db reset` every statement here is a no-op by construction — the tables
-- are empty until `seed.sql` runs afterwards — which is true of every prose migration in this
-- directory and is why CI's seed job proves re-appliability rather than content.

-- ---------------------------------------------------------------------------------------
-- 1. Published values become published English prose.
-- ---------------------------------------------------------------------------------------
insert into public.prose (org_id, locale, namespace, key, value, status)
select p.org_id, 'en', 'Programs', p.key || v.suffix, v.value, 'published'
from public.programs p
cross join lateral (values
  ('Ages', p.age_label),
  ('GroupSize', p.group_size)
) as v (suffix, value)
where p.status = 'published'
on conflict (org_id, locale, namespace, key) where status = 'published'
do update set value = excluded.value;

-- ---------------------------------------------------------------------------------------
-- 2. Unpublished edits become draft English prose, so nobody's work is dropped.
-- ---------------------------------------------------------------------------------------
insert into public.prose (org_id, locale, namespace, key, value, status)
select p.org_id, 'en', 'Programs', p.key || v.suffix, v.value, 'draft'
from public.programs p
cross join lateral (values
  ('Ages', p.age_label),
  ('GroupSize', p.group_size)
) as v (suffix, value)
where p.status = 'draft'
on conflict (org_id, locale, namespace, key) where status = 'draft'
do update set value = excluded.value;

-- ---------------------------------------------------------------------------------------
-- 3. The German twins, without which /de keeps rendering English.
-- ---------------------------------------------------------------------------------------
--
-- En dashes (–), not hyphens, matching the English rows and the seed. Numerals and the ratio
-- format are untouched because they are not language. `tests/content/locale-parity.test.ts`
-- fails if any of these six is missing, which is that test doing its job.
insert into public.prose (org_id, locale, namespace, key, value, status)
select o.id, 'de', 'Programs', v.key, v.value, 'published'
from public.orgs o
cross join (values
  ('infantsAges',        '6 Wochen – 15 Monate'),
  ('infantsGroupSize',   '8 Kinder'),
  ('toddlersAges',       '15 Monate – 3 Jahre'),
  ('toddlersGroupSize',  '10 Kinder'),
  ('preschoolAges',      '3 – 5 Jahre'),
  ('preschoolGroupSize', '18 Kinder')
) as v (key, value)
where o.slug = 'willow-grove'
on conflict (org_id, locale, namespace, key) where status = 'published'
do update set value = excluded.value;

-- ---------------------------------------------------------------------------------------
-- 4. The columns go.
-- ---------------------------------------------------------------------------------------
--
-- Deliberately in the same migration as the copy above, not a follow-up, for the reason #110
-- records: two editable homes for one string with nothing keeping them in step means the stale
-- one goes on rendering wherever a reader was missed.
alter table public.programs
  drop column if exists age_label,
  drop column if exists group_size;

comment on table public.programs is
  'One row per age band, holding the band''s locale-neutral facts: its key, its ratio and its '
  'order on the page. Anything that is a SENTENCE rather than a fact belongs in public.prose, '
  'which has a locale and an editor -- see #123, which moved age_label and group_size there '
  'under the Programs namespace as <key>Ages and <key>GroupSize.';
