# Friend-based timetable overlap: privacy summary

Gapwise lets two signed-in users become friends only after two explicit actions: one user submits
the other user's private, expiring code, and the code owner accepts the resulting request. Pending,
declined, canceled, removed, and revoked relationships cannot return overlap results. Either person
can remove the friendship at any time; once that database transaction commits, later API calls and
direct table queries return no relationship or overlap visibility.

## Data shared with a friend

For each academic term, an accepted friend may receive up to three windows where both users have a
candidate gap between classes. Each result contains only a weekday and start/end time rounded to
30-minute boundaries; the browser associates it with the friendship and display label it already
requested. The common-gap API accepts only an opaque friendship ID and enumerated academic term.
It offers no arbitrary time, mask, or probe query. A fixed term and fixed pair of capsule revisions
produce the same deterministic response. The API allows 30 refreshes per caller per rolling hour.
For example: “Alex is also free Wednesday, 11:00 AM–1:00 PM.” It does not return the friend's user
ID.

Gapwise does **not** share either person's complete timetable, normalized meeting rows, course
codes, lecture/tutorial/practical types, sections, class times, buildings, rooms, raw gap list,
original `.ics` file, or availability outside the returned intersection. Full normalized schedules
are encrypted in the browser in private-cloud mode and remain owner-scoped under Supabase Row Level
Security. Friends do not receive a table policy that permits cross-user private-data or capsule
reads. A narrowly scoped database function verifies mutual friendship and returns only two
encrypted lossy capsules plus the availability-key envelopes needed by the Vercel common-gap
function. It never returns either full private-data key or payload. The common-gap function decrypts
the two capsules, intersects them, and returns only the bounded result.

The capsule is derived in the browser from fixed academic and private events. It includes only
internal candidate gaps between merged busy intervals, clamped to 09:00–18:00, buffered by 15
minutes on both busy boundaries, rounded inward to 30 minutes, and discarded unless at least 60
minutes remain. It includes at most two candidates per weekday and eight per term, with no
before-first-class or after-last-class availability. It contains no course, activity, section,
event label, room, building, reason, exact busy interval, or complete free/busy grid.

Separate random AES-256-GCM keys protect full private data and friend availability. Normal server
flows cannot decrypt the private-data domain. The common-gap function holds access to the versioned
server KEK and is intentionally allowed to unwrap only availability keys for an authorized request.
This is a bounded disclosure design, not a claim that the common-gap service is zero knowledge.

## Finding and managing friends

Gapwise has no public user directory and no email/account search. Friend requests use a random
192-bit code that expires after 24 hours, is single-use, and is stored only as a cryptographic hash.
Submitting a valid, invalid, expired, used, or self-owned code produces the same generic response,
so the flow does not reveal whether an account exists. It does not send an email or consume the
Supabase Auth magic-link quota.

The social profile contains only a user-chosen display label. Gapwise never automatically uses an
Auth email address as that label. Pending relationship metadata is visible only to the two people
involved so they can accept, decline, or cancel the request. This metadata is projected as an
opaque friendship ID, status, direction, label, and update time; raw friendship rows and participant
Supabase Auth user IDs are not readable by browser clients.

## Revocation and deletion

Declining or canceling a pending request and removing an accepted friend mark the relationship
revoked. Row Level Security immediately hides the row from both former participants, and the
overlap function requires a current accepted, non-revoked row with both acceptance timestamps.
Reconnecting requires a fresh private code and fresh acceptance.

Deleting an account deletes its Supabase Auth user. Database foreign keys atomically cascade that
deletion through legacy rows retained during migration, encrypted private data, the encrypted
availability capsule, wrapped key envelopes, display label, invite hash, every pending, accepted,
or revoked relationship involving the user, and private overlap rate-limit state. The client also
removes that user's device keys, encrypted local records, remembered timetable, and decrypted state.
The deleted person disappears from every friend/request list in that same transaction, leaving no
stored shared result or relationship history for former friends.

The encrypted path remains behind a fail-safe deployment flag until the staged migration gates in
[`PRIVATE_CLOUD_MIGRATION_RUNBOOK.md`](PRIVATE_CLOUD_MIGRATION_RUNBOOK.md) are complete. While the
flag is `off`, production continues to use the legacy database overlap implementation and retains
its existing plaintext owner rows for rollback safety.
