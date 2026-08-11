# Friend-based timetable overlap: privacy summary

Gapwise lets two signed-in users become friends only after two explicit actions: one user submits
the other user's private, expiring code, and the code owner accepts the resulting request. Pending,
declined, canceled, removed, and revoked relationships cannot return overlap results. Either person
can remove the friendship at any time; once that database transaction commits, later API calls and
direct table queries return no relationship or overlap visibility.

## Data shared with a friend

For each academic term, an accepted friend may receive up to three windows where both users have a
gap between classes. Each result contains only an opaque friendship ID, a display label, weekday,
and start/end time rounded to 30-minute boundaries. The RPC allows 30 refreshes per caller per
rolling hour. For example: “Alex is also free Wednesday, 11:00 AM–1:00 PM.” It does not return the
friend's user ID.

Gapwise does **not** share either person's complete timetable, normalized meeting rows, course
codes, lecture/tutorial/practical types, sections, class times, buildings, rooms, raw gap list,
original `.ics` file, or availability outside the returned intersection. Full normalized schedules
remain readable only by their owner under Supabase Row Level Security. Friends do not receive a
table policy that permits cross-user schedule reads; a narrowly scoped database function verifies
mutual friendship and returns only the derived result.

The database keeps course code and event type as a combined event identity. A lecture and a
tutorial or practical for the same course remain different busy events and are not treated as a
shared component. An overlap is returned only for time during which both schedules are actually
free.

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
deletion through the normalized schedule, preferences, display label, invite hash, every pending,
accepted, or revoked relationship involving the user, and private overlap rate-limit state. The
deleted person disappears from every friend/request list in that same transaction, leaving no
stored shared result or relationship history for former friends.
