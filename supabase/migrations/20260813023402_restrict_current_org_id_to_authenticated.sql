-- Narrows EXECUTE on public.current_org_id() to the one role that actually needs it.
--
-- WHY THIS IS A SECOND MIGRATION AND NOT AN EDIT TO THE FIRST
--
-- 20260813023202_create_profiles.sql granted EXECUTE to `anon` as well as `authenticated`,
-- on the stated reasoning that anon evaluates policies on tables whose authenticated
-- policies call this function, and would hit a permission error without it.
--
-- That reasoning is wrong. Policies are scoped to a role: an anonymous session evaluates
-- only the `to anon` policies, and not one of them calls this function — every anonymous
-- policy in the schema is `status = 'published'` or `true`. The grant bought nothing.
--
-- Both halves were checked against this database rather than reasoned about a second time.
-- With EXECUTE revoked from anon, an `anon` session still reads orgs, site_settings,
-- programs and tuition_rates normally. With it revoked from authenticated, the same read
-- fails with `42501: permission denied for function current_org_id` — so authenticated
-- genuinely needs it and anon genuinely does not.
--
-- supabase/migrations/README.md forbids editing an applied migration: the remote history
-- table records what ran, and changing the file afterwards makes the two disagree silently.
-- The first migration had already been applied when this was found, so it stays as it is,
-- wrong comment and all, and this file is the correction.
--
-- WHAT THIS DOES NOT FIX
--
-- The database linter also warns that `authenticated` can call this function over
-- /rest/v1/rpc/current_org_id. That one is accepted, not overlooked. The grant cannot be
-- removed — the policies on every content table depend on it, as demonstrated above — and
-- the only alternative is moving the function to an unexposed schema, which would mean
-- rewriting the policy on every content table. #72 exists precisely so that never has to
-- happen.
--
-- It is also harmless: the function takes no arguments and returns the caller's own
-- organization id, derived from their own session. A signed-in member learns their own
-- org_id, which they already had. There is no argument to pass and therefore nothing to
-- probe with.

revoke execute on function public.current_org_id() from anon;

comment on function public.current_org_id() is
  'The caller''s organization, looked up in public.profiles. NULL for an anonymous session, '
  'which is what keeps every authenticated policy closed to anon. security definer: the '
  'policy on profiles calls this function and would otherwise recurse. EXECUTE is granted to '
  'authenticated only — anon evaluates no policy that calls it.';
