# v1 Plan — Marketing Website

> **Status: agreed in outline, open in detail.** Decisions in the "Agreed" tables below are settled
> and should not be relitigated without a reason. Sections marked **Proposed** are recommendations
> that have not been signed off. Remaining unknowns are listed at the bottom.

---

## Context

The goal is a small system for a child care center. Scoping narrowed **v1 to a marketing website** —
not the operations platform. That is the first slice: it is the center's storefront, it holds no
regulated data, and it can be live in weeks rather than months.

Intended outcome: a fast, credible, locally-discoverable website that center staff update
themselves without calling a developer — whose database and auth later become the foundation the
operations platform is built on.

---

## Agreed decisions

### Product

| Decision | Call |
|---|---|
| v1 scope | Marketing website, not the operations platform |
| Product shape | One center now, built multi-tenant-ready |
| Conversion | No forms. Call, email, or visit |
| Content editing | Center staff, via an admin UI |
| Languages | English now, structured for a second later |
| Center identity | **Fictional placeholder.** Name, address, and copy are invented for now |
| Photography | **Placeholder imagery.** Must be replaced before any real launch — see the risk note below |

### Design

| Decision | Call |
|---|---|
| Visual direction | **Warm and human** — warm neutral base, single sage accent, no photographs of people |
| Design rationale | Built for an anxious parent comparing centers, not to look like a site "for children" |
| Mobile | Designed and checked mobile-first; most traffic is a parent on a phone |

### Engineering

| Decision | Call |
|---|---|
| Hosting | Netlify |
| App | Next.js (App Router, TypeScript) |
| Database, auth, storage | Supabase |
| Next.js major version | **16** — verified compatible, see below |
| Change flow | One pull request per change, with a Netlify Deploy Preview |
| CI gate | Lean but real: typecheck, lint, production build, one cold-load Playwright test |
| Human gate | Owner gates at the release tag. Merging must not deploy |

### Releases

| Decision | Call |
|---|---|
| Release trigger | Publishing a **GitHub Release** in the web UI creates the tag and fires the deploy |
| Changelog | **No `CHANGELOG.md`.** GitHub Releases *is* the changelog |
| Release notes | **Auto-generated and grouped by type** via `.github/release.yml` |
| Versioning | Semantic versioning, derived from Conventional Commit types |

---

## Architecture

**The public website is prerendered at build time and served from cache — through the Next.js
runtime, not as files picked off the CDN. The database is never in a visitor's request path.**

- **Public pages** are prerendered at build time and served from a durable cache by the Netlify
  Next.js runtime — a single `___netlify-server-handler` function behind a `/*` redirect, returning
  `cache-status: "Next.js"; hit`. To a visitor it is CDN-fast; it is not literally a static file
  read, and a warm-cache handler invocation is effectively free here (but not zero, the way a CDN
  file read is).
- **The admin area** (`/admin/*`) is server-rendered and talks to Supabase live. Only staff reach it.
- When staff press **Publish**, the app starts a production rebuild, the site rebuilds, and Netlify
  swaps in the new deploy — roughly 1–2 minutes end to end.

  **Corrected in #75: this is not a Netlify build hook, and cannot be.** A build hook builds a git
  branch, and neither branch here can carry a content publish — `release-prod` is the production
  branch and never receives commits, and `main` would produce a branch deploy rather than
  production. Publish therefore dispatches a GitHub workflow that runs the project's one production
  deploy path against the **newest release tag**, so a content publish can never ship unreleased
  code and both production gates survive. `docs/RUNBOOK.md` has the mechanics.

Regenerating the whole site on publish, rather than revalidating individual pages, means depending
only on the most basic and most reliable thing the Next.js adapter does — server-render the admin —
and not on incremental-regeneration behavior that varies between hosting adapters. It also plays to
what Netlify is genuinely good at: serving immutable static deploys and rolling between them
instantly.

What it buys:

- **Speed and SEO** — prerendered HTML from a warm durable cache serves about as fast as a CDN file,
  and for a local business page speed is both a ranking input and a bounce-rate input.
- **Resilience** — if Supabase is paused or down, the public site is unaffected: the handler serves
  prerendered pages from cache and never touches the database. Only the admin is.
- **Rollback** — every Netlify deploy stays permanently addressable, so reverting is republishing a
  previous deploy: seconds, no rebuild.
- **Safety** — no public request path into the database is a much smaller attack surface.

**The trade:** content changes take 1–2 minutes to appear, not seconds, and each publish consumes
build minutes. For a brochure site whose copy changes monthly that is a non-issue — but the admin
must say *"Publishing — live in about two minutes"* rather than implying it was instant.

### How the split is actually enforced (#73)

The paragraph above was a design intention until `v0.4.0`; `/admin` is the first route this project
has ever served on demand, so it is now a thing the code has to hold rather than describe.

**One middleware, two branches, and they never both run.** `middleware.ts` tests the path: anything
under `/admin` goes to the Supabase session guard, everything else to the locale middleware. Running
both — the obvious shape — is wrong twice over. `getUser()` calls the auth server, so it would put a
network round trip in front of seven pages that are otherwise served from cache, which is exactly
the thing this section rules out. And `/admin` is not locale-prefixed, so the locale middleware
would redirect it to `/en/admin`, which does not exist.

**The check that this is still true is `npm run build`'s route table**, where the seven public pages
are marked `●` (prerendered) and only `/admin`, `/admin/sign-in`, and `/admin/sign-out` are marked
`ƒ`. An eighth `ƒ` on a public route means the boundary broke, and that is a more reliable signal
than any assertion about it — so it belongs in the pull request description of anything that
touches routing.

