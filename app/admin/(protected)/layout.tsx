import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

import { SIGN_IN_PATH } from "@/lib/admin-paths";
import { ADMIN_SECTIONS } from "@/lib/admin/nav";
import { getSignedInUser } from "@/lib/supabase-server";

/**
 * Everything staff-only sits under this layout, and the check below is the second of two.
 *
 * The middleware already turned an unauthenticated request away before routing. Repeating
 * the check here is not belt-and-braces theatre — the two fail differently. Middleware is
 * matcher-driven configuration, so a future edit to that pattern (excluding a path, adding a
 * file extension to the negative lookahead) silently stops guarding a route while everything
 * still compiles and every test that only exercises `/admin` still passes. This check is
 * *structural*: a new page is protected because of where its file sits, which is a property
 * a person can see in the directory tree.
 *
 * Neither is the real boundary. Row-level security is. If both of these were deleted, an
 * unauthenticated request would reach this page and read exactly nothing from the database.
 */
export default async function ProtectedAdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const user = await getSignedInUser();

  if (!user) {
    redirect(SIGN_IN_PATH);
  }

  return (
    <>
      <header className="border-b border-border bg-cream-50">
        <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-xs font-semibold tracking-widest text-terracotta-500 uppercase">
              Staff
            </p>
            <Link
              href="/admin"
              className="rounded-sm text-base font-semibold text-ink-900 focus-visible:ring-2 focus-visible:ring-sage-700 focus-visible:ring-offset-4 focus-visible:ring-offset-cream-50 focus-visible:outline-none"
            >
              Willow Grove Children&rsquo;s Center
            </Link>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-sm text-ink-500">{user.email}</span>
            {/* A plain form rather than a button with an onClick: signing out is a state
                change, so it is a POST, and a POST that works without JavaScript. */}
            <form action="/admin/sign-out" method="post">
              <button
                type="submit"
                className="rounded-full border border-border px-4 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-cream-200 focus-visible:ring-2 focus-visible:ring-sage-700 focus-visible:ring-offset-2 focus-visible:ring-offset-cream-50 focus-visible:outline-none"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* The section list, so a staff member can move between the four editors without going
          back to the index each time. Plain links rather than a component with active-state
          logic — four destinations do not earn a client boundary. */}
      <nav
        aria-label="Editor sections"
        className="border-b border-border bg-cream-50"
      >
        <ul className="mx-auto flex w-full max-w-5xl flex-wrap gap-x-5 gap-y-2 px-5 pb-3 text-sm">
          {ADMIN_SECTIONS.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                className="rounded-sm font-medium text-ink-700 transition-colors hover:text-sage-700 focus-visible:ring-2 focus-visible:ring-sage-700 focus-visible:ring-offset-4 focus-visible:ring-offset-cream-50 focus-visible:outline-none"
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-10">
        {children}
      </main>
    </>
  );
}
