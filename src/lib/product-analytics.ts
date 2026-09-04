import { track } from "@vercel/analytics";

export type ProductEvent =
  | "demo_timetable_opened"
  | "ics_import_completed"
  | "route_requested"
  | "gap_plan_generated"
  | "day_replay_opened"
  | "account_created"
  | "sync_enabled"
  | "ai_delegation_enabled";

/**
 * Privacy-safe product telemetry.
 *
 * Deliberately accepts only an allowlisted event name and no arbitrary payload.
 * Never add course codes/titles, timetable times, exact locations, friend data,
 * email addresses, user IDs, raw file contents, or free-form strings here.
 */
export function trackProductEvent(event: ProductEvent): void {
  try {
    track(event);
  } catch {
    // Analytics must never affect product behavior.
  }
}
