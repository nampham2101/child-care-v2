"use server";

import { revalidatePath } from "next/cache";

import { DraftError, saveDraft } from "@/lib/admin/drafts";
import { maybeDiscard } from "@/lib/admin/discard-request";
import { getEditableFees, getEditableRates } from "@/lib/admin/editable";
import { failed, invalid, saved, type SaveState } from "@/lib/admin/form-state";
import { FieldReader } from "@/lib/admin/validation";
import { createServerSupabase } from "@/lib/supabase-server";

/**
 * Save the rate sheet and the fees that are not the monthly rate.
 *
 * A rate is identified by the pair of rows it prices — schedule and room — rather than by a key
 * of its own, so the pair travels with the form as hidden ids. Both twins of a rate carry the
 * same pair, which is what lets a draft and its published twin be recognised as the same cell.
 *
 * **No cell may be left blank.** `lib/tuition.ts` raises when a schedule has no rate for a
 * room, because the tuition page renders a grid and one missing pair is an empty cell in a
 * price table — which a parent reads as "call us", on the page whose whole argument is that
 * this center does not hide its prices. The schema cannot express that (a unique constraint
 * stops duplicates but cannot require a pair exists), so the form refuses an empty rate the
 * same way the read path refuses a missing one.
 */
export async function saveTuition(
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

  const pairs = formData.getAll("rate_pair").map(String);

  const rateEdits = pairs.map((pair) => {
    const [scheduleId, programId] = pair.split("|");
    return {
      scheduleId,
      programId,
      perMonth: reader.integer(`rate__${pair}`, "Monthly rate", {
        // Mirrors `per_month > 0` in the schema. Zero is not a free place, it is a missing
        // number, and it would print as "$0" on the rate sheet.
        min: 1,
        max: 100_000,
      }),
    };
  });

  const fees = {
    registration: reader.integer("registration", "Registration fee", {
      min: 0,
      max: 100_000,
    }),
    deposit_weeks: reader.integer("deposit_weeks", "Deposit, in weeks", {
      min: 0,
      max: 52,
    }),
    notice_weeks: reader.integer("notice_weeks", "Notice required, in weeks", {
      min: 0,
      max: 52,
    }),
    late_pickup_per_minute: reader.integer(
      "late_pickup_per_minute",
      "Late pickup, per minute",
      { min: 0, max: 1000 },
    ),
    sibling_discount_percent: reader.integer(
      "sibling_discount_percent",
      "Sibling discount",
      // Mirrors `sibling_discount_percent between 0 and 100`.
      { min: 0, max: 100 },
    ),
  };

  const result = reader.finish({ rateEdits, fees });
  if (!result.ok) return invalid(result.errors);

  try {
    const supabase = await createServerSupabase();
    const [currentRates, currentFees] = await Promise.all([
      getEditableRates(),
      getEditableFees(),
    ]);

    let written = 0;

    for (const edit of rateEdits) {
      const before = currentRates.find(
        (rate) =>
          rate.scheduleId === edit.scheduleId &&
          rate.programId === edit.programId,
      );
      if (!before || before.perMonth === edit.perMonth) continue;

      await saveDraft(
        supabase,
        "tuition_rates",
        { schedule_id: edit.scheduleId, program_id: edit.programId },
        { per_month: edit.perMonth },
      );
      written += 1;
    }

    const feesUnchanged =
      currentFees !== null &&
      currentFees.registration === fees.registration &&
      currentFees.depositWeeks === fees.deposit_weeks &&
      currentFees.noticeWeeks === fees.notice_weeks &&
      currentFees.latePickupPerMinute === fees.late_pickup_per_minute &&
      currentFees.siblingDiscountPercent === fees.sibling_discount_percent;

    if (!feesUnchanged) {
      await saveDraft(supabase, "tuition_fees", {}, fees);
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

  revalidatePath("/admin/tuition");
  revalidatePath("/admin");
  return saved("The rate sheet");
}
