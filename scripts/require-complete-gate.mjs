/**
 * Refuses to let the gate start unless it can actually run in full — issue #105.
 *
 * ---------------------------------------------------------------------------------------
 * THE FAILURE THIS EXISTS FOR
 * ---------------------------------------------------------------------------------------
 *
 * `release.yml` reuses `ci.yml` through `workflow_call` so a release verifies the exact commit
 * it ships. Repository *variables* propagate into a called workflow on their own; *secrets* do
 * not, unless the caller says `secrets: inherit`. For five weeks it did not, and nothing
 * compared the two gates — so the release gate ran a weaker configuration than the merge gate,
 * looked identical in the workflow list, and was only noticed when v0.4.0 (#103) failed four
 * suites, skipped its deploy, and left production on v0.3.0 while GitHub showed v0.4.0 as the
 * latest release.
 *
 * The property this holds: **a release cannot deploy on a gate that ran less than the merge
 * gate ran.** It is held from two directions, deliberately, because they catch the same
 * mistake at different moments:
 *
 *   1. This script, run as the first step of the gate. It turns "four suites threw a generic
 *      missing-environment error somewhere in the middle of the run" into one refusal, in the
 *      first ten seconds, naming `secrets: inherit` as the thing to go and fix.
 *   2. `require-complete-gate.test.mjs`, which asserts that `release.yml` still carries the
 *      line and that `ci.yml` still runs this script. That one fails at *merge* time, so the
 *      one-line fix cannot be quietly deleted as noise in a later edit — which is the actual
 *      way this regresses. #103's fix was one line, and one line is easy to lose.
 *
 * Neither half is redundant. (1) catches a configuration that drifted without the file
 * changing; (2) catches the file changing. Only (2) catches it before it reaches a release.
 *
 * ---------------------------------------------------------------------------------------
 * WHAT IT DOES NOT DO
 * ---------------------------------------------------------------------------------------
 *
 * It does not count suites or compare two runs' results. #105 scoped that out on purpose: a
 * general workflow-testing harness is not worth its weight here, and every way the release
 * gate has actually been weaker than the merge gate has been a missing credential rather than
 * a missing step. If that stops being true, this is the file that grows.
 */
import { fileURLToPath } from "node:url";

/**
 * Everything the gate needs before it is worth starting.
 *
 * The `kind` matters to the diagnosis rather than to the check: variables reach a called
 * workflow by themselves and secrets do not, so *which* names are missing is what tells the
 * difference between "the release workflow forgot `secrets: inherit`" and "this repository was
 * never configured". Keep this list in step with the `env:` blocks in `ci.yml` — a suite that
 * starts needing a new credential should refuse here first, not halfway through the run.
 */
export const REQUIRED_CONFIG = [
  { name: "NEXT_PUBLIC_SUPABASE_URL", kind: "variable" },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", kind: "variable" },
  { name: "SUPABASE_TEST_PASSWORD", kind: "secret" },
];

/**
 * The events that mean "this run of `ci.yml` is the release gate, not the merge gate".
 *
 * Inside a called workflow `github.event_name` is the *caller's* event, so a gate reached
 * through `release.yml` reports `release` (a published release) or `workflow_dispatch` (the
 * dry run). A merge gate reports `pull_request` or `push`. That is the whole reason this
 * script can name `secrets: inherit` specifically rather than listing every possible cause.
 */
const RELEASE_EVENTS = new Set(["release", "workflow_dispatch"]);

/**
 * @param {Record<string, string | undefined>} env
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function checkGateConfig(env) {
  // Empty string, not just undefined: an unset GitHub secret or variable interpolates to an
  // empty string rather than disappearing, so `${{ secrets.ABSENT }}` arrives as "".
  const missing = REQUIRED_CONFIG.filter(({ name }) => !env[name]);

  if (missing.length === 0) return { ok: true };

  const names = missing.map(({ name }) => name).join(", ");
  const isReleaseGate = RELEASE_EVENTS.has(env.GITHUB_EVENT_NAME ?? "");
  const onlySecretsMissing = missing.every(({ kind }) => kind === "secret");

  // The signature of #103 exactly: the variables arrived, the secrets did not. There is one
  // way for that to happen, so say it rather than listing possibilities.
  if (isReleaseGate && onlySecretsMissing) {
    return {
      ok: false,
      message:
        `The release gate cannot run in full: ${names} is absent, while the repository ` +
        `variables beside it arrived. That is what a missing \`secrets: inherit\` looks ` +
        `like — a called workflow inherits variables on its own but never secrets. Add ` +
        `\`secrets: inherit\` to the \`verify\` job in .github/workflows/release.yml. ` +
        `Refusing now, because the alternative is what happened to v0.4.0 (#103): the ` +
        `suites that sign in fail on a missing-configuration error, the deploy is skipped, ` +
        `and the release looks published while production never moved.`,
    };
  }

  if (isReleaseGate) {
    return {
      ok: false,
      message:
        `The release gate cannot run in full: ${names} absent. Repository variables are ` +
        `missing too, so this is the repository's Actions configuration rather than a ` +
        `missing \`secrets: inherit\` in release.yml — check both. Refusing rather than ` +
        `running a weaker gate than the one main was merged through.`,
    };
  }

  // The merge gate. The common cause here is a pull request from a fork, which GitHub gives no
  // secrets by design. That already failed the run — `tests/rls/authenticated.test.ts` throws
  // rather than skips — just several minutes later and as four errors about the database. This
  // only moves the same refusal to the front and explains it.
  return {
    ok: false,
    message:
      `The gate cannot run in full: ${names} absent. A pull request from a fork gets no ` +
      `repository secrets, so the suites that sign in for real cannot run; a branch in this ` +
      `repository should have them, and an absence there means the Actions configuration is ` +
      `incomplete. Refusing up front rather than failing four suites on a ` +
      `missing-configuration error several minutes in.`,
  };
}

// Only when run as a script, so `require-complete-gate.test.mjs` can import the function
// without the import itself exiting the test runner. Same guard as clear-fetch-cache.mjs.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const result = checkGateConfig(process.env);

  if (!result.ok) {
    // `::error::` puts it in the run's annotation summary, so it is readable from the release
    // without opening the job log. Single line: GitHub truncates an annotation at a newline.
    console.error(`::error::${result.message}`);
    process.exit(1);
  }

  console.log(
    "Gate configuration is complete — every credential the suites need is present.",
  );
}
