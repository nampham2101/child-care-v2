import Link from "next/link";

import {
  CONTENT_LOCALES,
  contentLocaleName,
  isLocaleSwitchable,
  localeHref,
} from "@/lib/admin/content-locale";

/**
 * Which language's words the editor is pointed at — issue #111.
 *
 * ## It renders nothing at all while one locale is shipped
 *
 * Not a disabled control, not a single greyed pill: nothing. `isLocaleSwitchable` is false
 * until `routing.locales` holds more than one, and a picker offering one option implies a
 * choice that does not exist. This is what lets #111 merge and release while English is still
 * the only catalogue — the control appears by itself the day #53 or #54 adds a locale, with no
 * second pull request and no flag to remember.
 *
 * ## Links, not a form
 *
 * The choice belongs in the URL (`lib/admin/content-locale.ts` explains why a search parameter
 * and not a path segment). Links mean the browser's back button, a refresh, and a pasted link
 * all behave the way a staff member expects, and it works with no JavaScript — which the rest
 * of this editor also does, since every page here is server-rendered.
 *
 * ## Why the active one is stated, not just styled
 *
 * The failure this control makes possible is a staff member carefully rewriting a paragraph in
 * the wrong language and publishing it. Colour alone would not stop that: it is invisible to a
 * screen reader, it is the first thing to be missed on a glance, and #111 asks specifically
 * that the active locale be unmistakable. So the current locale is named in words above the
 * options, and its pill carries `aria-current`.
 */
export function ContentLocaleSwitcher({
  pathname,
  locale,
}: {
  /** The admin path being viewed, without a query string. */
  pathname: string;
  /** The resolved content locale — already checked against `routing.locales`. */
  locale: string;
}) {
  if (!isLocaleSwitchable()) return null;

  return (
    <div className="mt-6 rounded-2xl border border-border bg-cream-50 px-5 py-4">
      <p className="text-sm text-ink-700">
        You are editing the{" "}
        <strong className="font-semibold text-ink-900">
          {contentLocaleName(locale)}
        </strong>{" "}
        words. The editor itself stays in English.
      </p>

      <nav aria-label="Content language" className="mt-3">
        <ul className="flex flex-wrap gap-2">
          {CONTENT_LOCALES.map((option) => {
            const active = option === locale;
            return (
              <li key={option}>
                <Link
                  href={localeHref(pathname, option)}
                  aria-current={active ? "true" : undefined}
                  className={
                    active
                      ? "inline-block rounded-full bg-sage-900 px-4 py-1.5 text-sm font-semibold text-cream-50"
                      : "inline-block rounded-full border border-border px-4 py-1.5 text-sm font-medium text-ink-700 hover:border-sage-500 hover:text-ink-900 focus-visible:ring-2 focus-visible:ring-sage-700 focus-visible:outline-none"
                  }
                >
                  {contentLocaleName(option)}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
