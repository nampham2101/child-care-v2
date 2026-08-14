"use server";

import { revalidatePath } from "next/cache";

import { DraftError, saveDraft } from "@/lib/admin/drafts";
import { getEditablePrograms, getEditableRhythm } from "@/lib/admin/editable";
import { failed, invalid, saved, type SaveState } from "@/lib/admin/form-state";
import { FieldReader } from "@/lib/admin/validation";
import { createServerSupabase } from "@/lib/supabase-server";

/**
 * Save the rooms and the shape of the day.
 *
 * ## Only what actually changed is written
 *
 * The form posts every row, so a naive save would create a draft for all three rooms because
 * one ratio was corrected. That is not merely untidy: an "unpublished edit" badge on a row
 * nobody touched is a lie, and #75 turns this same set into the publish queue — where three
 * spurious entries would make a staff member approve changes they never made.
 *
 * So each row is compared against its current value and skipped when identical.
 */
export async function savePrograms(
  _previous: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const reader = new FieldReader(formData);

  const programKeys = formData.getAll("program_key").map(String);
  const rhythmKeys = formData.getAll("rhythm_key").map(String);

  const programEdits = programKeys.map((key) => ({
    key,
    values: {
      age_label: reader.text(`age_label__${key}`, "Ages in this room", {
        max: 60,
      }),
      ratio: reader.text(`ratio__${key}`, "Ratio", { max: 20 }),
      group_size: reader.text(`group_size__${key}`, "Group size", { max: 40 }),
      sort_order: reader.integer(`sort_order__${key}`, "Order on the page", {
        min: 0,
        max: 999,
      }),
    },
  }));

  const rhythmEdits = rhythmKeys.map((key) => ({
    key,
    values: {
      time: reader.text(`time__${key}`, "Time", { max: 20 }),
      sort_order: reader.integer(
        `rhythm_sort_order__${key}`,
        "Order in the day",
        { min: 0, max: 999 },
      ),
    },
  }));

  const result = reader.finish({ programEdits, rhythmEdits });
  if (!result.ok) return invalid(result.errors);

  try {
    const supabase = await createServerSupabase();
    const [currentPrograms, currentRhythm] = await Promise.all([
      getEditablePrograms(),
      getEditableRhythm(),
    ]);

    let written = 0;

    for (const edit of programEdits) {
      const current = currentPrograms.find((row) => row.key === edit.key);
      if (!current) continue;

      const unchanged =
        current.ageLabel === edit.values.age_label &&
        current.ratio === edit.values.ratio &&
        current.groupSize === edit.values.group_size &&
        current.sortOrder === edit.values.sort_order;
      if (unchanged) continue;

      await saveDraft(supabase, "programs", { key: edit.key }, edit.values);
      written += 1;
    }

    for (const edit of rhythmEdits) {
      const current = currentRhythm.find((row) => row.labelKey === edit.key);
      if (!current) continue;

      const unchanged =
        current.time === edit.values.time &&
        current.sortOrder === edit.values.sort_order;
      if (unchanged) continue;

      await saveDraft(
        supabase,
        "daily_rhythm",
        { label_key: edit.key },
        edit.values,
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
    /*
     * Rows are written one at a time — PostgREST offers no transaction across separate table
     * writes — so a failure part way through leaves earlier rows saved as drafts. That is safe
     * (nothing published moved) but it is not nothing, so the message says so rather than
     * implying the whole save was rolled back.
     */
    return failed(
      error instanceof DraftError
        ? `${error.message} Any rows saved before this point are still saved as drafts.`
        : "Something went wrong saving that. Nothing published was changed.",
    );
  }

  revalidatePath("/admin/programs");
  revalidatePath("/admin");
  return saved("The rooms and the day");
}
