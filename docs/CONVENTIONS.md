# Conventions

How this repository is organized, named, committed, reviewed, and released.

These conventions exist **before** the code they govern. When a convention here turns out to be
wrong or unworkable, change this document in the same PR that departs from it — do not let the code
and this file drift apart silently.

---

## Repository layout

Planned structure. Directories appear as the work that needs them lands; the shape is fixed now so
files do not end up improvised into place.

```
app/                      Next.js App Router
  [locale]/               Public, locale-prefixed pages
  admin/                  Staff-only admin area
lib/                      Shared logic — the single home for anything used twice
  *.test.ts               Vitest, beside the module it covers
  supabase/               Database client, typed queries
  content/                Content fetching and mapping
components/
  ui/                     Primitives (button, input, dialog)
  site/                   Public site components
  admin/                  Admin-only components
messages/                 i18n message catalogues, one file per locale
supabase/
  migrations/             SQL migrations, applied in order
  fixtures/               Rows that exist only to be tested against
docs/                     This directory
  adr/                    Architecture decision records
tests/
  e2e/                    Playwright
  rls/                    Row-level security, against the real project
```

**Shared logic lives in one place.** If a helper is needed in two places, it moves to `lib/` in the
same commit that creates the second use. Duplicated helpers are how silent drift bugs happen — a
copy gets fixed and the original does not.

---

## Naming

Codify what the codebase already does. These are the starting rules; when a real pattern emerges
that contradicts one, update this section rather than mixing two systems.

| Thing | Convention | Example |
|---|---|---|
| Directories | kebab-case | `page-blocks/` |
| React components | PascalCase file and export | `StaffCard.tsx` |
| Non-component modules | kebab-case | `format-date.ts` |
| Functions and variables | camelCase | `getPublishedPages` |
| Types and interfaces | PascalCase, no `I` prefix | `StaffMember` |
| Constants | SCREAMING_SNAKE_CASE | `DEFAULT_LOCALE` |
| Database tables | plural snake_case | `page_blocks` |
| Database columns | singular snake_case | `published_at` |
| Booleans | `is` / `has` / `can` prefix | `isPublished` |
| Environment variables | SCREAMING_SNAKE_CASE | `SUPABASE_SERVICE_ROLE_KEY` |
| Test files | mirror source, `.test.ts` | `format-date.test.ts` |

Avoid abbreviations that are not already universal in this domain. `organization` not `org` in
prose; `org_id` is acceptable in the schema because it is the established column convention.

---

## Code style

- **TypeScript everywhere.** No `.js` source files. `strict` mode on. No `any` — use `unknown` and
  narrow it.
- **Formatting is not a matter of opinion.** Prettier and ESLint run in CI; do not hand-format.
- **Server-first.** Prefer React Server Components. Add `"use client"` only where interactivity
  genuinely requires it, and push it as far down the tree as possible.
- **Comments explain why, not what.** Match the surrounding density. If a comment restates the code,
  delete it.
- **No secrets in code, ever.** They live in environment variables. The Supabase service-role key is
  server-side only and must never reach a browser bundle.

---

## Page layout

### Every page opens with a hero, and the hero has two halves

Use `components/site/PageHero.tsx`. Prose left, an evidence card right — `HeroFacts`, or
something else of similar weight. Below `sm` they stack, prose first.

Body text stays capped at its readable measure: around 70 characters a line, which is what
`PageHero` enforces by putting the prose in a 3/5 column. **Do not widen prose to fill a
container.** At full width on a laptop a paragraph runs past 120 characters a line and the eye
loses its place on the return sweep.

The empty half that a measure cap leaves over is filled with a fact, not left blank. Blank space
on one side of a hero reads as a page that failed to load, and this site's whole argument is
evidence rather than adjectives — so the hero states a claim and shows the proof beside it.

**The card carries a fact a parent is shopping for**, and it does not repeat what the page says
immediately below it. When the facts already exist further down the page, they move up into the
card rather than being printed twice — that is why the home page's trust strip lives in the hero,
and why `/about` explains its license in prose without re-listing the number under it.

