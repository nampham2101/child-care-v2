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

-- ---------------------------------------------------------------------------------------
-- THE TEST ACCOUNT (added by #72)
-- ---------------------------------------------------------------------------------------
--
-- tests/rls/authenticated.test.ts signs in for real, because current_org_id() reads the
-- session and a session is not something a fixture row can fake.
--
-- The account is NOT created here. Creating an auth user from SQL means hand-writing a
-- password hash into a file in a public repository, which is exactly the shape of mistake
-- this project avoids elsewhere. It is created once, by hand, in the Supabase dashboard
-- under Authentication → Users → Add user, with "Auto Confirm User" ticked:
--
--     email:    rls-fixture@example.com
--     password: generated, stored as the GitHub secret SUPABASE_TEST_PASSWORD
--               and in .env.local for local runs — never committed, never pasted anywhere
--
-- The address is deliberately in this file rather than in an environment variable: the
-- statement below joins on it, and a fixture that silently matched nothing would leave the
-- suite testing an account that does not exist. The guard makes that a loud failure instead.
--
-- WHY THIS ACCOUNT BELONGS TO THE FIXTURE ORGANIZATION AND NOT TO WILLOW GROVE
--
-- It is the only member account with a password anyone holds, and a member can write every
-- content row its organization owns. Put it in willow-grove and the GitHub secret becomes a
-- credential that can rewrite the live site's tuition table. Here, the worst a leak buys is
-- the ability to edit two rows whose text reads "FIXTURE — must never be visible".
--
-- The guarantee is still proved in both directions: the suite asserts this account writes
-- its own organization's rows AND is refused on Willow Grove's. A second account inside
-- willow-grove would only re-prove the same policy from the other side, at the price of that
-- credential existing.

insert into public.orgs (slug, name)
values ('rls-fixture', 'RLS Fixture Org — not a real center, never rendered')
on conflict (slug) do update
  set name = excluded.name;

do $$
begin
  if not exists (select 1 from auth.users where email = 'rls-fixture@example.com') then
    raise exception
      'The test account rls-fixture@example.com does not exist. Create it in the dashboard '
      'under Authentication → Users → Add user with Auto Confirm ticked, then re-run this '
      'file. Without it the profile row below would insert nothing and the authenticated '
      'suite would fail at sign-in with a message about credentials rather than about setup.';
  end if;
end
$$;

-- The profile row is what makes current_org_id() return anything for that session. Written
-- here rather than by the application because profiles has no INSERT policy at all — see
-- the migration that created it — so it is reachable only by the service role, which is what
-- the dashboard SQL editor runs as.
insert into public.profiles (id, org_id, role, display_name)
select u.id, o.id, 'editor', 'RLS Fixture Test Account'
from auth.users u
cross join public.orgs o
where u.email = 'rls-fixture@example.com'
  and o.slug = 'rls-fixture'
on conflict (id) do update set
  org_id = excluded.org_id,
  role = excluded.role,
  display_name = excluded.display_name;

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

-- ---------------------------------------------------------------------------------------
-- Prose for the fixture organization (#77)
-- ---------------------------------------------------------------------------------------
--
-- The editor suite signs in as this account, so without these rows /admin/copy has nothing to
-- show it and every group 404s. Two rows, both published, chosen for what they let a test prove:
--
--   * The `Programs` row is what makes a LABEL resolve. #76 emptied messages/en.json and
--     lib/admin/labels.ts kept reading it, so every heading in the facts editor silently fell
--     back to its raw database key — "infants" instead of "Infants". Nothing caught it, because
--     the end-to-end suite asserted on fields and never on headings. With this row present,
--     /admin/programs must render this text rather than `rlsFixturePublished`.
--
--   * The `FaqPage` row carries `{count}` on purpose. It is what the placeholder guard is
--     tested against: next-intl throws on a message whose placeholder is missing, and since #76
--     that throw fails the build — so a staff member deleting a brace has to be refused at save
--     time, not discovered in a broken deploy.
--
-- Both are `published` and there is deliberately no draft twin here, unlike the programs above.
-- A permanently-draft prose row would be promoted by the publish test and then contradict
-- whichever suite expected it to still be a draft — the exact cross-suite breakage the restore
-- helper in tests/e2e/admin-editor.spec.ts exists to undo. Drafts here are created by the test
-- that needs one and removed by that same test.
--
-- Values are absurd for the same reason the programs are: if either ever reaches a public page,
-- it should be unmistakable rather than looking like plausible copy.
insert into public.prose (org_id, locale, namespace, key, value, status)
select o.id, 'en', v.namespace, v.key, v.value, 'published'
from public.orgs o
cross join (values
  ('Programs', 'rlsFixturePublished', 'FIXTURE room name — other org, not ours'),
  ('FaqPage',  'rlsFixtureAnswer',    'FIXTURE answer holding {count} — must never be visible')
) as v(namespace, key, value)
where o.slug = 'rls-fixture'
on conflict (org_id, locale, namespace, key) where status = 'published'
do update set value = excluded.value;
