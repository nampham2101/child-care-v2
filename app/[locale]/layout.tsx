import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import {
  getMessages,
  getTranslations,
  setRequestLocale,
} from "next-intl/server";
import { LocaleSwitcher } from "@/components/site/LocaleSwitcher";
import { SiteNav } from "@/components/site/SiteNav";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { getCenter } from "@/lib/center";
import { geistSans } from "@/lib/fonts";
import { SITE_URL } from "@/lib/seo";
import "../globals.css";

export const metadata: Metadata = {
  /*
   * Required for `hreflang` and the sitemap (#52): Next resolves the relative alternates each
   * page declares against this, and without it they would be emitted relative and ignored.
   * `lib/seo.ts` explains why it follows the Netlify deploy URL rather than being hard-coded —
   * a preview must not claim to be production.
   */
  metadataBase: new URL(SITE_URL),
  // `template` lets a sub-page set just its own name (`"Programs"`) and get
  // `"Programs · Willow Grove Children's Center"` for free, so the center name is written once
  // here rather than on every page. It is a proper noun and identical in every language.
  //
  // `default` and `description` are the LAST RESORT only. Every one of the seven public pages
  // now supplies its own from the catalogue, the home page included since #53 — so what still
  // reaches these two is a route with no metadata of its own, which today means `/_not-found`.
  // They stay English because they are not on a translated page; making them locale-aware would
  // mean a `generateMetadata` here whose only caller is the 404.
  title: {
    default:
      "Willow Grove Children's Center · Licensed child care in NW Portland",
    template: "%s · Willow Grove Children's Center",
  },
  description:
    "A small, licensed child care center in Northwest Portland for ages 6 weeks to 5 years, where the same caregivers know your child by name. Call to plan a visit.",
};

// Prerender every locale at build time — the whole site is static (see docs/PLAN.md).
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;

  // A URL segment that is not a locale we ship is a 404, not a silent fallback — the
  // middleware already redirects `/`, so anything reaching here with a bad locale is a
  // real not-found.
  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Opt this layout (and the pages under it) into static rendering. Without it, reading
  // the locale would mark the route dynamic and the site would stop being prerendered.
  setRequestLocale(locale);

  const messages = await getMessages();
  const tFooter = await getTranslations("Footer");
  const center = await getCenter();

  return (
    <html lang={locale} className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider messages={messages}>
          {/* Header — the chrome every page shares. Sticky, so the brand and the primary
              nav stay reachable as a parent reads down a long page. The tap-to-call button
              is not here by choice; calling is offered in the page body instead.
              Being `sticky` also makes this the containing block the mobile menu panel
              positions against, so the panel drops flush with the header's bottom edge. */}
          <header className="sticky top-0 z-20 border-b border-border bg-background/90 backdrop-blur">
            {/* `gap-3` and the `min-w-0` below are what make this hold at 360px with the
                language control present (#52). The centre's name is the flexible element:
                it shrinks and truncates rather than pushing the nav toggle off the edge,
                because a half-visible name is recoverable and an unreachable menu is not. */}
            <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-3 px-5 py-4">
              <Link
                href="/"
                className="min-w-0 truncate rounded-sm text-base font-semibold text-ink-900 focus-visible:ring-2 focus-visible:ring-sage-900 focus-visible:ring-offset-4 focus-visible:ring-offset-background focus-visible:outline-none"
              >
                {center.name}
              </Link>
              {/* `shrink-0` so the controls keep their full width and the name gives way. */}
              <div className="flex shrink-0 items-center gap-2 sm:gap-4">
                <LocaleSwitcher locale={locale} />
                <SiteNav />
              </div>
            </div>
          </header>

          {children}

          {/* Footer — legal, licensing. Shared by every page, so it lives here rather
              than being re-inlined per page where the license number would drift. */}
          <footer className="border-t border-border">
            <div className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-5 py-8 text-sm text-ink-500">
              <p className="font-medium text-ink-700">{center.name}</p>
              <p>
                {tFooter("tagline", {
                  licenseNumber: center.licenseNumber,
                  // A string, not the raw number — ICU would render 2009 as "2,009".
                  since: String(center.yearsOperatingSince),
                })}
              </p>
              <p>
                {center.address.line1}, {center.address.line2}
              </p>
            </div>
          </footer>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
