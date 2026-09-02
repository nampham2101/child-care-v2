"use server";

import { revalidatePath } from "next/cache";

import {
  contentLocaleName,
  DEFAULT_CONTENT_LOCALE,
  resolveContentLocale,
} from "@/lib/admin/content-locale";
import { DraftError, saveDraft } from "@/lib/admin/drafts";
import { maybeDiscard } from "@/lib/admin/discard-request";
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
 *
 * The posted locale gets the same treatment (#111): it is resolved against `routing.locales`
 * and falls back to the default, so a crafted POST cannot write rows for a language the site
 * does not ship.
 *
 * ## Placeholders come from the DEFAULT locale, not from the row being edited
 *
 * This is the one rule that changes when a second language arrives, and it is the difference
 * between validation that works and validation that looks like it does.
 *
 * `FieldReader.prose` refuses a value that has dropped a placeholder the site fills in — 19
 * strings interpolate something, and next-intl throws on a message missing its argument, so a
 * dropped `{ageRange}` is a failed build rather than a cosmetic slip. The required set used to
 * be derived from the value being replaced, which is exactly right while there is one locale
 * and subtly wrong once there are two: **a German row that has already lost `{ageRange}` would
 * validate against itself and stay broken forever.**
 *
 * So the requirement comes from the English counterpart — the same placeholder set its source
 * has. A translator may reorder them or move them inside the sentence, which German grammar
 * routinely demands, but may not drop one.
 */
export async function saveProse(
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

  const slug = String(formData.get("group_slug") ?? "");
  const group = groupBySlug(slug);
  if (!group) {
    return failed(
      "That set of words does not exist. Go back to The words and pick a page.",
    );
  }

  const locale = resolveContentLocale(formData.get("locale"));

  const current = await getEditableProse(group.namespace, locale);
  if (current.length === 0) {
    return failed(
      `There is no ${contentLocaleName(locale)} copy stored for ${group.label}. ` +
        "Nothing was changed — this needs a developer.",
    );
  }

  // The placeholder requirement per key, taken from the default locale. One extra query when
  // editing a translation, none when editing the default (the rows are already in hand).
  const source =
    locale === DEFAULT_CONTENT_LOCALE
      ? current
      : await getEditableProse(group.namespace, DEFAULT_CONTENT_LOCALE);
  const requiredByKey = new Map(
    source.map((string) => [string.key, placeholdersIn(string.value)]),
  );

  const limit = proseLimitFor(current.map((string) => string.value));
  const reader = new FieldReader(formData);

  const edits = current.map((string) => ({
    key: string.key,
    value: reader.prose(
      `prose__${string.key}`,
      string.label,
      // Re-derived from stored rows, never taken from the form. Falls back to the row's own
      // placeholders for a key the default locale somehow lacks — refusing to validate at all
      // would be worse than validating against the only source available.
      requiredByKey.get(string.key) ?? placeholdersIn(string.value),
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
  // Names the language when there is more than one, so the confirmation cannot be mistaken for
  // a save against the words the person was reading a moment ago in another tab.
  return saved(
    locale === DEFAULT_CONTENT_LOCALE
      ? group.label
      : `${group.label} (${contentLocaleName(locale)})`,
  );
}
