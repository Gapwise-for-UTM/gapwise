# Private-cloud free-tier capacity model

Measured and checked against official plan documentation on 2026-08-11. Quotas change; recheck
the linked provider pages before a cutover or a large enrolment campaign.

## Current free-plan limits

| Resource                           |     Current included amount | Gapwise use                                               |
| ---------------------------------- | --------------------------: | --------------------------------------------------------- |
| Supabase database size             |          500 MB per project | Ciphertext, key envelopes, Auth and relationship metadata |
| Supabase MAU                       |                      50,000 | GitHub/email authenticated users                          |
| Supabase uncached egress           | 5 GB per organization/month | Auth and PostgREST responses                              |
| Supabase Edge Function calls       |               500,000/month | Account deletion only in the new normal path              |
| Supabase API requests              |                   Unlimited | Direct owner-RLS ciphertext synchronization               |
| Vercel Fast Data Transfer          |                100 GB/month | Static application and small function responses           |
| Vercel Function invocations        |             1,000,000/month | Device bootstrap and requested common-gap calculations    |
| Vercel Function active CPU         |               4 hours/month | RSA/AES work and request validation                       |
| Vercel Function provisioned memory |          360 GB-hours/month | Two small Node functions                                  |

Official sources: [Supabase billing quotas](https://supabase.com/docs/guides/platform/billing-on-supabase),
[Supabase database size](https://supabase.com/docs/guides/platform/database-size),
[Supabase egress](https://supabase.com/docs/guides/platform/manage-your-usage/egress),
[Vercel Hobby usage](https://vercel.com/docs/plans/hobby),
[Vercel limits](https://vercel.com/docs/limits), and
[Vercel Function usage](https://vercel.com/docs/functions/usage-and-pricing).

## Measurements

- After the additive schema deployment, the production database was 11,685,011 bytes (reported as
  11 MB) on 2026-08-11.
- Production contained one 1,543-byte legacy schedule JSON value. Only counts and sizes were read.
- The committed 18-meeting demo serializes to a 5,317-byte private JSON payload and a 5,333-byte
  AES-GCM ciphertext (the 16-byte authentication tag is included).
- Its deliberately lossy capsule is 396 bytes of JSON and 412 encrypted bytes.
- A current Vercel build emits two function bundles of about 1.6 MB each on disk, far below the
  platform's compressed function-size limit. The project deliberately caps both functions at ten
  seconds.

Ciphertext is incompressible. PostgREST represents `bytea` as hexadecimal JSON, so a full
private-data/capsule verification response is conservatively budgeted at 13.5 KB including row
metadata. Routine sync performs a metadata-only preflight (no ciphertext) and one full
decrypt-and-compare verification read. This avoids downloading ciphertext twice per edit.

## Database model

The planning allocation is 16 KB per fully provisioned authenticated user:

- about 5.8 KB for the measured encrypted private payload and capsule;
- key envelopes, heap/TOAST tuples, primary/unique indexes and row metadata;
- one friend profile, aggregate rate-limit state, and four accepted friends on average (each
  friendship row is shared by two users);
- a deliberately conservative reserve for Supabase Auth rows, indexes, page slack, catalog growth,
  and payload variation.

This is a capacity allocation, not a claim that every PostgreSQL tuple is exactly 16 KB. Measure
`pg_database_size`, table/index sizes, average ciphertext length, and friendship density as usage
grows.

| Fully provisioned users | Modelled total including current 11.69 MB | Share of 500 MB | Assessment                                                         |
| ----------------------: | ----------------------------------------: | --------------: | ------------------------------------------------------------------ |
|                  17,000 |                                    283 MB |             57% | Comfortable                                                        |
|                  20,000 |                                    331 MB |             66% | Comfortable with monitoring                                        |
|                  25,000 |                                    411 MB |             82% | Viable, but approaching an operational alert boundary              |
|                  30,000 |                                    491 MB |             98% | Not comfortable on Free; normal variation can force read-only mode |

The first real scaling bottleneck is therefore database size between roughly 25,000 and 30,000
fully provisioned accounts, not the 50,000-MAU allowance. Alert at 350 MB, investigate at 400 MB,
and do not plan growth against the final few percent of a quota that can put a Free database into
read-only mode.

## Monthly request and egress model

Planning assumptions are intentionally explicit:

- eight successful background syncs per active user per month;
- 13.5 KB Supabase egress per sync after the metadata-only preflight optimization;
- 20% additional Supabase egress reserve for Auth, new-device restore, friend lists and protocol
  overhead;
- 0.2 device-bootstrap calls and four actual common-gap requests per active user per month;
- pessimistic active CPU of 200 ms per broker call and 20 ms per common-gap call;
- pessimistic 500 ms wall duration at 2 GB for every Vercel invocation.

|    MAU | Supabase egress model | Vercel invocations | Active CPU model | Memory model |
| -----: | --------------------: | -----------------: | ---------------: | -----------: |
| 17,000 |                2.2 GB |             71,400 |           0.57 h |    19.8 GB-h |
| 20,000 |                2.6 GB |             84,000 |           0.67 h |    23.3 GB-h |
| 25,000 |                3.2 GB |            105,000 |           0.83 h |    29.2 GB-h |
| 30,000 |                3.9 GB |            126,000 |           1.00 h |    35.0 GB-h |

Supabase Edge Function volume is approximately account deletions, not opens, reads, edits, or
friend calculations. No Realtime subscription or polling is part of this model.

The static application's typical compressed first-load transfer is budgeted at 0.75 MB before a
user opens the lazy map. At four cold loads per MAU, 30,000 MAU would approach 90 GB of Vercel Fast
Data Transfer. Browser/CDN caching should reduce that, but transfer becomes the second boundary to
watch at the high scenario. Web Analytics (50,000 events) and Speed Insights (10,000 points) may
reach their Hobby observability allowances earlier; exhausting those optional measurements must
not affect application correctness.

## Operational measurements

Review monthly and before changing the rollout gate:

```sql
select pg_database_size(current_database());

select
  count(*) as users,
  avg(octet_length(ciphertext)) as average_private_ciphertext,
  max(octet_length(ciphertext)) as largest_private_ciphertext
from public.encrypted_private_data;
```

Also inspect Supabase database/egress usage, Vercel transfer/invocation/CPU/memory usage, average
friends per account, and the fraction of users requiring a broker call. Never query or export
plaintext timetable values for capacity monitoring.
