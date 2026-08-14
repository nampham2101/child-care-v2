/**
 * The site's typeface, configured once.
 *
 * There are two document roots now — `app/[locale]/layout.tsx` for the public site and
 * `app/admin/layout.tsx` for the staff area — and each has to attach the font variable to
 * its own `<html>`. Configuring `Geist()` separately in both would be four lines of
 * duplicated config that drift the first time a subset or a weight changes, which is the
 * case `docs/CONVENTIONS.md` says to move into `lib/` on its second use.
 */
import { Geist } from "next/font/google";

export const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});
