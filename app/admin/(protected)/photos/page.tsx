import type { Metadata } from "next";
import Image from "next/image";

import { saveSpacePhoto } from "@/app/admin/(protected)/photos/actions";
import { EditorForm } from "@/components/admin/EditorForm";
import { Field } from "@/components/admin/Field";
import { PhotoField } from "@/components/admin/PhotoField";
import { Section } from "@/components/admin/Section";
import { getEditableSpaces } from "@/lib/admin/editable";

export const metadata: Metadata = { title: "Photographs" };

/**
 * A photograph for each room.
 *
 * ## One form per room, which is a departure worth stating
 *
 * Every other editor page is a single form over every field. Uploads are different: slow, and
 * failing in ways typing does not. Bundling three into one submit would let a file that is too
 * large discard two that were fine. So each room is its own `EditorForm`, with its own result
 * message — the pattern the other pages establish, applied three times rather than once.
 *
 * ## No photographs of people
 *
 * Stated on the page, not only in `docs/PLAN.md`, because this is the screen where someone would
 * do it. Staff are monograms by decision, and rooms with nobody in them are also what makes this
 * feature carry no consent question at all.
 */
export default async function PhotosPage() {
  const spaces = await getEditableSpaces();

  return (
    <>
      <h1 className="text-2xl font-semibold text-ink-900">Photographs</h1>
      <p className="mt-2 max-w-prose text-ink-700">
        One picture of each room, shown on{" "}
        <span className="font-medium text-ink-900">/programs</span>. A parent
        deciding between two centers wants to see the room their child would
        actually be in.
      </p>
      <p className="mt-4 max-w-prose rounded-xl border border-border bg-cream-50 px-4 py-3 text-sm text-ink-700">
        <span className="font-medium text-ink-900">
          Photographs of the spaces only — never of children or staff.
        </span>{" "}
        Empty rooms, the garden, the entrance. This is a settled decision, and
        it is what keeps photograph consent out of this site entirely.
      </p>

      <div className="mt-8 flex flex-col gap-8">
        {spaces.map((space) => (
          <EditorForm
            key={space.key}
            action={saveSpacePhoto}
            submitLabel={space.image ? "Save draft" : "Upload"}
          >
            <input type="hidden" name="space_key" value={space.key} />

            <Section
              title={space.label}
              description={
                space.image
                  ? "Choosing a new file replaces this picture. The public site keeps the old one until you publish."
                  : "No photograph yet. This room shows no image on the public site until one is uploaded."
              }
              pending={space.hasDraft}
            >
              {space.image ? (
                <div className="overflow-hidden rounded-xl border border-border bg-cream-100">
                  {/*
                   * `unoptimized`, and only here. Netlify's Image CDN would otherwise cache a
                   * transform of a draft photograph under a URL the public page later reuses,
                   * so a staff member's unpublished picture could reach a visitor through the
                   * cache. The public page — the one that matters for performance — optimizes
                   * normally. This is three images on a staff-only screen.
                   */}
                  <Image
                    src={space.image.url}
                    alt={space.image.alt}
                    width={640}
                    height={420}
                    unoptimized
                    className="h-auto w-full object-cover"
                  />
                </div>
              ) : null}

              <PhotoField
                name={`photo__${space.key}`}
                label={
                  space.image ? "Replace the photograph" : "Choose a photograph"
                }
                hint="JPEG, PNG or WebP, up to 5 MB. Landscape works best — the card it sits in is wider than it is tall."
                required={!space.image}
              />

              <Field
                name={`alt__${space.key}`}
                label="Description of the photograph"
                hint="For a parent using a screen reader. Describe the room — “the infant room, with cots along the window” — not the fact that it is a photo."
                defaultValue={space.image?.alt ?? ""}
              />
            </Section>
          </EditorForm>
        ))}
      </div>
    </>
  );
}
