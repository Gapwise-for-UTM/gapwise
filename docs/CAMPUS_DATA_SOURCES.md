# Campus data sources and integration boundaries

Campus State records source URL, observation/publication time, freshness policy, and verification
state. Remote text is untrusted data and is never rendered as HTML. A source failure is
`unavailable`, not a negative fact.

## Sources used by the shipped snapshot

- **UTM Facilities building directory:** <https://www.utm.utoronto.ca/facilities/buildings>.
  Stable identity evidence, reviewed at release time. It does not justify live occupancy or indoor
  routes.
- **UTM snow and ice removal strategy:**
  <https://www.utm.utoronto.ca/facilities/utm-strategy-snow-and-ice-removal>. Named barrier-free
  entrance evidence only; without publishable coordinates it remains identity-only and cannot make
  a step-free route verified.
- **UTM maps and directions:** <https://www.utm.utoronto.ca/visitors/maps-and-directions>.
  Campus/building identity context. Gapwise does not extract coordinates from the visual map.
- **OpenStreetMap:** <https://www.openstreetmap.org/>. Build-time reviewed exterior geometry under
  ODbL; attribution is preserved in the map and data metadata. It is not fetched while routing.

Place hours and amenities are included only when an official public UTM page supports the exact
claim and the snapshot records that URL and review date. Hours are a published schedule, not a live
guarantee; holidays and temporary closures remain unknown unless an official dynamic state says
otherwise.

## Provider boundaries not represented as live facts

- **MiWay:** the provider interface is intended for the City of Mississauga's official GTFS and
  GTFS-Realtime publications. Production activation requires confirming the current official feed
  URLs, redistribution/attribution terms, update cadence and payload limits, then configuring one
  shared cached server fetch. Gapwise must not proxy an arbitrary URL or poll a feed from every
  browser. Until that review and configuration are complete, transit state is `unavailable`; no
  scheduled or live departure is fabricated.
- **UTM shuttle / GO Transit:** these can use the same normalized provider contract after a current
  supported public feed and terms are verified. A public timetable web page alone is not treated as
  a live API.
- **UTM events and CLNx:** only an official public feed/API with stable terms may be ingested. Gapwise
  will not crawl authenticated CLNx pages or ask for university credentials.
- **Campus status, elevators and construction:** public notices can be normalized when an official
  supported feed exists. Absence of a feed or a fetch failure does not mean campus is open or a
  route is accessible. A facility issue that intersects verified step-free evidence must invalidate
  that route; unknown evidence still fails closed.
- **Facilities issue reporting:** place/entity links may guide users to an official UTM reporting
  page. Gapwise does not call undocumented ServiceNow endpoints or claim to have submitted a ticket.
- **Quercus/Canvas:** Gapwise does not scrape authenticated pages, accept UTORid passwords, retain
  cookies, or claim a university-authorized API integration. A future connector requires a
  university-approved OAuth/developer key or an explicitly student-controlled read-only export/feed.
  Raw provider IDs and authentication stay behind the academic provider boundary.

Publisher infrastructure does not imply a partnership. A publisher must be explicitly approved,
limited to assigned entity/category scopes, and cannot set its own “official” verification state.
