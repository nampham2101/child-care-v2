# Instructions for AI agents

You are working on the marketing website for a child care center. This file is the entry point for
any AI agent in this repository. Humans read `docs/`; you read this first.

**Repository:** `nampham2101/child-care-v2` — **public**. Issue text, pull request descriptions,
commit messages, and branch names are world-readable from the moment they are pushed. Write them for
that audience, and never put anything in them you would not publish.
**Stack:** Next.js (App Router, TypeScript) · Netlify hosting · Supabase from `v0.3.0` onward
**Current state:** `v0.7.0` is the released version, live at <https://child-care-v2.netlify.app>
and deployed 2026-09-02. All seven public pages — home, `/programs`, `/about`, `/staff`,
`/tuition`, `/faq`, `/contact` — read their facts and prose from Supabase at build time, and
render in **English and German**: `routing.locales` is `["en", "de"]`, and `/de/*` is prerendered
beside `/en/*`. Row-level security is on, and the anonymous key can read published rows only.
Staff log in at `/admin/sign-in`, edit facts and copy in either language, upload images of the
spaces, **discard an edit they have changed their mind about**, and press Publish to rebuild
production.

**The `v0.4.0` tag is not a version of this site.** It was published, its release run failed, and
production stayed on `v0.3.0` for a day (#103). Everything the `v0.4.0` milestone describes reached
production as `v0.4.1`. Do not treat the `v0.4.0` tag as a rollback target — it never deployed.

**What the recent releases contained.** `v0.5.0` was the i18n plumbing only, agreed 2026-08-30 —
#110 (locale-dependent `site_settings` fields moved to `prose`), #111 (content locale control in
the copy editor), #52 (public switcher, `hreflang`, sitemap), with #112 and #115 alongside;
`v0.5.1` followed with #120. `v0.6.0` is the language itself: #53 (the German catalogue) and #123
(the last two untranslatable columns), with #122 alongside. `v0.7.0` is #121 (discard a pending
draft), plus two repairs to the recovery path — #126 (a rebuilt database had no copy at all) and
#127 (a migration filename disagreeing with its applied version).

