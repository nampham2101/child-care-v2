"use server";

import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/admin-paths";
import { createServerSupabase } from "@/lib/supabase-server";

export type SignInState = { error: string | null };

/**
 * Sign a staff member in.
 *
 * A server action rather than a browser call to `supabase-js`, for two reasons. The session
 * cookie is written server-side, where `httpOnly` is available and a cross-site script
 * cannot read it. And the form keeps working with JavaScript disabled or still loading,
 * which matters more than it sounds: this is the one page whose failure locks staff out of
 * the tool entirely.
 */
export async function signIn(
  _previous: SignInState,
  formData: FormData,
): Promise<SignInState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const next = safeNextPath(String(formData.get("next") ?? ""));

  if (!email || !password) {
    return { error: "Enter your email address and password." };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    /*
     * One message for every failure, and deliberately not the one Supabase returned.
     * Distinguishing "no such account" from "wrong password" turns this form into an oracle
     * for which email addresses have accounts here — which, at a child care center, is a
     * list of who works with the children. The real error is on the server logs where it is
     * useful; what reaches the page says only that the pair did not match.
     */
    return { error: "That email and password did not match an account." };
  }

  /*
   * `redirect` throws, so nothing below it runs. It is outside the try/catch above by
   * construction — catching a redirect and rendering an error instead is a mistake that
   * looks like a successful sign-in going nowhere.
   */
  redirect(next);
}
