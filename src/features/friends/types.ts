import type { Term, Weekday } from "@/lib/timetable-types";

export type FriendshipStatus = "pending" | "accepted";

export type FriendConnection = {
  id: string;
  displayName: string;
  status: FriendshipStatus;
  direction: "incoming" | "outgoing" | "mutual";
  updatedAt: string;
};

export type FriendGapOverlap = {
  friendshipId: string;
  friendDisplayName: string;
  term: Term;
  weekday: Weekday;
  startMinute: number;
  endMinute: number;
};

export type FriendInvite = {
  code: string;
  expiresAt: string;
};
