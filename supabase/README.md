# Supabase

Two things live here, and they are applied differently because they are different kinds of thing.

| File | What it is | Runs |
|---|---|---|
| `migrations/*.sql` | Schema. See [`migrations/README.md`](migrations/README.md) | Once, forward only |
| `seed.sql` | The fictional center's facts | Whenever the seeded values change |

There is **one hosted project and no local database** — Docker is not installed, so `supabase start`
and everything built on it is unavailable. `migrations/README.md` explains that constraint in full;
it applies to this file too.

---

## Applying the seed

`seed.sql` is the file `supabase db reset` would normally run after rebuilding a local stack. With
no local stack, it is applied against the hosted project directly, by pasting it into the **SQL
Editor** in the Supabase dashboard and running it.

That is a manual step on purpose. The alternative — a script in `package.json` — needs a credential
that can write, and the only such credential is the service-role key, which
[`docs/CONVENTIONS.md`](../docs/CONVENTIONS.md) keeps out of this repository and out of every
environment file. Nothing in the site writes to the database, so there is no second reason to
introduce one. A seed that runs a few times a release does not earn the standing risk of a
write-capable key sitting in `.env.local`.

**It is safe to run more than once.** Every statement upserts on the natural key the schema already
enforces, so a second run updates the same rows in place rather than inserting duplicates — verified
by re-running it and confirming the row identifiers and values were byte-for-byte unchanged.

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
order by 1;
```

A fully seeded database has 1, 1, 3, 7, 7, 3, 9, and 1 rows respectively — 32 in total.

## While `lib/` still holds the same values

Until the read-path work lands, every fact exists twice: in `lib/` and in these tables. **`lib/` is
still the source the site renders**, so a value changed in only one of the two places is a
divergence nothing currently detects.

Change both, in the same pull request, until `lib/` stops holding constants at all.
