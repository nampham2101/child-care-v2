/**
 * The center's facts, read from the database at build time.
 *
 * These values appear in the header, hero eyebrow, trust strip, contact block, and footer.
 * A parent who spots the license number in the header and again in the footer must see the
 * same number — so it is fetched once here rather than typed into each section, where the
 * copies would drift the first time one is edited.
 *
 * Until this module was converted, the same values were a frozen object literal. They now
 * come from `site_settings`, which is what makes them editable by center staff without a
 * developer — the entire reason `docs/PLAN.md` puts a database behind a brochure site.
 *
 * **This runs at build time, not in a visitor's request path.** Every page that calls it is
 * prerendered, and `docs/PLAN.md` rules out putting Supabase in front of a visitor. If a page
 * calling this ever becomes dynamic, that decision has been broken silently — the build
 * output listing every route as static is what catches it.
 */
import { cache } from "react";

import { supabase } from "@/lib/supabase";

/**
 * Which organization this site renders. Every content query filters on it.
 *
 * The anonymous policy is `status = 'published'` and carries no organization scope — see
 * `docs/PLAN.md` — so a query without this filter would happily return another tenant's
 * published rows. `supabase/fixtures/rls.sql` keeps a deliberately absurd published row in a
 * second organization so that forgetting is visible rather than silent.
 */
export const CENTER_ORG_SLUG = "willow-grove";

/**
 * The shape the pages consume, which is deliberately the shape the old constant had: display
 * and href kept adjacent so the pretty format and the dial target cannot disagree, and the
 * address nested. Mapping snake_case columns to it here means one module knows the column
 * names, rather than every page learning them.
 */
export type Center = {
  name: string;
  phoneDisplay: string;
  phoneHref: string;
  emailDisplay: string;
  emailHref: string;
  licenseNumber: string;
  yearsOperatingSince: number;
  ageRange: string;
  infantRatio: string;
  hoursShort: string;
  address: { line1: string; line2: string };
  neighborhood: string;
};

/** Thrown when the build cannot get the facts it is supposed to render. */
export class CenterContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CenterContentError";
  }
}

/**
 * `cache` deduplicates this within a single render pass. The layout, the page, and
 * `CallButton` all need these facts, and without it one prerendered page would issue three
 * identical queries for them. It does not persist across pages, which is correct — seven
 * queries across a whole build is not a cost worth engineering around.
 */
export const getCenter = cache(async (): Promise<Center> => {
  const { data, error } = await supabase
    .from("site_settings")
    .select(
      `phone_display, phone_href,
       email_display, email_href,
       license_number, years_operating_since,
       age_range, infant_ratio, hours_short,
       address_line1, address_line2, neighborhood,
       orgs!inner (name, slug)`,
    )
    // The join is inner and filtered, so this cannot return a different organization's row
    // even though the anonymous policy would allow reading one.
    .eq("orgs.slug", CENTER_ORG_SLUG)
    // `maybeSingle`, not `single`: a missing row is a case worth its own message rather than
    // PostgREST's PGRST116, which reads like a query bug rather than absent content.
    .maybeSingle();

  if (error) {
    throw new CenterContentError(
      `Could not read site_settings for "${CENTER_ORG_SLUG}": ${error.message}. ` +
        "The build needs the database; see supabase/README.md.",
    );
  }

  // A missing row comes back as null with no error, so this is the branch that actually
  // catches an unseeded database — and it must throw rather than fall back.
  //
  // There is deliberately no fallback to the old hardcoded values. A site that quietly
  // serves stale placeholder facts whenever the row is absent is worse than a build that
  // stops: the license number and the ratio are what a parent acts on, and nobody would ever
  // find out they had gone stale. Failing here costs a red build; the alternative costs
  // trust, silently.
  if (!data) {
    throw new CenterContentError(
      `No published site_settings row for organization "${CENTER_ORG_SLUG}". ` +
        "Apply supabase/seed.sql — see supabase/README.md. Note that a draft row is " +
        "invisible to the anonymous key and looks identical to a missing one from here.",
    );
  }

  return {
    name: data.orgs.name,
    phoneDisplay: data.phone_display,
    phoneHref: data.phone_href,
    emailDisplay: data.email_display,
    emailHref: data.email_href,
    licenseNumber: data.license_number,
    yearsOperatingSince: data.years_operating_since,
    ageRange: data.age_range,
    infantRatio: data.infant_ratio,
    hoursShort: data.hours_short,
    address: { line1: data.address_line1, line2: data.address_line2 },
    neighborhood: data.neighborhood,
  };
});
