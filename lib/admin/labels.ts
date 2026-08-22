/**
 * Human names for the things the editor lists.
 *
 * ## Fixed here: #76 broke every one of these
 *
 * This module used to `import messages from "@/messages/en.json"` and look a name up in it.
 * #76 moved the site's copy into the database and trimmed that file to three chrome strings, so
 * every lookup started missing and falling back to the raw key. The facts editor went on saving
 * correctly and started *reading* wrong: `/admin/programs` listed "infants" instead of
 * "Infants", and `/admin/staff` told a staff member their own bio was missing and that it
 * "needs a developer".
 *
 * The end-to-end suite stayed green because it asserts on the fields, not the headings. That
 * gap is closed in `tests/e2e/admin-editor.spec.ts`.
 *
 * The names now come from the same place the copy does. Everything below is **pure** and takes
 * the catalogue as an argument — `getAdminCatalogue()` in `lib/admin/editable.ts` does the
 * reading. That keeps this file testable without a database, and it means a page fetches the
 * catalogue once rather than each label opening its own connection.
 *
 * ## The decision #74 asks for, still enforced
 *
 * **`key` and `label_key` are not editable, and are never shown.** #74 offers two ways to
 * handle the risk they carry — prevent the edit in the UI, or validate it at save time — and
 * this is the first.
 *
 * The reasoning is not only safety. Those columns join a database row to its copy; a staff
 * member who changed `infants` to `babies` would break the join. Since #76 that failure is loud
 * — the build stops — where it used to be a silently blank card. Louder, and still not a reason
 * to make keys editable, because #74's acceptance bar is unchanged: *a staff member can
 * complete the whole edit without being told a database column name.* A `key` **is** one.
 *
 * **The limit that just lifted:** adding a room or a staff member needed a new key *and* its
 * copy, and copy was not editable. It is now. Creating rows is still out of scope — the open
 * question is how a key gets generated rather than whether it is typed — but it is no longer
 * blocked on the catalogue. `docs/PLAN.md` carries that tripwire.
 */

/** The shape `getAdminCatalogue()` returns: namespace → key → string. */
export type LabelCatalogue = Record<string, Record<string, string>>;

export type Label = {
  /** What to show. Falls back to the raw key rather than rendering nothing. */
  text: string;
  /** True when there is no copy for this key — a broken public page waiting to happen. */
  missing: boolean;
};

/**
 * Looks up a key's display name in a namespace.
 *
 * The catalogue is the admin locale's, and draft-aware, because a staff member who renamed a
 * room and has not published yet should see the new name on the editor that produced it.
 * `lib/admin/nav.ts` records why the admin's own chrome is not translated; which locale's
 * *content* is being edited is a separate concern, handled in `lib/admin/editable.ts`.
 */
export function labelFor(
  catalogue: LabelCatalogue,
  namespace: string,
  key: string,
): Label {
  const text = catalogue[namespace]?.[key];
  return text ? { text, missing: false } : { text: key, missing: true };
}

/** A room: `Programs.infants` → "Infants". */
export function programLabel(catalogue: LabelCatalogue, key: string): Label {
  return labelFor(catalogue, "Programs", key);
}

/** A moment in the day: `Day.arrival` → "Arrival and free play". */
export function rhythmLabel(
  catalogue: LabelCatalogue,
  labelKey: string,
): Label {
  return labelFor(catalogue, "Day", labelKey);
}

/** A staff member's role: `Staff.mariaRole` → "Director". Their name is a database column. */
export function staffRoleLabel(catalogue: LabelCatalogue, key: string): Label {
  return labelFor(catalogue, "Staff", `${key}Role`);
}

/** A schedule: `TuitionPage.fiveDayName` → "Five days". */
export function scheduleLabel(catalogue: LabelCatalogue, key: string): Label {
  return labelFor(catalogue, "TuitionPage", `${key}Name`);
}
