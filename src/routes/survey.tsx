import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Crosshair,
  Download,
  MapPin,
  Plus,
  Route as RouteIcon,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  normalizePublicBuildingCode,
  UTM_BUILDINGS,
} from "@/data/utm/building-registry";
import {
  fieldSurveyTargetsForBuilding,
  type FieldSurveyGeometryCandidate,
} from "@/data/utm/field-survey-targets";
import {
  validateCampusSurvey,
  type AccessibilityStatus,
  type CampusSurvey,
  type SurveyNode,
} from "@/data/utm/survey-format";

const DRAFT_KEY = "gapwise-utm-field-survey-v1";

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

type DraftState = {
  nodes: SurveyNode[];
  walkthroughSegments: WalkthroughSegment[];
};

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
        content:
          "Capture evidence-backed UTM entrance observations and CCT/HMALC Link walkthrough notes.",
      },
    ],
  }),
  component: FieldSurveyPage,
});

function id(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`.toLowerCase();
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
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

function localDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function candidateLabel(candidate: FieldSurveyGeometryCandidate) {
  const [longitude, latitude] = candidate.coordinates;
  return `OSM ${candidate.osmNodeId} · ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

function buildCampusSurvey(nodes: SurveyNode[]): CampusSurvey {
  const buildingFloors = new Map<string, Set<string>>();
  for (const node of nodes) {
    if (!node.building) continue;
    const floors = buildingFloors.get(node.building) ?? new Set<string>();
    if (node.floor) floors.add(node.floor);
    buildingFloors.set(node.building, floors);
  }

  return {
    schemaVersion: 1,
    survey: {
      date: localDate(),
      source: "UTM campus field survey",
      sourceUrl: "",
      notes:
        "Recorded with Gapwise field-survey mode. Browser geolocation accuracy is preserved in each live-capture node's notes. Candidate coordinates are existing source-backed OSM door geometry and require an on-site identity observation before selection.",
    },
    buildings: [...buildingFloors.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([code, floors]) => ({ code, floors: [...floors].sort() })),
    nodes,
    edges: [],
  };
}

function FieldSurveyPage() {
  const search = Route.useSearch();
  const initialBuilding = search.building ?? "MN";
  const [buildingCode, setBuildingCode] = useState(initialBuilding);
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
  const [locationStatus, setLocationStatus] = useState("");
  const [draft, setDraft] = useState<DraftState>({ nodes: [], walkthroughSegments: [] });

  const [walkFrom, setWalkFrom] = useState("");
  const [walkTo, setWalkTo] = useState("");
  const [walkDistance, setWalkDistance] = useState("");
  const [walkEnvironment, setWalkEnvironment] = useState<"indoor" | "covered">("indoor");
  const [walkStairs, setWalkStairs] = useState(false);
  const [walkAccessibility, setWalkAccessibility] = useState<AccessibilityStatus>("unknown");
  const [walkBidirectional, setWalkBidirectional] = useState(true);
  const [walkPhoto, setWalkPhoto] = useState("");
  const [walkNotes, setWalkNotes] = useState("");

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DRAFT_KEY);
      if (!saved) return;
      const parsed = JSON.parse(saved) as Partial<DraftState>;
      setDraft({
        nodes: Array.isArray(parsed.nodes) ? parsed.nodes : [],
        walkthroughSegments: Array.isArray(parsed.walkthroughSegments)
          ? parsed.walkthroughSegments
          : [],
      });
    } catch {
      // A damaged local draft should never block a new survey.
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  }, [draft]);

  useEffect(() => {
    const nextTargets = fieldSurveyTargetsForBuilding(buildingCode);
    const nextTarget = nextTargets[0] ?? null;
    setTargetId(nextTarget?.id ?? "");
    setLabel(nextTarget?.label ?? "Exterior entrance");
    setFloor(nextTarget?.levelContext ?? "");
    setCandidateId("");
    setCapturedLocation(null);
  }, [buildingCode]);

  useEffect(() => {
    if (!target) return;
    setLabel(target.label);
    setFloor(target.levelContext ?? "");
    setCandidateId("");
    setCapturedLocation(null);
  }, [targetId]); // eslint-disable-line react-hooks/exhaustive-deps

  const geometryCandidates = target?.geometryCandidates ?? [];
  const selectedCandidate = geometryCandidates.find((candidate) => candidate.id === candidateId) ?? null;
  const usableCandidate =
    selectedCandidate?.kind === "physical_door_unreconciled" ? selectedCandidate : null;
  const hasCoordinate = Boolean(usableCandidate || capturedLocation);
  const isConnectionTarget = target?.targetKind === "building_connection";

  function captureLocation() {
    if (!("geolocation" in navigator)) {
      setLocationStatus("This browser does not expose geolocation.");
      return;
    }
    setLocationStatus("Finding your position…");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const next = {
          longitude: position.coords.longitude,
          latitude: position.coords.latitude,
          accuracyMeters: position.coords.accuracy,
          capturedAt: new Date(position.timestamp).toISOString(),
        };
        setCapturedLocation(next);
        setCandidateId("");
        setLocationStatus(`Captured · browser reports ±${Math.round(next.accuracyMeters)} m accuracy`);
      },
      (error) => setLocationStatus(error.message || "Location capture failed."),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 15_000 },
    );
  }

  function addEntranceObservation() {
    const coordinate = usableCandidate
      ? { longitude: usableCandidate.coordinates[0], latitude: usableCandidate.coordinates[1] }
      : capturedLocation;
    if (!coordinate) return;

    const evidenceNotes = [
      target ? `Field target: ${target.id}.` : "Field target: unlisted exterior door.",
      usableCandidate
        ? `On-site observation reconciles this identity to existing OSM node ${usableCandidate.osmNodeId}; coordinate copied from source-backed OSM geometry, not phone GPS.`
        : capturedLocation
          ? `Live browser geolocation captured ${capturedLocation.capturedAt}; reported accuracy ±${Math.round(capturedLocation.accuracyMeters)} m. Reconcile against the physical threshold and source geometry before treating this as survey-grade exact geometry.`
          : "",
      `Observed access: ${accessObservation}.`,
      notes.trim(),
    ]
      .filter(Boolean)
      .join(" ");

    const node: SurveyNode = {
      id: id(`field-${buildingCode.toLowerCase()}`),
      building: buildingCode,
      floor: floor.trim() || null,
      kind: "entrance",
      labelOrRoom: label.trim() || "Exterior entrance",
      accessibility,
      longitude: coordinate.longitude,
      latitude: coordinate.latitude,
      ...(photoReference.trim() ? { photoReference: photoReference.trim() } : {}),
      notes: evidenceNotes,
    };

    setDraft((current) => ({ ...current, nodes: [...current.nodes, node] }));
    setNotes("");
    setPhotoReference("");
    setAccessObservation("unknown");
    setAccessibility("unknown");
    setCandidateId("");
    setCapturedLocation(null);
    setLocationStatus("Observation added to the local draft.");
  }

  function addWalkthroughSegment() {
    const distanceMeters = Number(walkDistance);
    if (!walkFrom.trim() || !walkTo.trim() || !Number.isFinite(distanceMeters) || distanceMeters <= 0) {
      return;
    }
    const segment: WalkthroughSegment = {
      id: id("walk-cct-hm"),
      fromLabel: walkFrom.trim(),
      toLabel: walkTo.trim(),
      distanceMeters,
      environment: walkEnvironment,
      stairs: walkStairs,
      accessibility: walkAccessibility,
      bidirectional: walkBidirectional,
      photoReference: walkPhoto.trim(),
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
    setWalkPhoto("");
    setWalkNotes("");
  }

  function exportEntranceSurvey() {
    try {
      const survey = buildCampusSurvey(draft.nodes);
      const validated = validateCampusSurvey(survey);
      downloadJson(`utm-field-survey-${localDate()}.json`, validated);
      setLocationStatus("Validated entrance survey downloaded.");
    } catch (error) {
      setLocationStatus(error instanceof Error ? error.message : "Survey validation failed.");
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
          "This file is evidence capture, not directly routable indoor geometry. Convert to indoor local-coordinate nodes/edges only after geometry and level transitions are independently defensible.",
      },
      segments: draft.walkthroughSegments,
    });
  }

  const selectedBuilding = UTM_BUILDINGS.find((building) => building.code === buildingCode)!;

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-5xl px-4 py-5 sm:px-6 sm:py-8">
        <header className="flex items-start justify-between gap-4">
          <div>
            <Link
              to="/route"
              className="inline-flex min-h-10 items-center gap-2 rounded-lg text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to campus map
            </Link>
            <p className="mt-5 font-mono text-xs font-bold uppercase tracking-[0.14em] text-accent">
              UTM evidence capture
            </p>
            <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.04em] sm:text-4xl">
              Field survey
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">
              Resolve the exact door identities Gapwise intentionally refuses to guess. Drafts stay in
              this browser until you download them.
            </p>
          </div>
          <div className="hidden rounded-xl border border-border bg-card p-3 sm:block">
            <ShieldCheck className="h-6 w-6 text-accent" aria-hidden="true" />
          </div>
        </header>

        <section className="mt-6 rounded-2xl border border-border bg-card p-4 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold">
              Building
              <select
                value={buildingCode}
                onChange={(event) => setBuildingCode(event.target.value)}
                className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
              >
                {UTM_BUILDINGS.map((building) => (
                  <option key={building.code} value={building.code}>
                    {building.code} — {building.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Survey target
              <select
                value={targetId}
                onChange={(event) => setTargetId(event.target.value)}
                className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
              >
                {targets.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
                <option value="">Unlisted exterior door</option>
              </select>
            </label>
          </div>

          <div className="mt-4 rounded-xl border border-border bg-secondary/40 p-4">
            <p className="font-mono text-[0.68rem] font-bold uppercase tracking-[0.12em] text-accent">
              {selectedBuilding.code} · {selectedBuilding.category}
            </p>
            <p className="mt-1 font-semibold">{selectedBuilding.name}</p>
            {target ? (
              <>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{target.instructions}</p>
                <p className="mt-2 text-xs text-muted-foreground">
                  Evidence: {target.sourceIds.join(" · ")}
                </p>
              </>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">
                Record this only if you are physically standing at a real exterior door.
              </p>
            )}
          </div>

          {!isConnectionTarget ? (
            <div className="mt-5 grid gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-semibold">
                  Door label
                  <input
                    value={label}
                    onChange={(event) => setLabel(event.target.value)}
                    className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </label>
                <label className="grid gap-1.5 text-sm font-semibold">
                  Floor / level context
                  <input
                    value={floor}
                    onChange={(event) => setFloor(event.target.value)}
                    placeholder="Optional, e.g. 2"
                    className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
                  />
                </label>
              </div>

              {geometryCandidates.length > 0 ? (
                <fieldset className="grid gap-2 rounded-xl border border-border p-4">
                  <legend className="px-1 text-sm font-semibold">Known geometry candidates</legend>
                  <label className="flex gap-3 text-sm">
                    <input
                      type="radio"
                      name="coordinate-source"
                      checked={!candidateId}
                      onChange={() => setCandidateId("")}
                    />
                    <span>
                      <strong>Live field position</strong>
                      <span className="block text-xs leading-5 text-muted-foreground">
                        Use for a newly observed door. Reconcile the GPS reading before importing it as exact geometry.
                      </span>
                    </span>
                  </label>
                  {geometryCandidates.map((candidate) => (
                    <label key={candidate.id} className="flex gap-3 text-sm">
                      <input
                        type="radio"
                        name="coordinate-source"
                        disabled={candidate.kind === "approach_only"}
                        checked={candidateId === candidate.id}
                        onChange={() => {
                          setCandidateId(candidate.id);
                          setCapturedLocation(null);
                          setLocationStatus("Existing source-backed door geometry selected.");
                        }}
                      />
                      <span>
                        <strong>{candidateLabel(candidate)}</strong>
                        <span className="block text-xs leading-5 text-muted-foreground">
                          {candidate.notes}
                        </span>
                      </span>
                    </label>
                  ))}
                </fieldset>
              ) : null}

              {!usableCandidate ? (
                <button
                  type="button"
                  onClick={captureLocation}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 text-sm font-semibold hover:bg-secondary/80"
                >
                  <Crosshair className="h-4 w-4" aria-hidden="true" />
                  Capture position at the threshold
                </button>
              ) : null}

              {capturedLocation ? (
                <div className="rounded-xl border border-border bg-secondary/40 p-3 text-sm">
                  <div className="flex items-center gap-2 font-semibold">
                    <MapPin className="h-4 w-4 text-accent" aria-hidden="true" />
                    {capturedLocation.latitude.toFixed(7)}, {capturedLocation.longitude.toFixed(7)}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Browser-reported accuracy ±{Math.round(capturedLocation.accuracyMeters)} m. This is evidence,
                    not automatic proof of the exact threshold coordinate.
                  </p>
                </div>
              ) : null}

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-sm font-semibold">
                  Accessibility evidence
                  <select
                    value={accessibility}
                    onChange={(event) => setAccessibility(event.target.value as AccessibilityStatus)}
                    className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="accessible">Verified accessible</option>
                    <option value="not_accessible">Verified not accessible</option>
                  </select>
                </label>
                <label className="grid gap-1.5 text-sm font-semibold">
                  Observed access
                  <select
                    value={accessObservation}
                    onChange={(event) => setAccessObservation(event.target.value)}
                    className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
                  >
                    <option value="unknown">Unknown</option>
                    <option value="ordinary student/public use observed">Ordinary use observed</option>
                    <option value="card reader observed">Card reader observed</option>
                    <option value="locked observed">Locked observed</option>
                    <option value="emergency-only signage observed">Emergency-only signage</option>
                    <option value="service-only signage observed">Service-only signage</option>
                  </select>
                </label>
              </div>

              <label className="grid gap-1.5 text-sm font-semibold">
                Photo reference
                <input
                  value={photoReference}
                  onChange={(event) => setPhotoReference(event.target.value)}
                  placeholder="e.g. IMG_2841.HEIC"
                  className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
                />
              </label>
              <label className="grid gap-1.5 text-sm font-semibold">
                Observation notes
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={4}
                  placeholder="Signage, side of building, nearby path, automatic opener, stairs/ramp, door count…"
                  className="rounded-xl border border-border bg-background p-3 text-sm"
                />
              </label>

              <button
                type="button"
                disabled={!hasCoordinate}
                onClick={addEntranceObservation}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Plus className="h-4 w-4" aria-hidden="true" />
                Add entrance observation
              </button>
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-accent/30 bg-accent/5 p-4 text-sm leading-6">
              <strong>Do not trace this indoor link with phone GPS.</strong> Walk it physically and use the
              segment recorder below. Gapwise's indoor graph uses local floor coordinates, so these notes are
              deliberately kept separate until the corridor geometry can be reconstructed defensibly.
            </div>
          )}

          {locationStatus ? (
            <p className="mt-4 whitespace-pre-wrap text-xs leading-5 text-muted-foreground" role="status">
              {locationStatus}
            </p>
          ) : null}
        </section>

        <section className="mt-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <RouteIcon className="mt-0.5 h-5 w-5 text-accent" aria-hidden="true" />
            <div>
              <h2 className="font-display text-xl font-semibold">CCT ↔ HMALC Link walkthrough</h2>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">
                First-party UTM sources verify the connection's existence. Record the actual route one segment at
                a time; do not infer hidden corridors or accessibility.
              </p>
            </div>
          </div>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold">
              From
              <input
                value={walkFrom}
                onChange={(event) => setWalkFrom(event.target.value)}
                placeholder="e.g. CCT atrium doorway"
                className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              To
              <input
                value={walkTo}
                onChange={(event) => setWalkTo(event.target.value)}
                placeholder="e.g. first corridor junction"
                className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Measured distance (m)
              <input
                inputMode="decimal"
                value={walkDistance}
                onChange={(event) => setWalkDistance(event.target.value)}
                className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
              />
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Environment
              <select
                value={walkEnvironment}
                onChange={(event) => setWalkEnvironment(event.target.value as "indoor" | "covered")}
                className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="indoor">Indoor</option>
                <option value="covered">Covered</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Accessibility
              <select
                value={walkAccessibility}
                onChange={(event) => setWalkAccessibility(event.target.value as AccessibilityStatus)}
                className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
              >
                <option value="unknown">Unknown</option>
                <option value="accessible">Verified accessible</option>
                <option value="not_accessible">Verified not accessible</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm font-semibold">
              Photo reference
              <input
                value={walkPhoto}
                onChange={(event) => setWalkPhoto(event.target.value)}
                className="h-11 rounded-xl border border-border bg-background px-3 text-sm"
              />
            </label>
          </div>

          <div className="mt-4 flex flex-wrap gap-5 text-sm">
            <label className="flex items-center gap-2 font-semibold">
              <input type="checkbox" checked={walkStairs} onChange={(event) => setWalkStairs(event.target.checked)} />
              Stairs on this segment
            </label>
            <label className="flex items-center gap-2 font-semibold">
              <input
                type="checkbox"
                checked={walkBidirectional}
                onChange={(event) => setWalkBidirectional(event.target.checked)}
              />
              Bidirectional observed
            </label>
          </div>

          <label className="mt-4 grid gap-1.5 text-sm font-semibold">
            Segment notes
            <textarea
              rows={3}
              value={walkNotes}
              onChange={(event) => setWalkNotes(event.target.value)}
              placeholder="Door, turn, elevator/stairs, level change, hours/access signs…"
              className="rounded-xl border border-border bg-background p-3 text-sm"
            />
          </label>

          <button
            type="button"
            onClick={addWalkthroughSegment}
            className="mt-4 inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 text-sm font-bold"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add walkthrough segment
          </button>
        </section>

        <section className="mt-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-semibold">Local draft</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {draft.nodes.length} entrance observations · {draft.walkthroughSegments.length} link segments
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setDraft({ nodes: [], walkthroughSegments: [] });
                setLocationStatus("Local draft cleared.");
              }}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-muted-foreground hover:bg-secondary"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Clear
            </button>
          </div>

          {draft.nodes.length > 0 ? (
            <ul className="mt-4 grid gap-2">
              {draft.nodes.map((node) => (
                <li key={node.id} className="rounded-xl border border-border bg-secondary/30 p-3 text-sm">
                  <strong>{node.building} · {node.labelOrRoom}</strong>
                  <span className="mt-1 block font-mono text-xs text-muted-foreground">
                    {node.latitude?.toFixed(7)}, {node.longitude?.toFixed(7)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={draft.nodes.length === 0}
              onClick={exportEntranceSurvey}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-accent px-4 text-sm font-bold text-accent-foreground disabled:opacity-40"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download importable entrance survey
            </button>
            <button
              type="button"
              disabled={draft.walkthroughSegments.length === 0}
              onClick={exportWalkthrough}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-border bg-secondary px-4 text-sm font-bold disabled:opacity-40"
            >
              <Download className="h-4 w-4" aria-hidden="true" />
              Download CCT/HM walkthrough notes
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
