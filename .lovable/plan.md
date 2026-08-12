# Deliverable 1 — Mobile shell + mobile Today

Goal: on narrow viewports, Gapwise gets a compact top bar, a fixed bottom nav (Today, Timetable, Map/Route, More), and a phone-native Today screen. Desktop rendering stays byte-for-byte the same. No new business logic, no new dependencies, no schema/analytics work.

## Approach in one sentence

Extract the state machine already living inside `TodaySummary` into a shared typed builder, then render two presentations from it: the existing desktop card (unchanged output) and a new mobile Today screen inside a new mobile shell that only mounts below the breakpoint.

## Step 1 — Extract the Today state (no behaviour change)

`src/components/TodaySummary.tsx` currently computes the whole state machine inside a `useMemo` and then flattens it into strings with a `switch`. Split it:

New `src/features/today/today-state.ts`
- `export type TodayState` — a discriminated union with the existing kinds: `before`, `ended`, `dates-unavailable`, `before-first`, `in-class`, `gap`, `done`, `no-classes`.
- `buildTodayState({ meetings, selectedTerm, preferences, gapPreferences, planTransition, now }): TodayState` — the body of the existing `useMemo`, moved verbatim (same term filter, `termStatus`, occurrence helpers, current/previous/next scan, `planTransition` + `calculateLeaveBy`, synthetic `Gap` + `planGapAssessment`).
- `routeMinutes`, `routeCopy`, `formatOccurrenceDate`, `occurrenceLead`, `minutesNow` move here too and are exported, since both presentations need them.

New `src/features/today/use-today-state.ts`
- `useTodayState(args)` owns the existing `now` state plus the 60s interval, then returns `{ now, state }`.

`src/components/TodaySummary.tsx`
- Keeps its exact props and its exact JSX/copy. It calls `useTodayState`, then runs the same `switch` to derive `heading/title/detail/secondary/SecondaryIcon` and the same `canPlanGap` / `canOpenRoute` flags. Nothing about desktop output changes.

Optional but cheap safety net: add `tests/today-state.test.ts` asserting one case per kind using `tests/fixtures.ts` and a fixed `now`. This is what guarantees desktop and mobile cannot disagree.

## Step 2 — Mobile shell

New `src/components/mobile/MobileShell.tsx`
- `MobileTopBar`: logo mark + "Gapwise for UTM", then `ThemeToggle` only. Height ~3.25rem, sticky, reuses the existing `app-nav` class.
- `MobileBottomNav`: four `button`s (Today, Timetable, Map/Route, More) with lucide icons already imported in the route (`CalendarClock`, `LayoutGrid`, `MapPinned`, `Menu`), `aria-current="page"` on the active tab, min 44px touch targets, accent colour for active.
- Layout: `fixed inset-x-0 bottom-0`, `pb-[env(safe-area-inset-bottom)]`, `border-t border-border`, `bg-background/95 backdrop-blur`.
- Content wrapper gets `pb-[calc(4.5rem+env(safe-area-inset-bottom))]` so the nav never covers content, and `min-h-[100dvh]`.

New `src/components/mobile/MobileToday.tsx`
- Consumes `TodayState` (does not recompute anything) and renders, per kind:
  - `in-class`: "Now" card — course, location, "until h:mm", then a next-class row with walk minutes and `leave by`.
  - `before-first`: next course, location, "starts in Xm".
  - `gap`: recommendation title, usable minutes, next class + location + start, `leave by` (or the go-home round-trip copy when the assessment says `go-home`).
  - `done` / `no-classes` / `before` / `ended` / `dates-unavailable`: honest single-line state plus the existing next-occurrence copy. No invented content, no fake counters.
- Actions: `Plan this gap` when `kind === "gap"`, `Navigate` (day route) when kind is `gap`, `before-first`, or `in-class` — same gating as the desktop card, wired to the same `onOpenGapPlan` / `onOpenDayRoute` callbacks.
- Visuals: existing `surface`, `button-primary`, `button-secondary`, `eyebrow` utilities and existing tokens only. No new colours, no second theme.

New `src/components/mobile/MobileMoreSheet.tsx`
- A `Drawer` from `@/components/ui/drawer` (vaul is already a dependency) holding what the desktop header has no room for on mobile: `ResidenceSettings`, `AccountStatus`, `CloudSyncControls` if it is currently rendered in the route, plus Update timetable / Remove timetable and the independent-project disclaimer. These are moved by reference — same components, same props, same handlers.

## Step 3 — Wiring in `src/routes/index.tsx`

- `const isMobile = useIsMobile()` from the existing `src/hooks/use-mobile.tsx` (768px). It returns `false` on the first render, so SSR/desktop keeps rendering the current tree and mobile swaps in after hydration — acceptable and avoids a hydration mismatch.
- Add local `mobileTab` state (`"today" | "timetable" | "route" | "more"`). `timetable` and `route` reuse the existing `showView` so `openedViews` lazy-mounting of `GapPlan` / `DayRoute` is preserved; `Plan this gap` from mobile Today calls `openGapPlan` and sets the tab to `timetable`-adjacent gap view exactly as desktop does.
- Loaded-timetable branch becomes: `isMobile ? <MobileShell …>{tab content}</MobileShell> : <existing tree unchanged>`. The desktop JSX is not edited, only wrapped in a conditional.
- Landing (no timetable) state is out of scope for this deliverable; it already stacks acceptably. The mobile shell only applies once meetings exist.
- Mobile Today calls `useTodayState` (or receives the state from the route so both mobile and desktop share one instance) — one source, one interval.

## Breakpoint strategy

Single JS breakpoint via the existing `useIsMobile()` (<768px) to choose shell vs desktop tree; Tailwind `sm:`/`lg:` classes inside mobile components only for internal fine-tuning. No new breakpoint constant, no CSS media-query duplication of layout decisions.

## Regression risks and mitigations

- Today logic drift during extraction — move the `useMemo` body verbatim, add the per-kind test, and diff the desktop card's rendered strings.
- Lazy-loading regression: `DayRoute` and `GapPlan` must stay behind `openedViews`; the mobile nav routes through `showView` rather than mounting them directly.
- Bottom nav overlapping content or sticky map controls — content padding uses `env(safe-area-inset-bottom)`; the map tab gets the same padding wrapper.
- Prettier/lint noise: keep edits scoped, run `bunx prettier --write` on only the touched files.
- Hydration: no `window` reads during render outside `useIsMobile`'s effect.

## Verification (all required checks, unchanged)

`bun install --frozen-lockfile`, `bun run typecheck`, `bun run lint`, `bun test`, `bun run build`, `bun test tests/icons.test.ts`, `bunx prettier --check .` — plus a Playwright pass at 360 / 375 / 390 / 430 px checking no horizontal scroll and no content hidden behind the nav, and a 1440 px desktop screenshot compared against the current build.

## Files

Touched: `src/components/TodaySummary.tsx`, `src/routes/index.tsx`.
New: `src/features/today/today-state.ts`, `src/features/today/use-today-state.ts`, `src/components/mobile/MobileShell.tsx`, `src/components/mobile/MobileToday.tsx`, `src/components/mobile/MobileMoreSheet.tsx`, `tests/today-state.test.ts`.
New dependencies: none.
