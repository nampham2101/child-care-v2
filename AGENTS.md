# Instructions for AI agents

You are working on the marketing website for a child care center. This file is the entry point for
any AI agent in this repository. Humans read `docs/`; you read this first.

**Repository:** `nampham2101/child-care-v2` — **public**. Issue text, pull request descriptions,
commit messages, and branch names are world-readable from the moment they are pushed. Write them for
that audience, and never put anything in them you would not publish.
**Stack:** Next.js (App Router, TypeScript) · Netlify hosting · Supabase from `v0.3.0` onward
**Current state:** `v0.3.0` is the released version — all seven public pages are live at
<https://child-care-v2.netlify.app>: home, `/programs`, `/about`, `/staff`, `/tuition`, `/faq`, and
`/contact`, now reading their **facts** from Supabase at build time. Row-level security is on, and
the anonymous key can read published rows only.

Work now targets `v0.4.0`: staff login, the content editor, the prose migration, image upload, and
publish triggering a rebuild. Two things follow from that split, and both bite the unwary:

- **No one can edit anything yet.** `v0.3.0` shipped a database with no editor — every fact is
  editable in principle and only through SQL in practice. That gap is the whole of `v0.4.0`.
- **Prose is still in `messages/*.json`**, all 282 strings of it. Moving it is a `v0.4.0` migration,
  not a thing that already happened.

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

### Do not push to production

Merging does not deploy. Publishing a GitHub Release deploys. **Never create or publish a release.**
That is the user's gate and the only one they have.

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
| `docs/CONVENTIONS.md` | Folder structure, naming, commits, PR scope, self-review checklist, release policy |
| GitHub Issues | The task queue. Milestone `v0.4.0` is the current target |
| GitHub Releases | The release history. There is no changelog file |

---

## 7. Writing things down

**Chat is not storage.** A new session reads none of the previous conversation.

If a decision is made, it lands in `docs/PLAN.md` or a GitHub issue **before the conversation ends**.
If work is identified but not assigned, it becomes an issue. Anything left only in chat is lost.

When you finish a piece of work, check whether the docs still describe reality. If they do not,
update them in the same pull request rather than letting them drift.
