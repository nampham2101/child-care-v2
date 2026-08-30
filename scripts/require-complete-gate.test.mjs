/**
 * The tripwire for issue #105 — not another test that a suite fails when its credential is
 * absent, which the suites already do for themselves.
 *
 * `docs/CONVENTIONS.md` warns that skipping a suite turns a missing gate into a green run, and
 * `tests/rls/anon.test.ts`, `tests/rls/authenticated.test.ts` and `tests/e2e/admin-auth.spec.ts`
 * each throw rather than skip when their configuration is absent. That discipline worked: #103
 * surfaced as a red release rather than a green one.
 *
 * What it did not catch is the release gate running a *different, weaker* configuration than
 * the merge gate for five weeks, because nothing compared the two. The fix was one line —
 * `secrets: inherit` — and the second half of this file exists because one line is exactly what
 * a later edit deletes as noise. That half fails at merge time, before a release is ever cut.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { checkGateConfig, REQUIRED_CONFIG } from "./require-complete-gate.mjs";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

const workflow = (name) =>
  readFile(path.join(projectRoot, ".github", "workflows", name), "utf8");

/** A fully-configured gate, which each case below then takes something away from. */
const complete = {
  NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
  NEXT_PUBLIC_SUPABASE_ANON_KEY: "anon-key",
  SUPABASE_TEST_PASSWORD: "fixture-password",
};

describe("checkGateConfig", () => {
  it("passes when every credential the suites need is present", () => {
    expect(
      checkGateConfig({ ...complete, GITHUB_EVENT_NAME: "release" }),
    ).toEqual({
      ok: true,
    });
  });

  it("names `secrets: inherit` when a release gate is missing only the secret", () => {
    // The shape of #103 exactly: repository variables propagate into a called workflow on
    // their own, secrets do not. Diagnosing this precisely is the whole point of the script —
    // a generic "something is missing" would leave the reader where #103 left them.
    const result = checkGateConfig({
      ...complete,
      SUPABASE_TEST_PASSWORD: "",
      GITHUB_EVENT_NAME: "release",
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("secrets: inherit");
    expect(result.message).toContain("release.yml");
    expect(result.message).toContain("SUPABASE_TEST_PASSWORD");
  });

  it("treats the release workflow's dry run as a release gate too", () => {
    // `workflow_dispatch` reaches ci.yml only through release.yml, because ci.yml has no
    // dispatch trigger of its own. A dry run that silently ran a weaker gate would report the
    // pipeline healthy while proving less than it claims.
    const result = checkGateConfig({
      ...complete,
      SUPABASE_TEST_PASSWORD: "",
      GITHUB_EVENT_NAME: "workflow_dispatch",
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("secrets: inherit");
  });

  it("does not blame release.yml when the variables are missing as well", () => {
    // Variables reach a called workflow by themselves, so their absence means the repository
    // was never configured — pointing at `secrets: inherit` here would send the reader to the
    // wrong file.
    const result = checkGateConfig({
      GITHUB_EVENT_NAME: "release",
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("Actions configuration");
    // It may still *mention* the line while ruling it out; what it must not do is prescribe
    // adding it, which would send the reader to edit a file that is already correct.
    expect(result.message).not.toContain("Add `secrets: inherit`");
  });

  it("explains a merge gate's absence as a fork rather than as a release fault", () => {
    const result = checkGateConfig({
      ...complete,
      SUPABASE_TEST_PASSWORD: "",
      GITHUB_EVENT_NAME: "pull_request",
    });

    expect(result.ok).toBe(false);
    expect(result.message).toContain("fork");
    expect(result.message).not.toContain("secrets: inherit");
  });

  it("treats an empty string as absent, the way GitHub delivers an unset secret", () => {
    // `${{ secrets.ABSENT }}` interpolates to "" rather than leaving the variable unset, so a
    // plain `in process.env` check would have passed straight through #103.
    for (const { name } of REQUIRED_CONFIG) {
      expect(checkGateConfig({ ...complete, [name]: "" }).ok).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------------------
// THE HALF THAT CATCHES THE FILE CHANGING
// ---------------------------------------------------------------------------------------
//
// The script above only runs if the workflows keep calling it, and it only has anything to
// catch if `release.yml` keeps inheriting secrets. Both are single lines in YAML that no
// compiler checks, so they are asserted here — on the merge gate, where deleting one fails the
// pull request rather than the next release.
describe("the workflow wiring that makes the gate complete", () => {
  it("still passes secrets to the gate release.yml reuses", async () => {
    const release = await workflow("release.yml");

    // The `verify` job is `uses:` — a called workflow — and `secrets: inherit` is what makes
    // its gate identical to the merge gate rather than merely look identical. #103 is the
    // five-week window where this line was absent.
    expect(release).toMatch(/uses:\s*\.\/\.github\/workflows\/ci\.yml/);
    expect(release).toContain("secrets: inherit");
  });

  it("still runs the preflight before the gate does any work", async () => {
    const ci = await workflow("ci.yml");

    expect(ci).toContain("scripts/require-complete-gate.mjs");

    // Before the install step, or it is not a preflight: the value of refusing early is a
    // ten-second failure that names its cause instead of a mid-run pile of database errors.
    // Anchored on the step itself rather than the bare string, which also occurs in prose.
    expect(ci.indexOf("scripts/require-complete-gate.mjs")).toBeLessThan(
      ci.indexOf("- run: npm ci"),
    );
  });

  it("hands the preflight every credential it checks for", async () => {
    const ci = await workflow("ci.yml");

    // A name added to REQUIRED_CONFIG but not to the step's `env:` would report itself missing
    // on every run, including the healthy ones — a tripwire that cries wolf gets deleted.
    const preflight = ci.slice(
      ci.lastIndexOf(
        "- name:",
        ci.indexOf("scripts/require-complete-gate.mjs"),
      ),
      ci.indexOf("scripts/require-complete-gate.mjs"),
    );

    for (const { name } of REQUIRED_CONFIG) {
      expect(preflight).toContain(name);
    }
  });
});
