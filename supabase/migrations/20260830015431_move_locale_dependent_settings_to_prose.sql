-- Move the three locale-dependent site_settings fields into public.prose — issue #110.
--
-- ---------------------------------------------------------------------------------------
-- WHICH THREE, AND WHY THESE AND NOT THE OTHERS
-- ---------------------------------------------------------------------------------------
--
-- `site_settings` was built without a locale dimension, and for most of what it holds that is
-- still exactly right. A phone number, an email address, a licence number, a street address, a
-- year, an infant ratio written "1:4" — those are the same string in every language, and giving
-- them a locale would mean maintaining three identical copies of a phone number and eventually
-- letting two of them drift.
--
-- These three are not facts. They are English sentences that happen to be stored as if they
-- were facts:
--
--     age_range     '6 weeks to 5 years'
--     hours_short   'Mon–Fri, 7:00 AM – 6:00 PM'
--     neighborhood  'Northwest Portland, one block from Wallace Park'
--
-- What makes them worse than a stray untranslated string somewhere in a corner is that they are
-- INTERPOLATED INTO OTHER PROSE at render time:
--
--     HomePage.heroEyebrow    'Licensed child care · Ages {ageRange}'
--     HomePage.heroBody       'A small, licensed center in {neighborhood}, where …'
--     HomePage.mapLabel       'Map of {neighborhood}'
--     ProgramsPage.eyebrow    'Ages {ageRange}'
--
-- So on a German page they would not sit quietly at the edge of the layout waiting to be
-- translated — they would appear mid-sentence, an English clause inside a German one. That
-- reads as a broken site rather than an untranslated one, which is the same argument #53 makes
-- about a missing key falling back to English.
--
-- ---------------------------------------------------------------------------------------
-- WHY prose AND NOT A LOCALE COLUMN ON site_settings
-- ---------------------------------------------------------------------------------------
--
-- Two alternatives were considered on #110 and are recorded here so this is not re-derived:
--
--   * **A locale column on site_settings.** Its publish identity is `array['org_id']` — one row
--     per organization, per docs/adr/0001. Adding a locale changes the shape of that key, which
--     means touching publish_org_drafts, the RLS policies, and every reader. Most invasive of
--     the three, to make one table hold two kinds of thing.
--   * **A separate site_settings_i18n table keyed (org_id, locale).** Clean and small, but it is
--     a SECOND locale mechanism standing beside `prose`, and it would have to be registered in
--     the publish_org_drafts table list with a correct position. A forgotten entry there does
--     not error — publishing simply skips the table, silently, which is the exact failure #94
--     rebuilt that function to make impossible.
--
-- `prose` already has everything these three need and costs nothing new: locale is already part
-- of its publish identity (`array['org_id', 'locale', 'namespace', 'key']`), draft-and-published
-- twins already work there, staff can already edit it at /admin/copy, and placeholder validation
-- already protects it. **publish_org_drafts is not touched by this migration** — `prose` is
-- already in its table list, and the columns it copies for `site_settings` are derived from
-- pg_attribute rather than written down, so dropping three of them needs no edit there. That is
-- #94 paying for itself.
--
-- ---------------------------------------------------------------------------------------
-- ONE PROSE ROW NOW FEEDS ANOTHER, AND THAT IS FINE
-- ---------------------------------------------------------------------------------------
--
-- After this, `HomePage.heroEyebrow` interpolates a value that is itself an editable prose row.
-- That is two reads, not a cycle: the page reads `Center.ageRange`, then passes it to
-- `heroEyebrow` as an ICU argument. ICU inserts an argument literally and does not re-parse it
-- as a message, so a value containing braces cannot be interpreted as further placeholders.
--
-- Placeholder validation is unaffected and was checked rather than assumed. `FieldReader.prose`
-- derives its `required` list from the value BEING REPLACED, server-side. `Center.ageRange` has
-- no placeholders, so editing it requires none; `HomePage.heroEyebrow` still contains
-- `{ageRange}`, so it still requires it. Neither row learns anything about the other.
--
-- ---------------------------------------------------------------------------------------
-- THE VALUES ARE COPIED, NOT RETYPED
-- ---------------------------------------------------------------------------------------
--
-- The inserts below read from site_settings rather than hard-coding the three English strings.
-- If a staff member has already edited the opening hours, that edit moves with them. Retyping
-- the seed values here would silently revert it, and the person would have no way to know why
-- their change disappeared.
--
-- Drafts move too, in a second statement. A staff member with an unpublished edit to the
-- neighbourhood would otherwise lose it the moment the column is dropped — the change would
-- look like the admin quietly discarding their work.
--
-- Both statements are scoped by nothing but the table's own contents, so this is correct for
-- every organization in the table rather than only for the one the site renders.
--
-- ---------------------------------------------------------------------------------------
-- SAFE TO RUN TWICE
-- ---------------------------------------------------------------------------------------
--
-- Each insert targets a partial unique index by name-in-effect — `prose_one_published_per_key`
-- and `prose_one_draft_per_key` — using the `on conflict (cols) where predicate` form. #93 is
-- why that form matters: `on conflict (cols)` alone cannot pick between two partial indexes and
-- Postgres refuses to plan the statement at all.
--
-- The column drop at the end is `if exists`, so a re-run is a no-op rather than an error.

-- ---------------------------------------------------------------------------------------
-- 1. Published values become published prose.
-- ---------------------------------------------------------------------------------------
insert into public.prose (org_id, locale, namespace, key, value, status)
select s.org_id, 'en', 'Center', v.key, v.value, 'published'
from public.site_settings s
cross join lateral (values
  ('ageRange', s.age_range),
  ('hoursShort', s.hours_short),
  ('neighborhood', s.neighborhood)
) as v (key, value)
where s.status = 'published'
on conflict (org_id, locale, namespace, key) where status = 'published'
do update set value = excluded.value;

-- ---------------------------------------------------------------------------------------
-- 2. Unpublished edits become draft prose, so nobody's work is dropped.
-- ---------------------------------------------------------------------------------------
insert into public.prose (org_id, locale, namespace, key, value, status)
select s.org_id, 'en', 'Center', v.key, v.value, 'draft'
from public.site_settings s
cross join lateral (values
  ('ageRange', s.age_range),
  ('hoursShort', s.hours_short),
  ('neighborhood', s.neighborhood)
) as v (key, value)
where s.status = 'draft'
on conflict (org_id, locale, namespace, key) where status = 'draft'
do update set value = excluded.value;

-- ---------------------------------------------------------------------------------------
-- 3. The columns go.
-- ---------------------------------------------------------------------------------------
--
-- Deliberately in the same migration as the copy above, not a follow-up. Leaving them in place
-- as dead columns would mean two editable homes for one string with nothing keeping them in
-- step — and the stale one would go on rendering wherever a reader was missed.
alter table public.site_settings
  drop column if exists age_range,
  drop column if exists hours_short,
  drop column if exists neighborhood;

comment on table public.site_settings is
  'The center''s locale-neutral facts: phone, email, licence, address, year, infant ratio. '
  'Anything that is a SENTENCE rather than a fact belongs in public.prose, which has a locale '
  'and an editor -- see #110, which moved age_range, hours_short and neighborhood there.';
