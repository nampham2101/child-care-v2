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
- **Staff pressing Publish in the admin also deploys to production** — added by #75, and it is the
  one other thing that does. See below; it cannot ship code, only content.

### Content publishing, and why it is not a build hook

`docs/PLAN.md` described this as "the app calls a Netlify build hook". **It cannot be**, and the
reason is the gating above: a build hook builds a *git branch*, and neither branch here can carry a
content publish. `release-prod` never receives commits, so a hook on it has nothing to build; `main`
would produce a branch deploy rather than production.

So pressing Publish dispatches
[`.github/workflows/publish-content.yml`](../.github/workflows/publish-content.yml), which:

1. Looks up the newest **published release tag**.
2. Confirms that release **actually deployed to production** — a `Release` run for that tag that
   concluded successfully. If it never did, the publish refuses and production is untouched.
3. Checks out that tag — *not* `main`.
4. Runs the same `netlify deploy --build --prod` the release workflow runs.

**The property this preserves: a content publish can never ship unreleased code.** Both production
gates survive — the owner still decides what code goes live by cutting a release, and staff decide
what content goes live by pressing Publish. It shares `release.yml`'s concurrency group, so a
release and a content publish queue rather than race.

It skips the CI gate deliberately: that exact commit was gated when it was released — step 2 is
what makes that true rather than assumed, after v0.4.0 was published with a gate that had failed
(#103) — and staff cannot make content structurally invalid because keys are not editable (#74).
The build is still a real check — `lib/content.ts` raises on a missing published row and `lib/tuition.ts` on an
incomplete rate sheet, so a bad publish fails the build and leaves production untouched.

**If a publish reports that the rebuild could not be started**, the edits are safe: they are already
published in the database, and the next successful build renders them. Check that
`GITHUB_PUBLISH_TOKEN` is set and unexpired in Netlify, then either press Publish again after any
edit, or cut a release.

**If a publish fails with "has never deployed to production successfully"**, the newest release was
published but its deploy did not finish — so there is no gated code to build. The edits are safe,
for the same reason as above. Fix the release (land the fix, cut a new patch release), and the
content goes live with it; no second Publish is needed.

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
4. **For the admin's Publish button** (#75): create a GitHub **fine-grained personal access token**
   scoped to this repository with **Actions: read and write** and nothing else, then set it in
   **Netlify** → Site configuration → Environment variables as `GITHUB_PUBLISH_TOKEN`.

   Netlify, not GitHub Actions — the admin runs on Netlify, and CI has no business rebuilding
   production. Anyone holding this token can start unlimited production builds, so treat it like the
   Netlify token: never committed, never in an issue, never in a chat. Rotate it by generating a new
   one and replacing the variable; nothing else reads it.

   Until it is set, saving and publishing still work as far as the database — a publish promotes the
   drafts and then reports that the rebuild could not be started, without losing anything.

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
