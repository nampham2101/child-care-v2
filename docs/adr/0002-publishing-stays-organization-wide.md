# 0002 — Publishing stays organization-wide, not per locale

**Status:** Accepted · 2026-08-31 · Decided by the owner on #116

#116 asked whether a staff member should be able to publish one language at a time, and required a
decision recorded either way — **including the decision to leave it alone**. This is that record,
and the answer is to leave it alone.

## Context

`public.publish_org_drafts()` takes no arguments. For each of its nine content tables it finishes
with the same statement:

```sql
update public.<table>
   set status = 'published'
 where org_id = $1
   and status = 'draft'
```

There is no locale filter, so one press of Publish promotes every pending draft in the organization
in every language.

Two things were conflated when #111 shipped the locale-aware copy editor, and only one of them is
true:

| | Per locale? |
|---|---|
| **Twin matching** — which published row a draft overwrites | **Yes.** `prose` is identified by `array['org_id', 'locale', 'namespace', 'key']`, so a German draft can never overwrite the English row. |
| **The publish sweep** — which drafts get promoted | **No.** Scoped to the organization only. |

Both halves are asserted in `tests/rls/prose-locale.test.ts`, so the behaviour is characterised
rather than merely described.

The mismatch is real and it is a *user-interface* mismatch, not a data one. The copy editor now has
a locale control, so the screen implies a scope — "I am working in German" — that the Publish button
does not honour. #111 answered that with words rather than machinery: the panel says outright that
publishing includes every language and that a half-finished translation goes out half-finished.
#116 asks whether to go further and give the sweep a locale argument.

## Decision

**No. `publish_org_drafts()` keeps its empty signature, and Publish keeps meaning "everything
pending goes live."** The panel wording added in #111 is the settled answer, not a placeholder.

Three reasons, in order of weight.

**A locale argument has no honest meaning.** Seven of the nine tables have no locale column at all.
So `publish_org_drafts('de')` must mean either *German prose and nothing else* — leaving the phone
number and the tuition rate sitting as drafts after the staff member pressed a button labelled
Publish — or *German prose plus every locale-free table*, which is "publish everything except some
of the copy". #116 correctly identifies picking between these as the real design question. The
answer is that both are harder to explain than the current rule, and this editor's whole design
leans on being explainable to one non-technical person.

**The need behind the request is not about language.** The motivating case is "German is 80% done
and I need to ship an unrelated phone-number fix." That is a *draft-selection* problem, and it
already exists without translation: a half-edited FAQ answer blocks an urgent tuition correction in
exactly the same way. Language is the most *visible* instance of it, not a separate problem. Solving
it on the locale axis would build a special case that pre-empts the general fix and would have to be
unwound to get there.

**The exposure during the risky period is already covered by something stronger.** A locale is
invisible to visitors until it appears in `routing.locales` in `i18n/routing.ts`. That is code: it
goes through a pull request and reaches production only on a release tag. So while a catalogue is
being built — the long, genuinely 80%-done stretch — publishing half-finished German harms nothing,
because nothing routes to it. #53 and #54 both order that one-line routing change **last, after the
rows exist**, for precisely this reason. What remains after a locale ships is ordinary editing of an
already-translated string, which is a small unit of work, no larger than the English edits Publish
has always swept up.

## Alternatives rejected

**`publish_org_drafts(target_locale text default null)`**, the sketch in #116, with null preserving
today's behaviour. Genuinely cheap to build and back-compatible with `lib/admin/publish.ts` — this
is the option to take if the decision goes the other way. Rejected on meaning, not cost: see the
first reason above. It also introduces a state nothing else in the system models — one locale live
and another not, within the same organization — which every later feature that reads content would
have to know about.

**Selective publish: let the staff member choose which pending drafts go.** The correct general
shape, and the thing a locale argument would be a crippled version of. Rejected *for now* rather
than on principle: it is a real feature with a real interface (a list, checkboxes, a count that
tracks the selection), and nothing today justifies it. Publish is one button precisely so that six
edits go out together instead of six ambiguous presses.

**A third status — `hold` or `in-progress` — that the sweep skips.** Solves the motivating case at
the row level rather than the locale level, and would work. Rejected because it puts a workflow
decision into a column that ADR 0001 deliberately kept to two values, and because
`publish_org_drafts` would then have to answer "what happens to a held draft whose published twin is
edited by someone else" — a question the current two-state model does not raise.

**Discard-this-draft, so an unwanted edit can be removed rather than published.** Not an
alternative; a gap worth its own ticket, filed as #121. It makes the all-or-nothing rule survivable
without changing what Publish means.

## Consequences

**`components/admin/PublishPanel.tsx` is now normative.** The sentence "That includes every language
— there is no way to publish one on its own" stops being a description of a temporary state and
becomes the contract. It is rendered only when more than one locale is switchable, which is correct
and should stay that way.

**`tests/rls/prose-locale.test.ts` keeps its "ships EVERY language's pending draft" test unchanged.**
Under this decision the test is not documenting a wart — it is the assertion that guards the rule.
Anyone who later makes it fail has changed a decision, not a detail, and should land here first.

**#53 and #54 land as they are scoped.** Neither needs to wait for this, and their existing ordering
— rows first, `routing.locales` last — is what keeps the reasoning above true. That ordering is now
load-bearing rather than merely tidy, and the two tickets should say so.

**The table-driven loop from #94 stays a loop over nine identical cases.** That uniformity is the
property that makes forgetting a new content table loud instead of silent; a locale argument would
split it into two shapes.

## Risks accepted

**A staff member can ship a half-finished translation of a locale that is already live, and the only
thing standing between them and that is a paragraph of text.** Real, and knowingly accepted. The
mitigation is that the unit of work after a catalogue ships is one string, not four thousand words,
and that the panel names the consequence in the same breath as the button.

*Tripwire:* the first time someone asks to hold back a specific pending edit — for **any** reason,
not only a language one. That is the signal that selective publish has become a real requirement,
and the answer then is the general feature, not the locale argument rejected here.

**A translator working over days is not the editor this assumes.** The reasoning above rests on
translation arriving as a catalogue in a pull request and on subsequent edits being small. Someone
translating *inside* the admin editor over a week hits the motivating case for real, and the routing
gate does not help them once their locale is live.

*Tripwire:* an account created for a translator, or any translation work that starts in the editor
rather than in a migration. At that point reopen this ADR — superseded, not rewritten.
