/**
 * Publishing: promote every pending draft, then rebuild production.
 *
 * ## The order is load-bearing
 *
 * Promote first, rebuild second. If the rebuild fails, the content is already published in the
 * database and **any later build renders it** — so the failure costs a delay, not the edit. The
 * reverse order would start a build against content that then failed to promote, publishing the
 * old values and reporting success.
 *
 * ## Why this is not a Netlify build hook
 *
 * #75 assumed one. A build hook builds a git branch, and neither branch here can carry a
 * content publish: `release-prod` is Netlify's production branch and never receives commits, and
 * `main` would produce a branch deploy rather than production. So publishing dispatches the
 * GitHub workflow that runs the project's one production deploy path, against the newest release
 * tag. **A content publish therefore cannot ship unreleased code** — see
 * `.github/workflows/publish-content.yml`.
 *
 * ## Pressing Publish twice
 *
 * #75 requires that rapid publishes do not stack. They cannot, and it falls out of the order
 * above rather than needing a lock: the first press promotes every draft, so the second finds
 * nothing to promote and returns without dispatching anything. No build, no queue, no state to
 * keep. The button is also disabled while a request is in flight, which handles the double-click
 * before the first request has even returned.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";

/** The repository whose workflow is dispatched. Public, and named in `AGENTS.md`. */
const REPOSITORY = "nampham2101/child-care-v2";

/** Dispatched against `main` because that is where the workflow file lives; the workflow then
 *  checks out the released tag itself. See the header of that file for why. */
const WORKFLOW_FILE = "publish-content.yml";
const DISPATCH_REF = "main";

export class PublishError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PublishError";
  }
}

export type PublishOutcome =
  | { kind: "nothing-to-publish" }
  | { kind: "published"; count: number }
  /** Promoted, but the rebuild could not be started. The content is safe; the site is stale. */
  | { kind: "published-not-rebuilt"; count: number; reason: string };

/**
 * Promote the caller's drafts inside one database transaction.
 *
 * The whole algorithm lives in `public.publish_org_drafts()` rather than here, because
 * publishing is many writes across seven tables that must all happen or none of them, and
 * PostgREST gives no transaction across separate requests. An application loop that failed part
 * way would leave the site half-published with no error anywhere.
 */
async function promoteDrafts(
  supabase: SupabaseClient<Database>,
): Promise<number> {
  const { data, error } = await supabase.rpc("publish_org_drafts");

  if (error) {
    throw new PublishError(
      error.code === "42501"
        ? "This account is not allowed to publish. It may have no organization — see issue #87."
        : `Nothing was published: ${error.message}`,
    );
  }

  return data ?? 0;
}

/**
 * Ask GitHub to run the production rebuild.
 *
 * The token is a real credential — anyone holding it can start builds — so it is read from the
 * server-side environment only. It has no `NEXT_PUBLIC_` prefix, which is what stops Next from
 * inlining it into a browser bundle, and this module is imported only by a server action.
 */
async function triggerProductionRebuild(): Promise<void> {
  const token = process.env.GITHUB_PUBLISH_TOKEN;

  if (!token) {
    throw new PublishError(
      "GITHUB_PUBLISH_TOKEN is not set in this environment, so the site rebuild cannot be " +
        "started. The owner sets it in Netlify — see docs/RUNBOOK.md.",
    );
  }

  const response = await fetch(
    `https://api.github.com/repos/${REPOSITORY}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ref: DISPATCH_REF }),
    },
  );

  // 204 No Content is success for this endpoint; anything else is not.
  if (response.status !== 204) {
    /*
     * The body is read for the message but deliberately not surfaced verbatim to a staff
     * member — a GitHub error can name the repository, the workflow and the token's scopes,
     * none of which belongs on a screen in a childcare center's office.
     */
    const detail =
      response.status === 404 ? "not found or no access" : "refused";
    throw new PublishError(
      `The rebuild could not be started — GitHub ${detail} (${response.status}).`,
    );
  }
}

/**
 * The whole publish, as one call.
 *
 * Returns rather than throws for the partial case, because "your edits are published but the
 * site has not rebuilt" is a real state a staff member needs described accurately, not an
 * error that implies nothing happened.
 */
export async function publishEverything(
  supabase: SupabaseClient<Database>,
): Promise<PublishOutcome> {
  const count = await promoteDrafts(supabase);

  if (count === 0) {
    // Nothing changed, so no build is started. This is also what makes a second press of the
    // button harmless rather than a second set of build minutes.
    return { kind: "nothing-to-publish" };
  }

  try {
    await triggerProductionRebuild();
  } catch (error) {
    return {
      kind: "published-not-rebuilt",
      count,
      reason:
        error instanceof PublishError
          ? error.message
          : "The rebuild could not be started.",
    };
  }

  return { kind: "published", count };
}
