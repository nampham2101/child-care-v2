/**
 * What an uploaded file has to be before it is allowed anywhere near Storage.
 *
 * ## This is the first untrusted input the system has ever accepted
 *
 * Everything before #78 was read-only or typed into a form by a signed-in member. An upload is
 * **bytes chosen by the person**, and #78 states the rule this module exists to enforce: *a
 * content-type header is a claim, not a fact.* A browser sets `File.type` from the file
 * extension; renaming `payload.svg` to `room.png` is enough to make it claim to be a PNG.
 *
 * So the type is decided by reading the first few bytes, and the claim is only used to produce
 * a better error message when the two disagree.
 *
 * ## Why sniffing rather than a library
 *
 * `sharp` and friends decode the image, which is more than is needed and pulls a native
 * dependency into a Netlify function for the sake of three magic numbers. `docs/CONVENTIONS.md`
 * prefers lightweight local tooling, and the check that matters — *is this actually one of the
 * three formats we accept* — is a byte comparison.
 *
 * **What this does not claim to do:** it is not a malware scan and it does not prove the file
 * decodes. A file that begins with the PNG signature and is then garbage passes here and renders
 * as a broken image. That is an acceptable failure — visible, harmless, and fixed by uploading
 * again — and it is worth being explicit that this is a format gate and not a safety guarantee.
 *
 * The dangerous formats are excluded by allowing only three: SVG is the one that matters, since
 * it is a document that can carry script, and it can never pass a signature check for JPEG, PNG
 * or WebP. The bucket restates the same three in `allowed_mime_types`, so a request that somehow
 * bypasses this is still refused by Storage.
 */

/** The formats a staff member may upload, and what each one begins with. */
const SIGNATURES = [
  {
    type: "image/jpeg" as const,
    extension: "jpg",
    // JPEG frames always open SOI (FF D8) followed by a marker (FF).
    matches: (bytes: Uint8Array) =>
      bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff,
  },
  {
    type: "image/png" as const,
    extension: "png",
    // The 8-byte PNG signature. The trailing CR/LF/EOF bytes are deliberately included: they
    // exist precisely so a file mangled by a text-mode transfer stops matching.
    matches: (bytes: Uint8Array) =>
      [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every(
        (byte, index) => bytes[index] === byte,
      ),
  },
  {
    type: "image/webp" as const,
    extension: "webp",
    // RIFF....WEBP — a container, so the format name sits at byte 8, past the length field.
    matches: (bytes: Uint8Array) =>
      [0x52, 0x49, 0x46, 0x46].every((byte, index) => bytes[index] === byte) &&
      [0x57, 0x45, 0x42, 0x50].every(
        (byte, index) => bytes[index + 8] === byte,
      ),
  },
];

/** Bytes needed to identify any of the three. WebP's marker ends at byte 12. */
export const SNIFF_BYTES = 12;

/** Matches the bucket's `file_size_limit`. Both are real; neither is decorative. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export type SniffedImage = { type: string; extension: string };

/**
 * What these bytes actually are, or `null` if they are not an image we accept.
 *
 * Pure and synchronous, so it is unit-testable against a handful of byte arrays rather than
 * against real files.
 */
export function sniffImage(bytes: Uint8Array): SniffedImage | null {
  if (bytes.length < SNIFF_BYTES) return null;

  const match = SIGNATURES.find((signature) => signature.matches(bytes));
  return match ? { type: match.type, extension: match.extension } : null;
}

export type UploadRejection = { ok: false; message: string };
export type UploadAcceptance = { ok: true; image: SniffedImage };

/**
 * The whole boundary check, in the order that produces the most useful message.
 *
 * Size first: a 40 MB file should be told it is too big rather than being read to find out what
 * format it is. Emptiness before that, because a zero-byte file is almost always a picker that
 * was cancelled and "that file is empty" is more use than "that is not an image".
 *
 * `claimedType` is only ever used to make a message friendlier. It is never trusted.
 */
export function checkUpload(
  bytes: Uint8Array,
  claimedType: string,
): UploadAcceptance | UploadRejection {
  if (bytes.length === 0) {
    return {
      ok: false,
      message: "That file is empty. Choose the photograph again.",
    };
  }

  if (bytes.length > MAX_UPLOAD_BYTES) {
    const megabytes = (bytes.length / 1024 / 1024).toFixed(1);
    return {
      ok: false,
      message: `That photograph is ${megabytes} MB, and the limit is 5 MB. Most phones can export a smaller copy.`,
    };
  }

  const image = sniffImage(bytes);
  if (!image) {
    // Naming the claim is the useful part: "it says PNG but it is not one" points at a renamed
    // file, which is the likeliest innocent cause and the one a person can act on.
    const claim = claimedType.trim();
    return {
      ok: false,
      message: claim
        ? `That file says it is ${claim}, but its contents are not a JPEG, PNG or WebP image. If it was renamed, export it again in one of those formats.`
        : "That is not a JPEG, PNG or WebP image.",
    };
  }

  return { ok: true, image };
}

/**
 * Where an image lives in the bucket: `<org_id>/<key>-<timestamp>.<ext>`.
 *
 * **The first segment is the tenancy boundary, not a tidy-up.** The Storage policies compare
 * `(storage.foldername(name))[1]` against `current_org_id()`, so a path built any other shape is
 * refused by the database. That is why this is one function rather than string concatenation at
 * the call site.
 *
 * The timestamp is what makes replacing a photograph safe. Writing to a stable path would
 * overwrite the file the **published** row still points at, so the live site would change the
 * moment a draft was uploaded — the one behaviour this editor has been careful never to have.
 * A new path per upload keeps the old bytes in place until Publish promotes the row.
 *
 * The cost, stated because it is real: replaced images are left behind in the bucket. At three
 * photographs on one site that is a rounding error, and the alternative — deleting the old
 * object on publish — is a delete that runs while the published row may still be being read by
 * an in-flight build. See #78's follow-ups.
 */
export function storagePathFor(
  orgId: string,
  key: string,
  extension: string,
  now: Date = new Date(),
): string {
  // Filenames are derived, never taken from the upload: an attacker-controlled filename is how
  // a path traversal or a surprise `.html` gets in. `key` is one of ours, and this asserts it.
  if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(key)) {
    throw new Error(
      `Refusing to build a storage path for the key ${JSON.stringify(key)}. Keys are ours, not the uploader's.`,
    );
  }

  return `${orgId}/${key}-${now.getTime()}.${extension}`;
}
