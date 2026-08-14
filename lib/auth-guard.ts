/**
 * The admin area's edge guard: refresh the session, then decide whether this request is
 * allowed to continue.
 *
 * It runs in the middleware because that is the only place that can do both halves. A
 * server component can read a session but not write the rotated cookie back; a route handler
 * can write cookies but only after the router has already chosen a route. The middleware
 * sees the request before either.
 *
 * WHAT THIS IS AND IS NOT. It keeps an unauthenticated request off an admin URL, which is a
 * usability and information-disclosure boundary. It is **not** what protects the data —
 * row-level security is, and it holds even if every line of this file is wrong. Keep it that
 * way: never let a write depend on having passed through here.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { ADMIN_HOME, SIGN_IN_PATH } from "@/lib/admin-paths";
import { readSupabaseConfig } from "@/lib/supabase-config";

export async function guardAdminRequest(
  request: NextRequest,
): Promise<NextResponse> {
  const { projectUrl, anonKey } = readSupabaseConfig();

  /*
   * Cookies are written to two places, and both are load-bearing. The response carries the
   * refreshed cookie back to the browser; the request carries it forward to the route being
   * rendered on this same pass, which would otherwise read the stale value it arrived with.
   */
  let response = NextResponse.next({ request });

  const supabase = createServerClient(projectUrl, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  /*
   * `getUser()`, never `getSession()`. `getSession()` decodes the cookie without verifying
   * its signature, so it answers "what does this browser claim" — the wrong question for a
   * gate. This call verifies the token with the auth server, and its side effect is the
   * session refresh this function exists to perform.
   */
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname, search } = request.nextUrl;

  if (!user && pathname !== SIGN_IN_PATH) {
    const signIn = request.nextUrl.clone();
    signIn.pathname = SIGN_IN_PATH;
    signIn.search = "";
    /*
     * Where they were headed, so signing in resumes it rather than dumping everyone on the
     * dashboard. Validated again by `safeNextPath` before it is ever redirected to — see
     * `lib/admin-paths.ts` for why a `next` parameter is worth being careful with.
     */
    signIn.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(signIn);
  }

  if (user && pathname === SIGN_IN_PATH) {
    const home = request.nextUrl.clone();
    home.pathname = ADMIN_HOME;
    home.search = "";
    return NextResponse.redirect(home);
  }

  return response;
}
