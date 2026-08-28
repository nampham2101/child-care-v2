-- Make publish_org_drafts a loop over a table list, so adding a content table stops meaning
-- restating the whole function.
--
-- ---------------------------------------------------------------------------------------
-- WHY
-- ---------------------------------------------------------------------------------------
--
-- The function was ~280 lines of the same three statements written nine times, and it had been
-- restated in full three times — #75 wrote it, #76 added prose, #78 added media — because
-- Postgres cannot append a statement to an existing function body. #94 is the tripwire the
-- third restatement set, and this is it being honoured.
--
-- The cost was never the line count. It was that **forgetting this function fails silently**:
-- add a tenth content table, forget to touch it, and nothing errors. The drafts simply never
-- publish, and the staff member's report is "I pressed Publish and my change did not appear".
-- A list makes the omission a missing row in one obvious place rather than a missing block in
-- three hundred lines.
--
-- ---------------------------------------------------------------------------------------
-- WHAT IS DECLARED AND WHAT IS DERIVED
-- ---------------------------------------------------------------------------------------
--
-- Declared, because no catalogue knows it: which tables publish, in what order, and which
-- columns IDENTIFY a row — the columns that pair a draft with its published twin.
--
-- Derived, because the catalogue does know it: which columns to COPY. That is every column of
-- the table minus the ones the database owns (`id`, `created_at`, `updated_at`), minus
-- `status` (the thing being changed), minus `org_id` (never copied, and the tenancy anchor),
-- minus the identity columns (equal on both twins by definition).
--
-- Deriving is the point. The column lists were the only real variation between the nine
-- blocks, and they were also the only thing a transcription slip could get wrong in a way that
-- still ran. A slip published some tables and skipped another, reporting success.
--
-- **The derived lists were checked against the nine hand-written ones before this was written**
-- and are identical, table for table, column for column. That check is what makes this a
-- refactor rather than a rewrite.
--
-- READ FROM pg_catalog, NOT information_schema. `information_schema.columns` filters by the
-- caller's privileges, and this function is `security invoker`. A caller who could not see a
-- column there would get a silently short copy list — the exact failure mode this change
-- exists to remove. `pg_attribute` is readable by PUBLIC and filters nothing.
--
-- ---------------------------------------------------------------------------------------
-- WHAT DELIBERATELY DOES NOT CHANGE
-- ---------------------------------------------------------------------------------------
--
--   * **Still `security invoker`.** Row-level security decides what the caller may touch. A
--     `security definer` rewrite would hand every member the ability to publish any
--     organization's drafts, which is a tenancy hole, not a refactor.
--   * **Still `set search_path = ''`**, and every reference stays schema-qualified. The
--     dynamic statements below build `public.%I` explicitly for the same reason.
--   * **The two promote cases are unchanged**, and are still the ones in
--     docs/adr/0001-draft-and-published-twin-rows.md. Case 2 — a draft with no published twin
--     is FLIPPED IN PLACE, never replaced — is the one that fails silently: the row's id is
--     referenced by any draft tuition_rates row, and that foreign key cascades on delete, so
--     replacing instead of flipping empties cells out of the rate sheet with no error
--     anywhere. tests/rls/publish.test.ts asserts it.
--   * **The return value counts the same things**: rows copied onto a twin, plus rows flipped.
--   * **The order is unchanged**, and it matters in one place: tuition_schedules is promoted
--     before tuition_rates, so a newly published schedule exists by the time its rates are
--     looked at. The list is ordered explicitly rather than relying on VALUES order.

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
  spec record;
  copy_cols text[];
  set_clause text;
  twin_match text;
begin
  if caller_org is null then
    raise exception 'No organization for this session. An account with no profiles row can publish nothing.'
      using errcode = 'insufficient_privilege';
  end if;

  for spec in
    select t.table_name, t.identity_cols
    from (values
      -- table                identity columns                                  order
      ('site_settings',     array['org_id'],                                     1),
      ('programs',          array['org_id', 'key'],                              2),
      ('daily_rhythm',      array['org_id', 'label_key'],                        3),
      ('staff',             array['org_id', 'key'],                              4),
      -- Before tuition_rates. See the header.
      ('tuition_schedules', array['org_id', 'key'],                              5),
      -- Identified by the pair it prices, not by org_id — a rate has no key of its own.
      ('tuition_rates',     array['schedule_id', 'program_id'],                  6),
      ('tuition_fees',      array['org_id'],                                     7),
      ('prose',             array['org_id', 'locale', 'namespace', 'key'],       8),
      ('media',             array['org_id', 'key'],                              9)
    ) as t(table_name, identity_cols, position)
    order by t.position
  loop
    -- Every column worth copying: not owned by the database, not the status being changed,
    -- not org_id, and not an identity column (equal on both twins already).
    select array_agg(a.attname::text order by a.attnum)
      into copy_cols
      from pg_catalog.pg_attribute a
     where a.attrelid = ('public.' || quote_ident(spec.table_name))::regclass
       and a.attnum > 0
       and not a.attisdropped
       and a.attname <> all (array['id', 'org_id', 'created_at', 'updated_at', 'status'])
       and a.attname <> all (spec.identity_cols);

    -- A table with nothing to copy is a table listed by mistake, or one whose identity
    -- columns are wrong. Either way it must be loud: a silent skip here is the failure this
    -- whole change is meant to make impossible.
    if copy_cols is null or cardinality(copy_cols) = 0 then
      raise exception 'publish_org_drafts: no copyable columns for public.%. Check its entry in the table list above.',
        spec.table_name
        using errcode = 'raise_exception';
    end if;

    select string_agg(format('%1$I = draft.%1$I', col), ', ')
      into set_clause
      from unnest(copy_cols) as col;

    select string_agg(format('draft.%1$I = published.%1$I', col), ' and ')
      into twin_match
      from unnest(spec.identity_cols) as col;

    -- Case 1: the draft has a published twin. Copy the draft's values onto the published row,
    -- which keeps that row's id and therefore every foreign key pointing at it.
    execute format(
      'update public.%1$I published
          set %2$s
         from public.%1$I draft
        where published.org_id = $1
          and published.status = ''published''
          and %3$s
          and draft.status = ''draft''',
      spec.table_name, set_clause, twin_match)
      using caller_org;
    get diagnostics affected = row_count;
    promoted := promoted + affected;

    -- The draft has served its purpose; its values are on the published row now.
    execute format(
      'delete from public.%1$I draft
        where draft.org_id = $1
          and draft.status = ''draft''
          and exists (
            select 1 from public.%1$I published
             where published.status = ''published''
               and %2$s
          )',
      spec.table_name, twin_match)
      using caller_org;

    -- Case 2: whatever drafts remain have no twin. Flip in place, never replace.
    execute format(
      'update public.%1$I
          set status = ''published''
        where org_id = $1
          and status = ''draft''',
      spec.table_name)
      using caller_org;
    get diagnostics affected = row_count;
    promoted := promoted + affected;
  end loop;

  return promoted;
end;
$$;

comment on function public.publish_org_drafts() is
  'Promotes every draft in the caller''s organization to published, in one transaction. '
  'security invoker, so row-level security decides what the caller may touch. Driven by the '
  'table list in its body (#94): adding a content table means adding one row there, and the '
  'columns to copy are derived from pg_attribute. Does not rebuild the site -- see '
  'lib/admin/publish.ts.';

-- Restated because `create or replace` does not preserve them being revoked.
revoke all on function public.publish_org_drafts() from public, anon;
grant execute on function public.publish_org_drafts() to authenticated;
