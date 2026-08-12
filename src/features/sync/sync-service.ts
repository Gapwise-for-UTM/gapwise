import type { Meeting } from "@/lib/timetable-types";
import type { PrivateDataPayloadV1 } from "@/features/security/private-data";
import type { UserPreferences } from "./preferences";

/**
 * Historical plaintext-cloud API shape retained temporarily for component/test
 * compatibility. Gate 6 removed the backing tables. No function in this module
 * can read or write plaintext cloud data.
 */
export type CloudScheduleRecord = {
  meetings: Meeting[];
  updatedAt: string | null;
  privateData?: PrivateDataPayloadV1;
  storageSource?: "secure-local" | "encrypted-cloud";
  persistentKeys?: boolean;
};

function retired(): never {
  throw new Error("Legacy plaintext cloud storage has been permanently retired.");
}

export async function saveSchedule(_meetings: Meeting[]): Promise<void> {
  retired();
}

export async function loadScheduleRecord(
  _authenticatedUserId?: string,
  _signal?: AbortSignal,
): Promise<CloudScheduleRecord | null> {
  retired();
}

export async function loadSchedule(): Promise<Meeting[] | null> {
  retired();
}

export async function deleteSchedule(): Promise<void> {
  // The backing plaintext table no longer exists. Deletion is intentionally a no-op.
}

export async function deletePreferences(): Promise<void> {
  // The backing plaintext table no longer exists. Deletion is intentionally a no-op.
}

export async function savePreferences(_preferences: UserPreferences): Promise<void> {
  retired();
}

export async function loadPreferences(): Promise<UserPreferences | null> {
  retired();
}
