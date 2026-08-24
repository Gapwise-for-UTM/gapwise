# Gapwise developer platform

Gapwise exposes a small, source-backed public campus API for applications serving the University of Toronto Mississauga community. The canonical base URL is `https://api.gapwise.ca/v1`; the machine-readable contract is `https://api.gapwise.ca/openapi.json`. Public v1 requires **no authentication** and never reads a Gapwise user's session.

## Quickstarts

```bash
curl 'https://api.gapwise.ca/v1/buildings?q=instructional&category=academic'
curl 'https://api.gapwise.ca/v1/places?building=HM&openNow=unknown'
curl -X POST https://api.gapwise.ca/v1/routes -H 'content-type: application/json' -d '{"from":"MN","to":"IB"}'
```

JavaScript/TypeScript consumers use `@gapwise/sdk`; Python consumers use `gapwise`. These names are publication targets and are not published by this repository change. Source quickstarts and recipes live in [`../sdk/javascript`](../sdk/javascript) and [`../sdk/python`](../sdk/python).

## Resources and discovery

- `GET /v1` reports API/data versions, capabilities, authentication, and the privacy boundary.
- `GET /v1/buildings` supports deterministic `q`, `category`, `limit`, and `offset`. Search normalizes Unicode and matches code, canonical name, and aliases using a case-insensitive substring.
- `GET /v1/buildings/:building` accepts a code, exact canonical name, or recognized alias and returns one stable canonical identity.
- `GET /v1/places` supports deterministic `q`, `kind`, `building`, `openNow`, `limit`, and `offset`. Filters combine with AND semantics. Search matches names and amenities.
- `GET /v1/places/:placeId` returns a stable place and its provenance.
- `POST /v1/routes` calculates a building-level route. Inspect `status`, `accuracy`, `routeVerification`, and `warnings`; Gapwise does not claim room-to-room routing.
- `POST /v1/gaps/plan` assesses only an explicitly supplied free interval and boundary buildings. It does not accept or retrieve a timetable.

Collection responses contain `data` and `meta.pagination`. `limit` defaults to 50 and is capped at 100. `offset` is zero-based. Stable source order makes the same data version and filters deterministic. `nextOffset` is `null` on the final page. Unknown query parameters and repeated parameters fail with `invalid_query` instead of being silently ignored.

## Freshness and uncertainty

Facts retain provenance statuses: `verified`, `stale`, `inferred`, `user-reported`, `unavailable`, or `unknown`. Building accessibility may be `unknown`. Routes may be `mixed`, `inferred`, or `unavailable`. Applications must not relabel those states as verified.

Place `availability.state` is `open`, `closed`, or `unknown`. **Unknown is not closed.** Gapwise returns open/closed only when published hours and their provenance support evaluation in `America/Toronto`; otherwise it returns unknown and directs users to the official action/source. Place responses include time-dependent availability evaluation and use `Cache-Control: no-store`. Building and metadata responses remain cacheable.

`meta.dataVersion` identifies the relevant campus dataset. `meta.generatedAt` identifies snapshot generation where applicable. API v1, campus data versions, JavaScript SDK versions, and Python SDK versions evolve independently.

## Responses and errors

Canonical success responses use `{ "data": ..., "meta": ... }`. Errors use:

```json
{
  "error": { "code": "building_not_found", "message": "Campus building not found." },
  "meta": { "apiVersion": "v1", "requestId": "..." }
}
```

Error codes are stable for programmatic handling; messages are developer-readable and may improve. `X-Request-Id` matches `meta.requestId`. Method errors include `Allow`. JSON request bodies are capped at 16 KiB. CORS permits unauthenticated browser reads and JSON POSTs from any origin.

## Abuse protection and retries

Gapwise relies on Vercel's platform-level traffic and firewall protections. It deliberately does **not** claim that an in-memory serverless counter is a globally exact rate limit. Platform protection may return HTTP 429. When `Retry-After` is present, wait for that duration; otherwise use bounded exponential backoff with jitter. Do not retry validation errors.

A durable distributed application quota may be introduced if traffic justifies the operational cost. That would be documented before clients are expected to rely on numeric quota headers.

## Versioning and compatibility

API v1 permits additive resources, optional response fields, new enum values where the schema says clients must tolerate them, and new error codes. Removing a field, changing its meaning/type, or making an optional request field required is breaking and requires a new API version.

Existing `https://gapwise.ca/api/utm-*` routes retain their original flat envelopes and query/body shapes. New integrations should not use them. Migration is mechanical:

| Legacy                              | Canonical                                          |
| ----------------------------------- | -------------------------------------------------- |
| `GET /api/utm-buildings`            | `GET https://api.gapwise.ca/v1/buildings`          |
| `GET /api/utm-building?q=MN`        | `GET https://api.gapwise.ca/v1/buildings/MN`       |
| `GET /api/utm-places`               | `GET https://api.gapwise.ca/v1/places`             |
| `GET /api/utm-place?id=utm-library` | `GET https://api.gapwise.ca/v1/places/utm-library` |
| `POST /api/utm-route`               | `POST https://api.gapwise.ca/v1/routes`            |
| `POST /api/utm-gap-plan`            | `POST https://api.gapwise.ca/v1/gaps/plan`         |

Canonical v1 wraps resources in `data`, moves version/request details to `meta`, and nests errors under `error`.

## Privacy and security boundary

The public API is implemented from bundled, canonical public-campus data and deterministic campus logic. It does not expose or query student timetables, accounts, friends, authentication, credentials, private sync, AI delegation, community crowd reports, precise live location, service-role keys, or Supabase internals. Original timetable files never enter this API. Community and publisher state remain separate because their privacy, freshness, abuse, and trust requirements differ from this static unauthenticated contract.