No stock photography, per `docs/PLAN.md`.

### Mid-page sections follow the same rule, one level down

A section whose entire body is prose leaves the same empty half the hero used to. Two ways out,
and which one applies is decided by the content, not by the layout:

- **Fill it when there is a fact worth putting there.** A companion element on the right — the
  same 3/5 to 2/5 split, stacking below `sm` with the prose first. `VisitSection` is the worked
  example: the call to action asks a parent to phone a stranger about their child, and `VisitCard`
  answers the four things standing in the way of that call.
- **Centre it when there is not.** The home page's parent testimonial gets no card. A quotation
  wants to sit alone, so the block is centred and the leftover width becomes symmetric margin.

**Never widen prose past its measure to fill a container.** That is the failure this rule exists
to prevent, and it is worse than the empty half.

A section is already fine if cards, a table, or a timeline sit under its intro — "Ratios and group
sizes", "Safety, on an ordinary day", "A day at Willow Grove". A short intro line above full-width
content uses the width correctly and needs nothing beside it.

Two rules carry down from the hero. The companion **must not repeat what the prose beside it
says** — when a fact moves into the card, it comes out of the paragraph rather than appearing
twice. And when a section repeats across pages, **it is one component**: `/programs` and `/about`
both render `VisitSection` with their own heading and paragraph, so the pages still to build
inherit the shape instead of copying it.

---

## Commits

**Conventional Commits**, so that changelogs and version bumps derive from history rather than
being maintained by hand.

```
type(scope): subject
```

- Subject: imperative mood, lowercase, no trailing period. "add staff bio editor", not "Added...".
- **Types:** `feat` `fix` `docs` `test` `refactor` `perf` `ci` `chore`
- **Scopes:** `site` `admin` `db` `auth` `content` `seo` `i18n` `ci` `deps` `docs`
- Breaking changes: `!` after the scope (`feat(db)!: ...`) plus a `BREAKING CHANGE:` footer.

Scope may be omitted when a change genuinely spans the repo. Reaching for that regularly is a sign
the commit is doing too much.

---

## Branches and pull requests

Trunk-based. Short-lived branches off `main`, named `type/short-description` — `feat/staff-editor`,
`fix/mobile-nav-overflow`.

### Branch off `main`, not off another pull request

Small and independent is the default, and it is a mechanical rule rather than a stylistic
preference: **a pull request based on another unmerged pull request will break when the parent
merges.**

The worked example, because it happened here. #57 was opened with #56 as its base, since it edited a
paragraph #56 introduced. The moment #56 was squash-merged, #57 reported a conflict — and nothing
had actually diverged. Squash replaces the parent's commits with a **single new commit with a new
SHA**, so #57 still carried the original. Git's merge base for #57 stayed at the commit *before*
#56, which made it look as though `main` and #57 had independently rewritten the same paragraph,
when #57's version was a strict superset of it.

The fix is one command, with no manual conflict resolution:

```bash
git rebase --onto origin/main <the parent branch's old tip> <branch>
```

So, in order of preference:

1. **Branch off `main`.** Independent work has none of this problem.
2. **If work genuinely depends on unmerged work, wait for the parent to merge.**
3. **If it cannot wait, rebase the moment the parent lands.** Do not leave a stacked pull request
   sitting — the longer it sits, the more it looks like an ordinary conflict to whoever finds it.

**The Deploy Preview is the more expensive half of this.** A stacked pull request's preview builds
against the *parent* branch, so what a reviewer looks at is not what merging to `main` would
produce. On a site whose review gate is "check the preview on a real phone", that is worse than the
conflict: a conflict announces itself, and a preview quietly showing the wrong thing does not.

### The merge strategy is not the lever

**Squash merge stays.** It is what keeps `main` at exactly one Conventional Commit per pull request,
which is what makes "version bumps derive from history" in this document true rather than
aspirational. Both alternatives were considered and rejected; they are recorded here so nobody
re-derives them:

