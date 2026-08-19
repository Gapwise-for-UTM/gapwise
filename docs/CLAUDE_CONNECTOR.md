# Gapwise AI for Claude

_Last verified: 2026-08-19_

Gapwise exposes one provider-neutral remote Model Context Protocol service at:

```text
https://ai.gapwise.ca/api/mcp
```

Claude has been validated end to end against this production endpoint.

## Connect

1. In Claude, open **Settings → Connectors**.
2. Add a custom remote connector named **Gapwise**.
3. Use `https://ai.gapwise.ca/api/mcp` as the server URL.
4. Complete the Gapwise OAuth consent flow.
5. In Gapwise, open **Account → AI** and explicitly choose which private categories Claude may read or change.

OAuth sign-in does **not** automatically expose your timetable. Private schedule access is a separate Gapwise delegation decision.

## Tool surface

The production connector currently exposes 17 tools: 13 read-only tools and 4 write/delete tools.

The public/stateless campus tools are:

- `list_utm_buildings`
- `get_utm_building`
- `route_between_utm_buildings`
- `plan_utm_gap_window`

They do not require private timetable delegation and never receive a student's timetable merely because Claude uses them.

Private tools cover delegation status, day/week schedule reads, deterministic precomputed gap plans, selected preferences, decision context, availability, weekly opportunities, feasibility checking, and bounded personal-item/gap-preference writes.

Imported academic meetings are read-only. There is no academic mutation tool.

## Recommended permission posture

Start read-only. Enable only the private categories needed for the task. Keep personal-item and gap-preference writes disabled unless you specifically want Claude to propose or queue those changes.

## Example prompts

### Weekly study planning

> Inspect my Fall week and find the strongest serious-study opportunities. Use Gapwise's own availability, routing, and gap calculations. Preserve uncertainty and do not make any changes.

### Public + private composition

> Confirm my Wednesday 11:00–13:00 gap from my private schedule, then use `route_between_utm_buildings` and `plan_utm_gap_window` for the surrounding buildings. Compare that public deterministic result with `get_my_gap_plan`. Do not calculate timing yourself and do not make changes.

### Public campus lookup without timetable access

> What UTM building does MN refer to? Use Gapwise's public campus tools only.

### Feasibility before a write

> Check whether a 90-minute personal study block fits in my Wednesday gap. Do not create it unless I explicitly ask after seeing the feasibility result.

## Troubleshooting

### Claude shows an old tool inventory

Claude may retain connector metadata across server releases. If the server has been updated but Claude still shows an older tool count:

1. disconnect/remove the Gapwise connector;
2. add `https://ai.gapwise.ca/api/mcp` again;
3. complete OAuth again;
4. start a new conversation and inspect the tool list.

This was required once during the Aug 19 public-campus-tool rollout: the pre-refresh client showed 13 tools, while a clean re-add correctly discovered all 17.

### Private tool says AI access is not enabled

OAuth authentication and Gapwise AI delegation are intentionally separate. Open Gapwise **Account → AI**, enable only the categories you want to share, save, and retry.

### Route is approximate or unavailable

Do not ask Claude to override that result. Gapwise treats uncertainty as data. Step-free routing fails closed when the available graph cannot justify a supported accessible path.

## Privacy

Read the public [Privacy Notice](https://gapwise.ca/privacy.html), [Terms of Use](https://gapwise.ca/terms.html), and [Support page](https://gapwise.ca/support.html).

Never paste raw ACORN `.ics` files, OAuth tokens, encryption keys, or another person's private data into a connector support report.
