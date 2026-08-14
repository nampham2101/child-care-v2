/**
 * The admin home — deliberately an empty shell.
 *
 * #73 ends here, and the emptiness is the point: authentication is the thing that is worth
 * reviewing on its own, rather than inside a pull request that also contains forms. The
 * editors that fill this page are #74 (facts), #77 (prose), and #78 (images).
 *
 * It lists what is coming rather than saying "nothing here yet", so the first staff member
 * to sign in learns what the tool will do instead of wondering whether it is broken.
 */
const COMING = [
  {
    title: "The center's facts",
    body: "Phone, email, licence number, hours, the three rooms, staff, and the rate sheet.",
    issue: 74,
  },
  {
    title: "Publishing",
    body: "Edits save as drafts. Publishing rebuilds the site, live in about two minutes.",
    issue: 75,
  },
  {
    title: "Words on the pages",
    body: "Room descriptions, staff bios, and every FAQ answer, editable without touching a file.",
    issue: 77,
  },
  {
    title: "Photos of the spaces",
    body: "The rooms, the garden, the entrance. No photographs of children or staff.",
    issue: 78,
  },
];

export default function AdminHomePage() {
  return (
    <>
      <h1 className="text-2xl font-semibold text-ink-900">
        You&rsquo;re signed in
      </h1>
      <p className="mt-2 max-w-prose text-ink-700">
        There is nothing to edit yet. Signing in was built first, on its own, so
        that the part protecting the site could be checked carefully before any
        editing was put behind it.
      </p>

      <h2 className="mt-10 text-sm font-semibold tracking-widest text-ink-500 uppercase">
        What lands here next
      </h2>
      <ul className="mt-4 grid gap-4 sm:grid-cols-2">
        {COMING.map(({ title, body, issue }) => (
          <li
            key={issue}
            className="rounded-2xl border border-border bg-cream-50 p-5"
          >
            <p className="font-semibold text-ink-900">{title}</p>
            <p className="mt-1.5 text-sm text-ink-700">{body}</p>
          </li>
        ))}
      </ul>
    </>
  );
}
