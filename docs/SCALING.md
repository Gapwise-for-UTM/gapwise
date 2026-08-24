# Campus intelligence scaling and failure model

Gapwise keeps the student schedule and the public campus graph in different trust and scaling
domains. The original ACORN calendar is parsed in the browser and is never sent to Vercel or
Supabase. Timetable layout, PNG export, gap arithmetic, place-fit calculations and route selection
also remain local. Public campus snapshots are not copied into each user's encrypted record.

## Request boundaries

| Work                                                                          | Runtime                           | Storage/cache                                                           |
| ----------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------- |
| ICS parsing, timetable image export, deterministic gap and route calculations | Browser                           | memory and the existing opt-in browser-encrypted private store          |
| Versioned buildings, entrances, places and hours                              | Browser/CDN                       | immutable build asset; service-worker cache with a visible data version |
| Public building/place API                                                     | Vercel edge/function              | CDN `s-maxage` plus `stale-while-revalidate`; no per-user copy          |
| Transit/status provider refresh                                               | Vercel scheduled/provider adapter | one bounded shared response, never a feed copy per user                 |
| Coarse crowd reports                                                          | Supabase                          | short-lived rows, authenticated writes, aggregate-only public reads     |
| Publisher changes and audit trail                                             | Supabase                          | scoped RLS/RPC writes and append-only audit records                     |

Live adapters must return `unavailable` when the upstream cannot be reached. A cached response may
be returned as `stale` with its source observation time; failure must never become “no delay”, “no
closure”, “empty”, or “accessible”. Clients should deduplicate a request, use a bounded refresh
interval only while the relevant surface is visible, pause when `document.visibilityState` is
hidden, and apply backoff after errors. There is no background location collection.

## Cache policy

Stable snapshots receive a versioned identifier and can be cached for a release. Public API list
responses should use a short CDN freshness window and a longer stale-while-revalidate window so one
refresh serves many users. Dynamic transit/status responses need a much shorter freshness budget,
but are still refreshed once per cache key rather than by every browser. Provider payloads are size
and time bounded before normalization; raw GTFS archives are build/ingestion inputs, not browser or
user records.

The PWA must retain the last stable campus snapshot, while labeling dynamic facts stale or
unavailable. Offline timetable, gap planning and bundled routing continue to work. Crowd reporting
and live providers fail quickly without an infinite loading state.

## Pressure points and upgrade signals

Monitor Vercel function invocations, cache hit ratio, upstream error/latency, response size, Supabase
database size, row writes per minute, RPC latency, rejected report rate, and Realtime connections.
Upgrade or move ingestion to a scheduled worker when any of these are sustained:

- public dynamic-state cache hit ratio below 90% at normal traffic;
- provider refresh duration approaching the function timeout or repeated upstream throttling;
- crowd aggregate p95 above 250 ms after indexes are warm;
- database or egress above 70% of the current plan allowance;
- cleanup cannot keep expired reports bounded to the intended TTL;
- publisher audit growth materially affects operational queries.

Prefer increasing shared cache duration, conditional requests, and scheduled normalization before
adding per-user infrastructure. Realtime remains limited to short-lived community state that
benefits from it; stable campus facts and transit feeds do not need one subscription per student.
