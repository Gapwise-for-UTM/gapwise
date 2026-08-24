"""Public type definitions for the Gapwise API v1 contract."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Generic, Literal, NotRequired, TypedDict, TypeVar

ApiVersion = Literal["v1"]
VerificationStatus = Literal["verified", "inferred", "unknown"]
FactStatus = Literal["verified", "stale", "inferred", "user-reported", "unavailable", "unknown"]
RouteMode = Literal["fastest", "prefer-indoor", "step-free"]
Term = Literal["Fall", "Winter", "Summer"]
Weekday = Literal["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]
RiskTolerance = Literal["low", "medium", "high"]
BuildingCategory = Literal["academic", "residence", "facility"]
PlaceKind = Literal["dining", "study", "library", "service", "recreation", "amenity", "facility"]
AvailabilityState = Literal["open", "closed", "unknown"]


class Provenance(TypedDict):
    source: str
    sourceUrl: str
    lastVerified: str
    verificationStatus: VerificationStatus


class FactProvenance(TypedDict):
    sourceId: str
    status: FactStatus
    observedAt: str
    expiresAt: NotRequired[str]
    note: NotRequired[str]


class Building(TypedDict):
    code: str
    name: str
    category: BuildingCategory
    aliases: list[str]
    routingCoverage: Literal["mapped", "identity-only"]
    entranceCount: int
    verifiedEntranceCount: int
    accessibility: Literal["accessible", "not_accessible", "unknown"]
    indoorRoomNodeCount: int
    provenance: list[Provenance]


class PlaceAvailability(TypedDict):
    state: AvailabilityState
    freshness: FactStatus
    evaluatedAt: str
    nextTransition: str | None


class CampusPlace(TypedDict):
    id: str
    name: str
    kind: PlaceKind
    buildingCode: str
    floorOrRoom: NotRequired[str]
    summary: str
    amenities: list[str]
    hoursProvenance: FactProvenance
    metadataProvenance: FactProvenance
    availability: PlaceAvailability


class RoutePreferences(TypedDict):
    mode: RouteMode
    walkingSpeedMps: float
    transitionBufferMinutes: float


RouteResult = TypedDict(
    "RouteResult",
    {
        "dataVersion": str,
        "from": Building,
        "to": Building,
        "preferences": RoutePreferences,
        "status": Literal["same-building", "routed", "approximate", "unavailable"],
        "accuracy": str,
        "totalDistanceMeters": float | None,
        "indoorDistanceMeters": float | None,
        "outdoorDistanceMeters": float | None,
        "estimatedSeconds": float | None,
        "floorChanges": int | None,
        "warnings": list[str],
        "routeVerification": Literal["verified", "mixed", "inferred", "unavailable"],
    },
    total=False,
)


class GapRecommendationTimelineItem(TypedDict):
    kind: str
    label: str
    minutes: int


class GapRecommendation(TypedDict):
    id: str
    action: str
    title: str
    summary: str
    score: float
    activityMinutes: int
    reasons: list[str]
    tags: list[str]
    timeline: list[GapRecommendationTimelineItem]


class GapAssessment(TypedDict):
    primary: GapRecommendation
    alternatives: list[GapRecommendation]
    confidence: float
    confidenceLabel: Literal["high", "medium", "low"]
    travelMinutes: float | None
    bufferMinutes: float
    leaveByMinutes: float
    arrivalMinutes: float | None
    fallback: bool
    routeStatus: str
    routeAccuracy: str
    warnings: list[str]


GapInterval = TypedDict(
    "GapInterval",
    {
        "term": Term,
        "weekday": Weekday,
        "startTime": int,
        "endTime": int,
        "durationMinutes": int,
        "from": Building,
        "to": Building,
    },
)


class GapPreferencesResult(TypedDict):
    setupMinutes: int
    packUpMinutes: int
    lunchWindowStart: int
    lunchWindowEnd: int
    mealDurationMinutes: int
    willingToLeaveCampus: bool
    oneWayHomeCommuteMinutes: int | None
    minimumHomeStayMinutes: int
    homeTurnaroundMinutes: int
    riskTolerance: RiskTolerance


class GapPlanResult(TypedDict):
    dataVersion: str
    gap: GapInterval
    route: RouteResult
    gapPreferences: GapPreferencesResult
    assessment: GapAssessment


class ApiInfo(TypedDict):
    name: str
    apiVersion: ApiVersion
    campusDataVersion: str
    campusStateVersion: str
    authentication: Literal["none"]
    documentationUrl: str
    openapiUrl: str
    privacy: str


class Pagination(TypedDict):
    limit: int
    offset: int
    count: int
    total: int
    nextOffset: int | None


T = TypeVar("T")


@dataclass(frozen=True, slots=True)
class Page(Generic[T]):
    """One deterministic collection page plus pagination and version metadata."""

    items: list[T]
    pagination: Pagination
    data_version: str
    request_id: str
