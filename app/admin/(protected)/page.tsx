import Link from "next/link";

import { PublishPanel } from "@/components/admin/PublishPanel";
import { countPendingEdits } from "@/lib/admin/editable";
import { ADMIN_SECTIONS } from "@/lib/admin/nav";

/**
 * The editor's front door.
 *
 * It leads with the count of unpublished edits rather than with the sections, because until
 * #75 ships there is no way to publish and therefore no way for a staff member to discover
 * that state except by being told. `docs/PLAN.md` is emphatic that this interface must never
 * imply a change is live when it is not; this is the first place that promise is kept.
 *
 * `next/link` rather than the locale-aware `Link` from `@/i18n/navigation`: the admin is
 * outside the locale tree, so a prefixed href here would point at a route that does not exist.
 */
export default async function AdminHomePage() {
  const pending = await countPendingEdits();

  return (
    <>
      <h1 className="text-2xl font-semibold text-ink-900">
        What would you like to change?
      </h1>

      <div className="mt-6">
        <PublishPanel pending={pending} />
      </div>

      <ul className="mt-8 grid gap-4 sm:grid-cols-2">
        {ADMIN_SECTIONS.map(({ href, label, description }) => (
          <li key={href}>
            <Link
              href={href}
              className="block h-full rounded-2xl border border-border bg-cream-50 p-5 transition-colors hover:border-sage-500 focus-visible:ring-2 focus-visible:ring-sage-700 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-100 focus-visible:outline-none"
            >
              <p className="font-semibold text-ink-900">{label}</p>
              <p className="mt-1.5 text-sm text-ink-700">{description}</p>
            </Link>
          </li>
        ))}
      </ul>

      <h2 className="mt-12 text-sm font-semibold tracking-widest text-ink-500 uppercase">
        Not here yet
      </h2>
      <p className="mt-3 max-w-prose text-sm text-ink-700">
        The words on the pages — room descriptions, staff bios, every FAQ answer
        (#76, #77). Photographs of the rooms and the garden (#78).
      </p>
    </>
  );
}
