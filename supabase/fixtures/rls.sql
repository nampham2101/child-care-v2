-- Fixtures for the row-level security suite in tests/rls/. Not seed data, not schema.
--
-- These rows exist so the suite has something that *should* be refused. Row-level security
-- is a database behaviour: a mocked client would only ever prove the mock was written to
-- agree with the assertions, so the suite runs against the real project and needs real rows
-- to be denied.
--
-- Applied the same way as supabase/seed.sql — pasted into the dashboard SQL editor. Safe to
-- re-run; every statement upserts on (org_id, key).
--
-- ---------------------------------------------------------------------------------------
-- WHY A SECOND ORGANIZATION, GIVEN ANON IS NOT SCOPED BY ORGANIZATION
-- ---------------------------------------------------------------------------------------
--
-- docs/PLAN.md settles this under "What anon is, and is not, isolated from": the anonymous
-- policy is `status = 'published'` and nothing else. A second organization's *published*
-- rows are readable with the anonymous key, deliberately, because that key ships in the
-- client bundle and any organization scope it carried would be caller-forgeable — isolation
-- that looks real and is not. Drafts are the private thing, and drafts are protected.
--
-- So this fixture organization is not here to prove cross-tenant isolation that does not
-- exist. It is here for two things that do:
--
--   1. A draft row stays invisible no matter which organization owns it.
--   2. The published twin below is a LEAK TRIPWIRE. It is a published row that the site must
--      never render, so any query that forgets to filter by org_id starts returning an
--      obviously fake program band instead of failing silently. That guarantee is the read
--      path's to keep (issue #50); this row is what makes breaking it visible.
--
-- The two program rows differ in exactly one column: status. That is what lets the suite
-- show its draft assertion fails for the right reason — the same shape of row, published, is
-- returned by the same query.
--
-- ---------------------------------------------------------------------------------------
-- IF A TABLE EVER HOLDS SOMETHING THAT IS NOT PUBLIC MARKETING COPY
-- ---------------------------------------------------------------------------------------
--
-- Enrolment records, incident notes, anything about an actual child — the reasoning above
-- expires completely, and docs/PLAN.md says so. Such a table must not be readable by anon
-- under any status. Do not extend this fixture to cover one; raise it instead.

insert into public.orgs (slug, name)
values ('rls-fixture', 'RLS Fixture Org — not a real center, never rendered')
on conflict (slug) do update
  set name = excluded.name;

-- Deliberately absurd values. If either of these ever reaches a page, it should be
-- unmistakable at a glance rather than looking like a plausible fourth room.
insert into public.programs (org_id, key, age_label, ratio, group_size, sort_order, status)
select o.id, v.key, v.age_label, v.ratio, v.group_size, v.sort_order,
       v.status::public.content_status
from public.orgs o
cross join (values
  ('rlsFixtureDraft',     'FIXTURE draft — must never be visible',   '9:9', '0 children', 901, 'draft'),
  ('rlsFixturePublished', 'FIXTURE published — other org, not ours', '9:9', '0 children', 902, 'published')
) as v(key, age_label, ratio, group_size, sort_order, status)
where o.slug = 'rls-fixture'
on conflict (org_id, key) do update set
  age_label = excluded.age_label,
  ratio = excluded.ratio,
  group_size = excluded.group_size,
  sort_order = excluded.sort_order,
  status = excluded.status;
