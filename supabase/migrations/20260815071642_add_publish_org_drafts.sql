-- Promote every pending draft in the caller's organization to published, atomically.
--
-- ---------------------------------------------------------------------------------------
-- WHY THIS IS A DATABASE FUNCTION AND NOT A LOOP IN THE APPLICATION
-- ---------------------------------------------------------------------------------------
--
-- Publishing is many writes across seven tables that must either all happen or none of them.
-- PostgREST gives no transaction across separate requests, so an application loop that failed
-- part way would leave the site half-published — some rooms showing new ratios and some the
-- old ones, with no error anywhere and no way to tell which. A function body is one
-- transaction; a failure rolls the whole publish back and the drafts stay drafts.
--
-- It is also the only place the promote algorithm exists, which matters because one of its two
-- cases fails silently. See below.
--
-- ---------------------------------------------------------------------------------------
-- SECURITY INVOKER, DELIBERATELY
-- ---------------------------------------------------------------------------------------
--
-- Unlike public.current_org_id(), this function is NOT `security definer`. It runs with the
-- caller's own privileges, so every row-level security policy applies exactly as it would to
-- the same statements issued directly: a member can publish its own organization's drafts and
-- is invisible to every other organization's. Making this `security definer` would hand any
-- authenticated caller the ability to publish anything, and the org filter below would become
-- the only thing standing between tenants — a filter, not a policy, and therefore one edit
-- away from being wrong.
--
-- `set search_path = ''` all the same: every reference is schema-qualified, so a caller cannot
-- shadow `public` with their own table and have this write there instead.
--
-- ---------------------------------------------------------------------------------------
-- THE TWO CASES, AND WHY THE SECOND ONE IS THE DANGEROUS ONE
-- ---------------------------------------------------------------------------------------
--
-- Recorded in docs/adr/0001-draft-and-published-twin-rows.md when the schema was designed:
--
--   1. The draft HAS a published twin — copy the draft's values onto the published row and
--      delete the draft. The published row KEEPS ITS ID, so every tuition_rates row already
--      pointing at it keeps pointing at it.
--
--   2. The draft has NO published twin (a room or a person added later) — flip that row's
--      status to 'published'. DO NOT insert a copy and delete the original: the row's id is
--      already referenced by any draft rate created against it, and tuition_rates cascades on
--      delete. A copy would take those rates with it, and the rate sheet would quietly lose
--      cells rather than raise anything.
--
-- Case 2 is written as an UPDATE for exactly that reason. If a future edit here ever reaches
-- for delete-and-reinsert, this comment is the reason not to.
--
-- ---------------------------------------------------------------------------------------
-- WHAT THIS FUNCTION DOES NOT DO
-- ---------------------------------------------------------------------------------------
--
-- It does not rebuild the site. Promoting rows changes what a *build* would render; the public
-- site is prerendered, so nothing a visitor sees moves until a deploy runs. Triggering that is
-- the application's job (see lib/admin/publish.ts) and is deliberately the second step: if the
-- deploy fails, the content is published in the database and the next build picks it up, which
-- is recoverable. The reverse order would risk a build that renders content that then fails to
-- promote.

create or replace function public.publish_org_drafts()
returns integer
language plpgsql
security invoker
set search_path = ''
as $$
declare
  caller_org uuid := public.current_org_id();
  promoted integer := 0;
  affected integer;
