import createMiddleware from "next-intl/middleware";

import { routing } from "./i18n/routing";

/**
 * The locale middleware — this is what turns a bare `/` into `/en` and rejects unknown
 * locale segments. It must run on Netlify's Next runtime, not only locally, so the `/`
 * redirect is a required check on the Deploy Preview before this ships.
 */
export default createMiddleware(routing);

export const config = {
  /*
   * Run on every path except Next internals, the API, and anything with a file extension
   * (static assets). Matching those would send `favicon.ico` through locale routing and
   * 404 it.
   */
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
