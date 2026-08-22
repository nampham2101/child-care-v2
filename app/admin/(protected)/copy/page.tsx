import type { Metadata } from "next";
import Link from "next/link";

import { DraftBadge } from "@/components/admin/Section";
import { getEditableProse } from "@/lib/admin/editable";
import { PROSE_GROUPS } from "@/lib/admin/prose-groups";

export const metadata: Metadata = { title: "The words" };

/**
 * Where a staff member starts when something on the site reads wrong.
 *
 * #77's acceptance bar is *a staff member can find and fix a typo on `/faq` without help*, and
 * with 279 strings that is a finding problem before it is an editing one. So this page is a
 * list of **places on the website**, not of database namespaces — the person knows the typo is
 * on the FAQ page and knows nothing else.
 *
 * Each row carries its own count of unpublished edits rather than one total at the top. A
 * single number would say "you have edits somewhere", which is the state that sends someone
 * opening all thirteen groups to find them.
 */
export default async function CopyIndexPage() {
  const groups = await Promise.all(
    PROSE_GROUPS.map(async (group) => {
      const strings = await getEditableProse(group.namespace);
      return {
        ...group,
        total: strings.length,
        pending: strings.filter((string) => string.hasDraft).length,
      };
    }),
  );

  return (
    <>
      <h1 className="text-2xl font-semibold text-ink-900">The words</h1>
      <p className="mt-2 max-w-prose text-ink-700">
        Every sentence on the public site. Pick the page the words are on —
        these are grouped the way a visitor moves through the site, not the way
        they are stored.
      </p>
      <p className="mt-4 max-w-prose rounded-xl border border-border bg-cream-50 px-4 py-3 text-sm text-ink-700">
        Editing here works the same as everywhere else in this editor: you save
        a draft, and nothing reaches the public site until you press Publish on
        the main page.
      </p>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {groups.map((group) => (
          <li key={group.slug}>
            <Link
              href={`/admin/copy/${group.slug}`}
              className="flex h-full flex-col rounded-2xl border border-border bg-cream-50 p-5 transition-colors hover:border-sage-500 focus-visible:ring-2 focus-visible:ring-sage-700 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-100 focus-visible:outline-none"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <p className="font-semibold text-ink-900">{group.label}</p>
                {group.pending > 0 ? <DraftBadge /> : null}
              </div>
              <p className="mt-1.5 text-sm text-ink-700">{group.where}</p>
              <p className="mt-3 text-sm text-ink-500">
                {group.total} {group.total === 1 ? "entry" : "entries"}
                {group.pending > 0
                  ? ` · ${group.pending} not published yet`
                  : ""}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
