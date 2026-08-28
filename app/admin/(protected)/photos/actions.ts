"use server";

import { revalidatePath } from "next/cache";

import { DraftError, saveOrCreateDraft } from "@/lib/admin/drafts";
import { getEditableSpaces } from "@/lib/admin/editable";
import { checkUpload, storagePathFor } from "@/lib/admin/image";
import { failed, invalid, saved, type SaveState } from "@/lib/admin/form-state";
import { FieldReader } from "@/lib/admin/validation";
import { createServerSupabase } from "@/lib/supabase-server";

/**
 * Upload one photograph and attach it to a room.
 *
 * ## One room per submit, unlike every other editor form
 *
 * The facts and copy pages save every field at once, because a staff member proofreading a page
 * fixes four things and presses Save once. **An upload is not that.** It is slow, it fails in
 * ways typing does not — the wrong format, a file off a camera that is too large — and bundling
 * three of them into one submit would mean one bad file discarding two good uploads. So each
 * room has its own form and its own result.
 *
 * ## The order of operations, and why the bytes go first
 *
 * Validate, upload to Storage, then write the row. If the upload fails, no row is written and
 * nothing changed. If the row write fails, an orphaned object is left in the bucket — which
 * costs a few kilobytes and is invisible, where the reverse order would leave a row pointing at
 * an object that does not exist and render a broken image on the public site.
 *
 * Between the two, the wasted bytes are the cheaper failure.
 */
export async function saveSpacePhoto(
  _previous: SaveState,
  formData: FormData,
): Promise<SaveState> {
  const key = String(formData.get("space_key") ?? "");

  /*
   * The key is checked against the rooms that actually exist rather than trusted. It reaches
   * `storagePathFor`, which builds a filename from it — an unchecked key from a crafted POST is
   * how a path traversal or a surprise extension gets into a bucket. That function asserts the
   * shape too; this is the layer that also asserts it is *ours*.
   */
  const spaces = await getEditableSpaces();
  const space = spaces.find((candidate) => candidate.key === key);
  if (!space) {
    return failed(
      "That room does not exist. Go back to Photographs and try again.",
    );
  }

  const reader = new FieldReader(formData);
  const alt = reader.text(`alt__${key}`, "Description of the photograph", {
    max: 160,
  });

  const file = formData.get(`photo__${key}`);
  const hasFile = file instanceof File && file.size > 0;

  /*
   * Alt text alone is a legitimate edit — fixing a description without re-uploading the
   * picture. But there has to be *something* to attach it to, so the first submit for a room
   * must carry a file.
   */
  if (!hasFile && !space.image) {
    return failed(
      `Choose a photograph of ${space.label}. There is nothing here yet, so a description on its own has nothing to describe.`,
    );
  }

  /*
   * The bytes are checked HERE, before `finish`, so a bad file and an empty description are
   * reported together rather than whichever the action happened to reach first. The result goes
   * in as a field error on the file input, so the message appears under the control it is about
   * instead of as a page-level banner.
   */
  let bytes: Uint8Array | null = null;
  let checked: ReturnType<typeof checkUpload> | null = null;
  if (hasFile) {
    // Read ONCE, and kept. A File from a server action's FormData is not reliably re-readable —
    // a second `arrayBuffer()` can hand back nothing, and the upload then stores an empty
    // object that the checks above already declared valid. Found in CI, which is the only place
    // this path runs.
    bytes = new Uint8Array(await file.arrayBuffer());
    checked = checkUpload(bytes, file.type);
    if (!checked.ok) reader.reject(`photo__${key}`, checked.message);
  }

  const validation = reader.finish(alt);
  if (!validation.ok) return invalid(validation.errors);

  try {
    const supabase = await createServerSupabase();

    if (!hasFile) {
      // Description-only edit. The path stays as it was; only `alt` moves.
      if (space.image && space.image.alt === alt) {
        return {
          status: "saved",
          message: "Nothing had changed, so nothing was saved.",
        };
      }
      await saveOrCreateDraft(supabase, "media", { key }, { alt }, {});
      revalidatePath("/admin/photos");
      revalidatePath("/admin");
      return saved(`The description of ${space.label}`);
    }

    // Narrowed rather than re-checked: `finish` above already refused every rejection, so
    // reaching here means the bytes passed and were kept.
    if (!checked?.ok || !bytes) {
      return failed("The photograph could not be read. Choose it again.");
    }
    const check = checked;

    /*
     * The organization comes from `current_org_id()` rather than from anything the form sent.
     * It is the first path segment, which the Storage policies compare against that same
     * function — so a value from the form could not widen access, but it could produce a path
     * the policy refuses, and the resulting error would look like a bug rather than a forgery.
     */
    const { data: orgId, error: orgError } =
      await supabase.rpc("current_org_id");
    if (orgError || !orgId) {
      return failed(
        "This account is not attached to an organization, so there is nowhere to file the photograph. That needs a developer — see issue #87.",
      );
    }

    const storagePath = storagePathFor(orgId, key, check.image.extension);

    const { error: uploadError } = await supabase.storage
      .from("spaces")
      .upload(storagePath, bytes, {
        contentType: check.image.type,
        // Never overwrite. Paths carry a timestamp, so a collision means two uploads in the
        // same millisecond — and silently replacing bytes the published row points at is the
        // one thing the timestamped path exists to prevent.
        upsert: false,
      });

    if (uploadError) {
      return failed(
        `The photograph could not be stored: ${uploadError.message}. Nothing was changed.`,
      );
    }

    await saveOrCreateDraft(
      supabase,
      "media",
      { key },
      { storage_path: storagePath, alt },
      { org_id: orgId },
    );
  } catch (error) {
    return failed(
      error instanceof DraftError
        ? error.message
        : "Something went wrong saving that. Nothing published was changed.",
    );
  }

  revalidatePath("/admin/photos");
  revalidatePath("/admin");
  return saved(`The photograph of ${space.label}`);
}
