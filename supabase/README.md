# Supabase

Two things live here, and they are applied differently because they are different kinds of thing.

| File | What it is | Runs |
|---|---|---|
| `migrations/*.sql` | Schema. See [`migrations/README.md`](migrations/README.md) | Once, forward only |
| `seed.sql` | The fictional center's facts, hand-authored | Whenever the seeded values change |
| `seed-prose.sql` | The site's copy, generated. See below (#126) | Whenever published copy should move into the restore point |
| `fixtures/rls.sql` | Rows the row-level security suite needs refused | Whenever the fixture changes |
| `checks/reseed-is-idempotent.sql` | Proves the seed files can still be re-applied (#98) | Every CI run |
| `checks/a-fresh-database-renders.sql` | Proves one clean pass yields a usable database (#126) | Every CI run |
| `config.toml` | The local stack those checks run against | Only in CI |

There is **one hosted project, and no local database on the development machine** — Docker is not
installed there, so `supabase start` and everything built on it is unavailable.
`migrations/README.md` explains that constraint in full and explains its one exception: the `seed`
job in CI, which starts a throwaway stack purely to re-apply the two files above. Nothing in that
job touches the hosted project, and it holds no credential.

---

## Applying the seed

`seed.sql` and `seed-prose.sql` are the files `supabase db reset` would normally run after
rebuilding a local stack. With no local stack, they are applied against the hosted project
directly, by pasting each into the **SQL Editor** in the Supabase dashboard and running it.

**`seed.sql` first.** It creates the organization that every statement in `seed-prose.sql` looks
up; the other order applies 586 rows to nothing and reports success. `config.toml` lists them in
that order for the same reason.

That is a manual step on purpose. The alternative — a script in `package.json` — needs a credential
that can write, and the only such credential is the service-role key, which
[`docs/CONVENTIONS.md`](../docs/CONVENTIONS.md) keeps out of this repository and out of every
environment file. Nothing in the site writes to the database, so there is no second reason to
introduce one. A seed that runs a few times a release does not earn the standing risk of a
write-capable key sitting in `.env.local`.

**It is safe to run more than once**, and since #98 that is a claim CI re-proves rather than one
this file asserts. Every statement upserts on the natural key, so a second run updates the same
rows in place rather than inserting duplicates. The `seed` job applies this file — the committed
file, not a copy — twice more against a throwaway stack on every run and fails if any row
identifier or content value moved. `checks/reseed-is-idempotent.sql` is what it runs and why.

One correction to the older version of that claim, which said "byte-for-byte unchanged": `updated_at`
does move. Each content table has a `BEFORE UPDATE` trigger, and an upsert that writes the same value
is still an update, so re-seeding restamps every row it touches. Nothing reads that column today, but
do not use it to tell a seeded row from an edited one.

**A re-seed leaves drafts alone.** Every `on conflict` in the file names the *published* partial
unique index (`where status = 'published'`), which is what makes the statements plan at all under the
twin-rows schema — and the useful consequence is that a staff member's unpublished draft is not a
conflict target and is not touched. Re-seeding puts the live site back to the values in this file
without discarding an edit somebody has in flight. Verified with a draft twin present.

That predicate is load-bearing, not decoration. Without it Postgres cannot tell which of the two
partial indexes is meant and refuses to plan the statement — `42P10`, raised at plan time, so the
whole file fails rather than one row. If a future migration changes a unique index here, this file
and `fixtures/rls.sql` have to change with it — and **the `seed` job is what will tell you**, on
the pull request that changes the index rather than weeks later. That sentence used to end "nothing
in CI will catch it", which was true when it was written and is the gap #98 closed.

**It never deletes.** Removing a program band from the file leaves its row in the database. A seed
that deleted whatever it did not recognise would be one careless edit away from destroying rows the
`v0.4.0` admin UI wrote. Deletions are deliberate and done by hand.

## Checking what is in there

Row counts, which are stated on the seed's source ticket and are the fastest way to spot a partial
run:

```sql
select 'orgs' t, count(*) from public.orgs
union all select 'site_settings', count(*) from public.site_settings
union all select 'programs', count(*) from public.programs
union all select 'daily_rhythm', count(*) from public.daily_rhythm
union all select 'staff', count(*) from public.staff
union all select 'tuition_schedules', count(*) from public.tuition_schedules
union all select 'tuition_rates', count(*) from public.tuition_rates
union all select 'tuition_fees', count(*) from public.tuition_fees
union all select 'prose', count(*) from public.prose
order by 1;
```

A fully seeded database has 1 org, 1 site_settings, 3 programs, 7 daily_rhythm, 7 staff, 3
tuition_schedules, 9 tuition_rates, and 1 tuition_fees — 32 facts in total — plus **586 `prose`
rows**, 293 per locale across `en` and `de`.

### `prose` is part of the seed now, and was not before (#126)

This section used to say `prose` was populated once by
`migrations/20260822020339_backfill_prose_from_en_catalogue.sql` and that re-running the seed
neither wrote nor touched it. That was true, and it was the bug.

Every prose migration is scoped `where o.slug = 'willow-grove'`, and on a fresh `supabase db
reset` the migrations run **before** `seed.sql` creates that organization — so all five of them
inserted nothing and a rebuilt database came out with no copy at all. Nobody noticed because the
only database anyone built from was the hosted one, where the organization already existed when
those migrations ran.

The copy is data, so it lives in the seed now: `seed-prose.sql`, generated from the published rows
by `scripts/generate-prose-seed.mjs` and carrying an md5 over its contents. The five migrations are
left exactly as they are — they were correct against the database that existed when they were
written, and rewriting applied migrations to tidy history is a worse habit than leaving them as
no-ops on a rebuild.

A `prose` count of 0 now means the seed is partial, and `checks/a-fresh-database-renders.sql` fails
the CI seed job rather than letting it through to a Netlify build that dies in `@/lib/prose`.

## `lib/` no longer holds these values

This section used to warn that every fact existed twice — once in `lib/`, once in these tables — and
that `lib/` was the source the site rendered. That stopped being true in `v0.3.0`. `lib/center.ts`,
`lib/programs.ts`, `lib/staff.ts` and `lib/tuition.ts` now read these tables at build time and hold
no constants, so **the database is the only source** and there is no second copy to keep in step.

What that changes for this file: editing a value here and applying it is the whole job. What it does
not change: `seed.sql` is still the transcription of record for the fictional center's facts, so a
value changed through the admin UI and not reflected here will be silently reverted the next time
somebody re-seeds. Keep them in agreement.
