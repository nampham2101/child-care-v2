import { createNavigation } from "next-intl/navigation";

import { routing } from "./routing";

/**
 * Locale-aware navigation primitives. Components import `Link` (and friends) from here
 * rather than from `next/link`, so an internal href like `/about` is written once and the
 * active locale prefix (`/en/about`) is added automatically. A hand-written `/en/...` in a
 * component would rot the moment the default locale changes; these helpers cannot.
 */
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
