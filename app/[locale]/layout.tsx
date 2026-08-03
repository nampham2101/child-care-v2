import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { notFound } from "next/navigation";
import { NextIntlClientProvider, hasLocale } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";
import "../globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  // `default` is the full home-page title; `template` lets a sub-page set just its own
  // name (`"Programs"`) and get `"Programs · Willow Grove Children's Center"` for free,
  // so the center name is written once here rather than on every page.
  title: {
    default: "Willow Grove Children's Center · Licensed child care in NW Portland",
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

  return (
    <html lang={locale} className={`${geistSans.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <NextIntlClientProvider messages={messages}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
