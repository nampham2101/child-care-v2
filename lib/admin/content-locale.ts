/**
 * Which **content** locale the editor is working on — issue #111.
 *
 * ## Content locale, not interface locale
 *
 * These are two different things and conflating them is the mistake this module exists to
 * prevent. `app/admin/layout.tsx` and `lib/admin/nav.ts` both settled it before there was
 * anything to switch:
 *
 *   > the admin is outside the locale tree … a staff member will need to switch which
 *   > **content** locale they are editing — that is a control inside the page, not a locale
 *   > prefix on the URL, and the two should not be confused.
 *
 * So: the admin's own chrome stays English, always. What changes is which rows of
 * `public.prose` the editor is pointed at. Nothing here translates a button.
 *
 * ## Why a search parameter and not a path segment
 *
 * `/admin/de/copy` would put a locale prefix on an admin URL, which is exactly what the note
 * above rules out — it would also mean the locale middleware sits in front of an authenticated
 * area. `?locale=de` is a control's state, not a route, and it survives a refresh, the back
 * button, and a link pasted to a colleague. A cookie would do none of those visibly, and two
 * tabs would fight over one hidden value.
 *
 * ## Everything here treats its input as hostile
 *
 * The locale arrives from a query string or a form field, both of which anyone can type. It is
 * matched against `routing.locales` and falls back to the default rather than being trusted —
 * an unrouted locale must not reach a query, or the editor would silently show and save rows
 * for a language the site does not ship.
 */
import { DEFAULT_LOCALE, localeEnglishName, LOCALES } from "@/lib/locales";

/**
 * The locales the editor may point at, and the fallback.
 *
 * Re-exported from `@/lib/locales` rather than read from `routing` again: #52 added a public
 * switcher that needs the same answers, and `docs/CONVENTIONS.md` says a helper needed twice
 * moves to one place instead of being pasted. These aliases stay because "content locale" is
 * the vocabulary the admin uses, and the distinction from the interface locale is the whole
 * point of this module.
 */
export const CONTENT_LOCALES = LOCALES;
export const DEFAULT_CONTENT_LOCALE = DEFAULT_LOCALE;

export { isLocaleSwitchable } from "@/lib/locales";

/**
 * Resolve an untrusted value — a search parameter, a form field — to a locale the site routes.
 *
 * Falls back rather than throwing. A staff member who edits the URL by hand, or follows a stale
 * link to a locale that has since been removed from `routing`, should land on the default
 * editor rather than on an error page; the value is a view preference, not an identifier for
 * something that must exist.
 */
export function resolveContentLocale(value: unknown): string {
  return typeof value === "string" && CONTENT_LOCALES.includes(value)
    ? value
    : DEFAULT_CONTENT_LOCALE;
}

/**
 * The name of a locale, in English, for the control.
 *
 * English because the admin chrome is English — a German option labelled "Deutsch" would be the
 * first step toward a half-translated interface, which `lib/admin/nav.ts` rules out. `Intl`
 * supplies the name so adding a locale to `routing` needs no new string here, which is the
 * same "derive it, do not list it" rule the rest of this ticket follows.
 */
export function contentLocaleName(locale: string): string {
  return localeEnglishName(locale);
}

/**
 * The href for one locale's version of the page being viewed.
 *
 * The default locale gets a clean URL with no parameter at all. That keeps every link a staff
 * member has bookmarked working unchanged, and means the single-locale site — which is every
 * site until #53 lands — never grows a query string it has no use for.
 */
export function localeHref(pathname: string, locale: string): string {
  return locale === DEFAULT_CONTENT_LOCALE
    ? pathname
    : `${pathname}?locale=${encodeURIComponent(locale)}`;
}
