"use server";

import { revalidatePath } from "next/cache";

import { type SaveState, failed } from "@/lib/admin/form-state";
import { ADMIN_SECTIONS } from "@/lib/admin/nav";
import { PublishError, publishEverything } from "@/lib/admin/publish";
import { createServerSupabase } from "@/lib/supabase-server";

/**
 * Publish every pending edit and rebuild the site.
 *
 * ## Every message here is about time, not success
 *
 * `docs/PLAN.md` is explicit that this must say *"Publishing — live in about two minutes"*
 * rather than implying the change is instant, and the reason is concrete: the site is
 * prerendered, so there is a window of one to two minutes where a staff member can press
 * Publish, open the site, and see the old value. Without being told, they will press Publish
 * again — which is why the wording matters more than it looks and why the button is a
 * deliberate action rather than an autosave.
 */
export async function publishAll(
  _previous: SaveState,
  _formData: FormData,
): Promise<SaveState> {
  try {
    const supabase = await createServerSupabase();
    const outcome = await publishEverything(supabase);

    // The counts change, so every section's cached render is stale.
    revalidatePath("/admin");
    for (const { href } of ADMIN_SECTIONS) revalidatePath(href);

    switch (outcome.kind) {
      case "nothing-to-publish":
        return {
          status: "saved",
          message:
            "Nothing was waiting, so no rebuild was started. The site already shows everything you have saved.",
        };

      case "published":
        return {
          status: "saved",
          message: `Publishing ${outcome.count} ${
            outcome.count === 1 ? "change" : "changes"
          } — live in about two minutes. You can close this page; the rebuild carries on without it.`,
        };

      case "published-not-rebuilt":
        /*
         * Deliberately not an error state in the red sense, because the edits are safe — they
         * are published in the database and the next successful rebuild will render them. What
         * is wrong is only that the site has not caught up yet, and saying "publish failed"
         * would send a staff member to re-enter work that is already saved.
         */
        return {
          status: "error",
          message: `Your ${outcome.count} ${
            outcome.count === 1 ? "change is" : "changes are"
          } published, but the site rebuild could not be started, so the public pages still show the old version. Nothing has been lost — tell the owner, and the next rebuild will pick it up. (${outcome.reason})`,
        };
    }
  } catch (error) {
    return failed(
      error instanceof PublishError
        ? error.message
        : "Something went wrong publishing. Nothing was changed.",
    );
  }
}
