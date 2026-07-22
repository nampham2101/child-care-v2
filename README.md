# Child Care Center Website

Marketing website for a child care center, with a small admin area so center staff can update
content themselves.

> **Status: foundations.** No application code yet. This commit establishes the repo's conventions
> before the code they govern exists. See [`docs/PLAN.md`](docs/PLAN.md) for what is being built —
> that document is a **draft under discussion**, not a settled plan.

## What this is

A fast, statically-served marketing site (home, programs, about, staff, tuition, FAQ, contact) whose
content lives in a database and is edited by center staff through a password-protected admin area.

The public site is generated at build time and served as static files. The database is never in a
visitor's request path — it is read at build time and written only from the admin. See
[`docs/PLAN.md`](docs/PLAN.md) for why.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| Hosting, CDN, builds | Netlify |
| Database, auth, storage | Supabase |
| Styling | Tailwind CSS |
| Testing | Vitest (unit), Playwright (end-to-end) |

Exact versions are pinned in `package.json` once the app is scaffolded.

## Local development

Not yet applicable — there is no application to run. Once scaffolded:

```bash
npm install
npm run dev
```

Requires Node 20+ (developed on Node 24). Netlify platform features run locally via `netlify dev`.

## Documentation

| Document | What it covers |
|---|---|
| [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) | Folder structure, naming, commit format, PR scope, release policy |
| [`docs/PLAN.md`](docs/PLAN.md) | What v1 is, delivery milestones, known risks — **draft** |

Further documents (`ARCHITECTURE.md`, `DATA-MODEL.md`, `RUNBOOK.md`, `adr/`) are added as the work
they describe is taken on. Documentation precedes the code it governs.

## Releases

Merging to `main` does not deploy. Production deploys only when a `v*` tag is pushed. See the
release policy in [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md).
