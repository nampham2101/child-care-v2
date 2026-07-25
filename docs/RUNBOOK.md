# Runbook

Operational procedures for this site: deploy, roll back, test the pipeline, rotate secrets.

`docs/CONVENTIONS.md` and `docs/PLAN.md` explain *why* the pipeline is shaped this way. This
file is the *how* — the steps to run when it is time to act.

---

## How deploys work

- Merging to `main` **does not deploy to production.** `main` is not Netlify's production branch —
  the production branch is a placeholder (`release-prod`) that never receives commits, so a merge to
  `main` produces only a non-production **branch deploy** (`main--child-care-v2.netlify.app`). PRs
  still get Deploy Previews.
- The site is intentionally **unlocked** (auto publishing on). This is required: a production lock
  ("stop auto publishing") blocks the release workflow's CLI `--prod` too, not just git auto-deploys.
- **Publishing a GitHub Release** is the only thing that deploys to production. It runs
  [`.github/workflows/release.yml`](../.github/workflows/release.yml), which re-runs the CI gate
  and then `netlify deploy --build --prod` — `--build` runs the Next.js runtime plugin, and `--prod`
  publishes to production.
- **Rollback** is republishing a previous production deploy — seconds, no rebuild, no revert commit.

### One-time prerequisites (owner)

1. Repo → Settings → Secrets and variables → Actions → add:
   - `NETLIFY_AUTH_TOKEN` — a Netlify personal access token. Add under **Secrets**.
   - `NETLIFY_SITE_ID` — the site's API ID (Netlify → Site configuration → General). Add under
     **Variables**, not Secrets — a site ID is a non-sensitive identifier, and the release
     workflow reads it from `vars`.
2. Netlify → Site configuration → Build & deploy → **Branches and deploy contexts**: set the
   production branch to a placeholder that is never pushed (`release-prod`), add `main` as a branch
   deploy (so PRs against `main` still get Deploy Previews), and keep Deploy Previews on.
3. Netlify → Deploys → make sure the site is **unlocked** (auto publishing on), so the release
   workflow's `--prod` can publish.

---

## Cut a release

1. Confirm `main` is green on the commit you intend to ship.
2. Pick the version from Conventional Commits since the last release: any `feat` → minor, only
   `fix`/`perf` → patch, a `!` / `BREAKING CHANGE` → major.
3. GitHub → Releases → **Draft a new release**. Create tag `vX.Y.Z`, target `main`.
4. Click **Generate release notes** — they group by label via `.github/release.yml`. Review the
   headings, then **Publish release**.
5. `release.yml` fires: gate → `netlify deploy --build --prod`. Watch the Actions run to green.
6. Open the production URL and confirm the site renders — a 404 means the runtime plugin did not
   run; do not leave it, roll back.

---

## Roll back

1. Netlify dashboard → the site → **Deploys**.
2. Open the last known-good deploy → **Publish deploy**.
3. Production serves it within seconds — no rebuild, no revert commit.
4. Follow up: land a `fix` (or revert) PR and cut a new patch release so `main` matches
   production again.

---

## Test the pipeline safely

- **Dry run (does not touch production):** Actions → **Release** → **Run workflow** with
  `dry_run: true`. Produces a *draft* deploy at its own URL; the live site is untouched. Confirms
  the token/site-id auth, that the Next.js plugin builds, and that the draft renders.
- **Full rehearsal (proves the real `--prod` path and rollback):** publish a GitHub **pre-release**
  on a throwaway tag such as `v0.1.0-rc.1`. `release: published` fires for pre-releases, so this
  exercises the true production deploy; then rehearse the rollback steps above.

---

## Rotate the Netlify token

1. Netlify → User settings → Applications → regenerate the personal access token.
2. Update the `NETLIFY_AUTH_TOKEN` Actions secret. No code change, no redeploy needed.
