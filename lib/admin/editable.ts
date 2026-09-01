/**
 * What the editor loads: the current state of every fact, with the pending edits folded in.
 *
 * One module rather than four mirroring `lib/center.ts`, `lib/programs.ts`, `lib/staff.ts` and
 * `lib/tuition.ts`, because those answer four different questions and this answers one — *what
 * does a staff member see right now* — and because the admin index needs a count of pending
 * edits across all of them, which a split would have to reassemble.
 *
 * ## This is not a second copy of the read path
 *
 * Every derived value the public site shows — `featuredStaff`, `yearsWith`, `averageTenure`,
 * `lowestFullTimeRate`, `initialsOf`, `formatRate` — stays in its existing module and is
 * imported from there wherever the admin needs it. #74 is explicit that the admin must not
 * grow its own copies, because that is how the editor and the page start disagreeing about
 * what a rate says. What is genuinely new here is only the draft-aware read, which the public
 * site has no use for: it reads published rows and nothing else, by policy.
 *
 * Organization scoping is row-level security's job here, not a filter — see
 * `lib/admin/drafts.ts` for why the admin deliberately does the opposite of the public queries.
 */
import { routing } from "@/i18n/routing";
import { hasDraft, pickEffective, readTwins } from "@/lib/admin/drafts";
import { programLabel } from "@/lib/admin/labels";
import { fieldLabel } from "@/lib/admin/prose-groups";
import { placeholdersIn } from "@/lib/admin/validation";
import { publicUrlFor } from "@/lib/media";
import { createServerSupabase } from "@/lib/supabase-server";

/**
 * Which locale's copy the editor works on.
 *
 * One shipped locale, so there is nothing to switch and no control is rendered — building a
 * picker with a single option would be dead UI. Every function below still takes a locale, so
 * #53 and #54 add a control rather than a rewrite. `docs/PLAN.md` records the shape that
 * control takes when it arrives: inside the page, never a prefix on the admin URL.
 */
const ADMIN_LOCALE = routing.defaultLocale;

/** Every editable section carries this, so the UI can mark what is not yet live. */
type Pending = { hasDraft: boolean };

/**
 * The center's facts. The ages, opening hours and neighbourhood are deliberately NOT here —
 * #110 moved them into `public.prose`, because they are sentences rather than facts and a
 * German page would otherwise carry an English clause through the middle of one. They are
 * edited in the copy editor now, under the "Ages, hours and area" group.
 */
export type EditableCenter = Pending & {
  phoneDisplay: string;
  emailDisplay: string;
  licenseNumber: string;
  yearsOperatingSince: number;
  infantRatio: string;
  addressLine1: string;
  addressLine2: string;
};

/**
 * A room's facts. The age range and the group size are deliberately NOT here — #123 moved them
 * into `public.prose` for the reason #110 moved the center's three, one table over: they are
 * English sentences rather than facts, and `programs` has no locale, so a German room card
 * rendered them untranslated. They are edited in the copy editor now, under "Rooms".
 */
export type EditableProgram = Pending & {
  key: string;
  ratio: string;
  sortOrder: number;
};

export type EditableRhythmSlot = Pending & {
  labelKey: string;
  time: string;
  sortOrder: number;
};

export type EditableStaffMember = Pending & {
  key: string;
  name: string;
  since: number;
  isFeatured: boolean;
  sortOrder: number;
};

export type EditableRate = Pending & {
  scheduleKey: string;
  programKey: string;
  perMonth: number;
  /** The pair that identifies this cell. Both twins carry the same two, which is what lets a
   *  draft rate and its published twin be recognised as the same cell. */
  scheduleId: string;
  programId: string;
};

export type EditableFees = Pending & {
  registration: number;
  depositWeeks: number;
  noticeWeeks: number;
  latePickupPerMinute: number;
  siblingDiscountPercent: number;
};

/**
 * Groups both twins of each thing under the key that identifies it, then picks the one to
 * show. Written once because all four keyed sections need exactly this.
 */
function byKey<T extends { status: string }>(
  rows: readonly T[],
  keyOf: (row: T) => string,
): { key: string; row: T; hasDraft: boolean }[] {
  const groups = new Map<string, T[]>();
  for (const row of rows) {
    const key = keyOf(row);
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }

  return [...groups.entries()]
    .map(([key, twins]) => ({
      key,
      row: pickEffective(twins)!,
      hasDraft: hasDraft(twins),
    }))
    .filter((entry) => entry.row !== undefined);
}

function num(value: unknown): number {
  return typeof value === "number" ? value : Number(value ?? 0);
}

function str(value: unknown): string {
  return typeof value === "string" ? value : String(value ?? "");
}

export async function getEditableCenter(): Promise<EditableCenter | null> {
  const supabase = await createServerSupabase();
  const twins = await readTwins(supabase, "site_settings");
  const row = pickEffective(twins);
  if (!row) return null;

  return {
    phoneDisplay: str(row.phone_display),
    emailDisplay: str(row.email_display),
    licenseNumber: str(row.license_number),
    yearsOperatingSince: num(row.years_operating_since),
    infantRatio: str(row.infant_ratio),
    addressLine1: str(row.address_line1),
    addressLine2: str(row.address_line2),
    hasDraft: hasDraft(twins),
  };
}

