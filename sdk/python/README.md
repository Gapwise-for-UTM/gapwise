# `gapwise`

Official typed Python client for the unauthenticated Gapwise Public Campus API v1. It supports Python 3.11+ and defaults to `https://api.gapwise.ca/v1`.

Published on PyPI as `gapwise`.

```bash
python -m pip install gapwise==0.1.0
```

```python
from gapwise import Gapwise

with Gapwise() as gapwise:
    info = gapwise.info()
    mn = gapwise.buildings.get("MN")
    buildings = gapwise.buildings.list(q="instructional", category="academic")
    places = gapwise.places.list(building="HM", kind="library")
    route = gapwise.routes.calculate(from_building="MN", to_building="IB")

    for place in places.items:
        # Unknown is not closed; keep the distinction in your UI.
        print(place["name"], place["availability"]["state"])
```

```python
from gapwise import AsyncGapwise

async with AsyncGapwise() as gapwise:
    places = await gapwise.places.list(open_now="unknown")
```

Lists return a typed immutable `Page` with `items`, `pagination`, `data_version`, and `request_id`. Configure `base_url`, `timeout`, `headers`, or inject an `httpx.Client`/`AsyncClient`. Injected clients are never closed by the SDK.

Structured API failures raise `GapwiseAPIError` with `status_code`, stable `code`, optional `details`, and `request_id`. Network failures and timeouts raise `GapwiseTransportError`; malformed successful responses raise `GapwiseResponseError`.

API v1, campus data versions, and this package version evolve independently. See [`../../docs/DEVELOPER_PLATFORM.md`](../../docs/DEVELOPER_PLATFORM.md) for filtering, uncertainty, privacy, versioning, rate-limit, and migration guidance.