Every piece of #52 and #111 that was gated on `routing.locales.length > 1` lit up by itself when
`de` was routed — the public switcher, `hreflang`, the sitemap's German entries, the admin's
content-locale control. Nothing had to be flipped on; that gating was the design paying out, and it
is why **adding Italian (#54) should stay a one-line change to `routing.locales` plus a catalogue.**

**#54, #27 and #132 are all proposals.** Do not start them without an assignment.

**No English string reaches a German page any more.** `programs.age_label` and
`programs.group_size` were the last two — English sentences in a facts table with no locale, so
"15 months – 3 years" and "8 children" rendered untranslated inside German room cards. **#123**
moved them into `prose` under the `Programs` namespace as `<key>Ages` and `<key>GroupSize`, in
both languages; `ratio` stayed, because "1:4" is "1:4" everywhere. `tests/e2e/german.spec.ts` used
to exclude those strings by name and now asserts against them, across `/de`, `/de/programs`,
`/de/about` and `/de/tuition`.

Things that bite the unwary:

- **Prose is in the database and editable** (#76, #77). 293 of the site's 296 strings are rows in
  `public.prose`, one per `(locale, namespace, key)` and now doubled across `en` and `de`;
  `messages/<locale>.json` holds only the three chrome strings. Staff edit copy at `/admin/copy`,
  on the same draft-then-publish path as facts. Do not send anyone to `messages/en.json` to change
  a sentence.
- **A hardcoded string is invisible until a second locale exists** (#53). Four English literals sat
  in TSX for months — the call button's verb, two hero stat values, the home page's metadata —
  indistinguishable from catalogue rows while `en` was the only locale, and untranslatable the
  moment `de` landed. They are rows now. The test before writing any user-facing text in a
  component: *would a German page show this?* If yes, it is a row.
- **A facts table holds facts, never sentences** (#110, #123). The ages, opening hours and
  neighbourhood used to live on `site_settings`; the age range and group size used to live on
  `programs`. All five are `prose` rows now — under `Center` and `Programs` — because they are
  English sentences, and two of them are interpolated into other sentences. The test before adding
  a text column to any content table: *would this string be identical in German?* If not, it is
  copy and belongs in `prose`. Note that this splits a table's columns rather than moving whole
  tables: `programs.ratio` stayed exactly where it was, and that is the point rather than a
  compromise.
- **A `{placeholder}` is load-bearing.** Twenty strings interpolate a value at render time, and
  next-intl throws on a message missing one — which now fails the build. `FieldReader.prose` is what
  stops a staff member deleting one; do not weaken it. Since #111 the required set for a
  translation comes from the **default locale's** row, not from the row being edited — deriving it
  from the row would let an already-broken translation validate against itself forever.
- **Publishing is all-or-nothing, including across languages** (#111). `publish_org_drafts` promotes
  every pending draft in the organization. The locale is part of how a draft is matched to its
  published twin, so a German edit can never overwrite the English row — but there is no such thing
  as publishing one language. Whether to change that is #116.
- **Locales are derived from `routing.locales`, never listed** (#52). The switcher, `hreflang`, the
  sitemap and the admin's content-locale control all read that one list through `lib/locales.ts`.
  Adding a language must stay a one-line change; a hand-kept copy anywhere is the one that goes
  stale, and a locale that exists but is invisible to search fails silently.
- **Photographs of the spaces exist** (#78). A `spaces` bucket, a `media` table, uploads at
  `/admin/photos`, rendered on `/programs`. **Never photographs of people** — that decision is what
  keeps consent out of this project entirely, and it is the one rule here with no technical
  enforcement, so it is enforced in review.
- **Uploads are the only untrusted input.** `lib/admin/image.ts` reads the actual bytes; a
  content-type header is a claim. Storage paths start with the organization id because the storage
  policies compare that segment — changing the path shape is changing a security boundary.
- **The editor can delete content now, in exactly one shape** (#121). Discarding a draft that has a
  published twin destroys only the edit. Discarding one with **no** twin destroys the thing, and
  today only a photograph can be in that state — every other section goes through `saveDraft`,
  which refuses to create. `lib/admin/discard.ts` words the confirmation from whichever case the
  database says it is, rather than from what the page assumed. Do not collapse the two sentences.
- **The test suites share one live database, and a cancelled CI run leaves rows behind.** Clean-up
  lives in `afterAll`, which a cancelled job never reaches — so a run killed mid-suite strands
  fixture rows and the *next* run fails on a count, somewhere nowhere near whatever changed. This
  cost a red release dry run on 2026-09-02. If a fixture-count assertion fails and the diff looks
  unrelated, check `programs` for stray `rlsFixture*` keys before believing the failure.
- **A fixture value has to be one the editor itself would accept.** `supabase/fixtures/rls.sql`
  writes through SQL, which skips the form's validation — so a marker longer than the field's own
  limit is a row nobody can save. #123 put a 37-character marker in `ratio`, which `savePrograms`
  caps at 20, and it failed an unrelated save test two tickets later. Keep fixture text short.

Merged is not shipped — only a published release reaches production.

---

## 1. Do this first, every session, before anything else

Run these. Do not skip them because the user's message sounds simple.

```bash
gh issue list --state open --json number,title,assignees,milestone
gh pr list --state open
git log --oneline -5
git status --short
```

**GitHub Issues is the task queue. It is the source of truth, not the conversation.** A previous
session's chat is gone; the issues are not.

## 2. Then report to the user, unprompted

After reading the issues, tell the user — briefly, before starting work:

1. **What is assigned to you**, and therefore what you are about to do
2. **What is blocked on them** — any issue titled `[owner]` or otherwise needing an account,
   credential, domain, or decision only they can make
3. **What is on the critical path** — if an owner task blocks work, say so plainly rather than
   quietly building around it

This reminder is a standing duty, not a courtesy. The user asked for it explicitly. They will not
always remember what they owe; you are expected to.

Keep it short. Three or four lines. Lead with what is blocked on them.

---

## 3. The working agreement

These rules exist because they were broken before. Follow them literally.

### Assignment is the go signal

- **An unassigned issue is a proposal, not work in flight. Do not start it.**
- Discussing a design, approving a plan, or saying "looks good" is **not** an instruction to build.
  Only assignment, or an explicit "do it", starts work.
- If the user asks a question, describes a problem, or thinks out loud — answer. Do not implement.
- When in doubt, draft the ticket and wait.

### Do not merge

- Open the pull request. **Stop there.** The user merges.
- Do not merge, even when CI is green, even when the change is trivial, even when the agreed model
  says merging is yours. Ask, or wait.
- **From `v0.4.0` the user reviews the pull request before merging it.** Green CI is not the go
  signal for a merge; their review is. Write the description for someone reviewing the diff, because
  now someone is.

### Do not push to production

Merging does not deploy. Publishing a GitHub Release deploys. **Never create or publish a release.**
That is the user's production gate, and from `v0.4.0` it is the second of two — PR review is the
first. Both are theirs; neither is yours to pass on their behalf.

### Scope

One pull request does one thing. Findings outside the task become issues, not extra commits. If
something is a security or data-loss risk, stop and say so immediately — never file it in a queue.

---

## 4. Hard rules

| Rule | Why |
|---|---|
| **Never `git add -A`.** Stage explicit paths | It once swept an unread file into a commit |
| **Never commit a file you have not read** | Same incident |
| **Never create `CHANGELOG.md`** | GitHub Releases is the record. This is a settled decision |
| **Never ask for, store, or accept secrets in conversation** | The user sets them in Netlify or GitHub secrets directly |
| **Label every PR** (`feature` `fix` `chore` `docs` `ci` `deps`) | GitHub groups release notes by label, not by commit message |
| **Commits follow Conventional Commits** | `type(scope): subject`, imperative, lowercase |

---

## 5. Settled decisions — do not relitigate

Re-opening these wastes the user's time. They are recorded with reasoning in `docs/PLAN.md`.

- **v1 is a marketing website**, not the operations platform
- **No forms.** The conversion action is a phone call
- **Netlify** for hosting; **Supabase** for the database from `v0.3.0`, auth and storage from `v0.4.0`
- **Content is staff-editable via an admin UI** — this is why a database exists at all
- **Visual direction is "warm and human"** — built for an anxious parent comparing centers, not to
  look like a site for children
- **The center is a fictional placeholder** with placeholder imagery
- **No photographs of people.** Staff are monograms; imagery is illustration or the facility itself
- **The public site is static.** The database is never in a visitor's request path
- **Multi-tenant-ready schema** (`org_id` from migration one) even though one center uses it

### Verified — do not re-derive

**Next.js 16 works with Netlify's runtime.** `@netlify/plugin-nextjs@5.15.12` gates on
`SUPPORTED_NEXT_VERSIONS = ">=13.5.0"` — open-ended, no upper bound. No version pin-back needed.

---

## 6. Where things are

| Path | Contents |
|---|---|
| `docs/PLAN.md` | What is being built, decisions and their reasoning, open questions |
| `docs/CONVENTIONS.md` | Folder structure, naming, commits, PR scope, who reviews, release policy |
| GitHub Issues | The task queue. Everything through `v0.7.0` is closed and shipped; no milestone is open yet |
| GitHub Releases | The release history. There is no changelog file |

---

## 7. Writing things down

**Chat is not storage.** A new session reads none of the previous conversation.

If a decision is made, it lands in `docs/PLAN.md` or a GitHub issue **before the conversation ends**.
If work is identified but not assigned, it becomes an issue. Anything left only in chat is lost.

When you finish a piece of work, check whether the docs still describe reality. If they do not,
update them in the same pull request rather than letting them drift.
