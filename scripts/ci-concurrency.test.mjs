/**
 * The tripwire for issue #134: nothing that writes to the shared hosted database may be
 * cancelled while it is running, and no two such runs may overlap.
 *
 * ---------------------------------------------------------------------------------------
 * WHY A TEST AND NOT JUST THE COMMENT IN ci.yml
 * ---------------------------------------------------------------------------------------
 *
 * The fix is three lines of YAML that no compiler checks, and the *previous* three lines
 * (`group: ci-${{ github.ref }}` with `cancel-in-progress: true`) are what almost every
 * repository has. They are the obvious thing to reach for, they look like a speed-up, and
 * restoring them would be a one-line "cleanup" in some later edit.
 *
 * What that costs is not obvious from the diff, which is the whole problem. Clean-up in these
 * suites lives in `afterAll`, and a cancelled job never reaches `afterAll` — so a cancelled run
 * strands `rlsFixture*` rows and the NEXT run fails on a row count, in a suite nowhere near
 * whatever changed. The v0.7.0 dry run failed exactly that way and read as a broken test for as
 * long as it took to find the overlapping run in `gh run list`.
 *
 * So the property is asserted here, on the merge gate, where undoing it fails the pull request
 * that undoes it. Same shape as `require-complete-gate.test.mjs`, and for the same reason: a
 * one-line guarantee needs something that notices the line leaving.
 *
 * These are string assertions rather than a parsed workflow. `js-yaml` is only ever present
 * here transitively, and adding a parser to test three lines would be more machinery than the
 * thing it checks — the same call `require-complete-gate.test.mjs` makes.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));

const workflow = (name) =>
  readFile(path.join(projectRoot, ".github", "workflows", name), "utf8");

/**
 * Every workflow that reaches something only one run may hold at a time: the hosted Supabase
 * project, or the production deploy. Each has its own group for its own resource; what they
 * share is that cancelling one part-way through leaves a mess behind.
 */
const MUST_NOT_CANCEL_IN_FLIGHT = [
  "ci.yml",
  "release.yml",
  "publish-content.yml",
];

describe("runs that touch the shared database are serialised", () => {
  it("groups the verify job on the database rather than on the ref", async () => {
    const ci = await workflow("ci.yml");

    // A constant, so two pull requests — two refs — cannot run the suites at the same time
    // against the one fixture organization. `ci-${{ github.ref }}` serialises a branch against
    // itself only, which is not the resource that is contended.
    expect(ci).toContain("group: hosted-database");
    expect(ci).not.toMatch(/group:\s*ci-\$\{\{\s*github\.ref/);
  });

  it("scopes that group to verify, leaving the seed job free to run beside it", async () => {
    const ci = await workflow("ci.yml");

    // `seed` creates and destroys a local stack inside its own job and shares nothing, so
    // queuing it behind `verify` would buy nothing and roughly double the wall clock of a run.
    // Position is how that is asserted without parsing the file: the group has to sit inside
    // the first job, after `verify:` and before `seed:`.
    const group = ci.indexOf("group: hosted-database");
    const verifyJob = ci.indexOf("\n  verify:");
    const seedJob = ci.indexOf("\n  seed:");

    expect(verifyJob).toBeGreaterThan(-1);
    expect(seedJob).toBeGreaterThan(-1);
    expect(group).toBeGreaterThan(verifyJob);
    expect(group).toBeLessThan(seedJob);
  });

  it.each(MUST_NOT_CANCEL_IN_FLIGHT)(
    "%s never cancels a run that is already in flight",
    async (name) => {
      const yaml = await workflow(name);

      // The assertion the ticket exists for. `cancel-in-progress: true` anywhere in these three
      // files re-opens #134: a killed job skips its `afterAll`, and the rows it was mid-way
      // through using outlive it.
      expect(yaml).toContain("cancel-in-progress: false");
      expect(yaml).not.toContain("cancel-in-progress: true");
    },
  );
});
