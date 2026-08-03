import type { ReactNode } from "react";

/**
 * A passthrough root layout. Next requires a layout at `app/`, but the real document —
 * `<html lang>`, the font, and the i18n provider — lives in `app/[locale]/layout.tsx`,
 * because only that layout knows the active locale from the URL. This file exists solely
 * to satisfy the framework and hands straight through to the locale layout.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return children;
}
