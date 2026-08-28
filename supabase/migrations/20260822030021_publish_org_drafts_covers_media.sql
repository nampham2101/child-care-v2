-- Teach publish_org_drafts about media.
--
-- Third time this function has been restated in full, and the reason is unchanged: Postgres
-- cannot add a statement to an existing function, so `create or replace` restates the body.
-- Everything above the media block is copied by script from
-- 20260822020112_publish_org_drafts_covers_prose.sql rather than retyped, because a
-- transcription slip in one of these UPDATE ... FROM statements would publish some tables and
-- silently skip another.
--
-- **Three repetitions is the tripwire.** Making this generic — a table list and a loop — was
-- deferred in #76 as out of scope for a prose ticket, and deferred again here for the same
-- reason. It is now filed rather than merely mentioned. Do not restate this function a fourth
-- time without doing that work first.
--
-- The media block is the keyed shape, identical to programs: copy the draft's columns onto the
-- published twin and delete the draft, or flip the draft in place when there is no twin. The
-- effect a staff member sees is the one that matters — **replacing a room's photograph does not
-- change the public site until Publish**, exactly like editing its ratio.

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

  -- ---------------------------------------------------------------------------------
  -- prose — identified by (locale, namespace, key); added by #76
  -- ---------------------------------------------------------------------------------
  update public.prose published
     set value = draft.value
    from public.prose draft
   where published.org_id = caller_org
     and published.status = 'published'
     and draft.org_id = published.org_id
     and draft.locale = published.locale
     and draft.namespace = published.namespace
     and draft.key = published.key
     and draft.status = 'draft';
  get diagnostics affected = row_count;
  promoted := promoted + affected;

  delete from public.prose draft
   where draft.org_id = caller_org
     and draft.status = 'draft'
     and exists (
       select 1 from public.prose published
        where published.org_id = draft.org_id
          and published.locale = draft.locale
          and published.namespace = draft.namespace
          and published.key = draft.key
          and published.status = 'published'
     );

  update public.prose
     set status = 'published'
   where org_id = caller_org and status = 'draft';
  get diagnostics affected = row_count;
  promoted := promoted + affected;

  -- ---------------------------------------------------------------------------------
  -- media — keyed, like programs; added by #78
  -- ---------------------------------------------------------------------------------
  update public.media published
     set storage_path = draft.storage_path,
         alt = draft.alt
    from public.media draft
   where published.org_id = caller_org
     and published.status = 'published'
     and draft.org_id = published.org_id
     and draft.key = published.key
     and draft.status = 'draft';
  get diagnostics affected = row_count;
  promoted := promoted + affected;

  delete from public.media draft
   where draft.org_id = caller_org
     and draft.status = 'draft'
     and exists (
       select 1 from public.media published
        where published.org_id = draft.org_id
          and published.key = draft.key
          and published.status = 'published'
     );

  update public.media
     set status = 'published'
   where org_id = caller_org and status = 'draft';
  get diagnostics affected = row_count;
  promoted := promoted + affected;

  return promoted;
end;
$$;

comment on function public.publish_org_drafts() is
  'Promotes every draft in the caller''s organization to published, in one transaction. '
  'security invoker, so row-level security decides what the caller may touch. Covers prose '
  '(#76) and media (#78). Does not rebuild the site -- see lib/admin/publish.ts.';

-- Restated because `create or replace` does not preserve them being revoked.
revoke all on function public.publish_org_drafts() from public, anon;
grant execute on function public.publish_org_drafts() to authenticated;
