/**
 * The admin area's paths, and the rules about them — pure string logic, no imports.
 *
 * Separate from `lib/auth-guard.ts` because that module pulls in `@supabase/ssr` and
 * `next/server`, and `docs/CONVENTIONS.md` keeps pure helpers importable without any of
 * that: it is what lets the suite beside this file check every redirect case in
 * milliseconds instead of standing up a request.
 */

/** The admin area's root. Everything under it is staff-only except `SIGN_IN_PATH`. */
export const ADMIN_ROOT = "/admin";

/**
 * The one admin path reachable without a session — otherwise signing in would require
 * already being signed in. It sits under `/admin` rather than at a top-level `/sign-in` so
 * the entire staff surface is one prefix: one middleware branch, one thing to exclude from
 * locale routing, and no public-looking URL that is really a staff door.
 */
export const SIGN_IN_PATH = "/admin/sign-in";

/** Where a signed-in staff member lands, and where the sign-in page sends them. */
export const ADMIN_HOME = "/admin";

export function isAdminPath(pathname: string): boolean {
  return pathname === ADMIN_ROOT || pathname.startsWith(`${ADMIN_ROOT}/`);
}

/**
 * Narrows a `?next=` value to somewhere inside the admin area, falling back to the admin
 * home for anything else.
 *
 * Anything unrecognised is discarded rather than corrected. A redirect target taken from a
 * query string is the classic open-redirect shape: `?next=https://evil.example` on a page
 * that asks for a password sends a staff member somewhere else entirely, with the URL bar
 * still reading like this site right up to the moment it does not. Three cases are easy to
 * miss and all three are tested:
 *
 *   - `//evil.example` is protocol-relative. It is an absolute URL wearing a path's clothes,
 *     and it passes a naive `startsWith("/")` check.
 *   - `/en/about` is same-origin and still wrong — a sign-in that lands on the public site
 *     looks like it failed.
 *   - `/admin/sign-in` would bounce a freshly signed-in person back to the form.
 */
export function safeNextPath(next: string | undefined | null): string {
  if (!next) return ADMIN_HOME;
  if (!next.startsWith("/") || next.startsWith("//")) return ADMIN_HOME;

  const [pathname] = next.split("?");
  if (!isAdminPath(pathname)) return ADMIN_HOME;
  if (pathname === SIGN_IN_PATH) return ADMIN_HOME;

  return next;
}
