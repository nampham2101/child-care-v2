import { CENTER } from "@/lib/center";

/**
 * The tap-to-call button — the highest-converting element on the page, so it is a real
 * link a phone can dial, not text a parent has to copy.
 *
 * It appears in the sticky header (so it never scrolls away) and again in the contact
 * section, which is why it lives here rather than being written twice. Sage, because every
 * call to action on this site is sage and nothing else is.
 */
export function CallButton({ className = "" }: { className?: string }) {
  return (
    <a
      href={CENTER.phoneHref}
      className={`inline-flex items-center gap-2 rounded-full bg-sage-700 px-5 py-2.5 text-sm font-semibold text-cream-50 transition-colors hover:bg-sage-900 focus-visible:ring-2 focus-visible:ring-sage-900 focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none ${className}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="h-4 w-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92Z" />
      </svg>
      <span>
        Call <span className="tabular-nums">{CENTER.phoneDisplay}</span>
      </span>
    </a>
  );
}
