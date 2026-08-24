"""Synchronous and asynchronous clients for the Gapwise Public Campus API."""

from __future__ import annotations

from collections.abc import Mapping
from typing import Any, Self, TypeVar, cast
from urllib.parse import quote

import httpx

from .types import (
    ApiInfo,
    AvailabilityState,
    Building,
    BuildingCategory,
    CampusPlace,
    GapPlanResult,
    Page,
    PlaceKind,
    RouteMode,
    RouteResult,
    Term,
    Weekday,
)

DEFAULT_BASE_URL = "https://api.gapwise.ca/v1"
T = TypeVar("T")


class GapwiseError(Exception):
    """Base exception for all Gapwise SDK failures."""


class GapwiseAPIError(GapwiseError):
    """A structured error returned by the Gapwise API."""

    def __init__(
        self,
        message: str,
        *,
        status_code: int,
        code: str,
        details: Any = None,
        request_id: str | None = None,
    ):
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.details = details
        self.request_id = request_id


class GapwiseTransportError(GapwiseError):
    """A timeout, connection, or other HTTP transport failure."""


class GapwiseResponseError(GapwiseError):
    """The API returned a successful response that did not match its JSON envelope."""


def _decode(response: httpx.Response) -> tuple[Any, dict[str, Any]]:
    try:
        payload = response.json()
    except ValueError as exc:
        if response.is_error:
            raise GapwiseAPIError(
                f"Gapwise API request failed with HTTP {response.status_code}.",
                status_code=response.status_code,
                code="http_error",
                request_id=response.headers.get("x-request-id"),
            ) from exc
        raise GapwiseResponseError("The Gapwise API returned invalid JSON.") from exc
    if response.is_error:
        error = payload.get("error", {}) if isinstance(payload, dict) else {}
        meta = payload.get("meta", {}) if isinstance(payload, dict) else {}
        raise GapwiseAPIError(
            error.get("message", f"Gapwise API request failed with HTTP {response.status_code}."),
            status_code=response.status_code,
            code=error.get("code", "http_error"),
            details=error.get("details"),
            request_id=meta.get("requestId") or response.headers.get("x-request-id"),
        )
    if (
        not isinstance(payload, dict)
        or "data" not in payload
        or not isinstance(payload.get("meta"), dict)
    ):
        raise GapwiseResponseError("The Gapwise API response envelope is invalid.")
    return payload["data"], payload["meta"]


def _page(response: httpx.Response) -> Page[Any]:
    data, meta = _decode(response)
    if not isinstance(data, list) or not isinstance(meta.get("pagination"), dict):
        raise GapwiseResponseError("The Gapwise API collection envelope is invalid.")
    return Page(
        items=data,
        pagination=meta["pagination"],
        data_version=meta.get("dataVersion", ""),
        request_id=meta.get("requestId", ""),
    )


def _params(**values: object) -> dict[str, object]:
    return {key: value for key, value in values.items() if value is not None}


def _route_payload(
    from_building: str,
    to_building: str,
    *,
    mode: RouteMode | None,
    walking_speed_mps: float | None,
    transition_buffer_minutes: float | None,
) -> dict[str, Any]:
    preferences = _params(
        mode=mode,
        walkingSpeedMps=walking_speed_mps,
        transitionBufferMinutes=transition_buffer_minutes,
    )
    return {
        "from": from_building,
        "to": to_building,
        **({"preferences": preferences} if preferences else {}),
    }