**Why `/admin` sits outside the locale tree at all.** The locale segment exists so a *parent* can
read the site in their language. Staff are the people who work at this one center, and the admin is
a tool rather than a publication, so prefixing it would add `/en/` to every staff URL and imply a
translated admin that nothing intends to build. *Tripwire, now handled:* #77 put prose editing in
the admin, and a staff member will eventually need to choose which **content** locale they are
editing. Every function in `lib/admin/editable.ts` takes a locale and defaults to
`routing.defaultLocale`; **no picker is rendered**, because one shipped locale makes a control with
a single option into dead UI. When #53 or #54 lands, that control goes *inside the page* and never
as a prefix on the admin URL — the two are easy to conflate and expensive to unpick.

**Three decisions inside the guard, each with a cheaper wrong answer:**

- **`getUser()`, never `getSession()`.** `getSession()` decodes the session cookie without verifying
  its signature, so it reports what the browser *claims*. It is the faster call and the one most
  examples reach for, and using it for a gate means the gate is forgeable.
- **The session lives in cookies written server-side, not in browser storage**, and sign-in is a
  server action rather than a client-side `supabase-js` call. That keeps the token out of reach of
  any script on the page and keeps the form working before JavaScript loads — on the one page whose
  failure locks staff out of the tool.
- **The guard is checked twice**, once in the middleware and once structurally in
  `app/admin/(protected)/layout.tsx`. They fail differently: the middleware is a matcher pattern that
  a later edit can silently stop applying, while the layout protects a new page because of where its
  file sits. **Neither is the real boundary.** Row-level security is, and it would hold with both of
  them deleted.

---

## Design direction

**Warm and human.** A warm off-white base, warm neutral surfaces, and a single grounded sage accent
carrying every call to action. Terracotta appears sparingly for warmth and is never used on a
control. Generous whitespace, real photography over illustration.

**The reasoning, because it drives everything else:** most childcare websites are designed to look
like they are *for children* — primary colors, bubbly type, cartoon suns. The person actually
choosing is an anxious parent, often on a phone, late at night, comparing three centers. They are
not looking for fun; they are looking for evidence their child will be safe and known. Calm
competence reads as trustworthy. Saturated primaries read as generic.

### Home page structure

| Section | The job it does |
|---|---|
| Header | Phone number as a **tap-to-call button**, not text. Never scrolls away. Highest-converting element on the page |
| Hero | Promise about *your child* ("known by name"), not a claim about the business. Eyebrow line states licensing and age range so a parent knows in one second whether we serve them. The four things parents compare — ratio, years operating, hours, license number — sit in the evidence card filling the hero's other half. Publishing the license number signals nothing to hide |
| Programs | Sorted by age, because a parent arrives knowing their child's age and nothing else |
| A day here | Simple timeline. Answers the question parents are too polite to ask: what actually happens to my child for nine hours |
| Staff | Faces and roles. Caregiver consistency is what parents worry about most |
| Testimonial | One small, specific, believable moment — not "amazing facility, highly recommend" |
| Contact | Address, hours, map. Ends the page on the action we want |

Deliberately absent: forms, chat widgets, and generic stock photography of smiling children —
parents recognize stock instantly, and it costs trust rather than building it.

### Photography — v1 ships no photographs of people

**Decided after `v0.3.0`.** Staff are represented by the monogram initials already built, and
imagery is illustration or photographs of the facility. No photographs of staff, and none of
children.

This mostly ratifies what exists. The site has no images at all today — no `public/` directory, no
image files, no `next/image` anywhere — and that was the built design rather than an omission:
`StaffCard` renders `initialsOf(person.name)`, and both map blocks are commented "a calm block, not
a stock photo". What the decision changes is the future: the monograms are the **finished state**,
not a placeholder waiting for portraits.

**Why.** The center is a fictional placeholder, so any photograph of a person would be stock or
generated. Both fail, and they fail in the same direction:

- **Stock images of children cannot represent a real named center.** Presenting them as this
  center's children and rooms is misrepresentation, and parents notice.
- **Generated photographs of children are the expensive kind of placeholder.** They read as real
  children and are hard to distinguish from real children, so they quietly become a trust problem
  with exactly the audience this site is written for — a parent deciding whether the people here are
  careful. "Those are not our children" is not a conversation worth inheriting.

**What this closes.** Photo-release consent, which was the legal exposure in this section and half
of open question 1. With no photographs of people there is no consent to obtain and no policy to
write.

**What it does not close, and the tripwire.** If this stops being a fictional placeholder and
someone wants real photographs of real children, the consent question returns in full: signed
parental photo-release, per child, before a single image ships. This decision is the reason that
question can be deferred — not a reason it disappeared. Facility photographs — rooms, garden,
reading corner — carry none of this and stay available; `v0.4.0`'s upload feature is scoped to
exactly those.

---

## Scope boundary — what v1 is *not*

- No inquiry form, tour booking, or waitlist
- No parent accounts, child records, attendance, or billing
- ~~No second language shipped (only structured for it)~~ — **reversed on #52, 2026-08-30.**
  German and Italian are being added in `v0.5.0`. The switcher, `hreflang`, sitemap and
  detection policy shipped in #52; the catalogues follow in #53 and #54. See the note under
  *After v1*.
- No payment provider, no transactional email vendor

Netlify has form handling as a built-in platform primitive, so an inquiry form later needs no
backend code and no email vendor. It is deliberately out of v1, but it is the cheapest high-value
addition afterwards — "call us" loses the parent browsing at 10pm after bedtime.

---

## Tech stack

Versions verified against the npm registry on 2026-07-22; Next.js re-verified on 2026-08-05.

| Layer | Choice | Version |
|---|---|---|
| Framework | Next.js (App Router, TypeScript) | 16.3.0 |
| Hosting, CDN, builds | Netlify | — |
| Netlify Next.js runtime | `@netlify/plugin-nextjs` | 5.15.12 |
| Netlify CLI | `netlify-cli` | 26.2.0 |
| Database, auth, storage | `@supabase/supabase-js` | 2.110.8 |
| Migrations | `supabase` CLI (dev dependency) | 2.111.0 |
| Styling | Tailwind CSS | 4.3.3 |
| i18n | `next-intl` | 4.13.4 |
| Testing | Playwright (end-to-end), Vitest (unit) | latest at scaffold |

