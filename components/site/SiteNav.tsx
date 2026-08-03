"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/i18n/navigation";
import { NAV_LINKS } from "@/lib/nav";

/**
 * The site's primary navigation, rendered in the header on every page.
 *
 * Two presentations of one link list, chosen by screen width:
 *
 *   - Wide enough for the six labels: a plain inline row. The styling is a sage underline
 *     that wipes in from the left on hover and sits full-width on the current page, so the
 *     nav reads as calm text until a parent reaches for it.
 *   - Narrow: a hamburger button that opens a full-width panel under the header. Six labels
 *     do not fit across a phone, and a menu a parent opens deliberately beats a cramped row
 *     they have to scroll sideways.
 *
 * One `<nav>` landmark wraps both so assistive tech sees a single "Primary" navigation, not
 * two competing copies — only one presentation is ever visible.
 *
 * It is a client component because the menu holds open/closed state and the current route
 * decides which link is marked active. `usePathname` returns the path with the locale
 * stripped (`/programs`), so it compares directly against the unlocalized hrefs in
 * `@/lib/nav`, while next-intl's `Link` adds the prefix back on output (`/en/programs`).
 */
export function SiteNav() {
  const t = useTranslations("Nav");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Escape closes the menu — the key anyone reaches for when a panel is covering the page.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <nav aria-label={t("label")}>
      {/* Wide screens — the inline row. */}
      <ul className="hidden items-center gap-7 sm:flex">
        {NAV_LINKS.map(({ href, labelKey }) => {
          const active = pathname === href;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={`relative inline-block py-1 text-sm font-medium transition-colors duration-200 after:absolute after:inset-x-0 after:-bottom-0.5 after:h-0.5 after:origin-left after:rounded-full after:bg-sage-700 after:transition-transform after:duration-300 after:ease-out after:content-[''] focus-visible:rounded-sm focus-visible:ring-2 focus-visible:ring-sage-900 focus-visible:ring-offset-4 focus-visible:ring-offset-background focus-visible:outline-none ${
                  active
                    ? "text-sage-700 after:scale-x-100"
                    : "text-ink-700 after:scale-x-0 hover:text-ink-900 hover:after:scale-x-100"
                }`}
              >
                {t(labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>

      {/* Narrow screens — the toggle. The three bars fold into an X while open, so the
          control shows its own state rather than relying on the panel below it. */}
      <button
        type="button"
        aria-expanded={open}
        aria-controls="site-menu"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className="-mr-2 inline-flex items-center justify-center rounded-full p-2 text-ink-700 transition-colors hover:bg-surface hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-sage-900 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none active:scale-95 sm:hidden"
      >
        <span className="sr-only">{open ? t("closeMenu") : t("openMenu")}</span>
        <span aria-hidden="true" className="relative block h-4 w-5">
          <span
            className={`absolute left-0 block h-0.5 w-5 rounded-full bg-current transition-all duration-300 ease-out ${
              open ? "top-1/2 -translate-y-1/2 rotate-45" : "top-0"
            }`}
          />
          <span
            className={`absolute top-1/2 left-0 block h-0.5 w-5 -translate-y-1/2 rounded-full bg-current transition-opacity duration-200 ${
              open ? "opacity-0" : "opacity-100"
            }`}
          />
          <span
            className={`absolute left-0 block h-0.5 w-5 rounded-full bg-current transition-all duration-300 ease-out ${
              open ? "top-1/2 -translate-y-1/2 -rotate-45" : "bottom-0"
            }`}
          />
        </span>
      </button>

      {/* The panel. `hidden` rather than a CSS-only collapse, so its links are genuinely
          out of the tab order when the menu is shut. It is positioned against the header,
          which is why that element is `relative`. */}
      <div
        id="site-menu"
        hidden={!open}
        className="animate-menu-in absolute inset-x-0 top-full border-b border-border bg-background shadow-lg sm:hidden"
      >
        <ul className="mx-auto w-full max-w-5xl px-5 py-2">
          {NAV_LINKS.map(({ href, labelKey }) => {
            const active = pathname === href;
            return (
              <li key={href}>
                <Link
                  href={href}
                  aria-current={active ? "page" : undefined}
                  // Tapping a destination closes the menu. A client-side route change never
                  // unmounts this component, so without this the panel would hang open over
                  // the page the parent just asked for.
                  onClick={() => setOpen(false)}
                  className={`flex items-center justify-between rounded-xl px-3 py-3.5 text-base font-medium transition-colors focus-visible:ring-2 focus-visible:ring-sage-900 focus-visible:outline-none active:bg-surface ${
                    active ? "bg-sage-50 text-sage-700" : "text-ink-700"
                  }`}
                >
                  {t(labelKey)}
                  {/* A quiet chevron — this row goes somewhere. */}
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-4 w-4 text-ink-300"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="m9 18 6-6-6-6" />
                  </svg>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </nav>
  );
}
