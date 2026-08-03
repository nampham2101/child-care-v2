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
 * href written as `/programs` renders as `/en/programs`. Mobile-first: the row scrolls
 * horizontally on a narrow phone rather than wrapping or collapsing behind a menu, which
 * keeps every destination one tap away and needs no open/close state.
 */
export function SiteNav() {
  const t = useTranslations("Nav");
  const pathname = usePathname();

  return (
    <nav aria-label={t("label")} className="-mx-5 overflow-x-auto px-5">
      <ul className="flex items-center gap-x-5 whitespace-nowrap">
        {NAV_LINKS.map(({ href, labelKey }) => {
          const active = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`inline-block border-b-2 py-2 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:ring-sage-900 focus-visible:outline-none ${
                  active
                    ? "border-sage-700 text-ink-900"
                    : "border-transparent text-ink-500 hover:text-ink-900"
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