begin
  if caller_org is null then
    raise exception 'No organization for this session. An account with no profiles row can publish nothing.'
      using errcode = 'insufficient_privilege';
  end if;

  -- ---------------------------------------------------------------------------------
  -- site_settings — one row per organization, so the twin is found by org_id alone
  -- ---------------------------------------------------------------------------------
  update public.site_settings published
     set phone_display = draft.phone_display,
         phone_href = draft.phone_href,
         email_display = draft.email_display,
         email_href = draft.email_href,
         license_number = draft.license_number,
         years_operating_since = draft.years_operating_since,
         age_range = draft.age_range,
         infant_ratio = draft.infant_ratio,
         hours_short = draft.hours_short,
         address_line1 = draft.address_line1,
         address_line2 = draft.address_line2,
         neighborhood = draft.neighborhood
    from public.site_settings draft
   where published.org_id = caller_org
     and published.status = 'published'
     and draft.org_id = published.org_id
     and draft.status = 'draft';
  get diagnostics affected = row_count;
  promoted := promoted + affected;

  delete from public.site_settings draft
   where draft.org_id = caller_org
     and draft.status = 'draft'
     and exists (
       select 1 from public.site_settings published
        where published.org_id = draft.org_id
          and published.status = 'published'
     );

  -- Case 2: no twin. Flip in place, never replace.
  update public.site_settings
     set status = 'published'
   where org_id = caller_org and status = 'draft';
  get diagnostics affected = row_count;
  promoted := promoted + affected;

  -- ---------------------------------------------------------------------------------
  -- programs — keyed
  -- ---------------------------------------------------------------------------------
  update public.programs published
     set age_label = draft.age_label,
         ratio = draft.ratio,
         group_size = draft.group_size,
         sort_order = draft.sort_order
    from public.programs draft
   where published.org_id = caller_org
     and published.status = 'published'
     and draft.org_id = published.org_id
     and draft.key = published.key
     and draft.status = 'draft';
  get diagnostics affected = row_count;
  promoted := promoted + affected;

  delete from public.programs draft
   where draft.org_id = caller_org
     and draft.status = 'draft'
     and exists (
       select 1 from public.programs published
        where published.org_id = draft.org_id
          and published.key = draft.key
          and published.status = 'published'
     );

  update public.programs
     set status = 'published'
   where org_id = caller_org and status = 'draft';
  get diagnostics affected = row_count;
  promoted := promoted + affected;

  -- ---------------------------------------------------------------------------------
  -- daily_rhythm — keyed on label_key
  -- ---------------------------------------------------------------------------------
  update public.daily_rhythm published
     set "time" = draft."time",
         sort_order = draft.sort_order
    from public.daily_rhythm draft
   where published.org_id = caller_org
     and published.status = 'published'
     and draft.org_id = published.org_id
     and draft.label_key = published.label_key
     and draft.status = 'draft';
  get diagnostics affected = row_count;
  promoted := promoted + affected;

  delete from public.daily_rhythm draft
   where draft.org_id = caller_org
     and draft.status = 'draft'
     and exists (
       select 1 from public.daily_rhythm published
        where published.org_id = draft.org_id
          and published.label_key = draft.label_key
          and published.status = 'published'
     );

  update public.daily_rhythm
     set status = 'published'
   where org_id = caller_org and status = 'draft';
  get diagnostics affected = row_count;
  promoted := promoted + affected;

  -- ---------------------------------------------------------------------------------
  -- staff — keyed
  -- ---------------------------------------------------------------------------------
  update public.staff published
     set name = draft.name,
         since = draft.since,
         is_featured = draft.is_featured,
         sort_order = draft.sort_order
    from public.staff draft
   where published.org_id = caller_org
     and published.status = 'published'
     and draft.org_id = published.org_id
     and draft.key = published.key
     and draft.status = 'draft';
  get diagnostics affected = row_count;
  promoted := promoted + affected;

  delete from public.staff draft
   where draft.org_id = caller_org
     and draft.status = 'draft'
     and exists (
       select 1 from public.staff published
        where published.org_id = draft.org_id
          and published.key = draft.key
          and published.status = 'published'
     );

  update public.staff
     set status = 'published'
   where org_id = caller_org and status = 'draft';
  get diagnostics affected = row_count;
  promoted := promoted + affected;

  -- ---------------------------------------------------------------------------------
  -- tuition_schedules — keyed. Promoted BEFORE tuition_rates, so a newly published
  -- schedule exists by the time its rates are looked at.
  -- ---------------------------------------------------------------------------------
  update public.tuition_schedules published
     set sort_order = draft.sort_order
    from public.tuition_schedules draft
   where published.org_id = caller_org
     and published.status = 'published'
     and draft.org_id = published.org_id
     and draft.key = published.key
     and draft.status = 'draft';
  get diagnostics affected = row_count;
  promoted := promoted + affected;

  delete from public.tuition_schedules draft
   where draft.org_id = caller_org
     and draft.status = 'draft'
     and exists (
       select 1 from public.tuition_schedules published
        where published.org_id = draft.org_id
          and published.key = draft.key
          and published.status = 'published'
     );

  update public.tuition_schedules
     set status = 'published'
   where org_id = caller_org and status = 'draft';
  get diagnostics affected = row_count;
  promoted := promoted + affected;

  -- ---------------------------------------------------------------------------------
  -- tuition_rates — identified by the (schedule, program) pair it prices
  -- ---------------------------------------------------------------------------------
  update public.tuition_rates published
     set per_month = draft.per_month
    from public.tuition_rates draft
   where published.org_id = caller_org
     and published.status = 'published'
     and draft.schedule_id = published.schedule_id
     and draft.program_id = published.program_id
     and draft.status = 'draft';
  get diagnostics affected = row_count;
  promoted := promoted + affected;

  delete from public.tuition_rates draft
   where draft.org_id = caller_org
     and draft.status = 'draft'
     and exists (
       select 1 from public.tuition_rates published
        where published.schedule_id = draft.schedule_id
          and published.program_id = draft.program_id
          and published.status = 'published'
     );

  update public.tuition_rates
     set status = 'published'
   where org_id = caller_org and status = 'draft';
  get diagnostics affected = row_count;
  promoted := promoted + affected;

  -- ---------------------------------------------------------------------------------
  -- tuition_fees — one row per organization
  -- ---------------------------------------------------------------------------------
  update public.tuition_fees published
     set registration = draft.registration,
         deposit_weeks = draft.deposit_weeks,
         notice_weeks = draft.notice_weeks,
         late_pickup_per_minute = draft.late_pickup_per_minute,
         sibling_discount_percent = draft.sibling_discount_percent
    from public.tuition_fees draft
   where published.org_id = caller_org
     and published.status = 'published'
     and draft.org_id = published.org_id
     and draft.status = 'draft';
  get diagnostics affected = row_count;
  promoted := promoted + affected;

  delete from public.tuition_fees draft
   where draft.org_id = caller_org
     and draft.status = 'draft'
     and exists (
       select 1 from public.tuition_fees published
        where published.org_id = draft.org_id
          and published.status = 'published'
     );

  update public.tuition_fees
     set status = 'published'
   where org_id = caller_org and status = 'draft';
  get diagnostics affected = row_count;
  promoted := promoted + affected;

  return promoted;
end;
$$;

comment on function public.publish_org_drafts() is
  'Promotes every draft in the caller''s organization to published, in one transaction. '
  'security invoker, so row-level security decides what the caller may touch. Does not '
  'rebuild the site — see lib/admin/publish.ts.';

-- anon must not have this. The grant is role-scoped rather than relying on the policies
-- inside, so an unauthenticated caller is refused at the door with 42501.
revoke all on function public.publish_org_drafts() from public, anon;
grant execute on function public.publish_org_drafts() to authenticated;
