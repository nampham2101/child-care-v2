import { describe, expect, it } from "vitest";

import {
  ADMIN_HOME,
  SIGN_IN_PATH,
  isAdminPath,
  safeNextPath,
} from "@/lib/admin-paths";

/**
 * The sign-in page carries a `?next=` parameter so that being bounced to sign in resumes
 * where a staff member was going. That parameter is attacker-controlled — it arrives in a
 * URL anyone can compose and send — and it decides where a browser goes immediately after a
 * password is typed. That combination is the whole reason this suite exists.
 *
 * These are the first tests in this repository covering a *security* decision rather than a
 * formatting or arithmetic one, which is why the cases below are written as attacks rather
 * than as inputs.
 */
describe("isAdminPath", () => {
  it("matches the admin root and everything under it", () => {
    expect(isAdminPath("/admin")).toBe(true);
    expect(isAdminPath("/admin/")).toBe(true);
    expect(isAdminPath("/admin/sign-in")).toBe(true);
    expect(isAdminPath("/admin/facts/programs")).toBe(true);
  });

  it("does not match public routes", () => {
    expect(isAdminPath("/")).toBe(false);
    expect(isAdminPath("/en")).toBe(false);
    expect(isAdminPath("/en/about")).toBe(false);
  });

  /**
   * The case a prefix check gets wrong. `/administrator` starts with `/admin` as a string
   * and is not inside the admin area — if this returned true, the locale middleware would
   * stop handling a public URL and the auth guard would start.
   */
  it("does not match a path that merely starts with the same letters", () => {
    expect(isAdminPath("/administrator")).toBe(false);
    expect(isAdminPath("/admin-tools")).toBe(false);
  });
});

describe("safeNextPath", () => {
  it("keeps a path inside the admin area", () => {
    expect(safeNextPath("/admin/facts")).toBe("/admin/facts");
    expect(safeNextPath("/admin/facts?tab=staff")).toBe(
      "/admin/facts?tab=staff",
    );
  });

  it("falls back to the admin home when there is no destination", () => {
    expect(safeNextPath(undefined)).toBe(ADMIN_HOME);
    expect(safeNextPath(null)).toBe(ADMIN_HOME);
    expect(safeNextPath("")).toBe(ADMIN_HOME);
  });

  /**
   * The attack this function exists to stop. A staff member who follows
   * `/admin/sign-in?next=https://evil.example` sees this site's URL and this site's form,
   * types a password, and is handed to somewhere else — which is then free to render a
   * convincing "session expired, sign in again" page.
   */
  it("refuses an absolute URL", () => {
    expect(safeNextPath("https://evil.example/admin")).toBe(ADMIN_HOME);
    expect(safeNextPath("http://evil.example")).toBe(ADMIN_HOME);
  });

  /**
   * The same attack past a naive guard. `//evil.example` has no scheme, so it looks like a
   * path and passes `startsWith("/")` — but a browser reads it as protocol-relative and
   * leaves the site.
   */
  it("refuses a protocol-relative URL", () => {
    expect(safeNextPath("//evil.example")).toBe(ADMIN_HOME);
    expect(safeNextPath("//evil.example/admin")).toBe(ADMIN_HOME);
  });

  it("refuses a same-origin path outside the admin area", () => {
    expect(safeNextPath("/en/about")).toBe(ADMIN_HOME);
    expect(safeNextPath("/administrator")).toBe(ADMIN_HOME);
  });

  /** Otherwise signing in successfully lands back on the sign-in form. */
  it("refuses the sign-in page itself", () => {
    expect(safeNextPath(SIGN_IN_PATH)).toBe(ADMIN_HOME);
    expect(safeNextPath(`${SIGN_IN_PATH}?next=/admin`)).toBe(ADMIN_HOME);
  });
});
