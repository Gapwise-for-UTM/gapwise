import { describe, expect, test } from "bun:test";
import {
  isCurrentRestorationRequest,
  memoryCandidate,
  shouldClearAccountState,
} from "@/features/sync/restoration-decisions";
import { meeting } from "./fixtures";

describe("restoration lifecycle decisions", () => {
  test("clears cloud-derived state on sign-out or user switch", () => {
    expect(shouldClearAccountState("user-a", "cloud", false)).toBe(true);
    expect(shouldClearAccountState("user-a", "memory", false)).toBe(false);
    expect(shouldClearAccountState(null, "cloud", true)).toBe(false);
  });

  test("clears all prior account state in private-cloud-authoritative mode", () => {
    expect(shouldClearAccountState("user-a", "memory", true)).toBe(true);
    expect(shouldClearAccountState("user-a", "none", true)).toBe(true);
  });

  test("only presents explicitly in-memory meetings to precedence selection", () => {
    const meetings = [meeting({ id: "memory" })];
    expect(memoryCandidate("memory", meetings)).toBe(meetings);
    expect(memoryCandidate("cloud", meetings)).toBeNull();
    expect(memoryCandidate("local", meetings)).toBeNull();
  });

  test("accepts only the mounted request for the current generation and user", () => {
    const current = {
      mounted: true,
      currentVersion: 3,
      requestVersion: 3,
      currentUserId: "user-a",
      requestUserId: "user-a",
    };
    expect(isCurrentRestorationRequest(current)).toBe(true);
    expect(isCurrentRestorationRequest({ ...current, mounted: false })).toBe(false);
    expect(isCurrentRestorationRequest({ ...current, currentVersion: 4 })).toBe(false);
    expect(isCurrentRestorationRequest({ ...current, currentUserId: "user-b" })).toBe(false);
    expect(isCurrentRestorationRequest({ ...current, currentUserId: null })).toBe(false);
  });
});
