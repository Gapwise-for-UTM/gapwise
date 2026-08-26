export function getAccountOnboardingAction(hasTimetable: boolean) {
  return hasTimetable
    ? { label: "Back to my day", kind: "continue" as const }
    : { label: "Import ACORN timetable", kind: "import" as const };
}
