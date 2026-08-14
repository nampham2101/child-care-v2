import type { Metadata } from "next";

import { saveCenter } from "@/app/admin/(protected)/center/actions";
import { EditorForm } from "@/components/admin/EditorForm";
import { Field } from "@/components/admin/Field";
import { Section } from "@/components/admin/Section";
import { getEditableCenter } from "@/lib/admin/editable";

export const metadata: Metadata = { title: "The center" };

/**
 * The center's facts — the values that appear in the header, the footer, the contact block and
 * the trust strip, which is why they are one row rather than typed per page.
 */
export default async function CenterPage() {
  const center = await getEditableCenter();

  if (!center) {
    return (
      <p className="max-w-prose text-ink-700">
        There are no details to edit yet. This usually means the account you are
        signed in with belongs to a different organization than the one this
        site publishes — see issue #87.
      </p>
    );
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-ink-900">The center</h1>
      <p className="mt-2 max-w-prose text-ink-700">
        These appear all over the site — the phone number in the header, the
        licence number in the footer of every page. Changing one here changes
        every place it shows.
      </p>

      <div className="mt-8">
        <EditorForm action={saveCenter}>
          <Section
            title="Getting in touch"
            description="The phone number is the one thing this whole site is trying to get a parent to use."
            pending={center.hasDraft}
          >
            <Field
              name="phone_display"
              label="Phone number"
              hint="Written the way it should look on the page. The tap-to-call link is worked out from it."
              inputMode="tel"
              defaultValue={center.phoneDisplay}
            />
            <Field
              name="email_display"
              label="Email address"
              inputMode="email"
              defaultValue={center.emailDisplay}
            />
            <Field
              name="hours_short"
              label="Opening hours"
              hint="Short enough to sit in a card — for example “Mon–Fri, 7:00am–6:00pm”."
              defaultValue={center.hoursShort}
            />
          </Section>

          <Section title="Where you are">
            <Field
              name="address_line1"
              label="Street address"
              defaultValue={center.addressLine1}
            />
            <Field
              name="address_line2"
              label="Town, state and postcode"
              defaultValue={center.addressLine2}
            />
            <Field
              name="neighborhood"
              label="Neighbourhood"
              hint="How a local would describe where you are. Parents search this way."
              defaultValue={center.neighborhood}
            />
          </Section>

          <Section
            title="Licence and ages"
            description="The evidence a parent is looking for before anything else."
          >
            <Field
              name="license_number"
              label="Licence number"
              defaultValue={center.licenseNumber}
            />
            <Field
              name="years_operating_since"
              label="Year the center opened"
              hint="A year, not a number of years — “12 years open” would be wrong every January."
              type="number"
              inputMode="numeric"
              defaultValue={center.yearsOperatingSince}
            />
            <Field
              name="age_range"
              label="Ages you take"
              hint="For example “6 weeks to 5 years”."
              defaultValue={center.ageRange}
            />
            <Field
              name="infant_ratio"
              label="Infant ratio"
              hint="For example “1:4”. This is the number parents compare centers on."
              defaultValue={center.infantRatio}
            />
          </Section>
        </EditorForm>
      </div>
    </>
  );
}