class _SyncBuildings:
    def __init__(self, owner: Gapwise):
        self._owner = owner

    def list(
        self,
        *,
        q: str | None = None,
        category: BuildingCategory | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> Page[Building]:
        return cast(
            Page[Building],
            _page(
                self._owner._request(
                    "GET",
                    "/buildings",
                    params=_params(q=q, category=category, limit=limit, offset=offset),
                )
            ),
        )

    def get(self, building: str) -> Building:
        return cast(
            Building,
            _decode(self._owner._request("GET", f"/buildings/{quote(building, safe='')}"))[0],
        )


class _SyncPlaces:
    def __init__(self, owner: Gapwise):
        self._owner = owner

    def list(
        self,
        *,
        q: str | None = None,
        kind: PlaceKind | None = None,
        building: str | None = None,
        open_now: AvailabilityState | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> Page[CampusPlace]:
        return cast(
            Page[CampusPlace],
            _page(
                self._owner._request(
                    "GET",
                    "/places",
                    params=_params(
                        q=q,
                        kind=kind,
                        building=building,
                        openNow=open_now,
                        limit=limit,
                        offset=offset,
                    ),
                )
            ),
        )

    def get(self, place_id: str) -> CampusPlace:
        return cast(
            CampusPlace,
            _decode(self._owner._request("GET", f"/places/{quote(place_id, safe='')}"))[0],
        )


class _SyncRoutes:
    def __init__(self, owner: Gapwise):
        self._owner = owner

    def calculate(
        self,
        *,
        from_building: str,
        to_building: str,
        mode: RouteMode | None = None,
        walking_speed_mps: float | None = None,
        transition_buffer_minutes: float | None = None,
    ) -> RouteResult:
        payload = _route_payload(
            from_building,
            to_building,
            mode=mode,
            walking_speed_mps=walking_speed_mps,
            transition_buffer_minutes=transition_buffer_minutes,
        )
        return cast(RouteResult, _decode(self._owner._request("POST", "/routes", json=payload))[0])


class _SyncGaps:
    def __init__(self, owner: Gapwise):
        self._owner = owner

    def plan(
        self,
        *,
        from_building: str,
        to_building: str,
        term: Term,
        weekday: Weekday,
        start_time: int,
        end_time: int,
        route_preferences: Mapping[str, object] | None = None,
        gap_preferences: Mapping[str, object] | None = None,
    ) -> GapPlanResult:
        payload = {
            "from": from_building,
            "to": to_building,
            "term": term,
            "weekday": weekday,
            "startTime": start_time,
            "endTime": end_time,
            **({"routePreferences": dict(route_preferences)} if route_preferences else {}),
            **({"gapPreferences": dict(gap_preferences)} if gap_preferences else {}),
        }
        return cast(
            GapPlanResult,
            _decode(self._owner._request("POST", "/gaps/plan", json=payload))[0],
        )


class Gapwise:
    """Synchronous Gapwise API client. Close it or use it as a context manager."""

    def __init__(
        self,
        *,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float | httpx.Timeout = 10.0,
        headers: Mapping[str, str] | None = None,
        client: httpx.Client | None = None,
    ):
        self._base_url = base_url.rstrip("/")
        self._owns_client = client is None
        self._client = client or httpx.Client(timeout=timeout)
        self._headers = {"Accept": "application/json", **(headers or {})}
        self.buildings, self.places, self.routes, self.gaps = (
            _SyncBuildings(self),
            _SyncPlaces(self),
            _SyncRoutes(self),
            _SyncGaps(self),
        )

    def _request(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        try:
            return self._client.request(
                method, f"{self._base_url}{path}", headers=self._headers, **kwargs
            )
        except httpx.HTTPError as exc:
            raise GapwiseTransportError(str(exc)) from exc

    def info(self) -> ApiInfo:
        return cast(ApiInfo, _decode(self._request("GET", ""))[0])

    def close(self) -> None:
        if self._owns_client:
            self._client.close()

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()


class _AsyncBuildings:
    def __init__(self, owner: AsyncGapwise):
        self._owner = owner

    async def list(
        self,
        *,
        q: str | None = None,
        category: BuildingCategory | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> Page[Building]:
        return cast(
            Page[Building],
            _page(
                await self._owner._request(
                    "GET",
                    "/buildings",
                    params=_params(q=q, category=category, limit=limit, offset=offset),
                )
            ),
        )

    async def get(self, building: str) -> Building:
        return cast(
            Building,
            _decode(await self._owner._request("GET", f"/buildings/{quote(building, safe='')}"))[0],
        )


class _AsyncPlaces:
    def __init__(self, owner: AsyncGapwise):
        self._owner = owner

    async def list(
        self,
        *,
        q: str | None = None,
        kind: PlaceKind | None = None,
        building: str | None = None,
        open_now: AvailabilityState | None = None,
        limit: int | None = None,
        offset: int | None = None,
    ) -> Page[CampusPlace]:
        return cast(
            Page[CampusPlace],
            _page(
                await self._owner._request(
                    "GET",
                    "/places",
                    params=_params(
                        q=q,
                        kind=kind,
                        building=building,
                        openNow=open_now,
                        limit=limit,
                        offset=offset,
                    ),
                )
            ),
        )

    async def get(self, place_id: str) -> CampusPlace:
        return cast(
            CampusPlace,
            _decode(await self._owner._request("GET", f"/places/{quote(place_id, safe='')}"))[0],
        )


class _AsyncRoutes:
    def __init__(self, owner: AsyncGapwise):
        self._owner = owner

    async def calculate(
        self,
        *,
        from_building: str,
        to_building: str,
        mode: RouteMode | None = None,
        walking_speed_mps: float | None = None,
        transition_buffer_minutes: float | None = None,
    ) -> RouteResult:
        payload = _route_payload(
            from_building,
            to_building,
            mode=mode,
            walking_speed_mps=walking_speed_mps,
            transition_buffer_minutes=transition_buffer_minutes,
        )
        return cast(
            RouteResult,
            _decode(await self._owner._request("POST", "/routes", json=payload))[0],
        )


class _AsyncGaps:
    def __init__(self, owner: AsyncGapwise):
        self._owner = owner

    async def plan(
        self,
        *,
        from_building: str,
        to_building: str,
        term: Term,
        weekday: Weekday,
        start_time: int,
        end_time: int,
        route_preferences: Mapping[str, object] | None = None,
        gap_preferences: Mapping[str, object] | None = None,
    ) -> GapPlanResult:
        payload = {
            "from": from_building,
            "to": to_building,
            "term": term,
            "weekday": weekday,
            "startTime": start_time,
            "endTime": end_time,
            **({"routePreferences": dict(route_preferences)} if route_preferences else {}),
            **({"gapPreferences": dict(gap_preferences)} if gap_preferences else {}),
        }
        return cast(
            GapPlanResult,
            _decode(await self._owner._request("POST", "/gaps/plan", json=payload))[0],
        )


class AsyncGapwise:
    """Asynchronous Gapwise API client. Close it or use ``async with``."""

    def __init__(
        self,
        *,
        base_url: str = DEFAULT_BASE_URL,
        timeout: float | httpx.Timeout = 10.0,
        headers: Mapping[str, str] | None = None,
        client: httpx.AsyncClient | None = None,
    ):
        self._base_url = base_url.rstrip("/")
        self._owns_client = client is None
        self._client = client or httpx.AsyncClient(timeout=timeout)
        self._headers = {"Accept": "application/json", **(headers or {})}
        self.buildings, self.places, self.routes, self.gaps = (
            _AsyncBuildings(self),
            _AsyncPlaces(self),
            _AsyncRoutes(self),
            _AsyncGaps(self),
        )

    async def _request(self, method: str, path: str, **kwargs: Any) -> httpx.Response:
        try:
            return await self._client.request(
                method, f"{self._base_url}{path}", headers=self._headers, **kwargs
            )
        except httpx.HTTPError as exc:
            raise GapwiseTransportError(str(exc)) from exc

    async def info(self) -> ApiInfo:
        return cast(ApiInfo, _decode(await self._request("GET", ""))[0])

    async def close(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def __aenter__(self) -> Self:
        return self

    async def __aexit__(self, *_: object) -> None:
        await self.close()
