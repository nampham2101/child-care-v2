"use client";

import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { NAV_LINKS } from "@/lib/nav";

/**
 * The site's primary navigation, rendered in the header on every page.
 *
 * A client component for one reason: the current route decides which link is marked
 * active, and `usePathname` reads that on the client. It returns the path with the locale
 * stripped (`/programs`, or `/` for the home page), so it compares directly against the
 * unlocalized hrefs in `@/lib/nav` — no locale juggling here.
 *
 * The links themselves use next-intl's `Link`, which adds the active locale prefix, so an
 * href written as `/programs` renders as `/en/programs`. Mobile-first: the pill track
 * scrolls horizontally on a narrow phone rather than wrapping or collapsing behind a menu,
 * which keeps every destination one tap away and needs no open/close state.
 *
 * Visually it is a segmented control: a soft recessed track holding pill links, with the
 * current page shown as a raised pill. The accent stays disciplined — the one filled-sage
 * pill on the site is the tap-to-call button, so the active nav pill is a raised cream
 * surface with a sage label, distinct from the call-to-action rather than competing with
 * it. Hover lifts a pill under the pointer (surface plus a soft shadow); pressing dips it
 * (`active:scale`) for a tactile click, and keyboard focus draws the same sage ring every
 * control on the site uses.
 */
export function SiteNav() {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  return (
    <nav
      aria-label={t("label")}
      className="-mx-5 overflow-x-auto px-5 pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {/* `w-full` stretches the track across the header on a desktop; `min-w-max` stops it
          collapsing below the labels on a phone, where the nav scrolls sideways instead. */}
      <ul className="flex w-full min-w-max items-center gap-1 rounded-full border border-border bg-surface/70 p-1 whitespace-nowrap">
        {NAV_LINKS.map(({ href, labelKey }) => {
          const active = pathname === href;
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`flex w-full items-center justify-center rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ease-out outline-none focus-visible:ring-2 focus-visible:ring-sage-900 focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-[0.94] ${
                  active
                    ? "bg-background text-sage-700 shadow-sm ring-1 ring-sage-200"
                    : "text-ink-500 hover:bg-background hover:text-ink-900 hover:shadow-sm"
                }`}
              >
                {t(labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
