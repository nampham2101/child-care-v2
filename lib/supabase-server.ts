/**
 * The request-scoped Supabase client the admin area uses.
 *
 * Unlike `lib/supabase.ts` this is a factory, and the difference is not stylistic. That
 * client is a module-scope singleton holding the anonymous key with no session, which is
 * right for a build that renders once and exits. A server handling requests from several
 * signed-in staff members cannot share one: the session lives in the client, so a singleton
 * would make it process state and hand one person's session to the next person's request.
 * **A new client per request, always.**
 *
 * The session itself lives in cookies rather than in memory, which is what lets it survive a
 * refresh and be read by a server component, a server action, and the middleware alike.
 */
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

import type { Database } from "@/lib/database.types";
import { readSupabaseConfig } from "@/lib/supabase-config";

/**
 * Still the **anonymous** key. Signing in does not change which key is used — it attaches a
 * user's JWT to requests made with it, and row-level security then resolves that user's
 * organization through `current_org_id()`. The service-role key would bypass every policy
 * this milestone's authorization model is built on and must never appear here.
 */
export async function createServerSupabase() {
  const { projectUrl, anonKey } = readSupabaseConfig();
  const cookieStore = await cookies();

  return createServerClient<Database>(projectUrl, anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          /*
           * A server component cannot write cookies — only a server action, a route handler,
           * or the middleware can. This throw is therefore expected and harmless *here*,
           * because the middleware in `lib/auth-guard.ts` has already refreshed the session
           * on this same request and written any rotated cookie itself.
           *
           * Swallowing it is only safe while that remains true. Delete the middleware and
           * this becomes a session that silently stops refreshing.
           */
        }
      },
    },
  });
}

/**
 * The signed-in user, verified against the auth server, or `null`.
 *
 * Deliberately `getUser()` and never `getSession()`. `getSession()` reads the cookie and
 * decodes it without checking the signature, so anything it returns is caller-supplied data
 * — fine for deciding whether to show a "signed in" badge, and a forgeable authorization
 * check. `getUser()` asks the auth server to verify the token. Every gate in this codebase
 * uses this function, so there is one answer to "is this request authenticated" rather than
 * two that can disagree.
 *
 * This is defence in depth, not the actual boundary: row-level security is what stops a
 * request reading another organization's rows, and it would hold even if this returned the
 * wrong answer. A hidden button is not a permission.
 */
export async function getSignedInUser() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
}
