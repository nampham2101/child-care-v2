# v1 Plan — Marketing Website

> **Status: DRAFT, under discussion.** This is a working document, not an agreed plan. Sections
> marked **Agreed** reflect decisions already made. Sections marked **Proposed** are one
> recommendation among possible options and have not been signed off. The open questions at the
> bottom are unresolved.

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

| Decision | Call |
|---|---|
| Product shape | One center now, built multi-tenant-ready |
| v1 scope | Marketing website |
| Conversion | No forms. Call / email / visit us |
| Content editing | Center staff, via an admin UI |
| Brand and copy | None yet — scaffold placeholders |
| Languages | English now, structured for a second later |
| Human gate | Owner gates at the release tag |
| Hosting | Netlify |
| App and data | Next.js + Supabase |

---

## Proposed architecture

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
must say *"Publishing — live in about two minutes"* rather than implying it was instant. If that
ever becomes annoying, the upgrade path is Netlify's on-demand revalidation, and it is contained.

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

## Proposed stack

Versions verified against the npm registry on 2026-07-22.

| Layer | Choice | Version |
|---|---|---|
| Framework | Next.js (App Router, TypeScript) | 16.2.11 — see risk below |
| Hosting, CDN, builds | Netlify | — |
| Netlify Next.js runtime | `@netlify/plugin-nextjs` | 5.15.12 |
| Netlify CLI | `netlify-cli` | 26.2.0 |
| Database, auth, storage | `@supabase/supabase-js` | 2.110.8 |
| Styling | Tailwind CSS + shadcn/ui | 4.3.3 |
| i18n | `next-intl` | 4.13.3 |
| Testing | Vitest, Playwright | latest at scaffold |

Verified local toolchain: Node v24.14.0, npm 11.9.0, git 2.53.0, gh 2.96.0. No Docker required.

Photos live in Supabase Storage and are optimized on the fly by Netlify's Image CDN, which Next.js
reaches by setting `remotePatterns` in `next.config.js` — configuration, not custom code.

### Why Supabase rather than Netlify's own database

Netlify provisions Postgres automatically and gives each deploy preview an isolated database branch,
which is genuinely useful. Supabase is still the recommendation for one decisive reason: **Netlify's
offering is a database only.** This project also needs staff logins and image storage, and Supabase
bundles Postgres, auth, storage, and row-level security behind one vendor and one bill. Using
Netlify's database would mean adding a third vendor for auth to save nothing.

*Tripwire to revisit:* if the operations platform later makes per-preview database branching valuable
enough to outweigh a separate auth service, reopen this.

---

## Known risk: Next.js 16 support on Netlify

**Unverified.** Next.js 16.0.0 shipped 2025-10-22, and `@netlify/plugin-nextjs` has published five
stable releases since (most recently 2026-06-18), all in the 5.15.x line. Support is *likely* fine,
but the package declares no peer-dependency range and this could not be confirmed against Netlify's
documentation at the time of writing.

**Resolution:** a ~30-minute deploy spike is the first task of M0, before any real code. Deploy a
throwaway Next.js app to Netlify and confirm static generation, server-rendered routes, and the
build hook all work.

**Fallback:** pin Next.js 15.5.21. Nothing in this project needs a Next 16 feature, and being one
major behind on a brochure site costs nothing.

---

## Proposed data model

Every content table carries `org_id` from the first migration, with row-level security on from day
one.

| Table | Purpose |
|---|---|
| `orgs` | Tenancy root. One row in v1. |
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
- The service-role key is used only in the server-side build and publish path, never sent to a
  browser, stored as a Netlify environment variable.

Localized tables carry a `locale` column, seeded `'en'` only. Adding a language later is a
translation job — inserting rows — not a schema migration.

**On multi-tenancy, honestly:** for one center's brochure site, `org_id` buys nothing today. It costs
roughly half a day now. Its entire value is that the operations platform inherits a correctly scoped
schema instead of needing a data migration under live child records.

---

## Proposed site structure

