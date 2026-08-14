/**
 * The Supabase connection details, validated once and shared by every client.
 *
 * There are three clients now rather than one — the build-time reader in `lib/supabase.ts`,
 * the request-scoped server client in `lib/supabase-server.ts`, and the one the middleware
 * builds in `lib/auth-guard.ts` — and all three need the same two variables checked the same
 * way. This module is that check, extracted here when the second caller appeared rather than
 * pasted, per `docs/CONVENTIONS.md`.
 */

/**
 * Thrown when configuration is absent or malformed, deliberately naming the variable at
 * fault, rather than surfacing three frames later as a null dereference inside a query.
 */
export class SupabaseConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupabaseConfigError";
  }
}

export type SupabaseConfig = {
  projectUrl: string;
  anonKey: string;
};

/**
 * Both variables are read as literal `process.env.X` expressions rather than through a
 * lookup helper. Next.js inlines `NEXT_PUBLIC_*` by static text substitution at build time;
 * a dynamic `process.env[name]` is invisible to that pass and would silently read
 * `undefined` in any bundle that is not running on Node. The substitution works inside a
 * function body exactly as it does at module scope, so moving the reads here costs nothing.
 */
export function readSupabaseConfig(): SupabaseConfig {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!projectUrl) {
    throw new SupabaseConfigError(
      "NEXT_PUBLIC_SUPABASE_URL is not set. Copy .env.example to .env.local and fill it in, " +
        "or set it in the CI and Netlify environments.",
    );
  }

  if (!anonKey) {
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
  const parsedUrl = new URL(projectUrl);
  if (parsedUrl.pathname !== "/") {
    throw new SupabaseConfigError(
      `NEXT_PUBLIC_SUPABASE_URL must be the project origin with no path, but it is "${projectUrl}". ` +
        `Use "${parsedUrl.origin}" — supabase-js appends /rest/v1/ itself.`,
    );
  }

  return { projectUrl, anonKey };
}
