import httpx
import pytest
from gapwise import AsyncGapwise, Gapwise, GapwiseAPIError

def test_sync_resources_and_canonical_path():
    seen = []
    def handler(request): seen.append(str(request.url)); return httpx.Response(200, json={"buildings": [{"code": "MN"}]})
    with httpx.Client(base_url="https://api.gapwise.ca/v1", transport=httpx.MockTransport(handler)) as http:
        client = Gapwise(client=http); assert client.buildings.list()[0]["code"] == "MN"
    assert seen == ["https://api.gapwise.ca/v1/buildings"]

def test_typed_api_error():
    transport = httpx.MockTransport(lambda _: httpx.Response(404, json={"error": {"code": "not_found", "message": "Missing"}}))
    with httpx.Client(base_url="https://example.test/v1", transport=transport) as http:
        with pytest.raises(GapwiseAPIError) as exc: Gapwise(client=http).places.get("missing")
    assert exc.value.code == "not_found" and exc.value.status_code == 404

@pytest.mark.asyncio
async def test_async_client():
    transport = httpx.MockTransport(lambda _: httpx.Response(200, json={"places": []}))
    async with httpx.AsyncClient(base_url="https://example.test/v1", transport=transport) as http:
        assert await AsyncGapwise(client=http).places.list() == []
