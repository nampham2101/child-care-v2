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

## Regenerating the types

`lib/database.types.ts` is generated from the live schema and committed, so that a query
naming a column that no longer exists fails `npm run typecheck` in CI rather than at runtime.

```bash
npx supabase gen types typescript --project-id kdhtodcmxgxfnxrbkkzp > lib/database.types.ts
```

**This command needs a Supabase access token** — `supabase login`, or `SUPABASE_ACCESS_TOKEN`
in the environment. It is a personal credential, not a project key, and it is not in
`.env.example` and must not be committed. Without it the command writes a JSON error into the
file instead of types, which is easy to miss because it exits without printing anything.

Regenerate in the **same pull request** as the migration that changed the schema. A committed
type file that disagrees with the database is worse than no type file, because it makes
typecheck confidently wrong.

The file is listed in `.prettierignore` and left exactly as the generator emits it, so
regenerating shows the schema change rather than several hundred reflowed lines.

## Rules that keep this directory honest

- **Never edit a migration that has been applied.** The remote history table records what
  ran; changing the file afterwards makes the two disagree silently. Fix forward with a new
  migration.
- **Never delete a migration file.** It is the record of how the schema reached its current
  state.
- Name for the change, not the ticket — `create_content_tables`, not `issue_47`.

## What has actually been run, and what has not

Being precise about this, because "documented" and "verified" are not the same thing.

**`supabase link` and `supabase db push` are still unexercised.** The first migration was
applied through the Supabase management connector rather than the CLI, because `db push`
needs the database password and `gen types` needs a personal access token — neither of which
was available at the time. The commands above are the intended path and are written from the
CLI's own documented behaviour, not from a successful run.

The consequence to know about: the remote migration history records version
`20260805025214`, and the file in this directory is named to match. A `db push` from a
freshly linked machine should therefore treat it as already applied rather than trying to
re-run it — but **that has not been observed**. Verify it with `db push --dry-run`, which
prints what it would do without doing it, before trusting it.

If the instructions turn out to be wrong, correct them in the pull request that finds out.
