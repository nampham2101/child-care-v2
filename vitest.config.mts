import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Unit tests for the pure logic in `lib/` — formatting and derived figures, the things
 * Playwright can only catch indirectly by happening to assert the exact rendered string.
 *
 * Nothing here needs a browser, a DOM, or a build, so the default `node` environment stays
 * and this run is the fast half of the gate: `npm run test:unit` answers in under a second,
 * while `npm run test:e2e` needs a production build first.
 */
const projectRoot = path.resolve(fileURLToPath(new URL(".", import.meta.url)));

export default defineConfig({
  test: {
    // Explicit, because Vitest's default glob also matches `.spec.ts` and would sweep up
    // `tests/e2e/` — Playwright specs, which fail immediately outside a Playwright runner.
    // The two suites are separate commands on purpose; neither should run the other's files.
    include: ["lib/**/*.test.ts"],
  },
  resolve: {
    // Vitest does not read `paths` from tsconfig.json, so the `@/` alias the source uses is
    // declared again here. Both must move together if the alias ever changes.
    alias: { "@": projectRoot },
  },
});
