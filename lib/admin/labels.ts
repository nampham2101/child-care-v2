/**
 * Human names for the things the editor lists.
 *
 * ## The decision #74 asks for, stated here because this is where it is enforced
 *
 * **`key` and `label_key` are not editable, and are never shown.** #74 offers two ways to
 * handle the risk they carry — prevent the edit in the UI, or validate it against the message
 * catalogue at save time — and this is the first.
 *
 * The reasoning is not only safety. Those columns are the join between a database row and a
 * namespace in `messages/en.json`; a staff member who changed `infants` to `babies` would get a
 * blank card on the public site, and the key-coverage test that would catch it only runs at
 * build time, so the first sign is a broken page. But the simpler argument is #74's own
 * acceptance bar: *a staff member can complete the whole edit without being told a database
 * column name.* A `key` **is** a database column name. Validating it would mean showing it.
 *
 * The consequence to be honest about: **adding a room or a staff member is not possible in this
 * release**, because a new row needs a new key and its copy in the catalogue, and the
 * catalogue is not editable until #76 moves prose into the database. That is a real limit of
 * this ticket rather than an oversight, and it is why the editor changes existing content and
 * does not create it — see `lib/admin/drafts.ts`.
 *
 * *Tripwire:* when #76 lands and prose is editable, revisit this. At that point a staff member
 * could genuinely create a room, and the question becomes how a key is generated rather than
 * whether it is typed.
 */
import messages from "@/messages/en.json";

const CATALOGUE = messages as Record<string, Record<string, string>>;

export type Label = {
  /** What to show. Falls back to the raw key rather than rendering nothing. */
  text: string;
  /** True when the catalogue has no copy for this key — a broken public page waiting to happen. */
  missing: boolean;
};

/**
 * Looks up a key's display name in a namespace of the English catalogue.
 *
 * English rather than the active locale, because the admin is not locale-prefixed and its
 * chrome is not translated — see `lib/admin/nav.ts`. When #77 brings translated content into
 * the editor, choosing which locale is being *edited* is a control inside the page and a
 * separate concern from this.
 */
export function labelFor(namespace: string, key: string): Label {
  const text = CATALOGUE[namespace]?.[key];
  return text ? { text, missing: false } : { text: key, missing: true };
}

/** A room: `Programs.infants` → "Infants". */
export function programLabel(key: string): Label {
  return labelFor("Programs", key);
}

/** A moment in the day: `Day.arrival` → "Arrival and free play". */
export function rhythmLabel(labelKey: string): Label {
  return labelFor("Day", labelKey);
}

/** A staff member's role: `Staff.mariaRole` → "Director". Their name is a database column. */
export function staffRoleLabel(key: string): Label {
  return labelFor("Staff", `${key}Role`);
}

/** A schedule: `TuitionPage.fiveDayName` → "Five days". */
export function scheduleLabel(key: string): Label {
  return labelFor("TuitionPage", `${key}Name`);
}
