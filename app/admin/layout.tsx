import type { Metadata } from "next";
import type { ReactNode } from "react";

import { geistSans } from "@/lib/fonts";
import "../globals.css";

/**
 * The admin area's document root.
 *
 * It renders `<html>` and `<body>` itself rather than inheriting them, because
 * `app/layout.tsx` is a passthrough and the real public document lives in
 * `app/[locale]/layout.tsx` — a sibling, not an ancestor. That is the consequence of the
 * decision recorded in `docs/CONVENTIONS.md` to put `app/admin/` outside the locale tree.
 *
 * WHY THE ADMIN IS NOT LOCALE-PREFIXED. The locale segment exists so a *parent* can read the
 * site in their language. Staff are the people who work at this one center, and the admin is
 * a tool rather than a publication. Prefixing it would add `/en/` to every staff URL, run
 * the locale middleware in front of an authenticated area, and imply a translated admin that
 * nothing intends to build. *Tripwire:* when #77 puts prose editing in here, a staff member
 * will need to switch which **content** locale they are editing — that is a control inside
 * the page, not a locale prefix on the URL, and the two should not be confused.
 */
export const metadata: Metadata = {
  title: {
    default: "Admin · Willow Grove Children's Center",
    template: "%s · Admin · Willow Grove Children's Center",
  },
  /*
   * A staff tool has no reason to appear in a search result, and a sign-in page ranking for
   * the center's name would be an odd first impression. The middleware already turns
   * unauthenticated requests away, so this is tidiness rather than a control — but it is
   * free and the omission would be noticed later by the wrong person.
   */
  robots: { index: false, follow: false },
};

/**
 * Nothing under `/admin` may be prerendered: every route here reads the session cookie, and
 * a cached admin page is a page that shows one person's state to another. Next would infer
 * this from `cookies()` anyway; it is declared because inference is not a guarantee anyone
 * can read, and the seven public pages staying static depends on this boundary being
 * explicit. See the build-output check in this ticket's pull request.
 */
export const dynamic = "force-dynamic";

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-cream-100">{children}</body>
    </html>
  );
}