Photos live in Supabase Storage and are optimized on the fly by Netlify's Image CDN, which Next.js
reaches by setting `remotePatterns` in `next.config.js` — configuration, not custom code.

### Next.js 16 on Netlify — resolved

This was previously carried as an unverified risk. It is now closed with evidence: the published
`@netlify/plugin-nextjs@5.15.12` package gates on

```
SUPPORTED_NEXT_VERSIONS = ">=13.5.0"
```

Open-ended, with no upper bound, so Next.js 16.3.0 passes. The runtime also references Turbopack
internally, which matters because Next 16 builds with Turbopack by default. **No version pin-back is
needed.** This is now confirmed end to end rather than locally: the `v0.1.0` release deployed to
production through the runtime plugin and the site serves prerendered pages.

**Re-checked on 2026-08-05** when Next.js moved 16.2.11 → 16.3.0 for the security bump. The gate in
`@netlify/plugin-nextjs@5.15.12` is unchanged, the production build succeeds, and every locale route
is still reported as prerendered. This claim is re-verified whenever Next.js moves, rather than
assumed to hold.

The one residual is cosmetic and **still present at 16.3.0**. Next 16 deprecated the `middleware`
file convention in favour of `proxy`, so every build prints a deprecation warning for the locale
middleware. It still works and still builds; whether the plugin runs a `proxy.ts` the same way has to
be checked on a real Deploy Preview before renaming the file that every first-time visitor's
`/`→`/en` redirect depends on. Tracked as issue #27 against `v0.3.0` — the 16.3.0 bump did not
resolve it, so it stays open.

### Why Supabase rather than Netlify's own database

Netlify provisions Postgres automatically and gives each deploy preview an isolated database branch,
which is genuinely useful. Supabase is still the choice for one decisive reason: **Netlify's offering
is a database only.** This project also needs staff logins and image storage, and Supabase bundles
Postgres, auth, storage, and row-level security behind one vendor and one bill. Using Netlify's
database would mean adding a third vendor for auth to save nothing.

*Tripwire to revisit:* if the operations platform later makes per-preview database branching valuable
enough to outweigh a separate auth service, reopen this.

---

## Data model

Every content table carries `org_id` from the first migration, with row-level security on from day
one.

### `v0.3.0` is the data layer only

Schema, row-level security, seed data, and pages reading content at build time. **Authentication,
storage, and the staff-editable admin UI are `v0.4.0`**, as the delivery table below has always had
them.

### Entity tables that mirror `lib/`

| Table | Source module |
|---|---|
| `orgs` | Tenancy root. One row in v1 |
| `site_settings` | `lib/center.ts` |
| `programs`, `daily_rhythm` | `lib/programs.ts` |
| `staff` | `lib/staff.ts` |
| `tuition_schedules`, `tuition_rates`, `tuition_fees` | `lib/tuition.ts` |

Columns and constraints are specified on issue #47 and stay there. Repeating a column list in this
document guarantees the two drift, and the migration is the thing that is actually true.

`profiles` landed first, in #72, because every other `v0.4.0` ticket sits on top of it. `media` and
Supabase Storage landed last, in #78 — see below.

### What `profiles` decided, and what it deliberately did not (#72)

`current_org_id()` now reads `public.profiles` instead of returning `NULL`, and **no policy on any
content table was edited** to make that happen — the indirection the first migration paid for is
what let one function body switch the whole release on.

Three decisions worth not re-deriving:

- **`security definer`, with `set search_path = ''`.** The policy on `profiles` calls this function
  and the function reads `profiles`, so without elevation the lookup recurses. The empty search path
  is load-bearing rather than stylistic: a `security definer` function with a mutable path is the
  textbook privilege-escalation shape.
- **`profiles` grants `SELECT` to `authenticated` and nothing else.** Every content policy trusts
  `current_org_id()`, and `current_org_id()` trusts `profiles.org_id` — so a member able to write
  that column could move itself into another organization and gain full write access through
  policies all behaving exactly as designed. There would be no bug anywhere to find. Accounts are
  therefore created and moved by the service role only. *Tripwire:* if #73 or a later ticket wants
  staff to edit their own display name, that needs a column-scoped policy, not a blanket `for all`.
- **`role` (`admin` | `editor`) is recorded but not yet read.** No policy branches on it. It exists
  now because adding a column to a populated table is a data migration and adding it here was free.

*Verified against the database rather than reasoned about:* an `anon` session does **not** need
`EXECUTE` on `current_org_id()` — policies are role-scoped, and no `to anon` policy calls it — while
`authenticated` does, failing with `42501` without it. The first migration granted both on wrong
reasoning; `20260813023402_restrict_current_org_id_to_authenticated.sql` is the correction.

**Accepted risk:** the database linter warns that `authenticated` can call `current_org_id()` over
`/rest/v1/rpc/`. The grant cannot be removed without rewriting the policy on every content table,
and the function takes no arguments and returns the caller's own organization id — a member learns
something it already knew. *Tripwire:* if this function ever takes an argument, that judgement
expires with it.

**Accounts are invite-only. There is no self-service signup.** Decided by the owner on #72: a public
childcare site has no reason to let strangers create accounts. Supabase Auth permits self-signup by
default, so turning it off is an explicit owner task rather than something the schema can enforce —
it is in the prerequisites table below, and #73 builds against it. Note what the schema *can*
enforce, and does: an account with no `profiles` row gets `NULL` from `current_org_id()` and
therefore matches nothing, so a stranger who did sign up would hold a session that can read and
write exactly nothing. The setting is the front door; the missing profile row is the deadbolt.