- **Merge commits** would genuinely fix it. The parent's original commits become ancestors of
  `main`, so the merge base moves forward and there is nothing to conflict. The cost is every
  intermediate commit plus a merge bubble on `main`, which destroys the one-commit-per-pull-request
  history this repository's versioning depends on. Not worth paying permanently for a problem that
  only appears when pull requests are stacked.
- **"Rebase and merge" does not fix it.** GitHub rewrites every commit with a new SHA when it
  rebases, producing exactly the same mismatch as squash. It looks like the answer and is not.

**This is a cost of stacking, not a cost of squashing.** Two independent branches off `main` are
untouched by it — #58 went through the same merge with no trouble at all.

### Merged branches are deleted automatically

`delete_branch_on_merge` is enabled on the repository, so the remote branch disappears the moment
its pull request merges. There is no manual cleanup step, and a branch still on the remote is
therefore work in flight rather than debris — which is the property that makes the branch list worth
reading at all.

The local copy survives the remote deletion. `git branch -d <branch>` after merging, or
`git fetch --prune` to drop the stale remote-tracking refs.

### A PR does one thing

When something fixable turns up that is outside the assigned task:

| What you find | What you do |
|---|---|
| Blocks the assigned task | Fix it in the same PR, call it out in the description |
| Trivial, in code you are already editing | Fix it, mention it in the PR |
| Anything else | **File an issue.** Do not touch the code. |
| Security or data-loss risk | **Stop and raise it immediately.** Never file it in a queue. |

The principle: **nothing silently dropped, nothing silently smuggled in.** Every finding becomes a
visible PR line or a readable issue. This is not tidiness — review is the quality gate and a release
tag is the rollback unit, and both break when PRs carry unrelated cargo.

### PR descriptions

Written for someone who never saw the ticket. What changed, why, how it was verified, and anything
deliberately left out. This is the audit trail.

### Self-review checklist

Every PR is self-reviewed against this before merge:

- [ ] Does one thing; unrelated findings are filed as issues, not fixed here
- [ ] Description explains the change to someone without context
- [ ] No secrets, keys, or credentials added
- [ ] No service-role database access reachable from client code
- [ ] Row-level security still enforced for any new table or column
- [ ] Shared logic extracted rather than duplicated
- [ ] Tests cover the real user path, not just a convenient trigger
- [ ] Conventions in this file still hold, or are updated in this PR
- [ ] Deploy Preview checked on a real phone for any visual change — and branched off `main`, so
      the preview shows what merging would actually produce
- [ ] Labelled to match its commit type, so the release notes group correctly
- [ ] Staged with explicit paths — never `git add -A`, which sweeps in untracked files

Self-review reliably catches slips — typos, missing error handling, forgotten edge cases. It does
not catch the author's own design blind spots. Deploy Previews and the release gate cover that.

---

## Testing

- **Unit tests** (Vitest) for pure logic: formatting, mapping, validation.
- **End-to-end tests** (Playwright) for user journeys, run against a **cold first-time page load** —
  no logged-in state, no warm cache. That is how every visitor actually arrives, and testing a
  convenient trigger instead has hidden real bugs before.
- **Row-level security tests** are mandatory for every new table: assert an anonymous client cannot
  read unpublished rows, and cannot insert, update, or delete. They live in `tests/rls/` and run
  against the **real hosted project** — row-level security is a database behaviour, and a mocked
  client proves only that the mock agrees with the assertions.

  They do **not** assert that another organization's published rows are invisible. That is not a
  guarantee `anon` can carry — the key ships in the client bundle, so any organization scope would
  be forgeable. `docs/PLAN.md` sets out the reasoning and the tripwire that voids it: the first
  table holding anything that is not public marketing copy.

  Assert a refusal by its error code, not merely that an error came back. A malformed payload also
  produces an error, and a test that accepts any failure passes on a table that grants writes.
