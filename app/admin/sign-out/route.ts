import { NextResponse, type NextRequest } from "next/server";

import { SIGN_IN_PATH } from "@/lib/admin-paths";
import { createServerSupabase } from "@/lib/supabase-server";

/**
 * Sign out, and go back to the sign-in page.
 *
 * POST only. A sign-out reachable by GET is a link an `<img src>` on any other site can
 * fire, which is a nuisance rather than a breach — but it is also the reason browsers
 * prefetch links, and a prefetched sign-out logs staff out while they are working.
 *
 * `signOut()` revokes the refresh token at Supabase as well as clearing the cookies, so the
 * session is dead server-side and not merely forgotten by this browser. Its result is not
 * checked on purpose: if the call fails, the cookies are still cleared and the redirect
 * still happens. Leaving someone signed in because sign-out errored is the worse outcome.
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();

  const signIn = new URL(SIGN_IN_PATH, request.url);

  /*
   * 303, not the default 307. The browser must follow this with a GET — a 307 preserves the
   * method and would re-POST to the sign-in page.
   */
  return NextResponse.redirect(signIn, { status: 303 });
}