export async function getEditablePrograms(): Promise<EditableProgram[]> {
  const supabase = await createServerSupabase();
  const twins = await readTwins(supabase, "programs");

  return byKey(twins, (row) => str(row.key))
    .map(({ key, row, hasDraft: pending }) => ({
      key,
      ratio: str(row.ratio),
      sortOrder: num(row.sort_order),
      hasDraft: pending,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getEditableRhythm(): Promise<EditableRhythmSlot[]> {
  const supabase = await createServerSupabase();
  const twins = await readTwins(supabase, "daily_rhythm");

  return byKey(twins, (row) => str(row.label_key))
    .map(({ key, row, hasDraft: pending }) => ({
      labelKey: key,
      time: str(row.time),
      sortOrder: num(row.sort_order),
      hasDraft: pending,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function getEditableStaff(): Promise<EditableStaffMember[]> {
  const supabase = await createServerSupabase();
  const twins = await readTwins(supabase, "staff");

  return byKey(twins, (row) => str(row.key))
    .map(({ key, row, hasDraft: pending }) => ({
      key,
      name: str(row.name),
      since: num(row.since),
      isFeatured: Boolean(row.is_featured),
      sortOrder: num(row.sort_order),
      hasDraft: pending,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

/**
 * The rate sheet, as a grid of schedule against room.
 *
 * A rate is identified by the pair of rows it points at, not by a key of its own, so the ids
 * are mapped back to keys here. Both twins of a program share one key, so mapping across every
 * row — draft and published alike — resolves a rate whichever twin it happens to reference.
 */
export async function getEditableRates(): Promise<EditableRate[]> {
  const supabase = await createServerSupabase();

  const [rateRows, scheduleRows, programRows] = await Promise.all([
    readTwins(supabase, "tuition_rates"),
    readTwins(supabase, "tuition_schedules"),
    readTwins(supabase, "programs"),
  ]);

  const scheduleKeyById = new Map(
    scheduleRows.map((row) => [row.id, str(row.key)]),
  );
  const programKeyById = new Map(
    programRows.map((row) => [row.id, str(row.key)]),
  );

  const scheduleOrder = new Map(
    byKey(scheduleRows, (row) => str(row.key)).map(({ key, row }) => [
      key,
      num(row.sort_order),
    ]),
  );
  const programOrder = new Map(
    byKey(programRows, (row) => str(row.key)).map(({ key, row }) => [
      key,
      num(row.sort_order),
    ]),
  );

  // The separator is written as an ESCAPE, never as a literal NUL byte. It was the byte itself
  // until #110 noticed why that matters: a single unprintable character makes git classify the
  // whole file as binary, so every change to this module since #95 arrived in review as
  // `Bin 12625 -> 14834 bytes` with no readable diff at all. The escape compiles to exactly the
  // same string — the composite key is byte-identical — and the file stays reviewable. Keep it
  // an escape, here and in `getEditableProse` below.
  return byKey(rateRows, (row) => {
    const schedule = scheduleKeyById.get(str(row.schedule_id)) ?? "";
    const program = programKeyById.get(str(row.program_id)) ?? "";
    return `${schedule}\u0000${program}`;
  })
    .map(({ key, row, hasDraft: pending }) => {
      const [scheduleKey, programKey] = key.split("\u0000");
      return {
        scheduleKey,
        programKey,
        perMonth: num(row.per_month),
        scheduleId: str(row.schedule_id),
        programId: str(row.program_id),
        hasDraft: pending,
      };
    })
    .sort(
      (a, b) =>
        (scheduleOrder.get(a.scheduleKey) ?? 0) -
          (scheduleOrder.get(b.scheduleKey) ?? 0) ||
        (programOrder.get(a.programKey) ?? 0) -
          (programOrder.get(b.programKey) ?? 0),
    );
}

/** One editable string. The `key` is not shown raw — `label` is what reaches the screen. */
export type EditableString = Pending & {
  namespace: string;
  key: string;
  locale: string;
  /** Readable field name derived from the key. `prose-groups.ts` explains that decision. */
  label: string;
  value: string;
  /**
   * The ICU placeholders the current value contains, like `{years}`.
   *
   * Carried to the form so the hint can name them, and re-derived server-side at save time —
   * this copy is a convenience for rendering, never the thing validation trusts.
   */
  placeholders: readonly string[];
};

/**
 * Every string in one group, draft-aware, in a stable order.
 *
 * Sorted by key rather than by any column the database chooses, because a form whose fields
 * reorder between visits is one where a staff member loses their place mid-edit.
 */
export async function getEditableProse(
  namespace: string,
  locale: string = ADMIN_LOCALE,
): Promise<EditableString[]> {
  const supabase = await createServerSupabase();
  const twins = await readTwins(supabase, "prose", { namespace, locale });

  return byKey(twins, (row) => str(row.key))
    .map(({ key, row, hasDraft: pending }) => ({
      namespace,
      key,
      locale,
      label: fieldLabel(key),
      value: str(row.value),
      placeholders: placeholdersIn(str(row.value)),
      hasDraft: pending,
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

/**
 * The whole catalogue as the editor sees it — draft included.
 *
 * This is what `lib/admin/labels.ts` reads to turn `infants` into "Infants". Draft-aware on
 * purpose: a staff member who has renamed a room and not yet published should see the new name
 * on the editor that produced it, not the old one.
 */
export async function getAdminCatalogue(
  locale: string = ADMIN_LOCALE,
): Promise<Record<string, Record<string, string>>> {
  const supabase = await createServerSupabase();
  const twins = await readTwins(supabase, "prose", { locale });

  const catalogue: Record<string, Record<string, string>> = {};
  for (const { row } of byKey(
    twins,
    (row) => `${str(row.namespace)}\u001f${str(row.key)}`,
  )) {
    (catalogue[str(row.namespace)] ??= {})[str(row.key)] = str(row.value);
  }
  return catalogue;
}

/** One room, and the photograph of it — which may not exist yet. */
export type EditableSpace = Pending & {
  key: string;
  /** The room's name, from the copy. Never the key. */
  label: string;
  /** Absent until someone uploads one. An empty bucket is an ordinary state, not an error. */
  image: { url: string; alt: string } | null;
};

/**
 * The rooms, each with its photograph if there is one.
 *
 * Driven by the program bands rather than by the media rows, so a room with no picture still
 * appears with somewhere to put one — a list built from `media` would show nothing at all on an
 * empty bucket, which is exactly the state this page exists to fix.
 *
 * Ordering comes from `getEditablePrograms`, so the rooms are youngest-first here for the same
 * reason they are on the public page.
 */
export async function getEditableSpaces(): Promise<EditableSpace[]> {
  const supabase = await createServerSupabase();

  const [programs, catalogue, mediaRows] = await Promise.all([
    getEditablePrograms(),
    getAdminCatalogue(),
    readTwins(supabase, "media"),
  ]);

  const byRoom = new Map(
    byKey(mediaRows, (row) => str(row.key)).map((entry) => [entry.key, entry]),
  );

  return programs.map((program) => {
    const found = byRoom.get(program.key);
    const label = programLabel(catalogue, program.key);

    return {
      key: program.key,
      label: label.text,
      image: found
        ? {
            url: publicUrlFor(str(found.row.storage_path)),
            alt: str(found.row.alt),
          }
        : null,
      hasDraft: found?.hasDraft ?? false,
    };
  });
}

/** How many photographs have an unpublished change. */
export async function countPendingSpaces(): Promise<number> {
  const supabase = await createServerSupabase();
  const twins = await readTwins(supabase, "media");
  return twins.filter((row) => row.status === "draft").length;
}

/** How many strings across every group have an unpublished edit. */
export async function countPendingProse(
  locale: string = ADMIN_LOCALE,
): Promise<number> {
  const supabase = await createServerSupabase();
  const twins = await readTwins(supabase, "prose", { locale });
  return twins.filter((row) => row.status === "draft").length;
}

export async function getEditableFees(): Promise<EditableFees | null> {
  const supabase = await createServerSupabase();
  const twins = await readTwins(supabase, "tuition_fees");
  const row = pickEffective(twins);
  if (!row) return null;

  return {
    registration: num(row.registration),
    depositWeeks: num(row.deposit_weeks),
    noticeWeeks: num(row.notice_weeks),
    latePickupPerMinute: num(row.late_pickup_per_minute),
    siblingDiscountPercent: num(row.sibling_discount_percent),
    hasDraft: hasDraft(twins),
  };
}

/**
 * How many things across the whole editor have an unpublished edit against them.
 *
 * The admin index shows this, so a staff member who edited something yesterday is told rather
 * than having to remember. #75 turns it into the publish queue.
 */
export async function countPendingEdits(): Promise<number> {
  const [center, programs, rhythm, staff, rates, fees, prose, spaces] =
    await Promise.all([
      getEditableCenter(),
      getEditablePrograms(),
      getEditableRhythm(),
      getEditableStaff(),
      getEditableRates(),
      getEditableFees(),
      // Prose joined this count in #77. Leaving it out would have made the publish panel
      // report "no pending edits" while a rewritten FAQ answer sat unpublished — and #75's
      // Publish button is driven by this number, so the button would have looked like there
      // was nothing to do.
      countPendingProse(),
      // And media in #78, for the same reason: a replaced photograph that the publish panel
      // did not count is one a staff member cannot tell is still waiting.
      countPendingSpaces(),
    ]);

  const lists = [programs, rhythm, staff, rates];
  return (
    (center?.hasDraft ? 1 : 0) +
    (fees?.hasDraft ? 1 : 0) +
    prose +
    spaces +
    lists.reduce(
      (total, list) => total + list.filter((item) => item.hasDraft).length,
      0,
    )
  );
}