```
/                 Home — hero, philosophy, programs teaser, call-us CTA
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

## Proposed delivery plan

| # | Milestone | Ships | Tag |
|---|---|---|---|
| **M0** | Foundations | Netlify + Next.js deploy spike **first**, then CI, Netlify site, empty app deploying | `v0.1.0` |
| **M1** | Design system + full static site | All pages with placeholder copy and image slots, responsive, SEO, JSON-LD, a11y baseline. Content still hardcoded. | `v0.2.0` |
| **M2** | Database + build-time read path | Supabase schema, RLS, seed data; site reads content from the database at build time | `v0.3.0` |
| **M3** | Admin UI | Supabase Auth login, block editor, image upload, draft → publish, build-hook trigger | `v0.4.0` |
| **M4** | Launch prep | Real content, performance and accessibility pass, legal pages, domain, analytics | `v1.0.0` |

**M1 is deliberately front-loaded** so a complete clickable site exists on a Deploy Preview before
any database work begins — the cheapest moment to change direction.

Rough shape: M0 ~2 days, M1 ~1 week, M2 ~3 days, M3 ~1 week, M4 ~3 days. Call it **3–4 weeks** to a
launchable v1, with content-writing time the main external variable.

Release process and PR policy are defined in [`CONVENTIONS.md`](CONVENTIONS.md).

---

## Prerequisites — owner tasks

Front-loaded so none surface mid-build.

**Before M0:**
- Netlify site created, with **automatic production publishing turned off** so only tags deploy
- Supabase project created (region near the center's families)

**Before launch:**
- Domain purchased, DNS pointed at Netlify
- Real center name, address, phone, and license number decided — or confirmation that we launch with
  clearly fictional placeholders
- **Google Business Profile created or claimed**

**Flagged risk — parental photo consent.** Publishing photographs of children on a public website
requires signed parental photo-release consent. This is legal exposure, not technical, and it has
stalled launches before. If releases are not in hand, M1's design must work with photographs of the
*facility* instead — a design constraint that must be known early, not late.

**Costs.** Domain roughly $15/year. Netlify and Supabase both have free tiers that fit a site this
size. Two figures to confirm rather than take on trust, as they could not be verified at the time of
writing: Netlify's current free-tier build-minute allowance (historically 300/month — at a ~2-minute
build, roughly 150 content publishes per month, ample here), and whether Supabase still pauses free
projects after inactivity. The architecture makes a paused database survivable for visitors either
way. Realistic ongoing cost: **$0–40/month**.

---

## Verification approach

**In CI on every PR:** typecheck, lint, Vitest, Playwright against a cold first-time page load,
a Lighthouse budget (performance and accessibility ≥ 95 on `/`, `/programs`, `/contact`), and an RLS
suite asserting an anonymous client cannot read draft rows or another organization's rows.

**Per milestone:**
- **M0** — spike deploys and runs on Netlify; Next.js version pin decided and recorded as an ADR
- **M1** — reviewed on a Deploy Preview on a real phone, not a resized desktop window
- **M2** — flip a row to `published`, rebuild, confirm it appears
- **M3** — full staff loop: log in → edit a bio → upload a photo → publish → build hook fires →
  live within ~2 minutes. Then log out and confirm `/admin` is unreachable.
- **M4** — Lighthouse against the production domain, structured data validated with Google's Rich
  Results Test, keyboard-only pass through every page

**Release:** tag `v1.0.0`, confirm production deploys only on the tag, then confirm rollback by
republishing the previous deploy. Rollback is tested before it is needed.

---

## Open questions

Unresolved and not assumed:

1. **Is the delivery plan above the right shape at all?** The milestone breakdown is a proposal.
2. **Does Netlify's runtime support Next.js 16?** Resolved by the M0 spike; fallback is pinning 15.
3. **Real center or placeholder?** Whether this launches for an actual named, licensed center
   changes the content, the legal pages, and the launch checklist.
4. **Are parental photo releases obtainable?** Determines whether the design can use photographs of
   children at all.
5. **Analytics choice.** Netlify's own analytics is a paid add-on; a lightweight privacy-friendly
   alternative is likely better. Decide at M4.

---

## After v1

Not in scope, listed so sequencing is visible: inquiry form (first, and cheap on Netlify) → tour
booking → waitlist → second language → then the operations platform (enrollment records, attendance,
daily reports to parents, billing). The multi-tenant-ready schema and Supabase Auth are what that
platform would stand on.
