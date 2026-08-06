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
| Visual direction | **Warm and human** — warm neutral base, single sage accent, photography-led |
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
- When staff press **Publish**, the app calls a **Netlify build hook**, the site rebuilds, and
  Netlify swaps in the new deploy — roughly 1–2 minutes end to end.

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

### Photography risk

Placeholder imagery is agreed for the build. Two things must be true before a real launch:

- **Stock images of children cannot represent a real named center.** Presenting them as this
  center's children and rooms is misrepresentation, and parents notice.
- **Real photographs of children require signed parental photo-release consent.** This is legal
  exposure, not technical. If releases are not obtainable, the design works with photographs of the
  facility instead — rooms, garden, reading corner — which perform nearly as well.

---

## Scope boundary — what v1 is *not*

- No inquiry form, tour booking, or waitlist
- No parent accounts, child records, attendance, or billing
- No second language shipped (only structured for it)
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

`profiles`, `media`, and Supabase Storage arrive with the admin UI in `v0.4.0`. Nothing writes to the
database in `v0.3.0`, so a user table and an upload table would be schema with no caller.

There is no `faq` or `about` table. With prose staying in the message catalogues — see below — those
two pages have no facts to move.

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

### Editable prose stays in `messages/*.json` for `v0.3.0`

Only facts move to the database this release. Room names, staff bios, headings, FAQ answers, and
every other piece of visible copy stay in the message catalogues, keyed by the `key` and `label_key`
columns above.

**The cost, stated plainly rather than discovered later:** when `v0.3.0` ships, center staff still
cannot edit a single word of copy. Every fact on the site becomes editable and no sentence does.
`/faq` and `/about`, which are almost entirely prose, gain nothing at all.

**The migration does not disappear — it moves.** `v0.4.0`'s admin UI needs a second migration to
bring prose into the database, together with a decision about how translated copy is stored per
locale. That work is deferred, not avoided, and `v0.4.0` should be estimated knowing it is there.

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

Routes are locale-prefixed (`/[locale]/...`), `en` default and only shipped locale.

Every page gets metadata and OG images; the site emits `LocalBusiness` / `ChildCare` JSON-LD,
`sitemap.xml`, and `robots.txt`. Note that the single biggest lever for a child care center being
found is the **Google Business Profile**, which is an owner task, not a code task.

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

### An accepted consequence

Because production is gated at the release rather than at PR review, **`main` may contain code the
owner has not reviewed**, and changes bundle between releases. That is deliberate: owner attention
goes on running software rather than on diffs. The consequence to accept is that when something
breaks after a release, the suspect list is a batch rather than a single PR. Deploy Previews are the
mitigation — every change is viewable before it merges.

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
above explains is not satisfiable and would be a claim of isolation that does not exist.

**Per milestone:**
- `v0.1.0` — merging main leaves production untouched; publishing the release deploys it; rollback
  by republishing the previous deploy works. **Rollback is tested before it is needed.**
- `v0.2.0` — every page reviewed on a Deploy Preview on a real phone, not a resized desktop window
- `v0.3.0` — flip a row to `published`, rebuild, confirm it appears
- `v0.4.0` — full staff loop: log in → edit a bio → upload a photo → publish → live within ~2
  minutes. Then log out and confirm `/admin` is unreachable.
- `v1.0.0` — Lighthouse against the production domain, structured data validated with Google's Rich
  Results Test, keyboard-only pass through every page

---

## Open questions

1. **Real center details.** When this stops being a fictional placeholder, the name, address, phone,
   license number, and age ranges are needed — plus a decision on photography consent.
2. **What the center differentiates on.** The hard part of a marketing site is the positioning, not
   the code. Copy quality decides whether this converts.
3. **Analytics.** Netlify's own analytics is a paid add-on; a lightweight privacy-friendly
   alternative is likely better. Decide before `v1.0.0`.

---

## After v1

Not in scope, listed so sequencing is visible: inquiry form (first, and cheap on Netlify) → tour
booking → waitlist → second language → then the operations platform (enrollment records, attendance,
daily reports to parents, billing). The multi-tenant-ready schema and Supabase Auth are what that
platform would stand on.
