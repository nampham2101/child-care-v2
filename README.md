# Child Care Center Website

Marketing website for a child care center, with a small admin area so center staff can update
content themselves.

**Live site:** <https://child-care-v2.netlify.app>

> **Status: in progress (`v0.2.0`).** All seven public pages are live. Content still comes from the
> code rather than a database, and the admin area is not built — those are `v0.3.0` and `v0.4.0`.
> See [`docs/PLAN.md`](docs/PLAN.md) for what is being built.

## What this is

A fast marketing site (home, programs, about, staff, tuition, FAQ, contact) whose content will live
in a database and be edited by center staff through a password-protected admin area.

Public pages are prerendered at build time and served from a durable cache by Netlify's Next.js
runtime — CDN-fast to a visitor, though not literally a static file read. The database is never in a
visitor's request path: it is read at build time and written only from the admin. See
[`docs/PLAN.md`](docs/PLAN.md) for why, and for what that distinction costs.

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| Hosting, CDN, builds | Netlify |
| Database, auth, storage | Supabase |
| Styling | Tailwind CSS |
| Testing | Vitest (unit, for the pure logic in `lib/`) and Playwright (end-to-end) |

Exact versions are resolved in `package-lock.json`, which is committed — CI and Netlify install
from it, so a build is never a different dependency tree than the one that was tested.

## Local development

```bash
npm install
npm run dev
```

| Command | What it does |
|---|---|
| `npm run dev` | Development server on <http://localhost:3000> |
| `npm run build` | Production build — what CI and Netlify run |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm run format` | Prettier, writing changes (`format:check` to only report) |
| `npm run test:unit` | Vitest, over the pure logic in `lib/`. Needs no build |
| `npm run test:e2e` | Playwright, against a cold first-time page load. Run `npm run build` first |

Node version is pinned in `.nvmrc` and read from there by CI and Netlify, so there is one place to
change it. Netlify platform features run locally via `netlify dev`.

## Documentation

| Document | What it covers |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Entry point for AI agents — task queue, working agreement, settled decisions |
| [`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) | Folder structure, naming, commit format, PR scope, release policy |
| [`docs/PLAN.md`](docs/PLAN.md) | What v1 is, delivery milestones, known risks |
| [`docs/RUNBOOK.md`](docs/RUNBOOK.md) | Cut a release, roll back, test the pipeline, rotate secrets |

Work is tracked in [GitHub Issues](https://github.com/nampham2101/child-care-v2/issues); release
history is in [GitHub Releases](https://github.com/nampham2101/child-care-v2/releases). There is no
changelog file, by design.

Further documents (`ARCHITECTURE.md`, `DATA-MODEL.md`, `adr/`) are added as the work they describe
is taken on. Documentation precedes the code it governs.

## Releases

Merging to `main` does not deploy. **Publishing a GitHub Release** is what deploys to production —
it creates the `v*` tag and fires the release workflow. Pushing a tag by hand does not. See
[`docs/RUNBOOK.md`](docs/RUNBOOK.md) for the steps and
[`docs/CONVENTIONS.md`](docs/CONVENTIONS.md) for the policy.