- **Tests before big refactors.** Load-bearing logic is never rewritten without a safety net first.

Unit tests live beside the module they cover, as `*.test.ts` — the naming table above. `tests/e2e/`
is Playwright's alone, and `npm run test:unit` is scoped to `lib/` so the two runners never try to
execute each other's files.

CI gates merge on: **typecheck, lint, formatting, unit tests, row-level security, production build,
and end-to-end tests.** Unit tests run before the build, because they need neither the build nor a
browser and finish in under a second; the row-level security suite runs next, because a policy
regression is worth failing on in seconds rather than after a build and a browser download.

`npm run test:unit` and `npm run test:rls` are separate commands with separate Vitest configs on
purpose. The unit suite is hermetic — no network, no credentials — and folding a database test into
it would make an unreachable project look like broken logic.

Unit tests joined that gate with the currency formatting in `lib/tuition.ts` and the tenure
arithmetic in `lib/staff.ts` — the first logic here that was worth testing apart from the page
rendering it, and the safety net the `v0.3.0` conversion of those modules to database queries is
refactored against.

A Lighthouse budget is still not in the gate, and joins it when there are enough pages to budget.
Config for a test runner with nothing meaningful to run is theatre — that line moves when the tests
do, in the same PR that adds them.

---

## Releases

**Semantic versioning**, derived from commit history:

| Commit type | Version bump |
|---|---|
| `fix:` | patch |
| `feat:` | minor |
| `!` / `BREAKING CHANGE:` | major |

**Merging does not deploy. Publishing a release deploys.**

- Every PR gets a Netlify Deploy Preview at its own URL.
- Production deploys are gated to releases by Netlify **site configuration**, not a repository
  file: the production branch is a placeholder that never receives commits, so merging to `main`
  produces only a non-production branch deploy. The site is intentionally unlocked, because a
  production lock would block the release workflow's `netlify deploy --build --prod` as well.
- **Publishing a GitHub Release** creates the `v*` tag and triggers the production deploy.
- Rollback is republishing the previous Netlify deploy — seconds, no rebuild, no revert commit.

### Release notes

**There is no `CHANGELOG.md`, and there will not be one.** GitHub Releases is the record: every
version, dated, with notes, linked to its exact commits and diff. A changelog file duplicates
something the host already stores and renders better, goes stale, and causes merge conflicts on
every parallel change.

Notes are generated from merged pull requests and grouped under headings by `.github/release.yml`.

**GitHub groups by pull request label, not by commit message.** It cannot infer a heading from a
`feat:` prefix. Every PR therefore carries a label matching its commit type:

| Label | Commit types |
|---|---|
| `feature` | `feat` |
| `fix` | `fix`, `perf` |
| `chore` | `chore`, `refactor` |
| `docs` | `docs` |
| `ci` | `ci`, `test` |
| `deps` | dependency bumps |

A missing label is not a failure — the PR simply falls into an "Other" group in the generated notes.

### An accepted consequence

Because production is gated at the release rather than at PR review, **`main` may contain code that
has not been reviewed by the project owner**, and changes bundle between releases. That is a
deliberate trade: owner attention goes on running software rather than on diffs. The consequence to
accept is that when something breaks after a release, the suspect list is a batch rather than a
single PR. Deploy Previews are the mitigation — every change is viewable before it merges.

---

## Documentation

- Documentation precedes the code it governs.
- Decisions with trade-offs get an ADR in `docs/adr/`, numbered and never rewritten after the fact —
  superseded ADRs are marked superseded and kept.
- **Every ADR records the reasoning, the risks knowingly accepted, and the tripwire that should make
  us revisit.** A decision without its reasoning has to be re-derived by whoever finds it next.
- Operational procedures live in `docs/RUNBOOK.md`: deploy, roll back, restore, rotate secrets.
- **Release history is not a file.** It lives in GitHub Releases, generated from what actually
  merged, and tied to the tag that actually deployed. Do not add a changelog to this repository.
