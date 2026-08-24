import httpx
import pytest

from gapwise import (
    AsyncGapwise,
    Gapwise,
    GapwiseAPIError,
    GapwiseResponseError,
    GapwiseTransportError,
    Page,
)

META = {"apiVersion": "v1", "dataVersion": "test", "requestId": "req-1"}


def envelope(data, *, pagination=None):
    return {
        "data": data,
        "meta": {**META, **({"pagination": pagination} if pagination else {})},
    }


def test_sync_every_resource_and_serialization():
    seen = []

    def handler(request):
        seen.append(request)
        path = request.url.path
        data = (
            {"apiVersion": "v1"}
            if path.endswith("/v1")
            else (
                {"code": "MN"}
                if "/buildings/" in path
                else (
                    {"id": "utm-library"}
                    if "/places/" in path
                    else ({"status": "routed"} if path.endswith("/routes") else {"assessment": {}})
                )
            )
        )
        return httpx.Response(200, json=envelope(data))

    with httpx.Client(transport=httpx.MockTransport(handler)) as http:
        client = Gapwise(client=http)
        assert client.info()["apiVersion"] == "v1"
        assert client.buildings.get("MN")["code"] == "MN"
        assert client.places.get("utm-library")["id"] == "utm-library"
        assert client.routes.calculate(from_building="MN", to_building="IB")["status"] == "routed"
        plan = client.gaps.plan(
            from_building="MN",
            to_building="IB",
            term="Fall",
            weekday="Monday",
            start_time=600,
            end_time=720,
        )
        assert "assessment" in plan
    assert [request.url.path for request in seen] == [
        "/v1",
        "/v1/buildings/MN",
        "/v1/places/utm-library",
        "/v1/routes",
        "/v1/gaps/plan",
    ]
    assert seen[3].json() == {"from": "MN", "to": "IB"}
    assert seen[4].json()["startTime"] == 600


def test_sync_discovery_custom_base_headers_and_page():
    seen = []
    pagination = {"limit": 1, "offset": 2, "count": 1, "total": 4, "nextOffset": 3}

    def handler(request):
        seen.append(request)
        return httpx.Response(200, json=envelope([{"code": "IB"}], pagination=pagination))

    with httpx.Client(transport=httpx.MockTransport(handler)) as http:
        page = Gapwise(
            base_url="https://example.test/custom",
            headers={"X-Client": "test"},
            client=http,
        ).buildings.list(q="instructional", category="academic", limit=1, offset=2)
    assert isinstance(page, Page)
    assert page.items[0]["code"] == "IB"
    assert page.pagination["nextOffset"] == 3
    assert (
        str(seen[0].url)
        == "https://example.test/custom/buildings?q=instructional&category=academic&limit=1&offset=2"
    )
    assert seen[0].headers["x-client"] == "test"


def test_sync_api_response_and_transport_errors():
    with (
        httpx.Client(
            transport=httpx.MockTransport(
                lambda _: httpx.Response(
                    404,
                    json={
                        "error": {"code": "place_not_found", "message": "Missing"},
                        "meta": {"apiVersion": "v1", "requestId": "req-x"},
                    },
                )
            )
        ) as http,
        pytest.raises(GapwiseAPIError) as exc,
    ):
        Gapwise(client=http).places.get("missing")
    assert (
        exc.value.code == "place_not_found"
        and exc.value.status_code == 404
        and exc.value.request_id == "req-x"
    )
    with (
        httpx.Client(
            transport=httpx.MockTransport(lambda _: httpx.Response(200, text="broken"))
        ) as http,
        pytest.raises(GapwiseResponseError),
    ):
        Gapwise(client=http).info()

    def timeout(_):
        raise httpx.ReadTimeout("slow")

    with (
        httpx.Client(transport=httpx.MockTransport(timeout)) as http,
        pytest.raises(GapwiseTransportError),
    ):
        Gapwise(client=http).info()


def test_context_manager_closes_owned_client_only():
    client = Gapwise()
    underlying = client._client
    with client:
        pass
    assert underlying.is_closed
    injected = httpx.Client(
        transport=httpx.MockTransport(lambda _: httpx.Response(200, json=envelope({})))
    )
    with Gapwise(client=injected):
        pass
    assert not injected.is_closed
    injected.close()


@pytest.mark.asyncio
async def test_async_equivalent_resources_filters_and_context():
    seen = []
    pagination = {"limit": 10, "offset": 0, "count": 0, "total": 0, "nextOffset": None}

    async def handler(request):
        seen.append(request)
        return httpx.Response(200, json=envelope([], pagination=pagination))

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as http:
        client = AsyncGapwise(base_url="https://example.test/v1", client=http)
        assert (await client.buildings.list(q="MN", category="academic")).items == []
        assert (
            await client.places.list(kind="library", building="HM", open_now="unknown")
        ).items == []
    assert "q=MN&category=academic" in str(seen[0].url)
    assert "openNow=unknown" in str(seen[1].url)


@pytest.mark.asyncio
async def test_async_api_and_transport_errors():
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda _: httpx.Response(
                429,
                json={
                    "error": {"code": "rate_limited", "message": "Wait"},
                    "meta": {"apiVersion": "v1", "requestId": "req"},
                },
            )
        )
    ) as http:
        with pytest.raises(GapwiseAPIError):
            await AsyncGapwise(client=http).info()

    def failed(_):
        raise httpx.ConnectError("offline")

    async with httpx.AsyncClient(transport=httpx.MockTransport(failed)) as http:
        with pytest.raises(GapwiseTransportError):
            await AsyncGapwise(client=http).info()


def test_public_exports_and_typed_marker():
    import gapwise

    assert gapwise.__all__ and Page.__module__ == "gapwise.types"
