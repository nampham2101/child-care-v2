/**
 * The fictional center's facts, in one place.
 *
 * These values appear in the header, hero eyebrow, trust strip, contact block, and footer.
 * A parent who spots the license number in the header and again in the footer must see the
 * same number — so it is defined once here rather than typed into each section, where the
 * copies would drift the first time one is edited.
 *
 * Everything here is placeholder content for a fictional center. The phone number uses the
 * 555-01xx range reserved for fiction so nobody's real line is ever dialled.
 */
export const CENTER = {
  name: "Willow Grove Children's Center",

  // Displayed to humans, and the digits the tap-to-call link actually dials. Kept as a
  // pair so the pretty format and the tel: target can never disagree.
  phoneDisplay: "(503) 555-0142",
  phoneHref: "tel:+15035550142",

  // Same display/href pairing as the phone. The `.example` domain is reserved by RFC 2606
  // for exactly this, so placeholder copy can never send a parent's message to a real
  // inbox. Calling is the conversion action; email is the slower second option.
  emailDisplay: "hello@willowgrove.example",
  emailHref: "mailto:hello@willowgrove.example",

  licenseNumber: "C-1094872",
  yearsOperatingSince: 2009,

  ageRange: "6 weeks to 5 years",
  infantRatio: "1:4",

  hoursShort: "Mon–Fri, 7:00 AM – 6:00 PM",

  address: {
    line1: "428 Alder Street",
    line2: "Portland, OR 97210",
  },

  // A neighbourhood description a parent can picture, not a marketing superlative.
  neighborhood: "Northwest Portland, one block from Wallace Park",
} as const;
