-- Photographs of the spaces: a `media` table, a Storage bucket, and policies on both.
--
-- ---------------------------------------------------------------------------------------
-- WHAT THIS IS FOR
-- ---------------------------------------------------------------------------------------
--
-- One image per room, rendered on /programs. `docs/PLAN.md` has said since v0.1.0 that photos
-- live in Supabase Storage and are optimized on the fly by Netlify's Image CDN; this is that
-- bucket finally existing.
--
-- **No photographs of people, ever.** Rooms, the garden, the entrance. That is a settled
-- decision with its reasoning in docs/PLAN.md, and it is the reason this feature carries no
-- consent dimension at all — there is nobody in the frame to obtain consent from. Staff remain
-- monograms. Nothing in this schema enforces that; it is a rule about what gets uploaded, and
-- the place it is enforced is review.
--
-- ---------------------------------------------------------------------------------------
-- WHY media LOOKS LIKE EVERY OTHER CONTENT TABLE
-- ---------------------------------------------------------------------------------------
--
-- org_id, a key, a status, and two partial unique indexes. That is not copied out of habit: it
-- is what makes the image participate in the draft/published twin from #74 and get promoted by
-- publish_org_drafts without that function learning anything new about images.
--
-- The consequence is the one that matters to a staff member: **replacing a room's photograph
-- does not change the public site until Publish**, exactly like editing its ratio. A schema
-- that stored the image outside this pattern would have made "upload" mean "publish", which is
-- the one behaviour this editor has been careful never to have.
--
-- `key` joins to a program band's key, so the infant room's photograph is `media.key =
-- 'infants'`. Not a foreign key to programs.id, deliberately — a program has TWO rows once it
-- has a draft, and a media row pointing at one of them would be pointing at half a thing.
-- Joining on the key is what every other cross-table reference here does.

create table public.media (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.orgs (id) on delete cascade,

  -- Which space this is a picture of. Matches a programs.key for now; the column does not
  -- know that, so a photograph of the garden needs no schema change.
  key text not null,

  -- Path within the bucket, always `<org_id>/<something>`. The first segment is what the
  -- storage policies below check, so it is the tenancy boundary and not a naming convention.
  storage_path text not null,

  -- Required, and required for a reason: an image with no alternative text is invisible to a
  -- parent using a screen reader, and this is a page whose whole job is reassurance. The
  -- upload form refuses to submit without it, and this constraint is why that cannot be
  -- quietly bypassed later.
  alt text not null,

  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint media_key_not_blank check (btrim(key) <> ''),
  constraint media_alt_not_blank check (btrim(alt) <> ''),
  constraint media_path_not_blank check (btrim(storage_path) <> '')
);

alter table public.media enable row level security;

create trigger media_set_updated_at
  before update on public.media
  for each row execute function public.set_updated_at();

create unique index media_one_published_per_key
  on public.media (org_id, key)
  where status = 'published';

create unique index media_one_draft_per_key
  on public.media (org_id, key)
  where status = 'draft';

create policy "published media is readable by anyone"
  on public.media for select to anon
  using (status = 'published');

create policy "media is managed by its own organization"
  on public.media for all to authenticated
  using (org_id = public.current_org_id())
  with check (org_id = public.current_org_id());

comment on table public.media is
  'Photographs of the spaces, one row per (org, key). Draft/published twins like every other content table. No images of people — see docs/PLAN.md.';

-- ---------------------------------------------------------------------------------------
-- The bucket
-- ---------------------------------------------------------------------------------------
--
-- **Public, decided rather than defaulted.** #78 asks for this to be a decision in the pull
-- request, so here it is with its reasoning:
--
--   * These are photographs of empty rooms on a marketing website. There is nothing to protect
--     — the whole point is that a parent comparing centers can see them.
--   * The public site is PRERENDERED. A signed URL expires, so a build would bake in a link
--     that dies, and the page would show broken images some hours after every deploy. Making
--     that work would mean either re-signing at request time — which puts Supabase in a
--     visitor's request path, ruled out in docs/PLAN.md — or a signing lifetime long enough
--     that it is public in all but name.
--   * Netlify's Image CDN fetches the origin URL itself. It holds no Supabase credentials.
--
-- So the honest options were "public" or "an expiring link on a static page", and only one of
-- them works. What a public bucket does NOT mean: anyone can write to it. Reads are open;
-- every write is governed by the policies below.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'spaces',
  'spaces',
  true,
  -- 5 MB. A photograph of a room off a phone is comfortably under this, and the limit is
  -- restated in the upload form so a staff member is told before waiting for the transfer.
  -- Enforced here as well because a form is a claim and this is the boundary.
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------------------
-- Storage policies — row-level security, on objects rather than rows
-- ---------------------------------------------------------------------------------------
--
-- #78 names the hazard exactly: "an authenticated member of one organization must not be able
-- to write into another's prefix." A public bucket with no write policy is a public bucket
-- anyone signed in can overwrite, including with a picture of somebody else's center.
--
-- The first path segment is the organization's id, and every policy below checks it against
-- current_org_id(). `storage.foldername(name)` splits the path; `[1]` is the first segment
-- because Postgres arrays are 1-indexed, which is the off-by-one worth stating rather than
-- rediscovering.
--
-- A member with no profile row resolves to NULL, `[1] = NULL::text` is never true, and they
-- can write nothing — the same deadbolt every content policy relies on.

create policy "spaces are readable by anyone"
  on storage.objects for select to anon, authenticated
  using (bucket_id = 'spaces');

create policy "members upload only into their own organization's folder"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'spaces'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

-- Update and delete are separate policies rather than one FOR ALL, so that read staying open
-- to `anon` above cannot accidentally widen with them.
create policy "members replace only their own organization's images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'spaces'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  )
  with check (
    bucket_id = 'spaces'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );

create policy "members delete only their own organization's images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'spaces'
    and (storage.foldername(name))[1] = public.current_org_id()::text
  );
