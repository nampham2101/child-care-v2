import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { saveProse } from "@/app/admin/(protected)/copy/[group]/actions";
import { ContentLocaleSwitcher } from "@/components/admin/ContentLocaleSwitcher";
import { EditorForm } from "@/components/admin/EditorForm";
import { PendingEdit } from "@/components/admin/PendingEdit";
import { ProseField } from "@/components/admin/ProseField";
import {
  contentLocaleName,
  DEFAULT_CONTENT_LOCALE,
  localeHref,
  resolveContentLocale,
} from "@/lib/admin/content-locale";
import { getEditableProse } from "@/lib/admin/editable";
import { groupBySlug, proseLimitFor } from "@/lib/admin/prose-groups";

type Params = {
  params: Promise<{ group: string }>;
  searchParams: Promise<{ locale?: string }>;
};

/*
 * Deliberately no `generateStaticParams`. Every route under `(protected)` is server-rendered
 * per request — it reads a Supabase session — and prerendering these at build time would run
 * the group query with no session, against policies that would return nothing. The build output
 * is the check: `/admin/*` must stay `ƒ`, and an `●` on any of them means the boundary broke.
 */

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { group } = await params;
  return { title: groupBySlug(group)?.label ?? "The words" };
}

/**
 * One group's copy, every string in it editable.
 *
 * ## Why this is a flat list and not a card per string
 *
 * Every other editor page wraps its fields in `Section`, because a program band is several
 * fields about one thing. A prose entry is **one** field, so a card around each would be 49
 * headed boxes on the FAQ page, each containing a single textarea — chrome that makes the page
 * longer without making anything clearer. The pending badge that `Section` would have carried
 * sits on the field instead.
 *
 * The whole group saves as one form, matching every other page here: a staff member proofreading
 * the FAQ fixes four things and presses Save once. `saveProse` writes a draft only for the
 * strings that actually changed, so the other 45 rows are not touched.
 */
export default async function CopyGroupPage({ params, searchParams }: Params) {
  const { group: slug } = await params;
  const group = groupBySlug(slug);
  if (!group) notFound();

  const locale = resolveContentLocale((await searchParams).locale);
  const strings = await getEditableProse(group.namespace, locale);

  // An empty group in the DEFAULT locale means the backfill did not cover this namespace —
  // a developer problem, which `assertGroupsCoverAll` catches in CI and which is a 404 here
  // rather than a form with no fields.
  //
  // An empty group in ANOTHER locale means something entirely different and ordinary: nobody
  // has translated this group yet. A 404 for that would read as a broken admin, because the
  // staff member reached it by picking a valid language from a control this page rendered. So
  // it is stated plainly instead — see the branch below.
  if (strings.length === 0 && locale === DEFAULT_CONTENT_LOCALE) notFound();

  const limit = proseLimitFor(strings.map((string) => string.value));
  const pending = strings.filter((string) => string.hasDraft).length;

  return (
    <>
      <Link
        href={localeHref("/admin/copy", locale)}
        className="text-sm font-medium text-sage-700 hover:text-sage-900 focus-visible:ring-2 focus-visible:ring-sage-700 focus-visible:outline-none"
      >
        ← All the words
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-ink-900">
        {group.label}
      </h1>
      <p className="mt-2 max-w-prose text-ink-700">{group.where}</p>

      <ContentLocaleSwitcher
        pathname={`/admin/copy/${group.slug}`}
        locale={locale}
      />

      {/* Nothing stored for this group in this language yet. Not an error — #53 and #54 seed a
          catalogue wholesale, so until one lands a group is simply untranslated. It says so
          rather than showing an empty form, because `saveDraft` deliberately refuses to create
          rows from nothing (#74) and a form here could not save anything a person typed. */}
      {strings.length === 0 ? (
        <p className="mt-8 max-w-prose rounded-2xl border border-border bg-cream-50 px-5 py-4 text-ink-700">
          This group has not been translated into {contentLocaleName(locale)}{" "}
          yet, so there is nothing here to edit. Translations are added in one
          go by a developer; once they exist, they are edited here like any
          other words.
        </p>
      ) : null}

      {pending > 0 ? (
        <p className="mt-4 max-w-prose rounded-xl border border-border bg-cream-50 px-4 py-3 text-sm text-ink-700">
          {pending === 1
            ? "One entry here has been edited and not published yet."
            : `${pending} entries here have been edited and not published yet.`}{" "}
          The public site still shows the old wording until you press Publish on
          the main page.
        </p>
      ) : null}

      {strings.length === 0 ? null : (
        <div className="mt-8">
          <EditorForm action={saveProse}>
            <input type="hidden" name="group_slug" value={group.slug} />
            {/* Posted so the save lands on the language being edited. `saveProse` re-validates
              it against `routing.locales` rather than trusting it — a hand-crafted POST must
              not be able to write rows for a locale the site does not ship. */}
            <input type="hidden" name="locale" value={locale} />

            <div className="flex flex-col gap-6 rounded-2xl border border-border bg-cream-50 p-6">
              {strings.map((string) => (
                <div key={string.key}>
                  {/* Per string rather than per group. This editor was the first place a pending
                      edit was shown for each individual row, and it is where the "half-typed
                      sentence" #121 opens with actually happens. A prose row is identified by all
                      three of these — the locale included, or a discard on the German page would
                      take the English row with it.

                      The badge-and-discard pairing moved into `PendingEdit` when #132 needed it
                      for rhythm slots and rates too; this renders exactly what it did inline. */}
                  <PendingEdit
                    pending={string.hasDraft}
                    discard={{
                      table: "prose",
                      identity: {
                        namespace: string.namespace,
                        key: string.key,
                        locale: string.locale,
                      },
                      label: `“${string.label}”`,
                    }}
                  />
                  <ProseField
                    name={`prose__${string.key}`}
                    label={string.label}
                    value={string.value}
                    placeholders={string.placeholders}
                    max={limit}
                  />
                </div>
              ))}
            </div>
          </EditorForm>
        </div>
      )}
    </>
  );
}
