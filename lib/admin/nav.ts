/**
 * The editor's sections, defined once and read by both the admin header and the index page.
 *
 * Ordered the way #74 orders them, which is the order a staff member thinks about the center
 * rather than the order the tables were created: the place itself, then the rooms, then the
 * people, then the money.
 *
 * Unlike `lib/nav.ts` these labels are plain English rather than message keys. The admin is a
 * tool for the people who work at this one center, not a publication — `docs/PLAN.md` records
 * why it is not locale-prefixed, and the same reasoning applies to its chrome. When #77 brings
 * translated content into the editor, what a staff member switches is which **content** locale
 * they are editing, which is a control inside a page and not this list.
 */
export const ADMIN_SECTIONS = [
  {
    href: "/admin/center",
    label: "The center",
    // Not "opening hours" or "the ages you take" any more: #110 moved those, and the
    // neighbourhood, into the copy editor, because they are sentences that need translating
    // rather than facts. A description promising fields that are no longer on the page sends a
    // staff member to the wrong editor and makes them think something was lost.
    description: "Phone, email, licence number, address, and the infant ratio.",
  },
  {
    href: "/admin/programs",
    label: "Rooms and the day",
    description:
      "The three rooms, their ratios and group sizes, and the shape of a day.",
  },
  {
    href: "/admin/staff",
    label: "Staff",
    description:
      "Who works here, the year each of them started, and who appears on the home page.",
  },
  {
    href: "/admin/tuition",
    label: "Tuition",
    description:
      "The monthly rate for every room and schedule, plus registration and other fees.",
  },
  {
    href: "/admin/copy",
    label: "The words",
    description:
      "Every sentence on the site — room descriptions, staff bios, headings, each FAQ answer, and the ages, hours and area written into them.",
  },
  {
    href: "/admin/photos",
    label: "Photographs",
    description:
      "A picture of each room, shown on the programs page. Spaces only — never children or staff.",
  },
] as const;
