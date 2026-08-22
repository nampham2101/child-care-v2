/**
 * Photographs of the spaces, read from the database at build time.
 *
 * Same shape as every other module in `lib/`: published rows only, filtered to this center's
 * organization, fetched once per build. `@/lib/content` explains why the organization filter is
 * a filtered inner join rather than defensive tidiness.
 *
 * ## A missing photograph is not a missing fact
 *
 * Everything else in `lib/` fails the build when its rows are absent, and deliberately —
 * `@/lib/content` argues that stale ratios cost more than a red build. **Images are the
 * exception, and it is a considered one.** A room with no photograph yet is an ordinary state:
 * `v0.4.0` ships with the bucket empty, and the first upload happens after the release, through
 * the admin. Failing the build on an absent image would mean the site could not be built until
 * somebody uploaded three files.
 *
 * So this returns a map and the caller renders what is there. The page must look deliberate with
 * no images at all, which is the layout constraint #78 pushes onto `/programs` and the reason
 * the card does not reserve empty space for one.
 */
import { cache } from "react";

import { CENTER_ORG_SLUG } from "@/lib/content";
import { readSupabaseConfig } from "@/lib/supabase-config";

export type SpaceImage = {
  /** Joins to a program band's key. */
  key: string;
  /** Absolute URL, ready for `next/image`. */
  url: string;
  alt: string;
};

/**
 * The public URL of an object in the `spaces` bucket.
 *
 * Built here rather than with `supabase.storage.getPublicUrl()` so it can be a pure function of
 * the configured project URL — no client, no import-time credential check — and so the shape is
 * visible in one place, because `next.config.ts` has to allow exactly this shape in
 * `images.remotePatterns` and the two must agree.
 */
export function publicUrlFor(storagePath: string): string {
  const { projectUrl } = readSupabaseConfig();
  return `${projectUrl.replace(/\/$/, "")}/storage/v1/object/public/spaces/${storagePath}`;
}

/**
 * Every published photograph, keyed by the space it shows.
 *
 * A map rather than a list because every caller asks "is there one for this room?", and a list
 * would make each of them write the same `find`.
 */
export const getSpaceImages = cache(
  async (): Promise<Map<string, SpaceImage>> => {
    const { supabase } = await import("@/lib/supabase");

    const { data, error } = await supabase
      .from("media")
      .select("key, storage_path, alt, orgs!inner (slug)")
      .eq("orgs.slug", CENTER_ORG_SLUG);

    /*
     * An error is not the same as an empty result and is not tolerated the way emptiness is. No
     * rows means nothing has been uploaded yet; a failed query means the database is
     * unreachable or a policy changed, and rendering a site silently missing its photographs
     * would hide that. Every other module routes this through `@/lib/content`; this one cannot,
     * because that helper's whole purpose is to also fail on empty.
     */
    if (error) {
      throw new Error(
        `Could not read the photographs of the spaces: ${error.message}. ` +
          "An empty result is fine and renders no images; this is a failed query.",
      );
    }

    return new Map(
      (data ?? []).map((row) => [
        row.key,
        {
          key: row.key,
          url: publicUrlFor(row.storage_path),
          alt: row.alt,
        },
      ]),
    );
  },
);
