# Migrations

SQL files, applied in filename order, forward only. This directory is the truth about the
schema — `docs/PLAN.md` deliberately does not repeat column lists, because a document and a
migration that describe the same table will drift and only one of them actually runs.

## There is no local database

**Docker is not installed on the development machine, so `supabase start` is unavailable** —
and with it `supabase db diff`, `supabase db reset`, and every other command that compares
against or rebuilds a local stack. This is a deliberate constraint, not an oversight: a
one-developer project with a hosted database does not earn a container runtime.

The practical consequence: **migrations are hand-written, not generated.** There is no local
schema to diff against, so nobody can make a change in a GUI and have the SQL produced for
them. Write the SQL, review it, apply it.

If a future ticket assumes a local database — a `db diff` step, a seeded test container, a
`db reset` in CI — that assumption is wrong here. Raise it rather than installing Docker to
satisfy it.

## Creating a migration

```bash
npx supabase migration new <short_snake_case_name>
```

This writes an empty timestamped file into this directory and needs neither Docker nor
network. Then write the SQL by hand.

Every table gets `org_id` and row-level security in the same migration that creates it —
never in a follow-up. A table that exists for even one deploy without RLS is a table that
was readable by anyone holding the anonymous key, which is a key that ships in the client
bundle by design.

## Applying a migration

Once per machine, link the working copy to the hosted project:

```bash
npx supabase link --project-ref kdhtodcmxgxfnxrbkkzp
```

Then preview and apply:

```bash
npx supabase db push --dry-run
```

```bash
npx supabase db push
```

Always dry-run first. `db push` runs against the real, only database — there is no staging
project and no preview branch, so a mistake here is a mistake in the one place the data
lives.

**The database password is prompted for; it is never committed, never placed in an
environment file, and never pasted into a chat or an issue.** It lives in the Supabase
dashboard under Settings → Database, and it is a different credential from the anonymous key
in `.env.example`. Linking writes the project ref into `supabase/.temp/`, which is
gitignored.

## Rules that keep this directory honest

- **Never edit a migration that has been applied.** The remote history table records what
  ran; changing the file afterwards makes the two disagree silently. Fix forward with a new
  migration.
- **Never delete a migration file.** It is the record of how the schema reached its current
  state.
- Name for the change, not the ticket — `create_content_tables`, not `issue_47`.

## Not yet exercised

At the time this README was written, this directory is empty and the link-and-push path has
not been run against the project. Issue #47 is the first migration and therefore the first
real test of these instructions. If they turn out to be wrong, correct them in that pull
request rather than working around them.
