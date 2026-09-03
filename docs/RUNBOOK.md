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
2. **Dry run first — do not skip this.** Actions → **Release** → **Run workflow** on `main` with
   `dry_run: true`, and wait for it to go green. It runs the same gate and the same build, but
   publishes to a *draft* URL, so a broken gate or a dead credential surfaces here rather than on a
   tag that cannot be reused. Open the draft URL and click through whatever the release adds.
3. Pick the version from Conventional Commits since the last release: any `feat` → minor, only
   `fix`/`perf` → patch, a `!` / `BREAKING CHANGE` → major.
4. GitHub → Releases → **Draft a new release**. Create tag `vX.Y.Z`, target `main`. Check the
   release **title** as well as the tag — `v0.4.0` shipped titled `v0.40`.
5. Click **Generate release notes** — they group by label via `.github/release.yml`. Review the
   headings, then **Publish release**.
6. `release.yml` fires: gate → `netlify deploy --build --prod`. Watch the Actions run, and confirm
   the **`Deploy to Netlify production` job itself succeeded** — not just that the run finished. If
   the gate fails, that job is *skipped* rather than failed, and GitHub still lists the release as
   the latest one.
7. **Confirm production actually changed.** Open a route that only the new version serves and check
   it returns 200. A published release is not a deployed release — that is exactly how `v0.4.0` sat
   at the top of the releases page for a day while production served `v0.3.0` (#103).
8. Confirm the site renders — a 404 on a page that should exist means the runtime plugin did not
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

  **Runs that touch the hosted database now queue rather than overlap** (#134), so a dry run
  started minutes after a merge waits for the post-merge CI instead of racing it. `ci.yml`'s
  `verify` job is grouped on the constant `hosted-database` with `cancel-in-progress: false`;
  the `seed` job builds a throwaway local stack and stays out of the group.

  It did not always. On 2026-09-02 the release and the post-merge CI shared a per-ref group, so
  starting the dry run *cancelled* the CI four seconds after it inserted a fixture twin — and a
  cancelled job never reaches its `afterAll`, so the row was stranded and the dry run failed on
  three program rows where the suite expects two. Nothing was wrong with the release.

  A run killed some other way — a dying runner, someone pressing cancel by hand — can still
  strand rows. The next run now says so in those words: `LEFT-OVER FIXTURE STATE, NOT A POLICY
  FAILURE`, naming the stray keys and the `delete` that clears them.

  **Cut releases when the queue is quiet.** A gate already *waiting* in the group is displaced if
  two more runs arrive, which GitHub reports as cancelled. A displaced gate deploys nothing, so
  the cost is a release to re-run rather than a bad one to roll back.

  **It also proves the gate is the full gate**, which is the half that failed silently for five
  weeks (#103). Read two things in the run's log before trusting it:

  - `Gate configuration is complete` from the preflight (#105) — the release gate has every
    credential the merge gate has, so `secrets: inherit` is doing its job.
  - The **e2e count**. A release gate runs **62**; a working copy without `SUPABASE_TEST_PASSWORD`
    runs 37 and skips the other 25. A release run reporting the smaller number is the #103 shape
    and must not be released from.

    The count grows as tests are added — 54 through `v0.5.1`, 57 after #124 and #125, 60 after
    #121, 62 after #132. **What matters is not the exact figure but that it is the large one:** the failure this
    guards against is the admin suites silently not running, which shows up as a drop of about
    twenty, not as a drift of one or two. Update this line when it changes rather than letting the
    gap widen until nobody trusts the number.

  Last verified on `main` at `4c7397b`, 2026-09-03: preflight passed, 60 e2e, draft deploy only,
  production untouched and still serving.

  That run was started **deliberately while the post-merge CI was still going**, because that is
  the case which used to go red. It queued instead of cancelling: CI on `main` ran 02:24:37 →
  02:27:35 and finished green on its own, the dry run was dispatched at 02:25:00, and its `verify`
  job started at 02:27:37 — two seconds after the database came free. Its `seed` job had already
  run in parallel from 02:25:05, which is the other half of #134 working, since that job's
  Postgres stack is local and shares nothing. Observed, not reasoned about.
- **Full rehearsal (proves the real `--prod` path and rollback):** publish a GitHub **pre-release**
  on a throwaway tag such as `v0.1.0-rc.1`. `release: published` fires for pre-releases, so this
  exercises the true production deploy; then rehearse the rollback steps above.

---

## Rotate the Netlify token

1. Netlify → **Applications** → **Personal access tokens** → **New access token**. Name it for its
   job (`github-actions-release · child-care-v2`), set an **Expiration**, and copy the value — once
   you leave that page it cannot be read again.
2. Update the `NETLIFY_AUTH_TOKEN` Actions secret. No code change, no redeploy needed.
3. Record the new expiry date below, and dry-run the release workflow to confirm it works before you
   need it.

**Current token expires:** _not recorded — fill this in at the next rotation._

Two ways this token dies, both silently:

- **It expires.** Netlify asks for an expiration when the token is created, so every token has an
  end date whether or not anyone wrote it down.
- **A Netlify password reset invalidates it.** Per Netlify's docs, resetting the account password
  permanently invalidates every personal access token created before the reset. If a release starts
  failing to authenticate and nothing else changed, ask whether the password was reset.

Either way the symptom is the same: the gate passes and the deploy step fails with
`Unauthorized: could not retrieve project`. The site and the site ID are fine; the credential is not.
This happened between `v0.3.0` and `v0.4.1` (#108).
