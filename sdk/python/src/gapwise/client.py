from __future__ import annotations
from typing import Any, Mapping
import httpx
from .types import Building, CampusPlace, RouteMode, RouteResult
DEFAULT_BASE_URL = "https://api.gapwise.ca/v1"

class GapwiseError(Exception): """Base exception for the Gapwise SDK."""
class GapwiseAPIError(GapwiseError):
    def __init__(self, message: str, *, status_code: int, code: str, details: Any = None, request_id: str | None = None):
        super().__init__(message); self.status_code = status_code; self.code = code; self.details = details; self.request_id = request_id
class GapwiseTransportError(GapwiseError): """The API could not be reached."""

def _unwrap(response: httpx.Response, key: str | None = None) -> Any:
    try: payload = response.json()
    except ValueError: payload = None
    if response.is_error:
        error = payload.get("error", {}) if isinstance(payload, dict) else {}
        raise GapwiseAPIError(error.get("message", f"Gapwise API request failed with HTTP {response.status_code}."), status_code=response.status_code, code=error.get("code", "http_error"), details=error.get("details"), request_id=response.headers.get("x-request-id"))
    return payload[key] if key else payload

def _route_payload(from_building: str, to_building: str, *, mode: RouteMode | None, walking_speed_mps: float | None, transition_buffer_minutes: float | None) -> dict[str, Any]:
    preferences = {k: v for k, v in {"mode": mode, "walkingSpeedMps": walking_speed_mps, "transitionBufferMinutes": transition_buffer_minutes}.items() if v is not None}
    return {"from": from_building, "to": to_building, **({"preferences": preferences} if preferences else {})}

class _SyncBuildings:
    def __init__(self, owner: Gapwise): self._owner = owner
    def list(self) -> list[Building]: return self._owner._request("GET", "/buildings", key="buildings")
    def get(self, building: str) -> Building: return self._owner._request("GET", f"/buildings/{httpx.URL(building).raw_path.decode()}", key="building")
class _SyncPlaces:
    def __init__(self, owner: Gapwise): self._owner = owner
    def list(self) -> list[CampusPlace]: return self._owner._request("GET", "/places", key="places")
    def get(self, place_id: str) -> CampusPlace: return self._owner._request("GET", f"/places/{httpx.URL(place_id).raw_path.decode()}", key="place")
class _SyncRoutes:
    def __init__(self, owner: Gapwise): self._owner = owner
    def calculate(self, *, from_building: str, to_building: str, mode: RouteMode | None = None, walking_speed_mps: float | None = None, transition_buffer_minutes: float | None = None) -> RouteResult: return self._owner._request("POST", "/routes", json=_route_payload(from_building, to_building, mode=mode, walking_speed_mps=walking_speed_mps, transition_buffer_minutes=transition_buffer_minutes), key="route")
class _SyncGaps:
    def __init__(self, owner: Gapwise): self._owner = owner
    def plan(self, *, from_building: str, to_building: str, term: str, weekday: str, start_time: int, end_time: int, route_preferences: Mapping[str, Any] | None = None, gap_preferences: Mapping[str, Any] | None = None) -> dict[str, Any]:
        payload = {"from": from_building, "to": to_building, "term": term, "weekday": weekday, "startTime": start_time, "endTime": end_time, **({"routePreferences": dict(route_preferences)} if route_preferences else {}), **({"gapPreferences": dict(gap_preferences)} if gap_preferences else {})}
        return self._owner._request("POST", "/gaps/plan", json=payload, key="gapPlan")

class Gapwise:
    def __init__(self, *, base_url: str = DEFAULT_BASE_URL, timeout: float | httpx.Timeout = 10.0, client: httpx.Client | None = None):
        self._owns_client = client is None; self._client = client or httpx.Client(base_url=base_url.rstrip("/"), timeout=timeout, headers={"Accept": "application/json"}); self.buildings = _SyncBuildings(self); self.places = _SyncPlaces(self); self.routes = _SyncRoutes(self); self.gaps = _SyncGaps(self)
    def _request(self, method: str, path: str, *, key: str | None = None, **kwargs: Any) -> Any:
        try: return _unwrap(self._client.request(method, path, **kwargs), key)
        except httpx.HTTPError as exc: raise GapwiseTransportError(str(exc)) from exc
    def info(self) -> dict[str, Any]: return self._request("GET", "")
    def close(self) -> None:
        if self._owns_client: self._client.close()
    def __enter__(self) -> Gapwise: return self
    def __exit__(self, *_: object) -> None: self.close()

class _AsyncBuildings:
    def __init__(self, owner: AsyncGapwise): self._owner = owner
    async def list(self) -> list[Building]: return await self._owner._request("GET", "/buildings", key="buildings")
    async def get(self, building: str) -> Building: return await self._owner._request("GET", f"/buildings/{httpx.URL(building).raw_path.decode()}", key="building")
class _AsyncPlaces:
    def __init__(self, owner: AsyncGapwise): self._owner = owner
    async def list(self) -> list[CampusPlace]: return await self._owner._request("GET", "/places", key="places")
    async def get(self, place_id: str) -> CampusPlace: return await self._owner._request("GET", f"/places/{httpx.URL(place_id).raw_path.decode()}", key="place")
class _AsyncRoutes:
    def __init__(self, owner: AsyncGapwise): self._owner = owner
    async def calculate(self, *, from_building: str, to_building: str, mode: RouteMode | None = None, walking_speed_mps: float | None = None, transition_buffer_minutes: float | None = None) -> RouteResult: return await self._owner._request("POST", "/routes", json=_route_payload(from_building, to_building, mode=mode, walking_speed_mps=walking_speed_mps, transition_buffer_minutes=transition_buffer_minutes), key="route")
class _AsyncGaps:
    def __init__(self, owner: AsyncGapwise): self._owner = owner
    async def plan(self, **kwargs: Any) -> dict[str, Any]:
        payload = {"from": kwargs.pop("from_building"), "to": kwargs.pop("to_building")}
        renames = {"start_time": "startTime", "end_time": "endTime", "route_preferences": "routePreferences", "gap_preferences": "gapPreferences"}
        payload.update({renames.get(k, k): v for k, v in kwargs.items() if v is not None})
        return await self._owner._request("POST", "/gaps/plan", json=payload, key="gapPlan")
class AsyncGapwise:
    def __init__(self, *, base_url: str = DEFAULT_BASE_URL, timeout: float | httpx.Timeout = 10.0, client: httpx.AsyncClient | None = None):
        self._owns_client = client is None; self._client = client or httpx.AsyncClient(base_url=base_url.rstrip("/"), timeout=timeout, headers={"Accept": "application/json"}); self.buildings = _AsyncBuildings(self); self.places = _AsyncPlaces(self); self.routes = _AsyncRoutes(self); self.gaps = _AsyncGaps(self)
    async def _request(self, method: str, path: str, *, key: str | None = None, **kwargs: Any) -> Any:
        try: return _unwrap(await self._client.request(method, path, **kwargs), key)
        except httpx.HTTPError as exc: raise GapwiseTransportError(str(exc)) from exc
    async def info(self) -> dict[str, Any]: return await self._request("GET", "")
    async def close(self) -> None:
        if self._owns_client: await self._client.aclose()
    async def __aenter__(self) -> AsyncGapwise: return self
    async def __aexit__(self, *_: object) -> None: await self.close()