There is no `faq` or `about` table. Those two pages are almost entirely copy, and copy lives in
`public.prose` (#76) rather than in a table of its own per page — so they have no facts to move.

### Drafts are twin rows (#74)

The first migration gave every content table one row per thing, which left the editor nowhere to put
an edit that is not yet live. Each unique constraint is now **two partial unique indexes** — one
scoped to `status = 'published'`, one to `status = 'draft'` — so a key carries at most one published
row and at most one draft, and the two coexist.

The reasoning, the three rejected alternatives, the promote algorithm `v0.4.0`'s publish step
inherits, and the risks knowingly accepted are in
[`docs/adr/0001-draft-and-published-twin-rows.md`](adr/0001-draft-and-published-twin-rows.md) — the
first ADR in this repository. The one line worth repeating here, because it is the failure that
motivated the whole change: flipping a live row to `draft` would have removed it from the anonymous
read and **failed the next build**, so editing the phone number would have broken the next deploy.

### Publishing is organization-wide, in every language (#116)

One press of Publish promotes every pending draft the organization has, in every locale. The locale
is part of how a draft is matched to its published twin — a German edit can never overwrite the
English row — but it is not part of what the sweep selects, so **there is no such thing as
publishing one language.** `components/admin/PublishPanel.tsx` says so on screen once a second
locale is switchable.

That is a decision, not a limitation waiting to be lifted:
[`docs/adr/0002-publishing-stays-organization-wide.md`](adr/0002-publishing-stays-organization-wide.md)
records why a locale argument has no honest meaning across nine tables when seven of them have no
locale at all, why the risky stretch is already covered by `routing.locales` being code behind a
release tag, and the tripwire that should make us revisit — the first request to hold back one
pending edit, for any reason.

### What the editor decided about keys (#74)

**`key` and `label_key` are not editable, and are never shown.** #74 offered two ways to handle the
integrity risk they carry — prevent the edit, or validate it against the message catalogue at save
time — and the editor takes the first.

Safety is only half the argument. Those columns join a database row to a namespace of copy, so a
staff member renaming `infants` to `babies` would get a blank card on the public site and the
key-coverage test would not notice until the next build. But the simpler reason is #74's own
acceptance bar: *a staff member can complete the whole edit without being told a database column
name.* A `key` **is** a column name, and validating one means showing it.

**The consequence, stated because it is a real limit rather than an oversight: the editor changes
existing content and cannot create it.** Adding a room or a staff member needs a new key *and* its
copy.

*Tripwire, now live:* #76 moved copy into `public.prose`, so the second half of that sentence is no
longer a blocker — a staff member could genuinely add a room once #77 exposes prose editing, and the
open question becomes **how a key is generated rather than whether it is typed**. Note the failure
mode changed with it: a renamed key used to render blank, and now fails the build, because
`i18n/request.ts` throws on a missing message. Louder, and still not a reason to make keys editable.

Two smaller decisions worth not re-deriving:

- **The phone number and email address are one field each, not two.** `site_settings` stores
  `phone_display` beside `phone_href` precisely so the pretty format and the dial target cannot
  disagree — and the surest way to make them disagree is to ask a person to keep both in sync. The
  `tel:` and `mailto:` are derived from what was typed.
- **Only rows that actually changed are written.** The forms post every row, so a naive save would
  draft all three rooms because one ratio was corrected. An "unpublished edit" badge on a row nobody
  touched is a lie, and #75 turns this same set into the publish queue — where spurious entries
  would have a staff member approving changes they never made.

### What `anon` is, and is not, isolated from

Settled while writing the first migration, because it changes what the row-level security suite can
honestly assert.

The anonymous policy is `status = 'published'` and **nothing else** — it is deliberately not scoped
to an organization. Draft rows are invisible to `anon` on every table, which is the guarantee that
matters and is the one being tested. But a second organization's *published* rows would be readable
by anyone holding the anonymous key.

**This is not a hole that can be closed at the policy level.** The anonymous key ships inside the
client bundle by design, so any organization scope it carried would be caller-supplied and therefore
caller-forgeable — a request could simply claim to be another tenant. Scoping `anon` by organization
would look like isolation while providing none, which is worse than not claiming it.

What makes this acceptable rather than merely unavoidable: a published row is content the tenant is
publishing on their own public website. It is not private data that leaked; it is marketing copy
that was already world-readable at its own URL. The private thing is the draft, and the draft is
protected.

*Tripwire to revisit:* the moment a table holds something that is not public marketing copy —
enrolment records, incident notes, anything about an actual child — this reasoning expires
completely. Such a table must not be readable by `anon` under any status, and belongs behind
`authenticated` with a real organization check.

**Consequence for issue #51:** "an anonymous client cannot read another organization's rows" is not
satisfiable as written and should be narrowed to drafts.

### The generic block store is deferred, not built

An earlier draft of this section proposed `pages` (slug, locale, SEO fields, draft-or-published) and
`page_blocks` (`type` plus a `data` JSONB payload): a generic content system in which any page is an
ordered list of untyped blocks.

**That is not what `v0.3.0` builds.** Seven fixed pages do not need an untyped block store. Adopting
one would turn every typed constant in `lib/` into JSON that TypeScript cannot check — `lib/tuition.ts`
currently makes a missing room rate a compile error — and it would buy no editing capability
whatsoever until the admin UI exists. The cost lands this release; the benefit does not.

*Tripwire to revisit:* the admin UI needing genuinely free-form pages — a staff member adding a page
or reordering sections without a developer. That is a legitimate requirement and it may well arrive
with `v0.4.0`. Reopen this decision when it does, rather than bending entity tables into a block
store one column at a time.

### The build clears Next's fetch cache, so Publish cannot serve stale facts

Settled on issue #67, because the publish loop this whole project is built on depends on it.

`next build` writes every `fetch` into `.next/cache/fetch-cache` with a one-year lifetime, and the
content queries go through that patched `fetch`. A rebuild against a warm cache therefore renders
the **previous** content — with no error, no warning, and a deploy reporting success. Reproduced
locally in both directions: with a warm cache a changed `site_settings` row did not reach the built
HTML; after clearing the cache it did.

**`npm run build` now clears `fetch-cache` before and after the build**, via the `prebuild` and
`postbuild` hooks in `package.json`. Nothing else in `.next/cache` is touched — the Turbopack and
TypeScript caches are pure build speed with no correctness stake.

**The obvious fix is the wrong one.** Marking the queries `cache: "no-store"` was tried first and
fails the build: Next 16 treats a no-store fetch as a dynamic API, so every page reading the
center's settings stops prerendering. This document rules out putting Supabase in a visitor's
request path, so that trades a silent staleness bug for a louder architectural one. Clearing the
cache keeps all seven pages prerendered. Deduplication *within* a build is `cache()` in the query
modules and is unaffected.

**Production was never exposed, and that is not why this was fixed.** `@netlify/plugin-nextjs`
`5.15.12` deletes `fetch-cache` before saving the build cache it restores between deploys, so a
Netlify rebuild always fetched fresh rows. That is an undocumented implementation detail of a pinned
version — one line in a bundled file — not a guarantee anyone promised us. The correctness of the
publish loop now rests on this repository instead of on a transitive dependency's internals.

**Tripwire:** if a future runtime bump makes builds slower and someone reaches for "restore more of
the cache", this decision is the reason not to. `scripts/clear-fetch-cache.test.mjs` fails if the
script or its hooks are removed.

### Editable prose stayed in `messages/*.json` for `v0.3.0` — and moved in `v0.4.0`

> **Settled by #76.** Prose is in the database. The `v0.3.0` reasoning is kept below because it is
> still the reason the two releases were split this way, and because a reader who remembers the old
> decision should be able to see what replaced it rather than find the section quietly rewritten.

Only facts moved to the database in `v0.3.0`. Room names, staff bios, headings, FAQ answers, and
every other piece of visible copy stayed in the message catalogues, keyed by the `key` and
`label_key` columns above.

**The cost, stated plainly rather than discovered later:** when `v0.3.0` shipped, center staff still
could not edit a single word of copy. Every fact on the site became editable and no sentence did.
`/faq` and `/about`, which are almost entirely prose, gained nothing at all.

**The migration did not disappear — it moved**, and #76 is where it landed.

#### What #76 decided

**The shape: one row per `(locale, namespace, key)`** in `public.prose`. The catalogue is exactly
two levels deep, so `namespace` and `key` are separate columns rather than one dotted string — the
editor in #77 can then `order by namespace, key` instead of parsing.

Two alternatives were rejected, and the reason is the same in both cases — publishing:

- **A JSONB column keyed by locale** stores one row per string with `{"en": …, "de": …}`. Draft and
  published are per row, so the whole multi-locale blob promotes as a unit and you could not ship an
  English typo fix without also publishing a half-finished translation sitting beside it. The
  draft/published twin makes that a real loss rather than a theoretical one.
- **A separate translations table** is correct and buys nothing: the key table would carry no column
  the join key does not already carry.

One row per locale also degenerates well. With one shipped locale it is one row per string, exactly
what a locale-less table would have been, so the locale column costs nothing now and is the thing
that would be expensive to retrofit once the rows hold copy.

**The read path merges, so no call site changed.** `i18n/request.ts` assembles the catalogue from
the database and hands it to next-intl as `messages`. Every `t("FaqPage.answer")` still works, ICU
interpolation still works for the 19 strings carrying placeholders, and the end-to-end suite passed
unedited — which is what proves the copy did not move by accident.

**The database is still not in a visitor's request path.** Every public route remains prerendered,
so this runs at build time alongside the fact queries. The build output is the check: seven public
routes marked `●` and only `/admin/*` marked `ƒ`.

**Chrome stays in `messages/<locale>.json`** — three strings, all of them naming the interface
rather than the center: the primary-nav aria-label and the open/close menu buttons. The test
`tests/content/message-keys.test.ts` pins that list, so copy cannot drift back out of the database
one string at a time.

**A missing string now fails the build**, matching how a missing fact already behaves. Previously it
rendered as a blank region, which reads as a CSS bug and sends whoever finds it looking in the wrong
place.

**The backfill was proven lossless by digest**, not by eye: 279 rows, md5
`5c1835181bb32db57ea6381147f53257` on both the database and the pre-migration catalogue.

### What the copy editor decided (#77)

Copy is editable at `/admin/copy`, on the same draft-then-publish path as facts.

**Grouped by where the words appear, not by namespace.** Thirteen groups, ordered the way a parent
moves through the site. 279 strings is a *finding* problem before it is an editing one, and a staff
member knows the typo is on the FAQ page and nothing about how it is stored. Each group carries its
own count of unpublished edits; one total at the top would say "you have edits somewhere", which is
the state that sends someone opening all thirteen.

**A `{placeholder}` cannot be deleted.** Twenty strings interpolate a value at render time.
next-intl throws on a message missing one, and since #76 that throw fails the build — so the edit
would save, publish, and break the next deploy minutes later with nothing connecting the two.
`FieldReader.prose` refuses it and names the placeholder; the required list is re-derived
server-side, never read from the form.

Since #111 that list comes from the **default locale's** row rather than from the row being edited.
The distinction does not matter with one language and is the whole thing with two: a German row that
has already lost `{ageRange}` would validate against itself and stay broken forever. A translator
may reorder placeholders — German grammar often demands it — but may not drop one.

**The field label is derived from the key**, so `placeWaitlistAnswer` reads "Place waitlist answer".
This bends #74's *never show a column name*, knowingly: a prose row has no name column, its key is
the only handle it has, and a form field still needs an accessible name. The alternative was 279
hand-written labels to keep in step with the rows — the duplicated join #76 just finished removing.
*Tripwire:* if these labels start being read as identifiers rather than as headings, the answer is a
`label` column, not a cleverer transform.

**The length limit is per group**, half again the longest string it holds, floored at 120. One fixed
limit is useless across a range running from "Infants" to a 276-character FAQ answer. Derived from
the same rows in the form and in the action, so the number shown is the number checked.

**No locale picker.** Every function takes a locale; nothing renders a control, because one shipped
locale makes it a menu with one item.

**Still not possible: creating content.** Adding a room or a staff member needs a new key, and the
open question is how a key is generated rather than whether it is typed. #76 lifted the blocker
(copy is editable now); the question itself is untouched.

### What the photograph upload decided (#78)

One picture per room, uploaded at `/admin/photos` and rendered on `/programs`. The first untrusted
input this system has ever accepted, so most of the decisions are about the boundary.

**Spaces, never people.** Rooms, the garden, the entrance. This is the existing "no photographs of
people" decision applied, and it is what keeps this feature free of any consent dimension — there is
nobody in the frame to obtain consent from. It is stated on the upload screen itself, not only here,
because that is where someone would otherwise break it.

**The bucket is public, decided rather than defaulted.** The public site is **prerendered**, so a
signed URL would be baked into a page and then expire, showing broken images some hours after every
deploy. Making signing work would mean re-signing at request time — which puts Supabase in a
visitor's request path, ruled out above — or a lifetime so long it is public in all but name. These
are pictures of empty rooms on a marketing site; there is nothing to protect. **Public means
readable, not writable:** every write is governed by policies on `storage.objects`, covered by
`tests/rls/storage.test.ts`.

**The type is read from the bytes, never from the header.** A browser sets a file's type from its
extension, so renaming `payload.svg` to `room.png` is enough to make it claim to be an image. SVG is
the format that matters — it is a document that can carry script — and it cannot pass a signature
check for JPEG, PNG or WebP. The bucket restates the same three in `allowed_mime_types`, so the
application check is the first gate and not the only one.

**Storage paths are `<org_id>/<key>-<timestamp>.<ext>`.** The first segment is the tenancy boundary,
compared against `current_org_id()` by the storage policies — not a naming convention. The timestamp
is what makes replacing a photograph safe: writing to a stable path would overwrite the bytes the
**published** row still points at, so uploading a draft would change the live site immediately. The
cost is that replaced images are left in the bucket; at three photographs that is a rounding error,
and deleting on publish would race an in-flight build.

**A missing image does not fail the build**, which is a deliberate exception to the rule that a
missing fact does. `v0.4.0` ships with an empty bucket and the first upload happens after the
release, through the admin — so failing on absence would mean the site could not build until someone
uploaded three files. The `/programs` card renders no image and reserves no space for one, so a room
without a photograph reads as complete rather than broken. A **failed query** is still fatal; only
emptiness is tolerated.

**`remotePatterns` is narrowed to one host and one path prefix.** `next/image` re-serves anything it
matches, so a wildcard host turns the site's image endpoint into an open proxy. It is derived from
`NEXT_PUBLIC_SUPABASE_URL` rather than hardcoded, so a preview pointed at another project does not
silently fail to render every image.

Why that is the right trade: the two halves fail differently. A wrong ratio or a wrong monthly rate
is a fact a parent acts on, and those are exactly the values that were duplicated across pages before
`lib/` centralised them — so they are the ones worth putting behind a single editable source first.
Prose is already single-sourced in the catalogues and is safe where it is until there is an editor to
edit it with.

**Row-level security rules:**
- Anonymous role: `SELECT` only, only rows where `status = 'published'`.
- Authenticated staff: full CRUD, only where `org_id` matches their own profile's `org_id`.
- **The service-role key is never stored in Netlify or CI.** The build reads only published content,
  which the anonymous key can already do under RLS; the admin writes as the logged-in staff user's
  own session. The one genuinely high-value credential therefore never leaves the Supabase
  dashboard.

**On multi-tenancy, honestly:** for one center's brochure site, `org_id` buys nothing today. It costs
roughly half a day now. Its entire value is that the operations platform inherits a correctly scoped
schema instead of needing a data migration under live child records.

---

## Site structure

```
/                 Home
/programs         Age-banded programs and daily rhythm
/about            Philosophy, licensing, safety and staff ratios
/staff            Team bios
/tuition          Rates and schedule options
/faq              Common parent questions
/contact          Phone, email, address, map, hours, directions
/privacy          Legal
/admin/*          Staff-only, behind Supabase Auth
```

Routes are locale-prefixed (`/[locale]/...`), `en` default and — until #53 or #54 lands — still the
only shipped locale. The switcher, `hreflang` and per-locale sitemap entries shipped in #52 and are
gated on `routing.locales.length > 1`, so they are present in the code and invisible on the site.
There is deliberately **no `Accept-Language` redirect** (#52): it surprises people whose browser
language is not the one they want to read licensing details in, and a response that varies on a
request header cannot be a static file at the edge.

Every page gets metadata; the site emits `sitemap.xml`. Note that the single biggest lever for a
child care center being found is the **Google Business Profile**, which is an owner task, not a code
task.

**Not built, despite what this paragraph used to claim:** OG images, `LocalBusiness` / `ChildCare`
JSON-LD, and `robots.txt`. They were written here as though they existed; only `sitemap.xml` does,
and only since #52. Corrected in the #52 docs sweep rather than left as a plan that reads like a
description of the site.

---

## Delivery plan

`v0.1.0` is deliberately small. Its purpose is not the home page — it is to prove the whole delivery
pipeline works end to end, with one page as the payload. Everything after it rides rails that have
already been tested.

### v0.1.0 — home page live, pipeline proven

Three pull requests:

| PR | Contents |
|---|---|
| 1 | Next.js + TypeScript + Tailwind scaffold, `netlify.toml`, CI workflow |
| 2 | The home page, plus one Playwright test that loads it cold and asserts the real content renders |
| 3 | Release workflow, `.github/release.yml`, and the PR labels that drive grouped notes |

Then: publish GitHub Release `v0.1.0` → production deploys.

### Beyond v0.1.0

| Version | Contents |
|---|---|
| `v0.2.0` | Remaining static pages: programs, about, staff, tuition, FAQ, contact |
| `v0.3.0` | Supabase schema, RLS, seed data; content read from the database at build time |
| `v0.4.0` | Auth and storage: staff login, content editor, prose migration, image upload, publish triggers rebuild |
| `v1.0.0` | Launch prep: real content, performance and accessibility pass, legal pages, domain |

---

## How work reaches production

- Every change is a branch and a pull request, with a description written for someone who never saw
  the ticket.
- CI gates the merge: typecheck, lint, build, Playwright.
- Every PR gets a **Netlify Deploy Preview** at its own URL.
- Merging to `main` **does not deploy.** `main` is not Netlify's production branch — that is a
  placeholder branch that never receives commits — so a merge to `main` is only a non-production
  branch deploy. The site is intentionally unlocked so the release workflow can publish via the CLI.
- **Publishing a GitHub Release** creates the tag and fires the production deploy.

**Rollback** is republishing the previous Netlify deploy — seconds, no rebuild, no revert commit.

### Release notes

There is no `CHANGELOG.md` and there will not be one. GitHub Releases is the permanent, browsable
record: every version, dated, with notes, linked to the exact commits and diffs.

Notes are auto-generated from merged pull requests and grouped under headings by a
`.github/release.yml` file. **GitHub groups by PR label, not by commit message** — it cannot infer a
heading from a `feat:` prefix. Every PR therefore carries a label matching its Conventional Commit
type (`feature`, `fix`, `chore`, `docs`, `ci`, `deps`), applied when the PR is opened. A missing
label is harmless: the PR falls into an "Other" group.

Version numbers follow from the commit types since the last release — any `feat:` means a minor
bump, only `fix:` means a patch, a `!` means major.

### Two gates from `v0.4.0`

Through `v0.3.0` there was one gate: production was gated at the release rather than at PR review,
so **`main` could contain code the owner had not reviewed**. That was deliberate — owner attention
on running software rather than on diffs — and it fitted seven read-only prerendered pages, where a
Deploy Preview showed a reviewer exactly what a visitor would get.

**From `v0.4.0` the owner also reviews every pull request before it merges.** The release remains
the production gate; review is added ahead of it, not substituted for it. The reason is that
`v0.4.0` writes to the database, authenticates real sessions, accepts uploaded files, and adds the
first dynamic routes — and a Deploy Preview cannot show a reviewer what an *unauthorized* visitor
reaches, which is exactly where those failures live. `docs/CONVENTIONS.md` carries the full
reasoning.

The cost is the one that was being avoided: owner time goes on diffs again, and merges wait on a
human. That is accepted for a release that takes untrusted input for the first time.

---

## Prerequisites — owner tasks

| Task | Status |
|---|---|
| Netlify account | **Done** |
| Netlify site created and connected to the repo | **Done** |
| Production gated to releases: site unlocked, production branch a placeholder, `main` a branch deploy | **Done** |
| `NETLIFY_AUTH_TOKEN` secret + `NETLIFY_SITE_ID` variable in GitHub Actions | **Done** |
| Supabase project created, URL and anon key published to GitHub and Netlify | **Done** — project `kdhtodcmxgxfnxrbkkzp`, `us-west-1` (issue #44) |
| Supabase database password to hand, for the first `supabase db push` | **Needed for issue #47.** A different credential from the anon key; prompted for at the terminal, never committed |
| Self-service signup turned off in Supabase Auth | **Done** (#72). Dashboard → Authentication → Sign In / Providers → "Allow new users to sign up" disabled. Supabase allows it by default, so this was an explicit step and it is the control that enforces invite-only — the sign-in page having no signup link enforces nothing |
| Test account `rls-fixture@example.com` created, and `SUPABASE_TEST_PASSWORD` set as a GitHub **secret** | **Done** (#72). The third step is the one that was missed and will be missed again: creating the account is not enough, `supabase/fixtures/rls.sql` must then be re-run to insert its `profiles` row. Without it `current_org_id()` returns `NULL` and the suite fails as a *policy* error rather than as the setup error it is |
| `GITHUB_PUBLISH_TOKEN` set in **Netlify's** environment variables | **Needed for #75's Publish button to reach production.** A GitHub fine-grained token scoped to this repository with **Actions: read and write** only. Netlify rather than GitHub Actions — that is where the admin runs, and CI must never be able to rebuild production. Without it, publishing still promotes the drafts and says plainly that the rebuild did not start |
| Owner account in the `willow-grove` organization | **Needed to use the admin on real content** — issue #87. The fixture account is in a different organization by design |
| Domain purchased, DNS pointed at Netlify | Needed before `v1.0.0` |
| Google Business Profile created or claimed | Needed before `v1.0.0` |

**Secrets policy.** Account logins are never shared with or held by the assistant. Project keys are
set by the owner directly in the Netlify UI or GitHub secrets — never pasted into a conversation,
never committed. `.env*` is gitignored; a committed `.env.example` lists variable names only. The
Supabase anon key and project URL are public by design and are not treated as secrets; row-level
security is what protects the data.

**Costs.** Domain roughly $15/year. Netlify and Supabase free tiers fit a site this size. Two figures
still to confirm: Netlify's current free-tier build-minute allowance, and whether Supabase still
pauses free projects after inactivity — the architecture makes a paused database survivable for
visitors either way. Realistic ongoing cost: **$0–40/month**.

---

## Verification approach

**In CI on every PR:** typecheck, lint, production build, and Playwright against a **cold
first-time page load** — no warm cache, no logged-in state, because that is how every visitor
actually arrives. From `v0.3.0`, an RLS suite asserting an anonymous client cannot read draft rows
and cannot write to any table — narrowed from "or another organization's rows", which the section
above explains is not satisfiable and would be a claim of isolation that does not exist. Alongside
it, a content-key suite asserting every key the database returns has copy in every catalogue: the
join that `as const` used to check and the compiler no longer can.

From `v0.4.0` (#72) a second RLS suite runs beside it, signing in as a real account and asserting the
half the anonymous suite cannot: a member reads and writes exactly its own organization's rows,
drafts included, is refused on every other organization's, and cannot move itself between them. It
signs in for real because `current_org_id()` resolves from the session's `auth.uid()` — there is
nothing client-side to stub. That makes it the one CI step carrying a genuine secret, and the reason
the account belongs to the fixture organization rather than to the live center: a member can write
everything its organization owns, so this credential's blast radius is deliberately two rows whose
text reads "FIXTURE — must never be visible".

### The recovery scripts are verified against a throwaway database (#98)

`seed.sql` and `fixtures/rls.sql` are applied by hand and ran in no test. #93 found both had been
unapplicable since #86 — several weeks — because the twin-rows migration replaced each unique
constraint with two partial unique indexes and `on conflict (cols)` could no longer name one.
Nothing reported it. The person most likely to find out is someone restoring a broken database.

A `seed` job now applies both files to a **local Supabase stack started inside the CI job**, twice
more after `db reset`, and fails if a row identifier or content value moved or if a planted draft
did not survive.

**The decision that needed making was where CI gets a database**, since it has no write-capable
credential and `docs/CONVENTIONS.md` deliberately keeps the service-role key out of every
environment. Three options were costed on #98; the owner chose the local stack. The reasoning:

- A **scratch Supabase project** or a **Supabase branch per run** were both rejected as
  unnecessary rather than as too expensive. Once the database is throwaway, no credential is
  needed at all — and a branch bills by the hour for something that runs on every pull request.
- A **plain Postgres service container** would have been faster, but the migrations reference
  `auth.users`, `auth.uid()`, `storage.buckets`, `storage.objects` and `storage.foldername()`. It
  would have needed a hand-written shim of all of that, and a shim is a reconstruction that drifts
  from the thing it stands in for.
- The **local stack** runs the real Auth and Storage schemas, so the migrations apply exactly as
  they do in production. It costs image pulls on a runner, which are free on a public repository.

**This does not reverse "there is no local database".** That constraint is about the development
machine, which has no Docker; `supabase/migrations/README.md` now says so precisely. Migrations are
still hand-written and still applied through the management connector against the one hosted
project.

**The tripwire that should make us revisit:** if the `seed` job starts being the reason CI is slow,
or if keeping `config.toml` in step with the hosted project becomes its own maintenance task, the
Postgres-container option is the fallback and the shim is the price.

**Per milestone:**
- `v0.1.0` — merging main leaves production untouched; publishing the release deploys it; rollback
  by republishing the previous deploy works. **Rollback is tested before it is needed.**
- `v0.2.0` — every page reviewed on a Deploy Preview on a real phone, not a resized desktop window
- `v0.3.0` — flip a row to `published`, rebuild, confirm it appears
- `v0.4.0` — full staff loop: log in → edit a bio → upload an image of a room → publish → live
  within ~2 minutes. Then log out and confirm `/admin` is unreachable.
- `v1.0.0` — Lighthouse against the production domain, structured data validated with Google's Rich
  Results Test, keyboard-only pass through every page

---

## Open questions

1. **Real center details.** When this stops being a fictional placeholder, the name, address, phone,
   license number, and age ranges are needed. Photography consent is no longer part of this
   question — v1 ships no photographs of people, which is decided above along with the tripwire that
   would reopen it.
2. **What the center differentiates on.** The hard part of a marketing site is the positioning, not
   the code. Copy quality decides whether this converts.
3. **Analytics.** Netlify's own analytics is a paid add-on; a lightweight privacy-friendly
   alternative is likely better. Decide before `v1.0.0`.
4. **Whether owner review before merge outlives `v0.4.0`.** It was added because `v0.4.0` writes,
   authenticates, and accepts uploads. Deliberately not decided here — whoever plans `v1.0.0` should
   decide it against that release's risk, not inherit this one's. The question to ask then is
   whether a Deploy Preview would show a reviewer the failure; when it would, the older
   release-gated model is defensible again.

---

## After v1

Not in scope, listed so sequencing is visible: inquiry form (first, and cheap on Netlify) → tour
booking → waitlist → ~~second language~~ → then the operations platform (enrollment records,
attendance, daily reports to parents, billing). The multi-tenant-ready schema and Supabase Auth are
what that platform would stand on.

### The second language moved to the front — #52, 2026-08-30

**This reverses the sequencing above**, and the reversal is recorded rather than quietly edited in,
because the ordering was a real decision and so is changing it.

The original argument put a second language behind the inquiry form, tour booking and the waitlist:
those three convert a browsing parent into a conversation, and a translation does not. That argument
is still sound *for a real center*. It was overtaken by what this project actually is — a practice
project with no real users, where the fictional placeholder location means the languages a Northwest
Portland neighbourhood really speaks was never a live consideration. German and Italian were chosen
as an engineering exercise in running three locales, not as a market decision.

**The risk consciously accepted:** the site gains roughly 8,000 words of machine-translated copy that
nobody on the project reads natively, and a translated page carries the same licensing and safety
details as the English one. That is acceptable here precisely because no parent is reading it. It
would not be on a real center's site, and **the tripwire is exactly that** — if this ever became a
live site for a real center, the translations need a native reviewer before launch, not after.

Split across three tickets so a stall in one language cannot block the other: #52 is the switcher and
SEO infrastructure (no new language), #53 is German, #54 is Italian.
