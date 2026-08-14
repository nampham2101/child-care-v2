import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";

import { isAdminPath } from "./lib/admin-paths";
import { guardAdminRequest } from "./lib/auth-guard";
import { routing } from "./i18n/routing";

/**
 * Two middlewares, one entry point, and a hard split between them.
 *
 * The locale middleware is what turns a bare `/` into `/en` and rejects unknown locale
 * segments. It must run on Netlify's Next runtime, not only locally, so the `/` redirect is
 * a required check on the Deploy Preview before this ships.
 *
 * From `v0.4.0` the admin area needs the other half: refreshing a Supabase session and
 * turning an unauthenticated request away. **The two never run on the same request.** That
 * is the boundary this file exists to hold, and it is worth stating why, because "just run
 * both" is the obvious shape and it is wrong twice over:
 *
 *   - `docs/PLAN.md` rules out putting Supabase in a visitor's request path. `getUser()`
 *     calls the auth server. Running it for everyone would put a network round trip in front
 *     of seven pages that are otherwise served as static files.
 *   - `/admin` is not locale-prefixed and must not be. Sent through the locale middleware it
 *     would redirect to `/en/admin`, which does not exist.
 */
const handleLocale = createMiddleware(routing);

export default async function middleware(
  request: NextRequest,
): Promise<NextResponse> {
  if (isAdminPath(request.nextUrl.pathname)) {
    return guardAdminRequest(request);
  }

  return handleLocale(request);
}

export const config = {
  /*
   * Run on every path except Next internals, the API, and anything with a file extension
   * (static assets). Matching those would send `favicon.ico` through locale routing and
   * 404 it.
   *
   * `/admin` is deliberately still matched — the branch above, not this pattern, is what
   * decides which middleware handles it.
   */
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
