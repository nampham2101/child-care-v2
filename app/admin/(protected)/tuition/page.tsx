import type { Metadata } from "next";

import { saveTuition } from "@/app/admin/(protected)/tuition/actions";
import { EditorForm } from "@/components/admin/EditorForm";
import { Field } from "@/components/admin/Field";
import { PendingEdit } from "@/components/admin/PendingEdit";
import { Section } from "@/components/admin/Section";
import {
  getAdminCatalogue,
  getEditableFees,
  getEditableRates,
} from "@/lib/admin/editable";
import { programLabel, scheduleLabel } from "@/lib/admin/labels";
import { formatRate } from "@/lib/tuition";

export const metadata: Metadata = { title: "Tuition" };

/**
 * The rate sheet, grouped by schedule so a staff member edits a row of the table they can
 * picture rather than a flat list of pairs.
 *
 * `formatRate` is imported from `lib/tuition.ts` rather than reimplemented, so the currency a
 * staff member sees while editing is formatted by exactly the code that renders the public
 * page — #74's rule about not growing a second copy of the read path.
 */
export default async function TuitionPage() {
  const [rates, fees, catalogue] = await Promise.all([
    getEditableRates(),
    getEditableFees(),
    getAdminCatalogue(),
  ]);

  const bySchedule = new Map<string, typeof rates>();
  for (const rate of rates) {
    bySchedule.set(rate.scheduleKey, [
      ...(bySchedule.get(rate.scheduleKey) ?? []),
      rate,
    ]);
  }

  return (
    <>
      <h1 className="text-2xl font-semibold text-ink-900">Tuition</h1>
      <p className="mt-2 max-w-prose text-ink-700">
        Every room needs a rate for every schedule. A blank cell in a price
        table reads as “call us”, on the one page whose argument is that you
        don&rsquo;t hide your prices.
      </p>

      <div className="mt-8">
        <EditorForm action={saveTuition}>
          {[...bySchedule.entries()].map(([scheduleKey, scheduleRates]) => {
            const label = scheduleLabel(catalogue, scheduleKey);

            return (
              <Section
                key={scheduleKey}
                title={label.text}
                description={
                  label.missing
                    ? "This schedule has no name in the site's copy, so its column heading renders blank. That needs a developer."
                    : "Monthly, per child, in whole dollars."
                }
                pending={scheduleRates.some((rate) => rate.hasDraft)}
                pendingCount={
                  scheduleRates.filter((rate) => rate.hasDraft).length
                }
              >
                {scheduleRates.map((rate) => {
                  const pair = `${rate.scheduleId}|${rate.programId}`;
                  const room = programLabel(catalogue, rate.programKey);

                  return (
                    <div key={pair}>
                      {/*
                       * A rate is the one discardable thing with no key of its own — it is
                       * identified by the pair it prices, which is why the identity is two
                       * UUIDs rather than a name. The label has to make up for that: "the
                       * Five days rate for Toddlers" is the only wording that lands, because
                       * neither half alone identifies a cell on the densest screen here, and
                       * the UUIDs identify nothing to a person at all.
                       */}
                      <PendingEdit
                        pending={rate.hasDraft}
                        discard={{
                          table: "tuition_rates",
                          identity: {
                            schedule_id: rate.scheduleId,
                            program_id: rate.programId,
                          },
                          label: `the ${label.text} rate for ${room.text}`,
                        }}
                      />
                      <input type="hidden" name="rate_pair" value={pair} />
                      <Field
                        name={`rate__${pair}`}
                        label={room.text}
                        hint={`Currently ${formatRate(rate.perMonth)} a month.`}
                        type="number"
                        inputMode="numeric"
                        defaultValue={rate.perMonth}
                      />
                    </div>
                  );
                })}
              </Section>
            );
          })}

          {fees ? (
            <Section
              title="The other numbers"
              description="What a rate sheet usually leaves out and a parent finds at signing. They sit in the hero for that reason."
              pending={fees.hasDraft}
              discard={{
                table: "tuition_fees",
                identity: {},
                label: "the registration and other fees",
              }}
            >
              <Field
                name="registration"
                label="Registration fee"
                hint="One-off, in whole dollars."
                type="number"
                inputMode="numeric"
                defaultValue={fees.registration}
              />
              <Field
                name="deposit_weeks"
                label="Deposit, in weeks"
                hint="How many weeks of tuition are held as a deposit."
                type="number"
                inputMode="numeric"
                defaultValue={fees.depositWeeks}
              />
              <Field
                name="notice_weeks"
                label="Notice required, in weeks"
                type="number"
                inputMode="numeric"
                defaultValue={fees.noticeWeeks}
              />
              <Field
                name="late_pickup_per_minute"
                label="Late pickup, per minute"
                hint="In whole dollars."
                type="number"
                inputMode="numeric"
                defaultValue={fees.latePickupPerMinute}
              />
              <Field
                name="sibling_discount_percent"
                label="Sibling discount"
                hint="A percentage, 0 to 100."
                type="number"
                inputMode="numeric"
                defaultValue={fees.siblingDiscountPercent}
              />
            </Section>
          ) : null}
        </EditorForm>
      </div>
    </>
  );
}
