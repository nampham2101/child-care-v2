/**
 * The upload boundary, tested as the things someone would actually send.
 *
 * This is the only module in the project that inspects untrusted bytes, so the cases worth
 * writing are the ones where a plausible file would otherwise get through: a renamed document
 * claiming to be a PNG, an SVG (a document that can carry script, and the reason the allow-list
 * is three formats rather than "image/*"), and a truncated file too short to identify.
 */
import { describe, expect, it } from "vitest";

import {
  MAX_UPLOAD_BYTES,
  checkUpload,
  sniffImage,
  storagePathFor,
} from "@/lib/admin/image";

/** A byte array beginning with `signature`, padded to a plausible length. */
function fileStartingWith(signature: number[], length = 64): Uint8Array {
  const bytes = new Uint8Array(length);
  bytes.set(signature, 0);
  return bytes;
}

const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
/** RIFF, four length bytes, then WEBP. */
const WEBP = [
  0x52, 0x49, 0x46, 0x46, 0x00, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
];

describe("sniffImage", () => {
  it("recognises the three formats we accept", () => {
    expect(sniffImage(fileStartingWith(JPEG))?.type).toBe("image/jpeg");
    expect(sniffImage(fileStartingWith(PNG))?.type).toBe("image/png");
    expect(sniffImage(fileStartingWith(WEBP))?.type).toBe("image/webp");
  });

  it("gives an extension that matches the format, not the filename", () => {
    expect(sniffImage(fileStartingWith(JPEG))?.extension).toBe("jpg");
    expect(sniffImage(fileStartingWith(PNG))?.extension).toBe("png");
    expect(sniffImage(fileStartingWith(WEBP))?.extension).toBe("webp");
  });

  /*
   * The format that matters most. An SVG is a document, it can carry script, and "image/svg+xml"
   * looks entirely reasonable in a content-type header — so the allow-list is three signatures
   * rather than a `startsWith("image/")` check on the claim.
   */
  it("refuses an SVG", () => {
    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
    );
    expect(sniffImage(svg)).toBeNull();
  });

  it("refuses a PDF and a zip", () => {
    expect(sniffImage(fileStartingWith([0x25, 0x50, 0x44, 0x46]))).toBeNull();
    expect(sniffImage(fileStartingWith([0x50, 0x4b, 0x03, 0x04]))).toBeNull();
  });

  /*
   * RIFF is a container — WAV and AVI open with the same four bytes. Checking only the prefix
   * would accept an audio file as an image, which is why the format name at byte 8 is checked.
   */
  it("refuses a RIFF file that is not WebP", () => {
    const wav = [...WEBP];
    wav[8] = 0x57; // W
    wav[9] = 0x41; // A
    wav[10] = 0x56; // V
    wav[11] = 0x45; // E
    expect(sniffImage(fileStartingWith(wav))).toBeNull();
  });

  it("refuses a file too short to identify", () => {
    expect(sniffImage(new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull();
  });

  /*
   * The PNG signature's trailing bytes exist to detect a mangled transfer. Dropping them would
   * still "look like" a PNG to a prefix check, so this pins that they are actually compared.
   */
  it("refuses a PNG whose signature was mangled in transit", () => {
    const mangled = [...PNG];
    mangled[4] = 0x0a; // CR turned into a bare LF
    expect(sniffImage(fileStartingWith(mangled))).toBeNull();
  });
});

describe("checkUpload", () => {
  it("accepts a real image and reports what it actually is", () => {
    const result = checkUpload(fileStartingWith(PNG), "image/png");
    expect(result).toEqual({
      ok: true,
      image: { type: "image/png", extension: "png" },
    });
  });

  /*
   * The case #78 is written around: the claim says PNG, the bytes say otherwise. The claim is
   * used only to write a message a person can act on — "if it was renamed, export it again".
   */
  it("refuses a renamed file and names the claim it made", () => {
    const result = checkUpload(
      new TextEncoder().encode("%PDF-1.7 this is not a picture of a room"),
      "image/png",
    );

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("image/png");
  });

  it("trusts a correct claim no more than a wrong one", () => {
    // Bytes are a PNG; the claim is nonsense. The bytes win, so this is accepted.
    const result = checkUpload(fileStartingWith(PNG), "application/x-nonsense");
    expect(result.ok).toBe(true);
  });

  it("refuses an empty file with a message about the picker, not the format", () => {
    const result = checkUpload(new Uint8Array(0), "image/png");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/empty/i);
  });

  /*
   * Size is checked before format so a 40 MB file is told it is too big rather than being read
   * to discover what it is.
   */
  it("refuses an oversized file and says how big it was", () => {
    const huge = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    huge.set(PNG, 0);
    const result = checkUpload(huge, "image/png");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("5 MB");
  });

  it("accepts a file exactly at the limit", () => {
    const exact = new Uint8Array(MAX_UPLOAD_BYTES);
    exact.set(PNG, 0);
    expect(checkUpload(exact, "image/png").ok).toBe(true);
  });
});

describe("storagePathFor", () => {
  const ORG = "80980882-0d79-4c89-92c8-b14ffcd95b68";

  /*
   * The first segment is the tenancy boundary — the Storage policies compare it against
   * current_org_id() — so this is not a naming convention and a change here is a policy change.
   */
  it("puts the organization first, which is what the storage policy checks", () => {
    const path = storagePathFor(
      ORG,
      "infants",
      "jpg",
      new Date(1_700_000_000_000),
    );
    expect(path.startsWith(`${ORG}/`)).toBe(true);
  });

  it("includes the key and the extension", () => {
    const path = storagePathFor(
      ORG,
      "infants",
      "webp",
      new Date(1_700_000_000_000),
    );
    expect(path).toBe(`${ORG}/infants-1700000000000.webp`);
  });

  /*
   * A stable path would overwrite the bytes the *published* row still points at, so uploading a
   * draft would change the live site immediately — the one behaviour this editor never has.
   */
  it("gives a different path each time, so a draft cannot overwrite what is live", () => {
    const first = storagePathFor(
      ORG,
      "infants",
      "jpg",
      new Date(1_700_000_000_000),
    );
    const second = storagePathFor(
      ORG,
      "infants",
      "jpg",
      new Date(1_700_000_000_001),
    );
    expect(first).not.toBe(second);
  });

  /*
   * Filenames are derived, never taken from the upload. These are the shapes that would turn a
   * key into a path traversal or a surprise extension if one ever reached here unchecked.
   */
  it.each([
    ["a traversal", "../../etc/passwd"],
    ["a slash", "infants/nested"],
    ["an extension", "infants.html"],
    ["empty", ""],
    ["a leading digit", "1infants"],
  ])("refuses %s as a key", (_what, key) => {
    expect(() => storagePathFor(ORG, key, "jpg")).toThrow(/Refusing/);
  });
});
