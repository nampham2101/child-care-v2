"use server";

import { revalidatePath } from "next/cache";

import { DraftError, saveDraft } from "@/lib/admin/drafts";
import { maybeDiscard } from "@/lib/admin/discard-request";
import { getEditableStaff } from "@/lib/admin/editable";
import { failed, invalid, saved, type SaveState } from "@/lib/admin/form-state";
import { FieldReader } from "@/lib/admin/validation";
import { createServerSupabase } from "@/lib/supabase-server";

/**
 * Save the team.
 *
 * `since` is the year a person started, never a number of years. A stored "12 years" is wrong
 * on the first of January, which is why `lib/staff.ts` derives tenure from this column — and
 * why the form asks for a year and refuses anything that is not one.
 */
export async function saveStaff(
  _previous: SaveState,
  formData: FormData,
): Promise<SaveState> {
  /*
   * Discard first, before anything is read or validated (#121). A staff member who typed
   * something the form refuses is exactly the person most likely to want the edit gone, and a
   * discard blocked by "one field needs fixing" would be absurd when the fields are what is
   * being thrown away. Returns null when this submission is an ordinary save.
   */
  const discarded = await maybeDiscard(formData);
  if (discarded) return discarded;

  const reader = new FieldReader(formData);
  const keys = formData.getAll("staff_key").map(String);
  const thisYear = new Date().getFullYear();

  const edits = keys.map((key) => ({
    key,
    values: {
      name: reader.text(`name__${key}`, "Name", { max: 80 }),
      since: reader.integer(`since__${key}`, "Year they started", {
        min: 1900,
        max: thisYear,
      }),
      is_featured: reader.boolean(`is_featured__${key}`),
      sort_order: reader.integer(`sort_order__${key}`, "Order on the page", {
        min: 0,
        max: 999,
      }),
    },
  }));

  const result = reader.finish(edits);
  if (!result.ok) return invalid(result.errors);

  try {
    const supabase = await createServerSupabase();
    const current = await getEditableStaff();
    let written = 0;

    for (const edit of edits) {
      const before = current.find((row) => row.key === edit.key);
      if (!before) continue;

      const unchanged =
        before.name === edit.values.name &&
        before.since === edit.values.since &&
        before.isFeatured === edit.values.is_featured &&
        before.sortOrder === edit.values.sort_order;
      if (unchanged) continue;

      await saveDraft(supabase, "staff", { key: edit.key }, edit.values);
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
        ? `${error.message} Any rows saved before this point are still saved as drafts.`
        : "Something went wrong saving that. Nothing published was changed.",
    );
  }

  revalidatePath("/admin/staff");
  revalidatePath("/admin");
  return saved("The team");
}
