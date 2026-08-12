/**
 * Guards the fix for issue #67 — a rebuild against a warm cache silently rendering the
 * previous build's content.
 *
 * There are two ways that fix dies, and neither one shows up as a failing page: the script
 * stops removing anything, or the npm hooks that call it get dropped in a routine edit to
 * `package.json`. Both are asserted here, because the symptom they produce is a *correct
 * looking* site serving month-old ratios — the kind of bug nobody reports because nothing
 * appears broken.
 *
 * What this deliberately does not do is run two real builds with a database change in
 * between. That is the honest end-to-end proof, it needs write access to the database, and it
 * costs a pair of full builds — so it was done by hand while fixing #67 and written up in the
 * pull request instead of being automated here.
 */
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { clearFetchCache, FETCH_CACHE_DIR } from "./clear-fetch-cache.mjs";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

describe("clearFetchCache", () => {
  it("removes a populated cache directory", async () => {
    const dir = path.join(
      await mkdtemp(path.join(tmpdir(), "fetch-cache-")),
      "fetch-cache",
    );
    await mkdir(dir, { recursive: true });
    // Shaped like the real thing: Next names entries by hash, and the ones that caused #67
    // held Supabase REST responses with a one-year revalidate.
    await writeFile(
      path.join(dir, "a".repeat(64)),
      JSON.stringify({ kind: "FETCH", revalidate: 31536000 }),
    );

    await clearFetchCache(dir);

    expect(existsSync(dir)).toBe(false);
  });

  it("succeeds on a tree that has never been built", async () => {
    // `prebuild` runs on every clean checkout, so a missing directory is the normal case and
    // must not fail the build.
    const missing = path.join(
      await mkdtemp(path.join(tmpdir(), "fetch-cache-")),
      "absent",
    );

    await expect(clearFetchCache(missing)).resolves.toBeUndefined();
  });

  it("targets this project's cache, not the current working directory", async () => {
    expect(FETCH_CACHE_DIR).toBe(
      path.join(projectRoot, ".next", "cache", "fetch-cache"),
    );
  });
});

describe("the build hooks that call it", () => {
  it("still run the script before and after every build", async () => {
    const { scripts } = JSON.parse(
      await readFile(path.join(projectRoot, "package.json"), "utf8"),
    );

    // `prebuild` is the load-bearing one — it is what makes the build about to run unable to
    // reuse the last one's Supabase responses. `postbuild` is what leaves the tree clean.
    expect(scripts.prebuild).toContain("clear-fetch-cache.mjs");
    expect(scripts.postbuild).toContain("clear-fetch-cache.mjs");
  });
});
