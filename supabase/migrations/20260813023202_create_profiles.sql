-- profiles, and current_org_id() reading from it.
--
-- The first migration wrote every authenticated policy against public.current_org_id() and
-- left the function returning NULL, so those policies granted nothing while nobody could log
-- in. This migration adds the table that maps a session to an organization and rewrites that
-- one function body. **No policy on any content table is touched** — that indirection was the
-- point, and this is where it pays.
--
-- Read this file alongside 20260805025214_create_content_tables.sql; the reasoning for the
-- tenancy model lives there and is not repeated.

-- ---------------------------------------------------------------------------------------
-- profile_role
-- ---------------------------------------------------------------------------------------
--
-- An enum rather than a text column, for the same reason content_status is one: a typo in a
-- future INSERT should be a hard error, not a row with a role nothing will ever match.
--
-- Two values, because two is what the product actually distinguishes today. 'admin' is the
-- person who can eventually invite others; 'editor' is everyone else. Nothing in this
-- migration reads the column yet — no policy branches on it — so it is recorded now rather
-- than being retrofitted onto rows that already exist. Adding a third value later is one
-- `alter type ... add value`; adding the column later is a data migration.

create type public.profile_role as enum ('admin', 'editor');

-- ---------------------------------------------------------------------------------------
-- profiles — one row per staff account
-- ---------------------------------------------------------------------------------------
--
-- The join between Supabase Auth and this schema. auth.users is managed by Auth and must not
-- be extended with application columns; profiles is the public-schema half that may be.

create table public.profiles (
  -- Shares the primary key with auth.users rather than carrying a separate surrogate id, so
  -- "one profile per account" is the shape of the table instead of a constraint someone has
  -- to remember. Cascade because a deleted account has no profile to keep.
  id uuid primary key references auth.users (id) on delete cascade,

  -- restrict, not cascade, unlike every content table. Deleting an organization that still
  -- has staff accounts attached should fail loudly and make the caller remove the people
  -- first — the content is replaceable, the accounts are the thing you would not notice were
  -- gone until someone could not log in.
  org_id uuid not null references public.orgs (id) on delete restrict,

  role public.profile_role not null default 'editor',

  -- Who took an action, in a UI that will show it. Not an email: the address is in
  -- auth.users, it changes, and it is not what a colleague should be shown.
  display_name text not null check (length(trim(display_name)) > 0),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

create index profiles_org_id_idx on public.profiles (org_id);

-- SELECT ONLY, AND DELIBERATELY SO.
--
-- Every content table grants authenticated `for all`. This one does not, and the difference
-- matters: org_id on this table is the tenancy key itself. A member who could UPDATE their
-- own profile row could set org_id to another organization and, on the next statement, hold
-- full write access to that organization's content through policies that are all working
-- exactly as designed. That is privilege escalation with no bug in it anywhere.
--
-- So accounts are created and moved by the service role only — the dashboard today, an
-- invite flow in #73 — which bypasses row-level security by definition. Nothing an
-- authenticated session can send changes who it is.
--
-- The read is scoped to the caller's own organization: staff see their colleagues, not every
-- account on the platform.
create policy "profiles are readable by their own organization"
  on public.profiles for select to authenticated
  using (org_id = public.current_org_id());

-- ---------------------------------------------------------------------------------------
-- current_org_id() — the rewrite this whole release waited on
-- ---------------------------------------------------------------------------------------
--
-- security definer, as the first migration's own comment warned. The policy directly above
-- calls this function, and this function reads that same table: without elevation the lookup
-- would re-enter the policy and recurse. Running as the owner, the read inside the function
-- bypasses row-level security and the cycle never forms.
--
-- `set search_path = ''` is kept, and is not a style nit here. A security definer function
-- with a mutable search path is the classic privilege-escalation shape: anyone able to
-- create a table named `profiles` in a schema earlier on the path would have this function
-- read theirs instead. The empty path is why every reference below is schema-qualified.
--
-- `select auth.uid()` is wrapped in a subquery so the planner evaluates it once per
-- statement rather than once per row — this function is called by a policy on every row of
-- every table, which makes it the hottest function in the schema.
create or replace function public.current_org_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select p.org_id
  from public.profiles p
  where p.id = (select auth.uid());
$$;

comment on function public.current_org_id() is
  'The caller''s organization, looked up in public.profiles. NULL for an anonymous session, '
  'which is what keeps every authenticated policy closed to anon. security definer: the '
  'policy on profiles calls this function and would otherwise recurse.';

-- Execute is revoked from PUBLIC first, because a security definer function should be
-- granted deliberately rather than inherited by every role that will ever exist. anon keeps
-- it: no anonymous policy calls this function, but anon evaluates policies on tables that
-- do, and a missing grant there would surface as a permission error on the live site rather
-- than as the NULL the design expects.
revoke execute on function public.current_org_id() from public;
grant execute on function public.current_org_id() to anon, authenticated;

-- ---------------------------------------------------------------------------------------
-- Privileges on profiles
-- ---------------------------------------------------------------------------------------
--
-- Row-level security decides which rows; these decide which verbs. Supabase grants both
-- public roles write privileges on new tables in public by default, which is why every
-- grant below is preceded by a revoke rather than trusted to be absent.
--
-- anon gets nothing at all — not even select. Unlike the content tables, none of this is
-- marketing copy: it is a list of who works at the center and which auth account is theirs.
-- The anonymous key ships in the client bundle, so "no policy would match anyway" is one
-- mistake away from being wrong, and this revoke is the second thing that would have to go
-- wrong too.

revoke all on public.profiles from anon;
revoke all on public.profiles from authenticated;

grant select on public.profiles to authenticated;
