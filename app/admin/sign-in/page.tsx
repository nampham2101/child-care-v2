import type { Metadata } from "next";

import { SignInForm } from "@/components/admin/SignInForm";
import { safeNextPath } from "@/lib/admin-paths";

export const metadata: Metadata = { title: "Sign in" };

/**
 * The staff sign-in page.
 *
 * THERE IS NO "CREATE AN ACCOUNT" LINK, AND THAT IS THE FEATURE. Accounts are created by
 * invitation — the owner's decision on #72 — and self-service signup is turned off in the
 * Supabase dashboard, which is the control that actually enforces it since a hidden link
 * enforces nothing. `docs/PLAN.md` records both, along with what the schema enforces even if
 * the setting were flipped back: an account with no `profiles` row resolves to `NULL` from
 * `current_org_id()` and matches no row in any policy, so it could read and write nothing.
 *
 * There is no password-reset link either, for now. Resetting a password requires sending
 * mail, and this project has no mail configured — a link that leads to a dead end is worse
 * than its absence. The owner resets a password from the dashboard. *Tripwire:* the second
 * staff member locked out is the moment this stops being acceptable.
 */
export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm">
        <div className="mb-8">
          <p className="text-xs font-semibold tracking-widest text-terracotta-500 uppercase">
            Staff only
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-ink-900">
            Sign in to edit the site
          </h1>
          <p className="mt-2 text-sm text-ink-500">
            Willow Grove Children&rsquo;s Center
          </p>
        </div>

        <div className="rounded-2xl border border-border bg-cream-50 p-6 shadow-sm">
          {/* Sanitised here as well as in the action. The value reaches the form as a hidden
              field, so it is caller-supplied twice over — once in the URL and once in the
              POST body — and each read validates rather than trusting the other. */}
          <SignInForm next={safeNextPath(next)} />
        </div>

        <p className="mt-6 text-center text-sm text-ink-500">
          Accounts are created by the center&rsquo;s owner. If you need access,
          ask them.
        </p>
      </div>
    </main>
  );
}
