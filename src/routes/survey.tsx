import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Crosshair, Download, Plus, Route as RouteIcon, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { normalizePublicBuildingCode, UTM_BUILDINGS } from "@/data/utm/building-registry";
import { validateCampusSurvey, type CampusSurvey, type SurveyNode } from "@/data/utm/survey-format";
import {
  fieldSurveyTargetsForBuilding,
  type FieldSurveyGeometryCandidate,
} from "@/features/routing/field-survey-targets";
import type { AccessibilityStatus } from "@/features/routing/types";

const DRAFT_KEY = "gapwise-utm-field-survey-v1";
const CONTROL =
  "h-11 w-full rounded-xl border border-border bg-background px-3 text-sm font-normal text-foreground outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30";

type CapturedLocation = {
  longitude: number;
  latitude: number;
  accuracyMeters: number;
  capturedAt: string;
};

type WalkthroughSegment = {
  id: string;
  fromLabel: string;
  toLabel: string;
  distanceMeters: number;
  environment: "indoor" | "covered";
  stairs: boolean;
  accessibility: AccessibilityStatus;
  bidirectional: boolean;
  photoReference: string;
  notes: string;
};

type DraftState = { nodes: SurveyNode[]; walkthroughSegments: WalkthroughSegment[] };

export function validateSurveySearch(search: Record<string, unknown>) {
  const building = normalizePublicBuildingCode(search["building"]) ?? undefined;
  return building ? { building } : {};
}

export const Route = createFileRoute("/survey")({
  validateSearch: validateSurveySearch,
  head: () => ({
    meta: [
      { title: "UTM Field Survey — Gapwise" },
      {
        name: "description",
        content: "Capture evidence-backed UTM entrance observations and CCT/HMALC Link walkthrough notes.",
      },
    ],
  }),
  component: FieldSurveyPage,
});

function uniqueId(prefix: string) {
  const suffix =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
  return `${prefix}-${suffix}`.toLowerCase();
}

