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
import { routing } from "@/i18n/routing";

/** The locales the site routes. The single source #52 also uses for the public switcher. */
export const CONTENT_LOCALES: readonly string[] = routing.locales;

/** What the editor falls back to, and what it shows when there is nothing to choose. */
export const DEFAULT_CONTENT_LOCALE: string = routing.defaultLocale;

/**
 * Whether to render a control at all.
 *
 * **A picker with one option is worse than no picker.** It implies a choice that does not
 * exist and takes up the space where a real one would go. #111 gates on this deliberately so
 * the ticket can merge and release while English is the only catalogue, and light up on its own
 * the day #53 or #54 lands — no second pull request, no flag to remember to flip.
 */
export function isLocaleSwitchable(): boolean {
  return CONTENT_LOCALES.length > 1;
}

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
  // `Intl.DisplayNames.of` THROWS a RangeError on a structurally invalid tag rather than
  // returning undefined — `of("pt BR")` is an exception, not a fallback. Every caller here
  // passes a locale already resolved against `routing.locales`, so this should be unreachable;
  // it is caught anyway because the alternative is that one malformed entry in `routing`
  // takes down the whole copy editor with a stack trace instead of an odd-looking label.
  try {
    return (
      new Intl.DisplayNames(["en"], { type: "language" }).of(locale) ?? locale
    );
  } catch {
    return locale;
  }
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
