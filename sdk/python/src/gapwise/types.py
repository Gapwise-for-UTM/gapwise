"""Typed representations checked against the public OpenAPI contract."""
from typing import Literal, NotRequired, TypedDict
VerificationStatus = Literal["verified", "inferred", "unknown"]
RouteMode = Literal["fastest", "prefer-indoor", "step-free"]
class Provenance(TypedDict):
    source: str
    sourceUrl: str
    lastVerified: str
    verificationStatus: VerificationStatus
class Building(TypedDict):
    code: str
    name: str
    category: Literal["academic", "residence", "facility"]
    aliases: list[str]
    routingCoverage: Literal["mapped", "identity-only"]
    entranceCount: int
    verifiedEntranceCount: int
    accessibility: Literal["accessible", "not_accessible", "unknown"]
    indoorRoomNodeCount: int
    provenance: list[Provenance]
class RoutePreferences(TypedDict):
    mode: NotRequired[RouteMode]
    walkingSpeedMps: NotRequired[float]
    transitionBufferMinutes: NotRequired[float]
class RouteResult(TypedDict):
    dataVersion: str
    from_: Building
    to: Building
    status: Literal["same-building", "routed", "approximate", "unavailable"]
    accuracy: str
    totalDistanceMeters: float | None
    estimatedSeconds: float | None
    warnings: list[str]
    routeVerification: Literal["verified", "mixed", "inferred", "unavailable"]
class CampusPlace(TypedDict):
    id: str
    name: str
    kind: str
    buildingCode: str
    floorOrRoom: NotRequired[str]
    summary: str
    amenities: list[str]
