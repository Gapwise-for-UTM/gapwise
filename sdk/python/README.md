# gapwise

Official typed Python client for the public, privacy-safe Gapwise Campus API.

```python
from gapwise import Gapwise
with Gapwise() as gapwise:
    route = gapwise.routes.calculate(from_building="MN", to_building="IB")
```

```python
from gapwise import AsyncGapwise
async with AsyncGapwise() as gapwise:
    places = await gapwise.places.list()
```

Configure `base_url`, `timeout`, or inject an `httpx.Client`/`AsyncClient` for advanced use. API failures raise `GapwiseAPIError`; network failures raise `GapwiseTransportError`.
