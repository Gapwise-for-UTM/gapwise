"""Public type definitions for the Gapwise API v1 contract."""

from __future__ import annotations
from dataclasses import dataclass
from typing import Generic, Literal, NotRequired, TypeVar, TypedDict

ApiVersion = Literal["v1"]
VerificationStatus = Literal["verified", "inferred", "unknown"]
FactStatus = Literal["verified", "stale", "inferred", "user-reported", "unavailable", "unknown"]
RouteMode = Literal["fastest", "prefer-indoor", "step-free"]
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


RouteResult = TypedDict(
    "RouteResult",
    {
        "dataVersion": str,
        "from": Building,
        "to": Building,
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
