"use server";

import { revalidatePath } from "next/cache";

import { DraftError, saveDraft } from "@/lib/admin/drafts";
import { maybeDiscard } from "@/lib/admin/discard-request";
import { failed, invalid, saved, type SaveState } from "@/lib/admin/form-state";
import { FieldReader } from "@/lib/admin/validation";
import { createServerSupabase } from "@/lib/supabase-server";

/**
 * Save the center's facts as a draft.
 *
 * The phone number and email address are each read as **one** field and stored as two columns.
 * `site_settings` keeps `phone_display` beside `phone_href` so the pretty format and the dial
 * target cannot disagree, and the surest way to make them disagree is to ask a person to keep
 * both in sync. So the `tel:` and `mailto:` are derived — see `lib/admin/validation.ts`.
 *
 * The ages, opening hours and neighbourhood are **not** saved here any more. #110 moved them
 * into `public.prose`, so the copy editor owns them and this action must not also write them —
 * two forms writing one row is how an edit silently loses to whichever was saved last.
 */
export async function saveCenter(
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

  const phone = reader.phone("phone_display", "Phone number");
  const email = reader.email("email_display", "Email address");

  const fields = {
    phone_display: phone.display,
    phone_href: phone.href,
    email_display: email.display,
    email_href: email.href,
    license_number: reader.text("license_number", "Licence number", {
      max: 40,
    }),
    years_operating_since: reader.integer(
      "years_operating_since",
      "Year the center opened",
      // Upper bound is the current year: a center cannot have opened next spring, and the
      // number is rendered as "since 2009" on the footer of every page.
      { min: 1900, max: new Date().getFullYear() },
    ),
    infant_ratio: reader.text("infant_ratio", "Infant ratio", { max: 20 }),
    address_line1: reader.text("address_line1", "Street address", { max: 120 }),
    address_line2: reader.text("address_line2", "Town, state and postcode", {
      max: 120,
    }),
  };

  const result = reader.finish(fields);
  if (!result.ok) return invalid(result.errors);

  try {
    const supabase = await createServerSupabase();
    await saveDraft(supabase, "site_settings", {}, result.value);
  } catch (error) {
    return failed(
      error instanceof DraftError
        ? error.message
        : "Something went wrong saving that. Nothing was changed.",
    );
  }

  // So the page re-reads and shows the draft it just wrote, rather than the values it was
  // rendered with.
  revalidatePath("/admin/center");
  revalidatePath("/admin");
  return saved("The center's details");
}
