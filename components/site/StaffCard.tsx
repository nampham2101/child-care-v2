import { getTranslations } from "next-intl/server";
import { initialsOf, type StaffMember, yearsWith } from "@/lib/staff";

/**
 * One person, as a monogram and the three facts a parent wants under a name.
 *
 * The home page's strip introduces three of them and `/staff` lists all seven, so the
 * markup is here rather than in both pages — the tenure line in particular is a fact, and
 * two copies of it would drift the first time one was edited.
 *
 * A `<figure>` with a `<figcaption>`, not a heading: the monogram is an illustration of
 * the person and the text is its caption, which is exactly what those elements are for.
 * It also keeps a name from being announced as a section heading in a list of seven.
 *
 * `bio` is optional because the home strip is an introduction and `/staff` is the page
 * that actually answers who these people are. The role and bio come from the `Staff`
 * namespace keyed by `person.key`; the name and the year they joined come from
 * `@/lib/staff`. See `docs/CONVENTIONS.md` for that split.
 */
export async function StaffCard({
  person,
  showBio = false,
}: {
  person: StaffMember;
  showBio?: boolean;
}) {
  const t = await getTranslations("Staff");

  return (
    <figure className="flex flex-col rounded-2xl border border-border bg-surface p-6">
      <div
        aria-hidden="true"
        className="flex h-16 w-16 items-center justify-center rounded-full bg-sage-50 text-lg font-semibold text-sage-700"
      >
        {initialsOf(person.name)}
      </div>
      <figcaption className="mt-4">
        <div className="font-semibold text-ink-900">{person.name}</div>
        <div className="text-sm text-ink-700">{t(`${person.key}Role`)}</div>
        <div className="mt-1 text-sm text-ink-500">
          {t("tenure", { years: yearsWith(person) })}
        </div>
        {showBio ? (
          <p className="mt-3 text-ink-700">{t(`${person.key}Bio`)}</p>
        ) : null}
      </figcaption>
    </figure>
  );
}
