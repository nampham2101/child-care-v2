/**
 * The site's primary navigation, defined once.
 *
 * Every page renders the same header, so the link list lives here rather than in the nav
 * component — a page ticket (#18–23) adds its route by appending one entry, and the header
 * picks it up everywhere with no markup to touch. Order is the order parents care about it:
 * programs first (the thing they came to compare), contact last (the conversion action).
 *
 * `href` is an unlocalized internal path (`/programs`). The locale prefix (`/en/programs`)
 * is added by next-intl's navigation `Link`, never hand-written here — see `@/i18n/navigation`.
 * `labelKey` names the string under the `Nav` namespace in `messages/en.json`, so the visible
 * text is translatable while the route stays a plain fact.
 */
export const NAV_LINKS = [
  { href: "/programs", labelKey: "programs" },
  { href: "/about", labelKey: "about" },
  { href: "/staff", labelKey: "staff" },
  { href: "/tuition", labelKey: "tuition" },
  { href: "/faq", labelKey: "faq" },
  { href: "/contact", labelKey: "contact" },
] as const;
