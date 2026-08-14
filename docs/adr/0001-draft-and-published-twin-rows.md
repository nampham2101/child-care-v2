# 0001 — Drafts are twin rows, separated by partial unique indexes

**Status:** Accepted · 2026-08-14 · Decided by the owner on #74

The first ADR in this repository. `docs/CONVENTIONS.md` has asked for `docs/adr/` since before
there was code; this is the first decision with trade-offs big enough to earn one, because it is a
schema shape that gets expensive to change once content is sitting in it.

## Context

`v0.3.0` shipped content tables with one row per thing — `unique (org_id)` for `site_settings` and
`tuition_fees`, `unique (org_id, key)` for the keyed tables — and a single `status` column
(`draft | published`) on that row. The anonymous read policy is `status = 'published'`.

That is a correct shape for a seeded, read-only site. It makes #74's editor impossible to build,
because there is nowhere to put an edit that is not yet live. Both ways out without a schema change
are wrong:

- **Overwrite the published row.** That is editing the live site. #74 forbids it, and no reviewer
  could safely approve an editor that writes straight to production content.
- **Flip the row to `draft`.** The row then disappears from the anonymous read, and
  `lib/content.ts`'s `requireRow` raises on a missing published row — so **editing the phone number
  would fail the next build**, with an error pointing at seed data rather than at the edit.

## Decision

Each unique constraint becomes **two partial unique indexes** over the same columns, one scoped to
`status = 'published'` and one to `status = 'draft'`. A key may therefore have at most one published
row and at most one draft, and the two coexist.

A draft is linked to its published twin by the same key the index is built on — not by a pointer
column that could disagree with it.

No policy changed. No column was added. The public read path is untouched.

## Alternatives rejected

**A single `content_drafts` table with a JSONB payload.** Smallest blast radius — no existing
constraint or foreign key moves. Rejected because JSONB is not type-checked by the database:
`per_month > 0` and every `not null` would stop firing at save time and fire at publish instead.
#74 is explicit that "validation belongs next to the constraints, not instead of them", and this
option is precisely the shape it warns against. It also puts the pending value somewhere the
column's own type cannot describe.

**Fold `status` into the constraint — `unique (org_id, key, status)`.** Equivalent today and says
something weaker. The invariant worth keeping is *at most one published row per key*; the composite
instead expresses *one row per status*, so adding a third status later would silently start
permitting a row of it rather than being a decision someone makes.

**Edit live and rely on the build boundary.** The public site is prerendered, so an edit to a
published row genuinely does not reach a visitor until a rebuild. Zero schema change, by far the
simplest. Rejected on a case this project will hit: merging a code change and publishing a release
would ship whatever half-finished content edits happen to be sitting in the database. Releases are
the one thing with two human gates on them, and content must not route around both. It also leaves
no way to abandon an edit once typed.

## Consequences

**The promote algorithm #75 inherits has two cases, and the difference is not cosmetic:**

1. The draft **has** a published twin — copy the draft's values onto the published row, delete the
   draft. The published row keeps its id, so every `tuition_rates` row already pointing at it keeps
   pointing at it.
2. The draft has **no** published twin (a newly added program or staff member) — flip that row's
   status to `published`. Do *not* insert a copy: the row's id is already referenced by any draft
   rate created against it, and a copy would strand them.

Getting case 2 wrong fails silently. `tuition_rates` cascades on delete, so replacing a row instead
of promoting it would take its rates with it — the rate sheet would lose cells rather than raise
anything.

**Reading "the current value" is now two rows, not one.** The admin wants draft-if-present-else-
published; the public site wants published only. The public queries in `lib/` already say
`status = 'published'` by policy, so they were correct before this change and stay correct after it.
Anything new that reads content has to decide which of the two it means.

**`isOneToOne` flipped to `false`** for `site_settings.org_id` and `tuition_fees.org_id` in
`lib/database.types.ts`, because that flag is derived from the unique constraint that was dropped.
Embedding `orgs` from either table still types as a single object — the foreign-key side is to-one
regardless — so no query changed. Worth knowing before someone reads the regenerated diff and
assumes it is noise.

## Risks accepted

**Two rows can drift apart in ways nothing checks.** A draft created against one version of a
published row stays valid after that published row is edited by someone else, and publishing it
would silently discard the other edit. With one editor at one center this is theoretical. It is a
real last-write-wins hazard the moment two staff members edit at once.

*Tripwire:* the second staff account at a single center. At that point the draft needs to record
which version of the published row it was derived from, and publishing needs to refuse a stale one.

**A draft can be orphaned.** Nothing deletes a draft whose published twin is removed, and nothing
surfaces a draft that was abandoned months ago. #75 owns showing what is pending; if drafts start
accumulating unseen, that is where it should be fixed.