function localDate() {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

function downloadJson(filename: string, value: unknown) {
  const blob = new Blob([`${JSON.stringify(value, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function buildCampusSurvey(nodes: SurveyNode[]): CampusSurvey {
  const floorsByBuilding = new Map<string, Set<string>>();
  for (const node of nodes) {
    if (!node.building) continue;
    const floors = floorsByBuilding.get(node.building) ?? new Set<string>();
    if (node.floor) floors.add(node.floor);
    floorsByBuilding.set(node.building, floors);
  }
  return {
    schemaVersion: 1,
    survey: {
      date: localDate(),
      source: "UTM campus field survey",
      sourceUrl: "",
      notes:
        "Recorded with Gapwise field-survey mode. Live browser location accuracy is preserved in node notes; existing OSM coordinates are selectable only after an on-site identity observation.",
    },
    buildings: [...floorsByBuilding.entries()].map(([code, floors]) => ({
      code,
      floors: [...floors].sort(),
    })),
    nodes,
    edges: [],
  };
}

function candidateTitle(candidate: FieldSurveyGeometryCandidate) {
  const [longitude, latitude] = candidate.coordinates;
  return `OSM ${candidate.osmNodeId} · ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

function FieldSurveyPage() {
  const search = Route.useSearch();
  const [buildingCode, setBuildingCode] = useState(search.building ?? "MN");
  const targets = useMemo(() => fieldSurveyTargetsForBuilding(buildingCode), [buildingCode]);
  const [targetId, setTargetId] = useState(targets[0]?.id ?? "");
  const target = targets.find((item) => item.id === targetId) ?? null;
  const [label, setLabel] = useState(target?.label ?? "Exterior entrance");
  const [floor, setFloor] = useState(target?.levelContext ?? "");
  const [accessibility, setAccessibility] = useState<AccessibilityStatus>("unknown");
  const [accessObservation, setAccessObservation] = useState("unknown");
  const [photoReference, setPhotoReference] = useState("");
  const [notes, setNotes] = useState("");
  const [candidateId, setCandidateId] = useState("");
  const [capturedLocation, setCapturedLocation] = useState<CapturedLocation | null>(null);
  const [status, setStatus] = useState("");
  const [draft, setDraft] = useState<DraftState>({ nodes: [], walkthroughSegments: [] });

  const [walkFrom, setWalkFrom] = useState("");
  const [walkTo, setWalkTo] = useState("");
  const [walkDistance, setWalkDistance] = useState("");
  const [walkStairs, setWalkStairs] = useState(false);
  const [walkAccessibility, setWalkAccessibility] = useState<AccessibilityStatus>("unknown");
  const [walkNotes, setWalkNotes] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DRAFT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<DraftState>;
        setDraft({
          nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
          walkthroughSegments: Array.isArray(parsed.walkthroughSegments)
            ? parsed.walkthroughSegments
            : [],
        });
      }
    } catch {
      // Corrupt local drafts should not block a fresh survey.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draft]);

  useEffect(() => {
    const next = fieldSurveyTargetsForBuilding(buildingCode)[0] ?? null;
    setTargetId(next?.id ?? "");
    setLabel(next?.label ?? "Exterior entrance");
    setFloor(next?.levelContext ?? "");
    setCandidateId("");
    setCapturedLocation(null);
  }, [buildingCode]);

  useEffect(() => {
    if (!target) {
      setLabel("Exterior entrance");
      setFloor("");
      return;
    }
    setLabel(target.label);
    setFloor(target.levelContext ?? "");
    setCandidateId("");
    setCapturedLocation(null);
  }, [target]);

  const candidates = target?.geometryCandidates ?? [];
  const selectedCandidate = candidates.find((candidate) => candidate.id === candidateId) ?? null;
  const usableCandidate =
    selectedCandidate?.kind === "physical_door_unreconciled" ? selectedCandidate : null;
  const connectionTarget = target?.targetKind === "building_connection";
  const selectedBuilding = UTM_BUILDINGS.find((building) => building.code === buildingCode);

  function captureLocation() {
    if (!("geolocation" in navigator)) {
      setStatus("This browser does not expose geolocation.");
      return;
    }
    setStatus("Finding your position…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next: CapturedLocation = {
          longitude: position.coords.longitude,
          latitude: position.coords.latitude,
          accuracyMeters: position.coords.accuracy,
          capturedAt: new Date(position.timestamp).toISOString(),
        };
        setCandidateId("");
        setCapturedLocation(next);
        setStatus(`Captured · browser reports ±${Math.round(next.accuracyMeters)} m accuracy`);
      },
      (error) => setStatus(error.message || "Location capture failed."),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );
  }

  function addEntrance() {
    const coordinate = usableCandidate
      ? { longitude: usableCandidate.coordinates[0], latitude: usableCandidate.coordinates[1] }
      : capturedLocation;
    if (!coordinate) return;

    const nodeNotes = [
      target ? `Field target: ${target.id}.` : "Field target: unlisted exterior door.",
      usableCandidate
        ? `On-site observation reconciles this identity to existing OSM node ${usableCandidate.osmNodeId}; coordinate copied from source-backed OSM geometry.`
        : capturedLocation
          ? `Live browser geolocation captured ${capturedLocation.capturedAt}; reported accuracy ±${Math.round(capturedLocation.accuracyMeters)} m. Reconcile against the physical threshold before importing as exact geometry.`
          : "",
      `Observed access: ${accessObservation}.`,
      notes.trim(),
    ]
      .filter(Boolean)
      .join(" ");

    const node: SurveyNode = {
      id: uniqueId(`field-${buildingCode.toLowerCase()}`),
      building: buildingCode,
      floor: floor.trim() || null,
      kind: "entrance",
      labelOrRoom: label.trim() || "Exterior entrance",
      accessibility,
      longitude: coordinate.longitude,
      latitude: coordinate.latitude,
      ...(photoReference.trim() ? { photoReference: photoReference.trim() } : {}),
      notes: nodeNotes,
    };
    setDraft((current) => ({ ...current, nodes: [...current.nodes, node] }));
    setCandidateId("");
    setCapturedLocation(null);
    setPhotoReference("");
    setNotes("");
    setStatus("Entrance observation added to the local draft.");
  }

  function addWalkSegment() {
    const distanceMeters = Number(walkDistance);
    if (!walkFrom.trim() || !walkTo.trim() || !Number.isFinite(distanceMeters) || distanceMeters <= 0) {
      setStatus("Enter both segment endpoints and a positive measured distance.");
      return;
    }
    const segment: WalkthroughSegment = {
      id: uniqueId("walk-cct-hm"),
      fromLabel: walkFrom.trim(),
      toLabel: walkTo.trim(),
      distanceMeters,
      environment: "indoor",
      stairs: walkStairs,
      accessibility: walkAccessibility,
      bidirectional: true,
      photoReference: "",
      notes: walkNotes.trim(),
    };
    setDraft((current) => ({
      ...current,
      walkthroughSegments: [...current.walkthroughSegments, segment],
    }));
    setWalkFrom(walkTo.trim());
    setWalkTo("");
    setWalkDistance("");
    setWalkStairs(false);
    setWalkAccessibility("unknown");
    setWalkNotes("");
    setStatus("CCT/HMALC walkthrough segment added.");
  }

  function exportEntrances() {
    try {
      const validated = validateCampusSurvey(buildCampusSurvey(draft.nodes));
      downloadJson(`utm-field-survey-${localDate()}.json`, validated);
      setStatus("Validated entrance survey downloaded.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Survey validation failed.");
    }
  }

  function exportWalkthrough() {
    downloadJson(`utm-cct-hm-walkthrough-${localDate()}.json`, {
      schemaVersion: 1,
      kind: "gapwise-indoor-walkthrough-notes",
      survey: {
        date: localDate(),
        source: "UTM campus field survey",
        connectionId: "cct-hm-link",
        note:
          "Evidence capture only. Convert to indoor local-coordinate nodes and edges after the corridor geometry and level transitions are independently defensible.",
      },
      segments: draft.walkthroughSegments,
    });
  }

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
        <Link to="/route" className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-muted-foreground">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to map
        </Link>
        <p className="mt-5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-accent">UTM evidence capture</p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.04em]">Field survey</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
          Resolve the exact door identities Gapwise refuses to guess. Drafts stay in this browser until exported.
        </p>

        <section className="mt-6 rounded-2xl border border-border bg-card p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Building">
              <select value={buildingCode} onChange={(event) => setBuildingCode(event.target.value)} className={CONTROL}>
                {UTM_BUILDINGS.map((building) => (
                  <option key={building.code} value={building.code}>{building.code} — {building.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Survey target">
              <select value={targetId} onChange={(event) => setTargetId(event.target.value)} className={CONTROL}>
                {targets.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                <option value="">Unlisted exterior door</option>
              </select>
            </Field>
          </div>

          <div className="mt-4 rounded-xl border border-border bg-secondary/40 p-4">
            <strong>{selectedBuilding?.code} · {selectedBuilding?.name}</strong>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {target?.instructions ?? "Record this only while physically standing at a real exterior door."}
            </p>
            {target ? <p className="mt-2 text-xs text-muted-foreground">Evidence: {target.sourceIds.join(" · ")}</p> : null}
          </div>

          {!connectionTarget ? (
            <div className="mt-5 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Door label"><input value={label} onChange={(event) => setLabel(event.target.value)} className={CONTROL} /></Field>
                <Field label="Floor / level context"><input value={floor} onChange={(event) => setFloor(event.target.value)} placeholder="Optional" className={CONTROL} /></Field>
              </div>

              {candidates.length ? (
                <fieldset className="grid gap-3 rounded-xl border border-border p-4">
                  <legend className="px-1 text-sm font-semibold">Known geometry candidates</legend>
                  {candidates.map((candidate) => (
                    <label key={candidate.id} className="flex gap-3 text-sm">
                      <input
                        type="radio"
                        name="geometry-candidate"
                        disabled={candidate.kind === "approach_only"}
                        checked={candidateId === candidate.id}
                        onChange={() => { setCandidateId(candidate.id); setCapturedLocation(null); }}
                      />
                      <span>
                        <strong>{candidateTitle(candidate)}</strong>
                        <span className="block text-xs leading-5 text-muted-foreground">{candidate.notes}</span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              ) : null}

              {!usableCandidate ? (
                <button type="button" onClick={captureLocation} className="button-secondary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold">
                  <Crosshair className="h-4 w-4" aria-hidden="true" /> Capture position at threshold
                </button>
              ) : null}

              {capturedLocation ? (
                <p className="rounded-xl border border-border bg-secondary/40 p-3 text-sm">
                  {capturedLocation.latitude.toFixed(7)}, {capturedLocation.longitude.toFixed(7)} · browser accuracy ±{Math.round(capturedLocation.accuracyMeters)} m
                </p>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Accessibility evidence">
                  <select value={accessibility} onChange={(event) => setAccessibility(event.target.value as AccessibilityStatus)} className={CONTROL}>
                    <option value="unknown">Unknown</option><option value="accessible">Verified accessible</option><option value="not_accessible">Verified not accessible</option>
                  </select>
                </Field>
                <Field label="Observed access">
                  <select value={accessObservation} onChange={(event) => setAccessObservation(event.target.value)} className={CONTROL}>
                    <option value="unknown">Unknown</option><option value="ordinary use observed">Ordinary use observed</option><option value="card reader observed">Card reader observed</option><option value="locked observed">Locked observed</option><option value="emergency-only signage observed">Emergency-only</option><option value="service-only signage observed">Service-only</option>
                  </select>
                </Field>
              </div>
              <Field label="Photo reference"><input value={photoReference} onChange={(event) => setPhotoReference(event.target.value)} placeholder="e.g. IMG_2841.HEIC" className={CONTROL} /></Field>
              <Field label="Observation notes"><textarea value={notes} onChange={(event) => setNotes(event.target.value)} rows={4} className={`${CONTROL} h-auto py-3`} placeholder="Signage, side, nearby path, opener, stairs/ramp, door count…" /></Field>
              <button type="button" disabled={!usableCandidate && !capturedLocation} onClick={addEntrance} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground disabled:opacity-40">
                <Plus className="h-4 w-4" aria-hidden="true" /> Add entrance observation
              </button>
            </div>
          ) : (
            <p className="mt-5 rounded-xl border border-accent/30 bg-accent/5 p-4 text-sm leading-6">
              Do not trace the CCT/HMALC Link with indoor GPS. Use the segment recorder below; convert the walkthrough to local floor geometry only after the route is defensible.
            </p>
          )}
        </section>

        <section className="mt-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
          <div className="flex gap-3"><RouteIcon className="mt-1 h-5 w-5 text-accent" aria-hidden="true" /><div><h2 className="font-display text-xl font-semibold">CCT ↔ HMALC Link walkthrough</h2><p className="mt-1 text-sm text-muted-foreground">Record doors, junctions, level changes and measured segment distances. Unknown stays unknown.</p></div></div>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="From"><input value={walkFrom} onChange={(event) => setWalkFrom(event.target.value)} className={CONTROL} /></Field>
            <Field label="To"><input value={walkTo} onChange={(event) => setWalkTo(event.target.value)} className={CONTROL} /></Field>
            <Field label="Measured distance (m)"><input inputMode="decimal" value={walkDistance} onChange={(event) => setWalkDistance(event.target.value)} className={CONTROL} /></Field>
            <Field label="Accessibility"><select value={walkAccessibility} onChange={(event) => setWalkAccessibility(event.target.value as AccessibilityStatus)} className={CONTROL}><option value="unknown">Unknown</option><option value="accessible">Verified accessible</option><option value="not_accessible">Verified not accessible</option></select></Field>
          </div>
          <label className="mt-4 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={walkStairs} onChange={(event) => setWalkStairs(event.target.checked)} /> Stairs on this segment</label>
          <Field label="Segment notes" className="mt-4"><textarea value={walkNotes} onChange={(event) => setWalkNotes(event.target.value)} rows={3} className={`${CONTROL} h-auto py-3`} /></Field>
          <button type="button" onClick={addWalkSegment} className="button-secondary mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold"><Plus className="h-4 w-4" aria-hidden="true" /> Add walkthrough segment</button>
        </section>

        <section className="mt-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div><h2 className="font-display text-xl font-semibold">Local draft</h2><p className="mt-1 text-sm text-muted-foreground">{draft.nodes.length} entrances · {draft.walkthroughSegments.length} link segments</p></div>
            <button type="button" onClick={() => setDraft({ nodes: [], walkthroughSegments: [] })} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted-foreground"><Trash2 className="h-4 w-4" aria-hidden="true" /> Clear</button>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button type="button" disabled={!draft.nodes.length} onClick={exportEntrances} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground disabled:opacity-40"><Download className="h-4 w-4" aria-hidden="true" /> Download importable entrance survey</button>
            <button type="button" disabled={!draft.walkthroughSegments.length} onClick={exportWalkthrough} className="button-secondary inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold disabled:opacity-40"><Download className="h-4 w-4" aria-hidden="true" /> Download link walkthrough</button>
          </div>
          {status ? <p className="mt-4 whitespace-pre-wrap text-xs leading-5 text-muted-foreground" role="status">{status}</p> : null}
        </section>
      </div>
    </main>
  );
}

function Field({ label, children, className = "" }: { label: string; children: ReactNode; className?: string }) {
  return <label className={`grid gap-1.5 text-sm font-semibold ${className}`}><span>{label}</span>{children}</label>;
}
