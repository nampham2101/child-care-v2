"use server";

import { revalidatePath } from "next/cache";

import { DraftError, saveDraft } from "@/lib/admin/drafts";
import { getEditableProse } from "@/lib/admin/editable";
import { failed, invalid, saved, type SaveState } from "@/lib/admin/form-state";
import { groupBySlug, proseLimitFor } from "@/lib/admin/prose-groups";
import { FieldReader, placeholdersIn } from "@/lib/admin/validation";
import { createServerSupabase } from "@/lib/supabase-server";

/**
 * Save one group of copy.
 *
 * ## Everything trusted is re-read from the database
 *
 * The form posts a group slug and a value per key, and **nothing else is believed**. Which keys
 * exist, which placeholders each must keep, and what the length limit is are all derived here
 * from the rows themselves. The alternative — hidden inputs carrying the limit and the
 * placeholder list — would let a crafted POST declare that a string needs no placeholders and
 * publish a change that breaks the next build.
 *
 * That is also why the key list comes from `getEditableProse` rather than from the form. A key
 * posted that the group does not contain is simply not iterated, so it cannot reach `saveDraft`
 * at all.
 */
export async function saveProse(
  _previous: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const slug = String(formData.get("group_slug") ?? "");
  const group = groupBySlug(slug);
  if (!group) {
    return failed(
      "That set of words does not exist. Go back to The words and pick a page.",
    );
  }

  const current = await getEditableProse(group.namespace);
  if (current.length === 0) {
    return failed(
      `There is no copy stored for ${group.label}. Nothing was changed — this needs a developer.`,
    );
  }

  const limit = proseLimitFor(current.map((string) => string.value));
  const reader = new FieldReader(formData);

  const edits = current.map((string) => ({
    key: string.key,
    value: reader.prose(
      `prose__${string.key}`,
      string.label,
      // Re-derived from the stored row, not taken from the form.
      placeholdersIn(string.value),
      { max: limit },
    ),
  }));

  const result = reader.finish(edits);
  if (!result.ok) return invalid(result.errors);

  try {
    const supabase = await createServerSupabase();
    let written = 0;

    for (const edit of edits) {
      const before = current.find((string) => string.key === edit.key);
      if (!before || before.value === edit.value) continue;

      await saveDraft(
        supabase,
        "prose",
        {
          namespace: group.namespace,
          key: edit.key,
          locale: before.locale,
        },
        { value: edit.value },
      );
      written += 1;
    }

    if (written === 0) {
      return {
        status: "saved",
        message: "Nothing had changed, so nothing was saved.",
      };
    }
  } catch (error) {
    return failed(
      error instanceof DraftError
        ? `${error.message} Any words saved before this point are still saved as drafts.`
        : "Something went wrong saving that. Nothing published was changed.",
    );
  }

  revalidatePath(`/admin/copy/${group.slug}`);
  revalidatePath("/admin/copy");
  revalidatePath("/admin");
  return saved(group.label);
}
