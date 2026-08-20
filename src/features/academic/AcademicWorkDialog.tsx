import { useMemo, useState } from "react";
import { BookOpenCheck, Check, Clock3, RotateCcw, Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createStudyPlan, transitionBlock, type StudyPlanProposal } from "./planner";
import {
  completeBlock,
  createManualCoursework,
  setManualCourseworkCompletion,
  type AcademicState,
} from "./state";
import type { AcademicPlanningContext, CourseworkKind } from "./types";
import type { Meeting } from "@/lib/timetable-types";
import type { Entitlement } from "@/features/entitlements/entitlements";
import { canUseFeature } from "@/features/entitlements/entitlements";
import { addDate, torontoLocalDateTimeInstant } from "./windows";
import { DEFAULT_ROUTE_PREFERENCES } from "@/config/routing";
import { UTM_ROUTING_GRAPH } from "@/data/utm/campus";
import { createScheduleTransitionPlanner } from "@/features/routing/transition";

const format = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Toronto",
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});

export function AcademicWorkDialog({
  open,
  onOpenChange,
  state,
  onChange,
  meetings,
  entitlement,
  routeMinutes,
  routingRevision,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  state: AcademicState;
  onChange: (state: AcademicState) => void;
  meetings: Meeting[];
  entitlement: Entitlement;
  routeMinutes?: ((from: Meeting, to: Meeting) => number | null) | undefined;
  routingRevision?: string | undefined;
}) {
  const [proposal, setProposal] = useState<StudyPlanProposal | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [course, setCourse] = useState("");
  const [title, setTitle] = useState("");
  const [due, setDue] = useState("");
  const [hours, setHours] = useState("2");
  const [priority, setPriority] = useState<"normal" | "high">("normal");
  const allowed = canUseFeature(entitlement, "academic_planner");
  const fallbackRouteMinutes = useMemo(() => {
    const planner = createScheduleTransitionPlanner(UTM_ROUTING_GRAPH, meetings);
    return (from: Meeting, to: Meeting) => {
      const route = planner(from, to, DEFAULT_ROUTE_PREFERENCES);
      if (route.status === "unavailable") return null;
      const seconds = route.result?.estimatedSeconds ?? route.approximateSeconds ?? 0;
      return Math.ceil(seconds / 60) + DEFAULT_ROUTE_PREFERENCES.transitionBufferMinutes;
    };
  }, [meetings]);
  const effectiveRouteMinutes = routeMinutes ?? fallbackRouteMinutes;
  const effectiveRoutingRevision =
    routingRevision ??
    `${DEFAULT_ROUTE_PREFERENCES.mode}:${DEFAULT_ROUTE_PREFERENCES.walkingSpeedMps}:${DEFAULT_ROUTE_PREFERENCES.transitionBufferMinutes}`;
  const context = useMemo<AcademicPlanningContext>(() => {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Toronto",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    return {
      horizon: {
        startDate: today,
        endDate: addDate(today, 13),
        dayStartMinute: 8 * 60,
        dayEndMinute: 21 * 60,
        timeZone: "America/Toronto",
      },
      routingRevision: effectiveRoutingRevision,
      academicMeetings: meetings.filter(
        (meeting) => meeting.sectionCode !== "PERSONAL" && meeting.sectionCode !== "STUDY",
      ),
      fixedPersonalCommitments: meetings.filter((meeting) => meeting.sectionCode === "PERSONAL"),
      coursework: state.coursework,
      courseProfiles: [],
      existingBlocks: state.blocks,
      preferences: {
        minimumBlockMinutes: 30,
        maximumBlockMinutes: 90,
        setupMinutes: 10,
        packUpMinutes: 10,
        maxDailyMinutes: 240,
      },
    };
  }, [effectiveRoutingRevision, meetings, state]);

  const contextForNow = (): AcademicPlanningContext => ({
    ...context,
    horizon: { ...context.horizon, notBefore: new Date().toISOString() },
  });

  function addItem(event: React.FormEvent) {
    event.preventDefault();
    setMessage(null);
    try {
      const estimatedMinutes = Math.round(Number(hours) * 60);
      onChange({
        ...state,
        coursework: [
          ...state.coursework,
          createManualCoursework({
            courseCode: course,
            title,
            kind: "assignment" as CourseworkKind,
            dueAt: due ? torontoLocalDateTimeInstant(due) : null,
            estimatedMinutes,
            priority,
          }),
        ],
        proposalRevision: null,
      });
      setTitle("");
      setCourse("");
      setDue("");
      setHours("2");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Coursework is invalid.");
    }
  }

  function build() {
    const next = createStudyPlan(contextForNow(), effectiveRouteMinutes);
    setProposal(next);
    setMessage(next.blocks.length ? null : "No valid work time was found in the next two weeks.");
  }

  function accept() {
    if (!proposal) return;
    const now = Date.now();
    if (proposal.blocks.some((block) => Date.parse(block.start) < now - 10 * 60_000)) {
      setMessage("This plan has started to pass. Rebuild it with your current time.");
      return;
    }
    const current = createStudyPlan(contextForNow(), effectiveRouteMinutes);
    if (current.revision !== proposal.revision) {
      setMessage("Your schedule changed. Rebuild this plan.");
      return;
    }
    onChange({
      ...state,
      blocks: [
        ...state.blocks,
        ...proposal.blocks.map((block) => transitionBlock(block, "accepted", proposal.revision)),
      ],
      proposalRevision: proposal.revision,
    });
    setProposal(null);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[88dvh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BookOpenCheck className="h-5 w-5 text-accent" />
            Academic work
          </DialogTitle>
          <DialogDescription>
            Fit coursework into your real timetable. Details stay in your encrypted private data.
          </DialogDescription>
        </DialogHeader>
        {!allowed ? (
          <div className="rounded-xl border border-accent/25 bg-accent/5 p-5">
            <p className="font-semibold">Gapwise Pro</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Automatically fit coursework into your real week.
            </p>
            <p className="mt-3 text-xs text-muted-foreground">Billing is not available yet.</p>
          </div>
        ) : (
          <>
            <form
              onSubmit={addItem}
              className="grid gap-3 rounded-xl border border-border p-4 sm:grid-cols-2"
            >
              <input
                aria-label="Course"
                required
                value={course}
                onChange={(event) => setCourse(event.target.value)}
                placeholder="Course · MAT157"
                className="h-11 rounded-lg border bg-background px-3"
              />
              <input
                aria-label="Title"
                required
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Title · Problem Set 4"
                className="h-11 rounded-lg border bg-background px-3"
              />
              <label className="text-xs text-muted-foreground">
                Due (Toronto time, optional)
                <input
                  aria-label="Due"
                  type="datetime-local"
                  value={due}
                  onChange={(event) => setDue(event.target.value)}
                  className="mt-1 h-11 w-full rounded-lg border bg-background px-3 text-foreground"
                />
              </label>
              <label className="text-xs text-muted-foreground">
                Estimated hours
                <input
                  aria-label="Estimated hours"
                  required
                  type="number"
                  min="0.25"
                  max="168"
                  step="0.25"
                  value={hours}
                  onChange={(event) => setHours(event.target.value)}
                  className="mt-1 h-11 w-full rounded-lg border bg-background px-3 text-foreground"
                />
              </label>
              <select
                aria-label="Priority"
                value={priority}
                onChange={(event) => setPriority(event.target.value as "normal" | "high")}
                className="h-11 rounded-lg border bg-background px-3"
              >
                <option value="normal">Normal priority</option>
                <option value="high">High priority</option>
              </select>
              <button className="button-primary h-11 px-4 font-semibold">Add coursework</button>
            </form>
            <div className="space-y-2">
              {state.coursework.map((item) => (
                <article key={item.id} className="rounded-xl border border-border p-4">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-accent">{item.courseCode}</p>
                      <h3 className="font-semibold">{item.title}</h3>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.localProgress === "completed_manually"
                          ? "Completed"
                          : `${item.dueAt ? `Due ${format.format(new Date(item.dueAt))} · ` : ""}~${Math.ceil(item.workEstimate.remainingMinutes / 10) * 10}m remaining`}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        aria-label={
                          item.localProgress === "completed_manually" ? "Reopen" : "Mark complete"
                        }
                        className="button-secondary h-9 w-9"
                        onClick={() =>
                          onChange(
                            setManualCourseworkCompletion(
                              state,
                              item.id,
                              item.localProgress !== "completed_manually",
                            ),
                          )
                        }
                      >
                        {item.localProgress === "completed_manually" ? (
                          <RotateCcw className="mx-auto h-4 w-4" />
                        ) : (
                          <Check className="mx-auto h-4 w-4" />
                        )}
                      </button>
                      <button
                        type="button"
                        aria-label="Delete coursework"
                        className="button-secondary h-9 w-9 text-destructive"
                        onClick={() =>
                          onChange({
                            ...state,
                            coursework: state.coursework.filter((candidate) => candidate.id !== item.id),
                            blocks: state.blocks.filter((block) => block.courseworkId !== item.id),
                            proposalRevision: null,
                          })
                        }
                      >
                        <Trash2 className="mx-auto h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      className="button-secondary px-3 py-1 text-xs"
                      onClick={() =>
                        onChange({
                          ...state,
                          coursework: state.coursework.map((candidate) =>
                            candidate.id === item.id
                              ? {
                                  ...candidate,
                                  priority: candidate.priority === "high" ? "normal" : "high",
                                }
                              : candidate,
                          ),
                          proposalRevision: null,
                        })
                      }
                    >
                      {item.priority === "high" ? "High priority" : "Make high priority"}
                    </button>
                  </div>
                </article>
              ))}
            </div>
            <button
              type="button"
              onClick={build}
              disabled={!state.coursework.length}
              className="button-primary inline-flex h-11 items-center justify-center gap-2 px-5 font-semibold"
            >
              <Clock3 className="h-4 w-4" />
              {state.blocks.some((block) => block.status === "missed")
                ? "Update plan"
                : "Build my plan"}
            </button>
            {proposal ? (
              <section className="rounded-xl border border-accent/30 bg-accent/5 p-4">
                <h3 className="font-semibold">Proposed study plan</h3>
                <div className="mt-3 space-y-2">
                  {proposal.blocks.map((block) => {
                    const item = state.coursework.find(
                      (candidate) => candidate.id === block.courseworkId,
                    );
                    return (
                      <div key={block.id} className="rounded-lg bg-background/75 p-3 text-sm">
                        <b>{format.format(new Date(block.start))}</b>
                        <br />
                        {item?.courseCode} · {item?.title} · {block.allocatedMinutes}m
                      </div>
                    );
                  })}
                </div>
                {Object.values(proposal.unscheduledMinutes).reduce((a, b) => a + b, 0) > 0 ? (
                  <p className="mt-3 text-sm font-medium text-destructive">
                    {Object.values(proposal.unscheduledMinutes).reduce((a, b) => a + b, 0)}m still
                    needs a place.
                  </p>
                ) : null}
                <div className="mt-4 flex gap-2">
                  <button
                    type="button"
                    onClick={accept}
                    className="button-primary px-4 py-2 font-semibold"
                  >
                    Add to timetable
                  </button>
                  <button
                    type="button"
                    onClick={() => setProposal(null)}
                    className="button-secondary inline-flex items-center gap-1 px-4 py-2"
                  >
                    <X className="h-4 w-4" />
                    Reject
                  </button>
                </div>
              </section>
            ) : null}
            {state.blocks
              .filter((block) => ["accepted", "missed"].includes(block.status))
              .map((block) => {
                const item = state.coursework.find(
                  (candidate) => candidate.id === block.courseworkId,
                );
                return (
                  <div
                    key={block.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-border p-3 text-sm"
                  >
                    <span>
                      <b>
                        {item?.courseCode} · {item?.title}
                      </b>
                      <br />
                      <span className="text-muted-foreground">
                        {format.format(new Date(block.start))} · {block.allocatedMinutes}m ·{" "}
                        {block.status}
                      </span>
                    </span>
                    {block.status === "accepted" ? (
                      <span className="flex gap-1">
                        <button
                          type="button"
                          className="button-secondary px-3 py-2"
                          onClick={() => onChange(completeBlock(state, block.id))}
                        >
                          Complete
                        </button>
                        <button
                          type="button"
                          className="button-secondary px-3 py-2"
                          onClick={() =>
                            onChange({
                              ...state,
                              blocks: state.blocks.map((candidate) =>
                                candidate.id === block.id
                                  ? transitionBlock(candidate, "missed")
                                  : candidate,
                              ),
                              proposalRevision: null,
                            })
                          }
                        >
                          Missed
                        </button>
                        <button
                          type="button"
                          className="button-secondary px-3 py-2"
                          onClick={() =>
                            onChange({
                              ...state,
                              blocks: state.blocks.map((candidate) =>
                                candidate.id === block.id
                                  ? transitionBlock(candidate, "cancelled")
                                  : candidate,
                              ),
                              proposalRevision: null,
                            })
                          }
                        >
                          Cancel
                        </button>
                      </span>
                    ) : null}
                  </div>
                );
              })}
          </>
        )}
        {message ? (
          <p role="alert" className="text-sm text-destructive">
            {message}
          </p>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
