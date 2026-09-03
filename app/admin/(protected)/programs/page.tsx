import type { Metadata } from "next";

import { savePrograms } from "@/app/admin/(protected)/programs/actions";
import { EditorForm } from "@/components/admin/EditorForm";
import { Field } from "@/components/admin/Field";
import { PendingEdit } from "@/components/admin/PendingEdit";
import { Section } from "@/components/admin/Section";
import {
  getAdminCatalogue,
  getEditablePrograms,
  getEditableRhythm,
} from "@/lib/admin/editable";
import { programLabel, rhythmLabel } from "@/lib/admin/labels";

export const metadata: Metadata = { title: "Rooms and the day" };

/**
 * The three rooms and the shape of a day.
 *
 * Ratios and group sizes appear on four pages — the home summary cards, `/programs`, `/about`
 * and the tuition table — which is why they are edited in one place. A ratio saying 1:4 on one
 * page and 1:5 on another is worse than publishing no ratio at all.
 */
export default async function ProgramsPage() {
  const [programs, rhythm, catalogue] = await Promise.all([
    getEditablePrograms(),
    getEditableRhythm(),
    getAdminCatalogue(),
  ]);

  return (
    <>
      <h1 className="text-2xl font-semibold text-ink-900">Rooms and the day</h1>
      <p className="mt-2 max-w-prose text-ink-700">
        The numbers a parent writes down when they are comparing you with the
        center down the road.
      </p>

      <div className="mt-8">
        <EditorForm action={savePrograms}>
          {programs.map((program) => {
            const label = programLabel(catalogue, program.key);

            return (
              <Section
                key={program.key}
                title={label.text}
                description={
                  label.missing
                    ? "This room has no name in the site's copy, so it renders blank on the public pages. That needs a developer."
                    : undefined
                }
                pending={program.hasDraft}
                discard={{
                  table: "programs",
                  identity: { key: program.key },
                  label: `the ${label.text} room`,
                }}
              >
                {/* The key travels with the row so the save knows which room this is. It is
                    never shown and never editable — see lib/admin/labels.ts. */}
                <input type="hidden" name="program_key" value={program.key} />

                {/* The ages and the group size were two more fields here until #123. They
                    are sentences rather than numbers — "6 weeks – 15 months", "8 children" —
                    so they are `prose` rows now and are edited under Copy → Rooms, in
                    whichever language the editor is set to. */}
                <Field
                  name={`ratio__${program.key}`}
                  label="Ratio"
                  hint="Caregivers to children, written the way it should appear — for example “1:4”. The same in every language, which is why it is here and the ages are in Copy."
                  defaultValue={program.ratio}
                />
                <Field
                  name={`sort_order__${program.key}`}
                  label="Order on the page"
                  hint="Lowest first. Rooms are listed youngest to oldest, because a parent arrives knowing their child's age and nothing else."
                  type="number"
                  inputMode="numeric"
                  defaultValue={program.sortOrder}
                />
              </Section>
            );
          })}

          {/* No `discard` on this section: it covers seven slots, so a control here would be a
              bulk discard rather than the one-thing-at-a-time action #121 built. Each slot
              carries its own below, and the badge counts them instead (#132). */}
          <Section
            title="A day here"
            description="The times a parent reads to picture their child's morning. Listed in the order they happen."
            pending={rhythm.some((slot) => slot.hasDraft)}
            pendingCount={rhythm.filter((slot) => slot.hasDraft).length}
          >
            {rhythm.map((slot) => {
              const label = rhythmLabel(catalogue, slot.labelKey);

              return (
                <div
                  key={slot.labelKey}
                  className="border-b border-border pb-5 last:border-0 last:pb-0"
                >
                  {/* Names the slot rather than the field, because a discard reverts the whole
                      row — the time and its order in the day, not just whichever one was
                      typed in. */}
                  <PendingEdit
                    pending={slot.hasDraft}
                    discard={{
                      table: "daily_rhythm",
                      identity: { label_key: slot.labelKey },
                      label: `the “${label.text}” slot`,
                    }}
                  />

                  <div className="grid gap-4 sm:grid-cols-2">
                    <input
                      type="hidden"
                      name="rhythm_key"
                      value={slot.labelKey}
                    />
                    <Field
                      name={`time__${slot.labelKey}`}
                      label={label.text}
                      hint="12-hour, no am or pm — the whole list runs through one day."
                      defaultValue={slot.time}
                    />
                    <Field
                      name={`rhythm_sort_order__${slot.labelKey}`}
                      label="Order in the day"
                      type="number"
                      inputMode="numeric"
                      defaultValue={slot.sortOrder}
                    />
                  </div>
                </div>
              );
            })}
          </Section>
        </EditorForm>
      </div>
    </>
  );
}
