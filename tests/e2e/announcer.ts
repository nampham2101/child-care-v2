import type { Locator, Page } from "@playwright/test";

/**
 * Locators for the admin's own status and error messages.
 *
 * ## Why these exist rather than `page.getByRole("alert")`
 *
 * Next renders its own always-present route announcer as
 * `<div role="alert" aria-live="assertive" id="__next-route-announcer__">`. So a bare
 * `getByRole("alert")` matches two elements on every page and fails Playwright's strict mode —
 * with an error about the *locator*, which reads like a duplicated element in the markup rather
 * than a framework detail.
 *
 * This has now cost three separate failures across #73, #74 and #75. Encoding the answer once is
 * cheaper than each new assertion rediscovering it, and the comment is the actual value here:
 * the next person writing an admin assertion should not have to work out what the second alert
 * is.
 *
 * Both scope to a `<form>`, because every message the admin shows is the result of submitting
 * one. The route announcer lives outside any form, which is what makes the scope sufficient.
 */

/** An error message the admin rendered — `role="alert"`, so a screen reader interrupts. */
export function formAlert(page: Page): Locator {
  return page.locator("form").getByRole("alert");
}

/** A success message — `role="status"`, so it is announced without interrupting. */
export function formStatus(page: Page): Locator {
  return page.locator("form").getByRole("status");
}
