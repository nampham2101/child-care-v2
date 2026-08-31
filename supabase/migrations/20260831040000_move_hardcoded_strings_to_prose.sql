-- Five strings that were written into components rather than into the catalogue — issue #53.
--
-- ---------------------------------------------------------------------------------------
-- HOW THESE WERE FOUND, AND WHY THEY ARE IN THIS TICKET
-- ---------------------------------------------------------------------------------------
--
-- The German catalogue landed complete: 282 rows, key-for-key with English, every placeholder
-- preserved. The German home page still rendered four English fragments, because these strings
-- were never in `prose` for either locale — they were literals in TSX:
--
--     components/site/CallButton.tsx     'Call'            in the sticky header, every page
--     app/[locale]/page.tsx              '{n} years'       the "caring for families" stat
--     app/[locale]/page.tsx              '7am–6pm'         the "open weekdays" stat
--     app/[locale]/layout.tsx            title + description   the home page's metadata
--
-- While English was the only locale, a literal and a row were indistinguishable on the page.
-- They are not the same thing at all: a literal cannot be translated and cannot be edited by
-- staff, and neither limitation announced itself until a second locale existed. #53's bar is
-- "every page renders in German with no English string visible", so these block it rather than
-- sitting beside it, and #53's metadata clause names the last one directly.
--
-- **This is the general lesson, worth more than the four fixes:** English-only is a state in
-- which the difference between copy and a literal is invisible. Adding a locale is what
-- develops the photograph.
--
-- ---------------------------------------------------------------------------------------
-- BOTH LOCALES IN ONE STATEMENT, DELIBERATELY
-- ---------------------------------------------------------------------------------------
--
-- A new key must exist in every routed locale or `tests/content/locale-parity.test.ts` fails —
-- which is the check doing its job, not an obstacle. Inserting `en` in one migration and `de`
-- in another would leave the tree red in between and would mean the English row could ship
-- alone, which is the precise failure the parity test exists to prevent.
--
-- ---------------------------------------------------------------------------------------
-- WHERE THEY LANDED, AND WHY NO NEW NAMESPACE
-- ---------------------------------------------------------------------------------------
--
--   * `Visit.call` — the call button is half of the conversion pair with `HomePage.planVisit`,
--     and `Visit` is already the group a staff member opens to edit "planning a visit".
--   * `HomePage.yearsValue` — mirrors `StaffPage.yearsValue`, which already existed for the
--     same reason on the staff page. Same shape, same placeholder name.
--   * `Center.hoursCompact` — the short form beside `Center.hoursShort`. Both are the opening
--     hours as a SENTENCE rather than as a fact, which is exactly #110's test for this
--     namespace: '7am–6pm' is not the string a German page should show.
--   * `HomePage.metaTitle` / `HomePage.metaDescription` — every other page keeps its metadata
--     in its own namespace under these two key names. The home page was the exception only
--     because it inherited the root layout's static English.
--
-- No namespace is added. `lib/admin/prose-groups.ts` requires every namespace to have a group
-- and `assertGroupsCoverAll` fails loudly on a stray, so a new one would be a fifth change
-- inside a ticket that is already carrying four.
--
-- Safe to run twice, on the same partial index and for the same reason as the catalogue
-- migration beside it.

insert into public.prose (org_id, locale, namespace, key, value, status)
select o.id, v.locale, v.namespace, v.key, v.value, 'published'
from public.orgs o
cross join (values
  ('en', 'Visit', 'call', 'Call'),
  ('de', 'Visit', 'call', 'Anrufen'),

  ('en', 'HomePage', 'yearsValue', '{years} years'),
  ('de', 'HomePage', 'yearsValue', '{years} Jahre'),

  ('en', 'Center', 'hoursCompact', '7am–6pm'),
  ('de', 'Center', 'hoursCompact', '7–18 Uhr'),

  ('en', 'HomePage', 'metaTitle', 'Willow Grove Children''s Center · Licensed child care in NW Portland'),
  ('de', 'HomePage', 'metaTitle', 'Willow Grove Children''s Center · Lizenzierte Kinderbetreuung in NW Portland'),

  ('en', 'HomePage', 'metaDescription', 'A small, licensed child care center in Northwest Portland for ages 6 weeks to 5 years, where the same caregivers know your child by name. Call to plan a visit.'),
  ('de', 'HomePage', 'metaDescription', 'Eine kleine, lizenzierte Kindertagesstätte in Northwest Portland für Kinder von 6 Wochen bis 5 Jahren, in der dieselben Bezugspersonen Ihr Kind beim Namen kennen. Rufen Sie an und planen Sie einen Besuch.')
) as v (locale, namespace, key, value)
where o.slug = 'willow-grove'
on conflict (org_id, locale, namespace, key) where status = 'published'
do update set value = excluded.value;
