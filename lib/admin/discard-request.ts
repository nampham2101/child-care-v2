/**
 * Handling a discard that arrived on an editor's own form — issue #121.
 *
 * ## Why this rides the section's save action instead of being an action of its own
 *
 * The obvious shape is a separate server action on a `formAction` button. It does not work:
 * `EditorForm` drives its form through `useActionState`, and a button whose `formAction` names a
 * different action posts outside that hook, so the state it returns is dropped on the floor and
 * the person sees nothing happen.
 *
 * So a discard is a submit of the section's ordinary form, distinguished by which button was
 * pressed — the browser sends the name and value of only that one. Each editor action calls this
 * first and returns whatever it gives back. That keeps one implementation shared across all six
 * editors, which #121 asks for, while the result still flows through the hook that renders it.
 *
 * **It runs before validation, and that is the point.** A staff member who typed something the
 * form refuses is exactly the person most likely to want to discard, and a discard blocked by
 * "one field needs fixing" would be absurd — the fields are being thrown away.
 *
 * ## Not a `"use server"` module
 *
 * If it were, every export would become a callable endpoint. This is called *by* server actions,
 * never posted to directly, so it stays an ordinary server-side module and the editors' own
 * actions remain the only entry points.
 */
import { revalidatePath } from "next/cache";

import { discardPrompt, discardResult, parseTarget } from "@/lib/admin/discard";
import { DraftError, discardDraft, readTwins } from "@/lib/admin/drafts";
import { failed, type SaveState } from "@/lib/admin/form-state";
import { ADMIN_SECTIONS } from "@/lib/admin/nav";
import { createServerSupabase } from "@/lib/supabase-server";

/**
 * If this submission was a discard, deal with it and return the state to show. Otherwise `null`,
 * and the caller carries on saving.
 *
 * Two presses. `discard_request` only reads — it works out which of ADR 0001's two cases the
 * thing is in and returns the matching confirmation. `discard_confirm` performs it.
 *
 * The prompt is worded from the database rather than from what the page believed, because
 * whether this destroys *an edit* or *the thing itself* is exactly the distinction being
 * confirmed, and the page cannot always know which. One extra read on a rarely-pressed control
 * buys a confirmation that cannot describe the wrong outcome.
 */
export async function maybeDiscard(
  formData: FormData,
): Promise<SaveState | null> {
  const confirming = formData.get("discard_confirm");
  const requested = formData.get("discard_request");
  const raw = confirming ?? requested;
  if (raw === null) return null;

  const target = parseTarget(raw);
  if (!target) {
    return failed(
      "That discard could not be read, so nothing was changed. Reload the page and try again.",
    );
  }

  try {
    const supabase = await createServerSupabase();

    if (confirming === null) {
      const twins = await readTwins(supabase, target.table, target.identity);
      if (!twins.some((row) => row.status === "draft")) {
        return failed(
          "There is no unpublished edit here to discard. Reload the page to see where things stand.",
        );
      }

      return {
        status: "idle",
        confirming: {
          // The value as it arrived, not a re-serialisation of the parsed object: `parseTarget`
          // trims the label, so a round trip could produce a string the control no longer
          // recognises as its own and the prompt would render nowhere.
          target: typeof raw === "string" ? raw : "",
          prompt: discardPrompt(
            twins.some((row) => row.status === "published")
              ? "reverted"
              : "removed",
            target.label,
          ),
        },
      };
    }

    const { outcome, draft } = await discardDraft(
      supabase,
      target.table,
      target.identity,
    );

    /*
     * The uploaded file, once the row pointing at it is gone.
     *
     * Row first, deliberately. Removing the object first and then failing to delete the row
     * would leave a draft photograph whose bytes no longer exist — a broken row, which is worse
     * than an orphaned object. #121 names that trade and this is the side it comes down on.
     *
     * Deleting it is safe rather than merely tidy: `storagePathFor` timestamps every upload and
     * the upload uses `upsert: false`, so a draft's object is never the file a published row
     * points at. A failure is not reported as a failed discard, because the discard succeeded;
     * what is left behind is one unreferenced file.
     */
    if (target.table === "media" && typeof draft.storage_path === "string") {
      await supabase.storage.from("spaces").remove([draft.storage_path]);
    }

    // The pending count on the admin index moves, and so does this section's own render.
    revalidatePath("/admin");
    for (const { href } of ADMIN_SECTIONS) revalidatePath(href);

    return { status: "saved", message: discardResult(outcome, target.label) };
  } catch (error) {
    return failed(
      error instanceof DraftError
        ? error.message
        : "Something went wrong discarding that. Nothing was changed.",
    );
  }
}
