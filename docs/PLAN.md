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

**The public website is a pile of static files. The database is never in a visitor's request path.**

- **Public pages** are generated at build time into plain HTML and served from Netlify's CDN.
- **The admin area** (`/admin/*`) is server-rendered and talks to Supabase live. Only staff reach it.
- When staff press **Publish**, the app calls a **Netlify build hook**, the site rebuilds, and
  Netlify swaps in the new deploy — roughly 1–2 minutes end to end.

Regenerating the whole site on publish, rather than revalidating individual pages, means depending
only on the most basic and most reliable thing the Next.js adapter does — server-render the admin —
and not on incremental-regeneration behavior that varies between hosting adapters. It also plays to
what Netlify is genuinely good at: serving immutable static deploys and rolling between them
instantly.

What it buys:

- **Speed and SEO** — static HTML from a CDN is the fastest thing to serve, and for a local business
  page speed is both a ranking input and a bounce-rate input.
- **Resilience** — if Supabase is paused or down, the public site is unaffected. Only the admin is.
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
| Hero | Promise about *your child* ("known by name"), not a claim about the business. Eyebrow line states licensing and age range so a parent knows in one second whether we serve them |
| Trust strip | The four things parents compare: ratio, years operating, hours, license number. Publishing the license number signals nothing to hide |
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

Versions verified against the npm registry on 2026-07-22.

| Layer | Choice | Version |
|---|---|---|
| Framework | Next.js (App Router, TypeScript) | 16.2.11 |
| Hosting, CDN, builds | Netlify | — |
| Netlify Next.js runtime | `@netlify/plugin-nextjs` | 5.15.12 |
| Netlify CLI | `netlify-cli` | 26.2.0 |
| Database, auth, storage | `@supabase/supabase-js` | 2.110.8 |
| Styling | Tailwind CSS | 4.3.3 |
| i18n | `next-intl` | 4.13.3 |
| Testing | Playwright; Vitest when there is logic to unit-test | latest at scaffold |

Photos live in Supabase Storage and are optimized on the fly by Netlify's Image CDN, which Next.js
reaches by setting `remotePatterns` in `next.config.js` — configuration, not custom code.

### Next.js 16 on Netlify — resolved

This was previously carried as an unverified risk. It is now closed with evidence: the published
`@netlify/plugin-nextjs@5.15.12` package gates on

```
SUPPORTED_NEXT_VERSIONS = ">=13.5.0"
```

Open-ended, with no upper bound, so Next.js 16.2.11 passes. The runtime also references Turbopack
internally, which matters because Next 16 builds with Turbopack by default. **No version pin-back is
needed.** A scaffolded Next 16 app was confirmed locally to typecheck, lint, build, and prerender
its route as static. The first real Netlify deploy remains the end-to-end confirmation.

### Why Supabase rather than Netlify's own database

Netlify provisions Postgres automatically and gives each deploy preview an isolated database branch,
which is genuinely useful. Supabase is still the choice for one decisive reason: **Netlify's offering
is a database only.** This project also needs staff logins and image storage, and Supabase bundles
Postgres, auth, storage, and row-level security behind one vendor and one bill. Using Netlify's
database would mean adding a third vendor for auth to save nothing.

*Tripwire to revisit:* if the operations platform later makes per-preview database branching valuable
enough to outweigh a separate auth service, reopen this.

---

## Proposed data model

Every content table carries `org_id` from the first migration, with row-level security on from day
one.

| Table | Purpose |
|---|---|
| `orgs` | Tenancy root. One row in v1 |
| `profiles` | Staff users → `auth.users`, carries `org_id` and role (`owner` / `editor`) |
| `pages` | Page shell: slug, locale, SEO title and description, draft-or-published |
| `page_blocks` | Ordered content blocks per page — `type` plus `data` JSONB |
| `programs` | Age-banded programs (infant / toddler / preschool / pre-K) |
| `staff` | Team bios and photos |
| `site_settings` | Phone, email, address, hours, map link, social links |
| `media` | Uploaded images: storage path, alt text, dimensions |

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
| `v0.4.0` | Admin UI: staff login, block editor, image upload, publish triggers rebuild |
| `v1.0.0` | Launch prep: real content, performance and accessibility pass, legal pages, domain |

---

## How work reaches production

- Every change is a branch and a pull request, with a description written for someone who never saw
  the ticket.
- CI gates the merge: typecheck, lint, build, Playwright.
- Every PR gets a **Netlify Deploy Preview** at its own URL.
- Merging to `main` **does not deploy.** Netlify's automatic production publishing is disabled.
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
| Netlify site created and connected to the repo | Outstanding |
| Netlify automatic production publishing **disabled** | Outstanding — until this is off, "merging does not deploy" is a claim, not a guarantee |
| Netlify auth token + site ID added to GitHub Actions secrets | Outstanding |
| Supabase project created | Not needed until `v0.3.0` |
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
or another organization's rows.

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
