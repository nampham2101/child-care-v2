import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The configuration guard in `lib/supabase.ts`.
 *
 * The ticket that added the client asks that a misconfigured build fail with a readable
 * message naming the missing variable. Nothing imports the client yet, so `next build`
 * cannot demonstrate that — the module is never loaded and the guard never runs. These
 * tests are what actually holds that promise, and they keep holding it once the first query
 * lands and the failure mode stops being hypothetical.
 *
 * Every case re-imports the module, because the guard runs at module load and Vitest caches
 * a module the same way Node does. Without `resetModules` the second case would assert
 * against the first case's already-evaluated copy and pass for the wrong reason.
 */
const VALID_URL = "https://kdhtodcmxgxfnxrbkkzp.supabase.co";
const VALID_KEY = "test-anon-key";

async function loadClientModule() {
  return import("@/lib/supabase");
}

beforeEach(() => {
  vi.resetModules();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("configuration guard", () => {
  it("names the URL variable when it is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", VALID_KEY);

    await expect(loadClientModule()).rejects.toThrow(
      "NEXT_PUBLIC_SUPABASE_URL is not set",
    );
  });

  it("names the key variable when it is missing", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", VALID_URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    await expect(loadClientModule()).rejects.toThrow(
      "NEXT_PUBLIC_SUPABASE_ANON_KEY is not set",
    );
  });

  /**
   * The dashboard displays the REST endpoint more prominently than the project origin, and
   * pasting it produces `/rest/v1/rest/v1/...` and a PGRST125 on every query — a failure
   * that reads as a broken query rather than a broken variable. It was made for real while
   * wiring the project up, so it fails at load with an instruction instead.
   */
  it("rejects a URL carrying a path, and says what to use instead", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", `${VALID_URL}/rest/v1/`);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", VALID_KEY);

    await expect(loadClientModule()).rejects.toThrow(VALID_URL);
  });

  it("throws a named error, so the cause survives a stack trace", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "");

    await expect(loadClientModule()).rejects.toThrowError(
      expect.objectContaining({ name: "SupabaseConfigError" }),
    );
  });
});

describe("the shared client", () => {
  beforeEach(() => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", VALID_URL);
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", VALID_KEY);
  });

  it("is created when both variables are present", async () => {
    const { supabase } = await loadClientModule();

    expect(supabase).toBeDefined();
    expect(typeof supabase.from).toBe("function");
  });

  /**
   * One client, not one per import. Two importers holding different instances would each
   * carry their own connection state, which is the bug this module exists to prevent.
   */
  it("is the same instance for every importer", async () => {
    const first = await loadClientModule();
    const second = await loadClientModule();

    expect(first.supabase).toBe(second.supabase);
  });
});
