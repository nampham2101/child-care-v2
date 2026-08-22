import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { saveProse } from "@/app/admin/(protected)/copy/[group]/actions";
import { EditorForm } from "@/components/admin/EditorForm";
import { ProseField } from "@/components/admin/ProseField";
import { DraftBadge } from "@/components/admin/Section";
import { getEditableProse } from "@/lib/admin/editable";
import { groupBySlug, proseLimitFor } from "@/lib/admin/prose-groups";

type Params = { params: Promise<{ group: string }> };

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
export default async function CopyGroupPage({ params }: Params) {
  const { group: slug } = await params;
  const group = groupBySlug(slug);
  if (!group) notFound();

  const strings = await getEditableProse(group.namespace);
  // An empty group means the backfill did not cover this namespace. `assertGroupsCoverAll` is
  // what catches that in CI; here it is a 404 rather than a form with no fields.
  if (strings.length === 0) notFound();

  const limit = proseLimitFor(strings.map((string) => string.value));
  const pending = strings.filter((string) => string.hasDraft).length;

  return (
    <>
      <Link
        href="/admin/copy"
        className="text-sm font-medium text-sage-700 hover:text-sage-900 focus-visible:ring-2 focus-visible:ring-sage-700 focus-visible:outline-none"
      >
        ← All the words
      </Link>

      <h1 className="mt-3 text-2xl font-semibold text-ink-900">
        {group.label}
      </h1>
      <p className="mt-2 max-w-prose text-ink-700">{group.where}</p>

      {pending > 0 ? (
        <p className="mt-4 max-w-prose rounded-xl border border-border bg-cream-50 px-4 py-3 text-sm text-ink-700">
          {pending === 1
            ? "One entry here has been edited and not published yet."
            : `${pending} entries here have been edited and not published yet.`}{" "}
          The public site still shows the old wording until you press Publish on
          the main page.
        </p>
      ) : null}

      <div className="mt-8">
        <EditorForm action={saveProse}>
          <input type="hidden" name="group_slug" value={group.slug} />

          <div className="flex flex-col gap-6 rounded-2xl border border-border bg-cream-50 p-6">
            {strings.map((string) => (
              <div key={string.key}>
                {string.hasDraft ? (
                  <div className="mb-2">
                    <DraftBadge />
                  </div>
                ) : null}
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
    </>
  );
}
