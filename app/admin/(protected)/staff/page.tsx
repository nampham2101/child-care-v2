import type { Metadata } from "next";

import { saveStaff } from "@/app/admin/(protected)/staff/actions";
import { EditorForm } from "@/components/admin/EditorForm";
import { CheckboxField, Field } from "@/components/admin/Field";
import { Section } from "@/components/admin/Section";
import { getEditableStaff } from "@/lib/admin/editable";
import { staffRoleLabel } from "@/lib/admin/labels";
import { averageTenure, yearsWith } from "@/lib/staff";

export const metadata: Metadata = { title: "Staff" };

/**
 * The team.
 *
 * `averageTenure` and `yearsWith` are imported from `lib/staff.ts` rather than recalculated
 * here. #74 is explicit: the admin must not grow its own copies of the derived helpers, because
 * that is how the editor and the public page start disagreeing about the same number. Showing
 * the average back to a staff member as they edit is also the point — it is the single figure
 * the `/staff` hero is built around.
 */
export default async function StaffPage() {
  const staff = await getEditableStaff();

  // The same arithmetic the public page does, on the same shape of row. The draft values are
  // what is shown, so a staff member sees what the average *would become* before publishing.
  const average = staff.length > 0 ? averageTenure(staff) : 0;

  return (
    <>
      <h1 className="text-2xl font-semibold text-ink-900">Staff</h1>
      <p className="mt-2 max-w-prose text-ink-700">
        Tenure is the number a parent is really reading — a center where nobody
        stays is a center where nobody knows their child.
      </p>
      <p className="mt-4 rounded-xl border border-border bg-cream-50 px-4 py-3 text-sm text-ink-700">
        With the values below, the average tenure shown on{" "}
        <span className="font-medium text-ink-900">/staff</span> would be{" "}
        <span className="font-semibold text-ink-900">
          {average} {average === 1 ? "year" : "years"}
        </span>
        .
      </p>

      <div className="mt-8">
        <EditorForm action={saveStaff}>
          {staff.map((person) => {
            const role = staffRoleLabel(person.key);

            return (
              <Section
                key={person.key}
                title={person.name || role.text}
                description={
                  role.missing
                    ? "This person has no role or bio in the site's copy, so their card renders half-empty. That needs a developer."
                    : `${role.text} · ${yearsWith(person)} years here`
                }
                pending={person.hasDraft}
              >
                <input type="hidden" name="staff_key" value={person.key} />

                <Field
                  name={`name__${person.key}`}
                  label="Name"
                  hint="As a parent would be introduced to them."
                  defaultValue={person.name}
                />
                <Field
                  name={`since__${person.key}`}
                  label="Year they started"
                  hint="A year, not a number of years — otherwise it would be wrong every January."
                  type="number"
                  inputMode="numeric"
                  defaultValue={person.since}
                />
                <CheckboxField
                  name={`is_featured__${person.key}`}
                  label="Show on the home page"
                  hint="The home page introduces a few of the team. Everyone appears on /staff regardless."
                  defaultChecked={person.isFeatured}
                />
                <Field
                  name={`sort_order__${person.key}`}
                  label="Order on the page"
                  hint="Lowest first. The order a parent meets people — leadership, then room by room, then the kitchen."
                  type="number"
                  inputMode="numeric"
                  defaultValue={person.sortOrder}
                />
              </Section>
            );
          })}
        </EditorForm>
      </div>
    </>
  );
}
