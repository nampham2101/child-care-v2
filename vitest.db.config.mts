import path from "node:path";
import { fileURLToPath } from "node:url";

// `loadEnv` comes from Vite itself — `vitest/config` re-exports `defineConfig` but not this.
import { loadEnv } from "vite";
import { defineConfig } from "vitest/config";

/**
 * The suites that need the real database, deliberately a separate Vitest run from `test:unit`.
 *
 * Two of them now, and they are here for the same reason:
 *
 *   - `tests/rls/` — row-level security is a database behaviour, and mocking it would only
 *     prove the mock agrees with the assertions.
 *   - `tests/content/` — that every key in the database has a matching message. Both halves of
 *     that join have to be real for the answer to mean anything.
 *
 * `vitest.config.mts` covers pure logic in `lib/` — no network, no credentials, answers in
 * under a second, and runs on every commit without asking anything of the environment. Keeping
 * them apart means the fast gate stays hermetic: folding these in would make
 * `npm run test:unit` fail whenever the network is down or the project is paused, and the
 * failure would look like broken logic rather than an unreachable database.
 */
const projectRoot = path.resolve(fileURLToPath(new URL(".", import.meta.url)));

export default defineConfig({
  test: {
    include: ["tests/rls/**/*.test.ts", "tests/content/**/*.test.ts"],
    // Next.js reads `.env.local` on its own; a bare Vitest run does not, so the two
    // variables are loaded here. The empty prefix is required — Vite exposes only `VITE_`
    // names by default, and these are named for Next's convention. In CI there is no
    // `.env.local` and the workflow supplies them as repository variables instead.
    //
    // Both are public by design and ship in the client bundle. The service-role key is not
    // loaded here and must never be: it bypasses every policy this suite exists to assert.
    env: loadEnv("", projectRoot, ""),
    // These suites read and write the same few rows on one shared database. Run in parallel
    // and the write-refusal tests would race the read assertions against each other's state
    // for no gain — there are only a few dozen assertions and they finish in seconds.
    fileParallelism: false,
    // A missing fixture or an unreachable project should be one clear error, not the same
    // failure repeated across every table and every content key in `test.each`.
    bail: 1,
  },
  resolve: {
    // Matches vitest.config.mts. Both must move together if the alias ever changes.
    alias: { "@": projectRoot },
  },
});
