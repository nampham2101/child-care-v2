"use client";

import { useEffect, useRef, useState } from "react";

import { Link, usePathname } from "@/i18n/navigation";
import { isLocaleSwitchable, localeNativeName, LOCALES } from "@/lib/locales";

/**
 * The language control in the site header — issue #52.
 *
 * ## It renders nothing while one locale is shipped
 *
 * Not a disabled control, not a single inert pill: nothing. A switcher with one option implies
 * a choice that does not exist and takes the space where a real one would go. This is what lets
 * #52 merge and release before any catalogue exists, and appear by itself the day #53 or #54
 * adds a locale to `routing` — no follow-up pull request, no flag to remember.
 *
 * ## Every option is written in its own language
 *
 * "Deutsch", not "German". The person this control exists for is the one who *cannot read the
 * page they are looking at* — an English label for a German option is useless to exactly them.
 * `localeNativeName` derives the endonym, so a new locale needs no new string.
 *
 * ## It stays on the page the visitor is reading
 *
 * `usePathname` from `@/i18n/navigation` returns the path with the locale stripped
 * (`/tuition`), and next-intl's `Link` puts the chosen prefix back (`/de/tuition`). A parent
 * comparing fees who switches language lands on the fees, not back at the home page — which is
 * the single most common way a language switcher is annoying.
 *
 * ## Why a disclosure button and not three inline links
 *
 * Three endonyms side by side is roughly 150px of text. The header already carries the centre's
 * name and, below `sm`, the menu toggle; #52 requires this to hold at **360px**, and three
 * links would not. One button collapses that to a single control — and below `sm` it shows the
 * locale code (`EN`) rather than the endonym, which keeps it near 40px while the accessible
 * name stays a full sentence for anyone not reading it visually.
 *
 * Links inside, not buttons: each option is a navigation to a real URL, so it should be
 * middle-clickable, openable in a new tab, and visible to a crawler.
 */
export function LocaleSwitcher({ locale }: { locale: string }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  // Escape closes, and so does a click anywhere else — the two things a person does when they
  // opened a menu they did not mean to. Both are skipped entirely while it is shut, so the
  // closed state costs no listeners on a page that is otherwise static.
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointerDown(event: MouseEvent) {
      if (!container.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open]);

  if (!isLocaleSwitchable()) return null;

  return (
    <div ref={container} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls="locale-menu"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-ink-700 transition-colors hover:border-sage-500 hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-sage-900 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none"
      >
        {/* The accessible name is a full sentence in English regardless of what is shown, so a
            screen reader announces a control rather than two letters. It is not translated:
            the label names the act of choosing a language, which is the one thing a visitor
            who cannot read this page still needs to find. */}
        <span className="sr-only">
          Language — currently {localeNativeName(locale)}
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-4 w-4"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M3.6 9h16.8M3.6 15h16.8M12 3a15 15 0 0 1 0 18a15 15 0 0 1 0-18" />
        </svg>
        {/* Endonym where there is room, locale code where there is not. */}
        <span aria-hidden="true" className="hidden sm:inline">
          {localeNativeName(locale)}
        </span>
        <span aria-hidden="true" className="sm:hidden">
          {locale.toUpperCase()}
        </span>
      </button>

      {/* `hidden` rather than a CSS-only collapse, so the options are genuinely out of the tab
          order while the menu is shut. */}
      <ul
        id="locale-menu"
        hidden={!open}
        className="absolute right-0 top-full z-30 mt-2 min-w-40 rounded-2xl border border-border bg-background py-1.5 shadow-lg"
      >
        {LOCALES.map((option) => {
          const active = option === locale;
          return (
            <li key={option}>
              <Link
                href={pathname}
                locale={option}
                lang={option}
                hrefLang={option}
                aria-current={active ? "true" : undefined}
                onClick={() => setOpen(false)}
                className={`block px-4 py-2.5 text-sm transition-colors focus-visible:ring-2 focus-visible:ring-sage-900 focus-visible:outline-none ${
                  active
                    ? "font-semibold text-sage-700"
                    : "font-medium text-ink-700 hover:bg-surface hover:text-ink-900"
                }`}
              >
                {localeNativeName(option)}
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
