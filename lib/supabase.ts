/**
 * The one Supabase client, shared by everything that reads from the database.
 *
 * Created once at module load and exported as a value rather than behind a factory, so
 * every caller reuses a single connection pool and a single set of headers. A per-call
 * `createClient` would be the easy alternative and the wrong one — it re-parses config on
 * every query and makes "which client made this request" unanswerable in a log.
 *
 * This client carries the **anonymous** key only. It can read exactly what row-level
 * security lets an unauthenticated visitor read, which is all this site needs: content is
 * fetched at build time and served prerendered, so the database is never in a visitor's
 * request path. The service-role key has no use here and must never reach this file — see
 * docs/CONVENTIONS.md.
 */
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

/**
 * Thrown at module load — deliberately, so a misconfigured build dies on the first import
 * naming the variable that is missing, rather than three frames inside a query with a null
 * dereference that says nothing about the cause.
 */
export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseConfigError";
  }
}

/**
 * Both variables are read as literal `process.env.X` expressions rather than through a
 * lookup helper. Next.js inlines `NEXT_PUBLIC_*` by static text substitution at build time;
 * a dynamic `process.env[name]` is invisible to that pass and would silently read
 * `undefined` in any bundle that is not running on Node.
 */
const PROJECT_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!PROJECT_URL) {
  throw new SupabaseConfigError(
    "NEXT_PUBLIC_SUPABASE_URL is not set. Copy .env.example to .env.local and fill it in, " +
      "or set it in the CI and Netlify environments.",
  );
}

if (!ANON_KEY) {
  throw new SupabaseConfigError(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Copy .env.example to .env.local and fill it " +
      "in, or set it in the CI and Netlify environments.",
  );
}

/**
 * The variable holds the bare project origin, with no path. `supabase-js` appends
 * `/rest/v1/` itself, so a value ending in `/rest/v1/` produces `/rest/v1/rest/v1/...` and
 * every query fails with PGRST125. That mistake was actually made while wiring this project
 * up (issue #44), and it is cheap to make again by pasting the endpoint the Supabase
 * dashboard displays most prominently — so it fails loudly here instead.
 */
const parsedUrl = new URL(PROJECT_URL);
if (parsedUrl.pathname !== "/") {
  throw new SupabaseConfigError(
    `NEXT_PUBLIC_SUPABASE_URL must be the project origin with no path, but it is "${PROJECT_URL}". ` +
      `Use "${parsedUrl.origin}" — supabase-js appends /rest/v1/ itself.`,
  );
}

/**
 * Typed with the generated schema, which is the whole reason `lib/database.types.ts` is
 * committed rather than produced at build time: a query naming a column that no longer
 * exists is then a `npm run typecheck` failure in CI, not a runtime error discovered on a
 * page a parent is reading. Regenerate the types in the same pull request as the migration
 * that changes the schema — see supabase/migrations/README.md.
 */
export const supabase = createClient<Database>(PROJECT_URL, ANON_KEY);
