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

import { CENTER_ORG_SLUG, requireRow } from "@/lib/content";
import { supabase } from "@/lib/supabase";

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

  const row = requireRow(data, error, "Could not read site settings");

  return {
    name: row.orgs.name,
    phoneDisplay: row.phone_display,
    phoneHref: row.phone_href,
    emailDisplay: row.email_display,
    emailHref: row.email_href,
    licenseNumber: row.license_number,
    yearsOperatingSince: row.years_operating_since,
    ageRange: row.age_range,
    infantRatio: row.infant_ratio,
    hoursShort: row.hours_short,
    address: { line1: row.address_line1, line2: row.address_line2 },
    neighborhood: row.neighborhood,
  };
});
