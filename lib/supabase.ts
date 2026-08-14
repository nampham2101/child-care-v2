/**
 * The build-time Supabase client, shared by everything that *reads public content*.
 *
 * Created once at module load and exported as a value rather than behind a factory, so
 * every caller reuses a single connection pool and a single set of headers. A per-call
 * `createClient` would be the easy alternative and the wrong one — it re-parses config on
 * every query and makes "which client made this request" unanswerable in a log.
 *
 * This client carries the **anonymous** key only. It can read exactly what row-level
 * security lets an unauthenticated visitor read, which is all the public site needs: content
 * is fetched at build time and served prerendered, so the database is never in a visitor's
 * request path. The service-role key has no use here and must never reach this file — see
 * docs/CONVENTIONS.md.
 *
 * IT CARRIES NO SESSION, AND MUST NOT BE USED BY THE ADMIN AREA. A module-scope singleton is
 * correct for a build that renders once and exits, and wrong for a server handling requests
 * from several signed-in people: the session would be process state shared between them.
 * `lib/supabase-server.ts` is the request-scoped client the admin uses, and it exists for
 * exactly that reason.
 */
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { readSupabaseConfig } from "@/lib/supabase-config";

/**
 * Re-exported so the error type stays importable from where it has always been importable.
 * The definition moved to `lib/supabase-config.ts` when the second and third clients needed
 * the same validation.
 */
export { SupabaseConfigError } from "@/lib/supabase-config";

/**
 * Validated at module load — deliberately, so a misconfigured build dies on the first import
 * naming the variable that is missing, rather than three frames inside a query with a null
 * dereference that says nothing about the cause.
 */
const { projectUrl, anonKey } = readSupabaseConfig();

/**
 * Typed with the generated schema, which is the whole reason `lib/database.types.ts` is
 * committed rather than produced at build time: a query naming a column that no longer
 * exists is then a `npm run typecheck` failure in CI, not a runtime error discovered on a
 * page a parent is reading. Regenerate the types in the same pull request as the migration
 * that changes the schema — see supabase/migrations/README.md.
 */
export const supabase = createClient<Database>(projectUrl, anonKey);
