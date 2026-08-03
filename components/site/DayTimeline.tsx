import { getTranslations } from "next-intl/server";
import { DAILY_RHYTHM } from "@/lib/programs";

/**
 * The daily rhythm as a vertical timeline.
 *
 * The home page shows it to answer the question parents are too polite to ask — what
 * actually happens for nine hours — and `/programs` shows it again as the shared spine
 * the three rooms hang off. Two copies of this markup would drift the first time a clock
 * time moved, so it is one component reading one list from `@/lib/programs`.
 *
 * A Server Component: it renders text and nothing here is interactive.
 */
export async function DayTimeline() {
  const t = await getTranslations("Day");

  return (
    <ol className="max-w-xl">
      {DAILY_RHYTHM.map((slot) => (
        <li
          key={slot.time}
          className="flex gap-4 border-l-2 border-sage-200 pb-6 pl-5 last:pb-0"
        >
          <span className="w-14 shrink-0 text-sm font-semibold text-sage-700 tabular-nums">
            {slot.time}
          </span>
          <span className="text-ink-700">{t(slot.labelKey)}</span>
        </li>
      ))}
    </ol>
  );
}
