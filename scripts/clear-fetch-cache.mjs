/**
 * Removes Next's persistent fetch cache, so no Supabase response outlives the build that
 * fetched it.
 *
 * `next build` writes every `fetch` it makes into `.next/cache/fetch-cache` with a one-year
 * lifetime. Our content queries go through that same patched `fetch`, so a rebuild against a
 * warm cache renders the *previous* content: no error, no warning, and a deploy that reports
 * success. `docs/PLAN.md` sells the opposite — staff press Publish, the site rebuilds, and
 * the new facts are live in a minute or two. Ratios and rates are exactly what a parent acts
 * on, so serving a stale one silently is the worst shape this bug could take. Issue #67 has
 * the reproduction.
 *
 * **Why this and not `cache: "no-store"` on the queries.** That was tried first and it is
 * wrong here: Next 16 treats a no-store fetch as a dynamic API, so every page that reads the
 * center's settings stopped prerendering and the build failed outright with "couldn't be
 * rendered statically". `docs/PLAN.md` rules out putting Supabase in a visitor's request
 * path, so opting the routes into dynamic rendering to fix a cache bug trades a silent
 * problem for a louder, worse one. Clearing the cache leaves all seven pages prerendered and
 * still guarantees fresh content, because the guarantee we need is about what survives
 * *between* builds — deduplication *within* one build is `cache()` in the query modules, and
 * it is untouched.
 *
 * Only `fetch-cache` goes. The Turbopack and TypeScript caches beside it are pure build
 * speed with no correctness stake, and throwing them away would make every build slow for no
 * reason.
 *
 * Run by the `prebuild` and `postbuild` npm hooks, so `npm run build` is clean at both ends:
 * `prebuild` is the load-bearing one and guarantees the build about to run cannot reuse
 * anything, while `postbuild` leaves the tree in a state a test can actually assert. A bare
 * `next build` bypasses both — build through `npm run build`, which is what CI, Netlify, and
 * docs/RUNBOOK.md all do.
 */
import { rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

/** Resolved from this file rather than `process.cwd()`, so the hooks work from any directory. */
const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

export const FETCH_CACHE_DIR = path.join(
  projectRoot,
  ".next",
  "cache",
  "fetch-cache",
);

/**
 * `force` covers the ordinary case of a tree that has never been built, which must not be an
 * error — `prebuild` runs on a clean checkout every time CI installs from scratch.
 */
export async function clearFetchCache(dir = FETCH_CACHE_DIR) {
  await rm(dir, { recursive: true, force: true });
}

// Only when run as a script, so `clear-fetch-cache.test.mjs` can import the function without
// deleting a real build's cache as a side effect of the import.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await clearFetchCache();
}
