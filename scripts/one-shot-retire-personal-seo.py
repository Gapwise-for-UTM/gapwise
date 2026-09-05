from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text()


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content)


def replace_once(path: str, old: str, new: str) -> None:
    text = read(path)
    count = text.count(old)
    if count != 1:
        raise RuntimeError(f"{path}: expected exactly one match, found {count}: {old[:100]!r}")
    write(path, text.replace(old, new, 1))


def remove_between(path: str, start_marker: str, end_marker: str, start_at: int = 0) -> None:
    text = read(path)
    start = text.find(start_marker, start_at)
    if start < 0:
        raise RuntimeError(f"{path}: start marker not found: {start_marker!r}")
    end = text.find(end_marker, start)
    if end < 0:
        raise RuntimeError(f"{path}: end marker not found: {end_marker!r}")
    write(path, text[:start] + text[end:])


# Canonical repository migration: PR #275 intentionally left a handful of stale test/docs URLs.
TEXT_EXTENSIONS = {
    ".ts",
    ".tsx",
    ".js",
    ".mjs",
    ".cjs",
    ".json",
    ".md",
    ".txt",
    ".toml",
    ".yml",
    ".yaml",
    ".py",
    ".sql",
}
for path in ROOT.rglob("*"):
    if not path.is_file() or ".git" in path.parts or path.suffix not in TEXT_EXTENSIONS:
        continue
    try:
        text = path.read_text()
    except UnicodeDecodeError:
        continue
    updated = text.replace(
        "https://github.com/andrewmuratov/gapwise",
        "https://github.com/Gapwise-for-UTM/gapwise",
    )
    if updated != text:
        path.write_text(updated)


# ---------------------------------------------------------------------------
# Retire Personal Items from the user-facing schedule while preserving the
# legacy encrypted/sync/API data shape for backwards compatibility.
# ---------------------------------------------------------------------------

schedule_path = "src/features/schedule/use-selected-schedule-context.ts"
text = read(schedule_path)
text = text.replace('import type { PersonalItem } from "@/lib/personal-types";\n', "")
text = text.replace(
    "export function useSelectedScheduleContext(\n  meetings: Meeting[] | null,\n  personalItems: PersonalItem[],\n) {",
    "export function useSelectedScheduleContext(meetings: Meeting[] | null) {",
)
text = text.replace(
    "composeTermSchedule(meetings ?? EMPTY_MEETINGS, personalItems, term)",
    "composeTermSchedule(meetings ?? EMPTY_MEETINGS, [], term)",
)
text = text.replace("[meetings, personalItems, term]", "[meetings, term]")
if "PersonalItem" in text or "personalItems" in text:
    raise RuntimeError("selected schedule context still references personal items")
write(schedule_path, text)

write(
    "src/features/gaps/selection.ts",
    '''type GapSelectionListener = (gapId: string) => void;\n\nlet queuedGapId: string | null = null;\nconst listeners = new Set<GapSelectionListener>();\n\n/**\n * Keeps timetable-derived selection ephemeral and browser-local. The selected\n * gap never needs to be encoded into a shareable URL or sent to a service.\n */\nexport function queueGapPlanSelection(gapId: string) {\n  queuedGapId = gapId;\n  for (const listener of listeners) listener(gapId);\n}\n\nexport function peekQueuedGapPlanSelection() {\n  return queuedGapId;\n}\n\nexport function clearQueuedGapPlanSelection(gapId?: string) {\n  if (gapId === undefined || queuedGapId === gapId) queuedGapId = null;\n}\n\nexport function subscribeGapPlanSelection(listener: GapSelectionListener) {\n  listeners.add(listener);\n  return () => listeners.delete(listener);\n}\n''',
)

app_path = "src/routes/_app.tsx"
app = read(app_path)
for import_line in [
    'import PersonalItemForm from "@/components/PersonalItemForm";\n',
    'import { usePersonalItemCommands } from "@/features/personal/use-personal-item-commands";\n',
    'import { emitClickSpark } from "@/lib/micro-interactions";\n',
    'import { composeSchedule } from "@/lib/personal-scheduler";\n',
]:
    app = app.replace(import_line, "")
needle = 'import type { GapPreferences } from "@/features/gaps/types";\n'
if needle not in app:
    raise RuntimeError("_app.tsx: GapPreferences import anchor missing")
app = app.replace(
    needle,
    needle + 'import { queueGapPlanSelection } from "@/features/gaps/selection";\n',
    1,
)
app = re.sub(
    r"\n  const personalCommands = usePersonalItemCommands\(personalItems, setPersonalItems\);",
    "",
    app,
    count=1,
)
app = app.replace("useSelectedScheduleContext(meetings, personalItems)", "useSelectedScheduleContext(meetings)")
old_export = '''  const exportMeetings = useMemo(\n    () => [\n      ...composeSchedule(meetings ?? EMPTY_MEETINGS, personalItems),\n      ...terms.flatMap((availableTerm) => plannedWorkMeetings(academic, availableTerm)),\n    ],\n    [academic, meetings, personalItems, terms],\n  );'''
new_export = '''  const exportMeetings = useMemo(\n    () => [\n      ...(meetings ?? EMPTY_MEETINGS),\n      ...terms.flatMap((availableTerm) => plannedWorkMeetings(academic, availableTerm)),\n    ],\n    [academic, meetings, terms],\n  );'''
if old_export not in app:
    raise RuntimeError("_app.tsx: exportMeetings block changed unexpectedly")
app = app.replace(old_export, new_export, 1)

# Mobile exact-gap navigation and removal of personal callbacks.
app = app.replace(
    '''              onOpenGapPlan={() => {\n                openGapPlan();\n              }}''',
    '''              onOpenGapPlan={(gap) => {\n                queueGapPlanSelection(gap.id);\n                openGapPlan();\n              }}''',
    1,
)
for block in [
    '''              onAddPersonal={() => {\n                personalCommands.openCreate();\n              }}\n''',
    "              onEditPersonal={personalCommands.openEdit}\n",
    "              onDeletePersonal={personalCommands.remove}\n",
]:
    app = app.replace(block, "")

# Remove all PersonalItemForm mounts.
app, form_count = re.subn(
    r"\n\s*<PersonalItemForm\n(?:.|\n)*?\n\s*/>",
    "",
    app,
)
if form_count < 1:
    raise RuntimeError("_app.tsx: expected PersonalItemForm mounts")

# Desktop toolbar: Academic Work stays; Add personal disappears.
personal_button = re.compile(
    r'''\n\s*<button\n\s*type="button"\n\s*onClick=\{\(event\) => \{\n\s*emitClickSpark\(event\);\n\s*personalCommands\.openCreate\(\);\n\s*\}\}\n\s*className="button-primary click-spark inline-flex items-center gap-2 px-3 py-1\.5 text-xs font-semibold"\n\s*>\n\s*Add personal\n\s*</button>'''
)
app, button_count = personal_button.subn("", app, count=1)
if button_count != 1:
    raise RuntimeError(f"_app.tsx: expected one Add personal button, got {button_count}")

old_timetable_props = '''                      onRouteToMeeting={() => showView("route")}\n                      onEditPersonal={personalCommands.openEdit}\n                      onDeletePersonal={personalCommands.remove}\n                      onCreatePersonal={({ weekday, startTime, endTime }) =>\n                        personalCommands.createAt({\n                          term,\n                          weekday: weekday as import("@/lib/timetable-types").Weekday,\n                          startTime,\n                          endTime,\n                        })\n                      }\n                      onMovePersonal={(id, weekday, startTime, endTime) =>\n                        personalCommands.move(\n                          id,\n                          weekday as import("@/lib/timetable-types").Weekday,\n                          startTime,\n                          endTime,\n                        )\n                      }\n                      onResizePersonal={personalCommands.resize}\n'''
new_timetable_props = '''                      onRouteToMeeting={() => showView("route")}\n                      onOpenGap={(gap) => {\n                        queueGapPlanSelection(gap.id);\n                        openGapPlan();\n                      }}\n'''
if old_timetable_props not in app:
    raise RuntimeError("_app.tsx: personal timetable callback block changed unexpectedly")
app = app.replace(old_timetable_props, new_timetable_props, 1)

# Product footer gets a crawlable public resource cluster.
footer_anchor = '''            </p>\n          </div>\n          <p className="eyebrow self-end text-muted-foreground">Built for UTM students</p>'''
footer_replacement = '''            </p>\n            <nav\n              aria-label="Explore Gapwise"\n              className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs font-semibold"\n            >\n              <Link to="/about" className="hover:text-accent hover:underline">About</Link>\n              <Link to="/utm-timetable" className="hover:text-accent hover:underline">UTM timetable</Link>\n              <Link to="/gap-planner" className="hover:text-accent hover:underline">Gap planner</Link>\n              <Link to="/campus-map" className="hover:text-accent hover:underline">Campus map</Link>\n              <Link to="/campus-routing" className="hover:text-accent hover:underline">Campus routing</Link>\n              <Link to="/acorn-import" className="hover:text-accent hover:underline">ACORN import</Link>\n              <Link to="/developers" className="hover:text-accent hover:underline">Developers</Link>\n              <Link to="/support" className="hover:text-accent hover:underline">Support</Link>\n            </nav>\n          </div>\n          <p className="eyebrow self-end text-muted-foreground">Built for UTM students</p>'''
if footer_anchor not in app:
    raise RuntimeError("_app.tsx: footer anchor missing")
app = app.replace(footer_anchor, footer_replacement, 1)

if "personalCommands" in app or "PersonalItemForm" in app or "Add personal" in app:
    raise RuntimeError("_app.tsx still contains user-facing personal-item wiring")
write(app_path, app)

# TimetableGrid: remove personal edit/create/drag UI and make every gap a button.
grid_path = "src/components/TimetableGrid.tsx"
grid = read(grid_path)
grid = grid.replace(
    'import { detectConflicts, moveItem, resizeItem, snapToIncrement } from "@/lib/personal-scheduler";\n',
    "",
)
grid = grid.replace('import type { PersonalItem } from "@/lib/personal-types";\n', "")
grid = grid.replace("  onEdit,\n  onDelete,\n", "")
grid = grid.replace(
    "  onEdit?: ((meetingId: string) => void) | undefined;\n  onDelete?: ((meetingId: string) => void) | undefined;\n",
    "",
)
grid = grid.replace('  const isPersonal = meeting.sectionCode === "PERSONAL";\n', "")
meeting_start = grid.find("function MeetingCard")
personal_ui_start = grid.find("      {isPersonal ? (\n", meeting_start)
meeting_body_anchor = grid.find('      <div className="flex min-w-0 items-center gap-1.5">', personal_ui_start)
if personal_ui_start >= 0 and meeting_body_anchor >= 0:
    grid = grid[:personal_ui_start] + grid[meeting_body_anchor:]
else:
    raise RuntimeError("TimetableGrid: meeting personal controls not found")

grid = grid.replace("  onEditPersonal,\n  onDeletePersonal,\n", "")
grid = grid.replace(
    "  onEditPersonal: ((meetingId: string) => void) | undefined;\n  onDeletePersonal: ((meetingId: string) => void) | undefined;\n",
    "",
)
details_start = grid.find("function MeetingDetailsDialog")
personal_details_start = grid.find("          {/* Edit/Delete for personal items */}", details_start)
details_paragraph = grid.find('          <p className="text-xs leading-relaxed text-muted-foreground">', personal_details_start)
if personal_details_start >= 0 and details_paragraph >= 0:
    grid = grid[:personal_details_start] + grid[details_paragraph:]
else:
    raise RuntimeError("TimetableGrid: personal detail controls not found")

# Add exact-gap callback and remove personal mutation callbacks from component API.
grid = grid.replace(
    "  gaps,\n  onRouteToMeeting,\n",
    "  gaps,\n  onRouteToMeeting,\n  onOpenGap,\n",
    1,
)
grid = grid.replace(
    "  onEditPersonal,\n  onDeletePersonal,\n  onCreatePersonal,\n  onMovePersonal,\n  onResizePersonal,\n",
    "",
    1,
)
grid = grid.replace(
    "  onRouteToMeeting?: (meeting: Meeting) => void;\n",
    "  onRouteToMeeting?: (meeting: Meeting) => void;\n  onOpenGap?: (gap: Gap) => void;\n",
    1,
)
for prop_line in [
    "  onEditPersonal?: (meetingId: string) => void;\n",
    "  onDeletePersonal?: (meetingId: string) => void;\n",
    "  onCreatePersonal?: (payload: { weekday: string; startTime: number; endTime: number }) => void;\n",
    "  onMovePersonal?: (id: string, weekday: string, startTime: number, endTime: number) => void;\n",
    "  onResizePersonal?: (id: string, startTime: number, endTime: number) => void;\n",
]:
    grid = grid.replace(prop_line, "")

# Remove drag state.
drag_start = grid.find("  const [dragState, setDragState] = useState<null | {")
compact_anchor = grid.find("  const [compactHours, setCompactHours]", drag_start)
if drag_start < 0 or compact_anchor < 0:
    raise RuntimeError("TimetableGrid: drag state anchors missing")
grid = grid[:drag_start] + grid[compact_anchor:]

# Remove empty-column create gesture handlers.
weekday_anchor = grid.find('className={`weekday-column relative border-l border-border')
pointer_start = grid.find("                  onPointerDown={(e) => {", weekday_anchor)
hours_anchor = grid.find("                >\n                  {hours.map", pointer_start)
if pointer_start < 0 or hours_anchor < 0:
    raise RuntimeError("TimetableGrid: weekday pointer handlers missing")
grid = grid[:pointer_start] + grid[hours_anchor:]

# Replace passive gap overlay with a native accessible button.
gap_pattern = re.compile(
    r'''<div\n\s+key=\{gap\.id\}\n\s+className="gap-window pointer-events-none"\n\s+data-testid="gap-window"\n\s+aria-hidden="true"\n\s+style=\{\{ top, height \}\}\n\s*>\n(?P<body>.*?)\n\s+</div>''',
    re.S,
)
match = gap_pattern.search(grid)
if not match:
    raise RuntimeError("TimetableGrid: passive gap overlay not found")
body = match.group("body")
replacement = '''<button\n                        key={gap.id}\n                        type="button"\n                        className="gap-window"\n                        data-testid="gap-window"\n                        data-gap-interactive="true"\n                        data-gap-id={gap.id}\n                        aria-label={`${formatCompactDuration(gap.durationMinutes)} gap, ${formatTime(gap.startTime)} to ${formatTime(gap.endTime)}. Open gap plan.`}\n                        style={{ top, height }}\n                        onPointerDown={(event) => event.stopPropagation()}\n                        onClick={() => onOpenGap?.(gap)}\n                      >\n''' + body + '''\n                      </button>'''
grid = grid[: match.start()] + replacement + grid[match.end() :]

# Strip personal-only drag/move/resize handlers from each meeting wrapper.
sorted_anchor = grid.find("                  {sorted.map((meeting) => {")
grid = grid.replace('                    const isPersonal = meeting.sectionCode === "PERSONAL";\n', "", 1)
class_start = grid.find("                        className={`absolute z-10 px-1 py-0.5", sorted_anchor)
style_start = grid.find("                        style={{", class_start)
if class_start < 0 or style_start < 0:
    raise RuntimeError("TimetableGrid: draggable meeting class block missing")
grid = grid[:class_start] + '                        className="absolute z-10 px-1 py-0.5"\n' + grid[style_start:]
pointer_start = grid.find("                        onPointerDown={(e) => {", style_start)
personal_resize_anchor = grid.find("                      >\n                        {isPersonal ? (", pointer_start)
if pointer_start < 0 or personal_resize_anchor < 0:
    raise RuntimeError("TimetableGrid: meeting drag handlers missing")
grid = grid[:pointer_start] + "                      >\n" + grid[personal_resize_anchor + len("                      >\n") :]
resize_start = grid.find("                        {isPersonal ? (", pointer_start)
meeting_card_anchor = grid.find("                        <MeetingCard", resize_start)
if resize_start < 0 or meeting_card_anchor < 0:
    raise RuntimeError("TimetableGrid: resize handles missing")
grid = grid[:resize_start] + grid[meeting_card_anchor:]
# Remove personal callbacks from MeetingCard call and details dialog call.
for line in [
    "                            onEdit={onEditPersonal}\n",
    "                            onDelete={onDeletePersonal}\n",
    "        onEditPersonal={onEditPersonal}\n",
    "        onDeletePersonal={onDeletePersonal}\n",
]:
    grid = grid.replace(line, "")
if any(token in grid for token in ["onCreatePersonal", "onMovePersonal", "onResizePersonal", "detectConflicts", "dragState", "isPersonal"]):
    raise RuntimeError("TimetableGrid still contains personal drag/edit UI")
write(grid_path, grid)

# Mobile timetable: keep timetable/details, remove personal-item controls, and select exact gap.
mobile_path = "src/components/mobile/MobileTimetable.tsx"
mobile = read(mobile_path)
mobile = mobile.replace("  Plus,\n", "")
mobile = mobile.replace("  onEditPersonal,\n  onDeletePersonal,\n", "")
mobile = mobile.replace(
    "  onEditPersonal: (meetingId: string) => void;\n  onDeletePersonal: (meetingId: string) => void;\n",
    "",
)
mobile = mobile.replace('  const isPersonal = meeting?.sectionCode === "PERSONAL";\n', "")
mobile = mobile.replace("{meeting.sectionCode && !isPersonal ? (", "{meeting.sectionCode ? (")
mobile_details_start = mobile.find("function MeetingDetailsSheet")
personal_action_start = mobile.find("              {isPersonal ? (", mobile_details_start)
details_action_end = mobile.find("            </div>\n\n            <p className=\"mt-4 text-xs", personal_action_start)
if personal_action_start >= 0 and details_action_end >= 0:
    mobile = mobile[:personal_action_start] + mobile[details_action_end:]
else:
    raise RuntimeError("MobileTimetable: personal detail action block missing")

mobile = mobile.replace("  onAddPersonal,\n  onEditPersonal,\n  onDeletePersonal,\n", "")
mobile = mobile.replace("  onOpenGapPlan: () => void;\n", "  onOpenGapPlan: (gap: Gap) => void;\n")
for prop_line in [
    "  onAddPersonal: () => void;\n",
    "  onEditPersonal: (meetingId: string) => void;\n",
    "  onDeletePersonal: (meetingId: string) => void;\n",
]:
    mobile = mobile.replace(prop_line, "")

# Remove top-right Add button while retaining export action.
header_add_start = mobile.find('            <button\n              type="button"\n              onClick={onAddPersonal}')
header_add_end = mobile.find("            </button>", header_add_start)
if header_add_start >= 0 and header_add_end >= 0:
    header_add_end += len("            </button>\n")
    mobile = mobile[:header_add_start] + mobile[header_add_end:]
else:
    raise RuntimeError("MobileTimetable: header Add button missing")
mobile = mobile.replace(
    "            Pick another day or add a personal item to plan time outside your ACORN schedule.",
    "            Pick another day to review the classes in your imported ACORN schedule.",
)
empty_add_start = mobile.find('          <button\n            type="button"\n            onClick={onAddPersonal}')
empty_add_end = mobile.find("          </button>", empty_add_start)
if empty_add_start >= 0 and empty_add_end >= 0:
    empty_add_end += len("          </button>\n")
    mobile = mobile[:empty_add_start] + mobile[empty_add_end:]
else:
    raise RuntimeError("MobileTimetable: empty-state Add button missing")
mobile = mobile.replace("onClick={onOpenGapPlan}", "onClick={() => onOpenGapPlan(gap)}")
for line in [
    "        onEditPersonal={onEditPersonal}\n",
    "        onDeletePersonal={onDeletePersonal}\n",
]:
    mobile = mobile.replace(line, "")
mobile = mobile.replace("              const isPersonal = meeting.sectionCode === \"PERSONAL\";\n", "")
mobile = re.sub(
    r'''\n\s*\{isPersonal \? \(\n\s*<span className="rounded-md bg-secondary.*?</span>\n\s*\) : null\}''',
    "",
    mobile,
    count=1,
    flags=re.S,
)
if any(token in mobile for token in ["onAddPersonal", "onEditPersonal", "onDeletePersonal", "Add personal item", "isPersonal"]):
    raise RuntimeError("MobileTimetable still contains personal-item UI")
write(mobile_path, mobile)

# GapPlan consumes the ephemeral selection whether already mounted or newly mounted.
gap_plan_path = "src/components/GapPlan.tsx"
gap_plan = read(gap_plan_path)
import_anchor = 'import type { GapAction, GapPreferences, GapRecommendation } from "@/features/gaps/types";\n'
if import_anchor not in gap_plan:
    raise RuntimeError("GapPlan import anchor missing")
gap_plan = gap_plan.replace(
    import_anchor,
    import_anchor
    + 'import { clearQueuedGapPlanSelection, peekQueuedGapPlanSelection, subscribeGapPlanSelection } from "@/features/gaps/selection";\n',
    1,
)
selection_anchor = '''  useEffect(() => {\n    if (!gaps.some((gap) => gap.id === selectedGapId)) setSelectedGapId(gaps[0]?.id ?? null);\n  }, [gaps, selectedGapId]);\n'''
selection_effect = selection_anchor + '''  useEffect(() => {\n    const applySelection = (gapId: string) => {\n      const gap = gaps.find((item) => item.id === gapId);\n      if (!gap) return;\n      setSelectedGapId(gap.id);\n      setSelectedByDay((current) => ({ ...current, [gap.weekday]: gap.id }));\n      clearQueuedGapPlanSelection(gap.id);\n    };\n\n    const queued = peekQueuedGapPlanSelection();\n    if (queued) applySelection(queued);\n    return subscribeGapPlanSelection(applySelection);\n  }, [gaps]);\n'''
if selection_anchor not in gap_plan:
    raise RuntimeError("GapPlan selection anchor missing")
gap_plan = gap_plan.replace(selection_anchor, selection_effect, 1)
write(gap_plan_path, gap_plan)

# Remove actual user-facing personal-item UI modules. Legacy types/persistence/private
# payload support remain intentionally in place.
for obsolete in [
    ROOT / "src/components/PersonalItemForm.tsx",
    ROOT / "src/features/personal/use-personal-item-commands.ts",
]:
    if obsolete.exists():
        obsolete.unlink()

# Brand labels in shared public chrome.
legal_path = "src/components/LegalPage.tsx"
legal = read(legal_path).replace(
    '<span className="font-display font-semibold">Gapwise UTM</span>',
    '<span className="font-display font-semibold">Gapwise</span>',
)
write(legal_path, legal)

# Interactive gap styling; native button semantics get explicit hover/focus affordances.
styles_path = "src/styles.css"
styles = read(styles_path)
styles = re.sub(
    r'''\n\.personal-item-form input\[type="color"\],[\s\S]*?\.personal-item-form input\[type="color"\]::-webkit-color-swatch \{[\s\S]*?\n\}''',
    "",
    styles,
    count=1,
)
interactive_gap_css = '''\n\n/* Timetable gaps are first-class navigation targets, not decorative overlays. */\n.gap-window[data-gap-interactive="true"] {\n  pointer-events: auto;\n  cursor: pointer;\n  color: inherit;\n  transition:\n    border-color var(--motion-fast) var(--ease-out),\n    background-color var(--motion-fast) var(--ease-out),\n    box-shadow var(--motion-fast) var(--ease-out),\n    transform var(--motion-fast) var(--ease-out);\n}\n\n.gap-window[data-gap-interactive="true"]:hover {\n  border-color: color-mix(in oklab, var(--color-gap) 68%, var(--color-border));\n  box-shadow:\n    inset 0 1px 0 color-mix(in oklab, white 7%, transparent),\n    0 0 0 1px color-mix(in oklab, var(--color-gap) 14%, transparent),\n    var(--gap-glow);\n}\n\n.gap-window[data-gap-interactive="true"]:active {\n  transform: scale(0.995);\n}\n\n.gap-window[data-gap-interactive="true"]:focus-visible {\n  outline: 2px solid var(--color-accent);\n  outline-offset: -3px;\n  border-style: solid;\n}\n'''
if "Timetable gaps are first-class navigation targets" not in styles:
    styles += interactive_gap_css
write(styles_path, styles)

# ---------------------------------------------------------------------------
# Public feature pages: real, useful product content shared by UI and static SEO.
# ---------------------------------------------------------------------------
write(
    "src/content/public-feature-pages.ts",
    '''export type PublicFeatureSection = {\n  title: string;\n  body: string;\n  bullets?: readonly string[];\n};\n\nexport type PublicFeaturePage = {\n  path: string;\n  eyebrow: string;\n  title: string;\n  seoTitle: string;\n  description: string;\n  lead: string;\n  sections: readonly PublicFeatureSection[];\n};\n\nexport const PUBLIC_FEATURE_PAGES = {\n  about: {\n    path: "/about",\n    eyebrow: "About Gapwise",\n    title: "A campus planner built around the time between classes.",\n    seoTitle: "About Gapwise — Privacy-First Campus Planning for UTM",\n    description:\n      "Learn how Gapwise combines a UTM timetable, deterministic campus routing, gap planning, and privacy-first architecture into one student-built product.",\n    lead:\n      "Gapwise is an independent student-built campus intelligence project for the University of Toronto Mississauga. It is designed to answer a practical question a timetable alone cannot: what can you realistically do before the next class?",\n    sections: [\n      {\n        title: "One product, clear responsibilities",\n        body:\n          "The core web app owns private student state and deterministic day planning. Shared UTM campus facts live in the Gapwise data project, developer contracts live in the public API and SDKs, AI access is optional and permissioned, and service status is independently hosted.",\n        bullets: [\n          "Local-first ACORN calendar parsing",\n          "Deterministic gap and route calculations",\n          "Source-backed campus data with explicit uncertainty",\n          "Optional encrypted private sync and bounded AI delegation",\n        ],\n      },\n      {\n        title: "Privacy is an architectural constraint",\n        body:\n          "The original ACORN .ics file is parsed in the browser. Gapwise minimizes what must leave the device, keeps guest use first-class, and separates private timetable state from public campus data and optional integrations.",\n      },\n      {\n        title: "Independent and open",\n        body:\n          "Gapwise is not an official University of Toronto service and does not imply university endorsement. Development, public contracts, data provenance, documentation, and service status are visible through the Gapwise GitHub organization and public Gapwise domains.",\n      },\n    ],\n  },\n  timetable: {\n    path: "/utm-timetable",\n    eyebrow: "UTM timetable",\n    title: "Turn an ACORN export into a timetable that understands your day.",\n    seoTitle: "UTM Timetable Planner — Gapwise",\n    description:\n      "Import a University of Toronto ACORN .ics calendar into Gapwise locally and get a UTM timetable connected to gaps, buildings, and campus routes.",\n    lead:\n      "Gapwise reads the calendar file ACORN already lets you export. The original file is processed on your device, then converted into a structured weekly timetable that can power gap planning and campus-aware navigation.",\n    sections: [\n      {\n        title: "What the timetable adds",\n        body:\n          "Class times are only the start. Gapwise keeps course components, rooms, building codes, terms, weekends, and recurring dates connected so the same schedule can drive Today, Gap Plan, and Day Route views.",\n      },\n      {\n        title: "Your academic schedule stays authoritative",\n        body:\n          "Imported academic meetings are not casually editable. Updating the timetable means importing a newer ACORN export, which keeps the product aligned with the source instead of quietly mutating official class meetings.",\n      },\n      {\n        title: "Academic Work stays separate",\n        body:\n          "You can plan coursework and study blocks through Academic Work without turning the timetable into a general-purpose personal calendar. Gapwise keeps the student-planning layer focused on academic work and the gaps around class.",\n      },\n    ],\n  },\n  map: {\n    path: "/campus-map",\n    eyebrow: "Campus map",\n    title: "Explore UTM with a map that knows Gapwise buildings and routes.",\n    seoTitle: "UTM Campus Map — Gapwise",\n    description:\n      "Explore mapped University of Toronto Mississauga buildings, entrances, campus places, and routing context with Gapwise's privacy-first UTM campus map.",\n    lead:\n      "The Gapwise map is not just a background image. It connects canonical UTM building identities, source-backed geometry, routing nodes, entrances, and confidence information to the same campus model used by the planner.",\n    sections: [\n      {\n        title: "Useful without a timetable",\n        body:\n          "The campus explorer can be opened without uploading a schedule. Search or select a supported building, inspect mapped campus context, and use public routing independently of private student state.",\n      },\n      {\n        title: "No background location history",\n        body:\n          "Foreground device location is optional and only used when you ask for it. Ordinary Gapwise private sync does not store a route history or continuously track a student's movement across campus.",\n      },\n      {\n        title: "Provenance over pretending",\n        body:\n          "Campus geometry and routing confidence are documented through Gapwise Data. Unknown or inferred details are labelled rather than being presented as verified facts.",\n      },\n    ],\n  },\n  gaps: {\n    path: "/gap-planner",\n    eyebrow: "Gap planner",\n    title: "A two-hour gap is not always two hours of usable time.",\n    seoTitle: "UTM Gap Planner — Gapwise",\n    description:\n      "See usable time between UTM classes after travel, transition buffers, setup, pack-up, meals, and campus context with Gapwise's deterministic gap planner.",\n    lead:\n      "Gap Plan turns the empty space between classes into a practical time budget. It starts with the exact interval, then accounts for the movement and buffers required to arrive at the next commitment on time.",\n    sections: [\n      {\n        title: "Raw gap versus usable time",\n        body:\n          "Gapwise separates the calendar interval from the time you can safely spend. Route time, transition buffers, setup and pack-up preferences, and meal targets can all reduce the amount that is actually available.",\n      },\n      {\n        title: "Deterministic recommendations",\n        body:\n          "When a recommendation depends on arithmetic or routing, normal code performs the calculation. Suggestions such as a focus sprint, meal window, quick reset, or leave-campus candidate are derived from reproducible inputs rather than an AI guessing the clock.",\n      },\n      {\n        title: "Click a gap to inspect that exact interval",\n        body:\n          "Every highlighted gap in the timetable opens Gap Plan with that specific interval selected, so the weekly view and the detailed planner stay directly connected.",\n      },\n    ],\n  },\n  routing: {\n    path: "/campus-routing",\n    eyebrow: "Campus routing",\n    title: "Campus routes should be computed, not improvised.",\n    seoTitle: "UTM Campus Routing — Gapwise",\n    description:\n      "Plan deterministic routes between supported UTM buildings with explicit distance, travel-time, accessibility, and route-confidence information in Gapwise.",\n    lead:\n      "Gapwise treats routing as a deterministic campus problem. The routing engine uses the maintained UTM graph and reports what is verified, mixed, inferred, approximate, or unavailable instead of inventing a line when the data cannot support one.",\n    sections: [\n      {\n        title: "Confidence travels with the answer",\n        body:\n          "A route is more useful when you know how it was produced. Gapwise keeps verification and accuracy information attached to routes so downstream screens, APIs, and integrations can preserve uncertainty rather than hiding it.",\n      },\n      {\n        title: "Accessibility fails closed",\n        body:\n          "Step-free routing does not silently fall back to an unverified inaccessible path. If the maintained graph cannot support the requested accessibility constraint, Gapwise can report that the route is unavailable.",\n      },\n      {\n        title: "Shared campus facts, private schedule context",\n        body:\n          "Building and routing data can be public and reusable. The student's timetable is a separate private input. Keeping those boundaries distinct lets Gapwise offer public campus intelligence without publishing anyone's routine.",\n      },\n    ],\n  },\n  acorn: {\n    path: "/acorn-import",\n    eyebrow: "ACORN import",\n    title: "Import your U of T timetable without giving Gapwise your ACORN password.",\n    seoTitle: "Import an ACORN Timetable into Gapwise",\n    description:\n      "Learn how to export your University of Toronto ACORN timetable as an .ics calendar and import it into Gapwise with browser-local parsing.",\n    lead:\n      "Gapwise does not need your ACORN credentials. You export the calendar file yourself, choose it on your device, and Gapwise parses the original .ics locally in the browser.",\n    sections: [\n      {\n        title: "1. Export from ACORN",\n        body:\n          "Use ACORN's calendar export to download the .ics file for your current schedule. The export contains the meeting information Gapwise needs to reconstruct the weekly timetable.",\n      },\n      {\n        title: "2. Choose the file in Gapwise",\n        body:\n          "The parser runs in your browser. The original calendar source bytes are not uploaded to a Gapwise API just to build your timetable.",\n      },\n      {\n        title: "3. Review, update, or remove",\n        body:\n          "Check the imported terms and meetings. If ACORN changes, import a fresh export. You can also remove the timetable from the product; signed-in encrypted sync remains optional rather than required for ordinary use.",\n      },\n    ],\n  },\n} as const satisfies Record<string, PublicFeaturePage>;\n''',
)

write(
    "src/components/PublicFeaturePage.tsx",
    '''import { ArrowRight, ExternalLink, ShieldCheck } from "lucide-react";\nimport type { PublicFeaturePage as PublicFeaturePageData } from "@/content/public-feature-pages";\n\nconst RESOURCE_LINKS = [\n  ["/utm-timetable", "Timetable"],\n  ["/gap-planner", "Gap planner"],\n  ["/campus-map", "Campus map"],\n  ["/campus-routing", "Campus routing"],\n  ["/acorn-import", "ACORN import"],\n  ["/about", "About"],\n] as const;\n\nexport function PublicFeaturePage({ page }: { page: PublicFeaturePageData }) {\n  return (\n    <div className="min-h-screen bg-background text-foreground">\n      <header className="border-b border-border bg-background/92 backdrop-blur">\n        <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">\n          <a href="/" className="brand-lockup flex items-center gap-3" aria-label="Gapwise home">\n            <span className="brand-mark-shell">\n              <img src="/logo-mark.svg" alt="" aria-hidden="true" />\n            </span>\n            <span className="font-display text-base font-semibold tracking-tight">Gapwise</span>\n          </a>\n          <nav className="hidden items-center gap-5 text-sm text-muted-foreground md:flex" aria-label="Public product pages">\n            <a href="/about" className="hover:text-foreground">About</a>\n            <a href="/developers" className="hover:text-foreground">Developers</a>\n            <a href="https://docs.gapwise.ca" className="hover:text-foreground">Docs</a>\n          </nav>\n          <a href="/" className="button-primary inline-flex min-h-10 items-center gap-2 px-3 text-sm font-semibold">\n            Open Gapwise <ArrowRight className="h-4 w-4" aria-hidden="true" />\n          </a>\n        </div>\n      </header>\n\n      <main className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-20">\n        <section className="max-w-4xl">\n          <p className="eyebrow text-accent">{page.eyebrow}</p>\n          <h1 className="mt-4 font-display text-4xl font-semibold tracking-[-0.05em] sm:text-6xl">\n            {page.title}\n          </h1>\n          <p className="mt-6 max-w-3xl text-base leading-8 text-muted-foreground sm:text-lg">\n            {page.lead}\n          </p>\n          <div className="mt-8 flex flex-wrap gap-3">\n            <a href="/" className="button-primary inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold">\n              Try Gapwise <ArrowRight className="h-4 w-4" aria-hidden="true" />\n            </a>\n            <a href="https://docs.gapwise.ca" className="button-secondary inline-flex min-h-11 items-center gap-2 px-4 text-sm font-semibold">\n              Documentation <ExternalLink className="h-4 w-4" aria-hidden="true" />\n            </a>\n          </div>\n        </section>\n\n        <div className="mt-14 grid gap-4 lg:grid-cols-3">\n          {page.sections.map((section, index) => (\n            <article key={section.title} className="surface p-6 sm:p-7">\n              <p className="font-mono text-[0.65rem] font-semibold uppercase tracking-[0.14em] text-accent">\n                {String(index + 1).padStart(2, "0")}\n              </p>\n              <h2 className="mt-4 font-display text-xl font-semibold tracking-tight">{section.title}</h2>\n              <p className="mt-3 text-sm leading-7 text-muted-foreground">{section.body}</p>\n              {section.bullets?.length ? (\n                <ul className="mt-4 space-y-2 text-sm text-muted-foreground">\n                  {section.bullets.map((bullet) => (\n                    <li key={bullet} className="flex gap-2">\n                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" aria-hidden="true" />\n                      <span>{bullet}</span>\n                    </li>\n                  ))}\n                </ul>\n              ) : null}\n            </article>\n          ))}\n        </div>\n\n        <aside className="mt-8 surface flex gap-4 p-5 sm:p-6">\n          <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-accent" aria-hidden="true" />\n          <div>\n            <h2 className="font-display font-semibold">Independent, privacy-first, and explicit about limits</h2>\n            <p className="mt-2 text-sm leading-6 text-muted-foreground">\n              Gapwise is an independent student-built project for University of Toronto Mississauga. It is not an official University of Toronto service and is not affiliated with or endorsed by the University.\n            </p>\n          </div>\n        </aside>\n\n        <section className="mt-14 border-t border-border pt-8">\n          <p className="eyebrow text-muted-foreground">Explore Gapwise</p>\n          <nav className="mt-4 flex flex-wrap gap-2" aria-label="Related Gapwise pages">\n            {RESOURCE_LINKS.filter(([href]) => href !== page.path).map(([href, label]) => (\n              <a key={href} href={href} className="button-secondary px-3 py-2 text-sm font-semibold">\n                {label}\n              </a>\n            ))}\n          </nav>\n        </section>\n      </main>\n\n      <footer className="border-t border-border">\n        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-xs text-muted-foreground sm:px-6 md:flex-row md:items-center md:justify-between">\n          <span>Gapwise · Make the time between classes count.</span>\n          <nav className="flex flex-wrap gap-4" aria-label="Gapwise resources">\n            <a href="/privacy" className="hover:text-foreground">Privacy</a>\n            <a href="/trust" className="hover:text-foreground">Trust</a>\n            <a href="/support" className="hover:text-foreground">Support</a>\n            <a href="https://github.com/Gapwise-for-UTM" className="hover:text-foreground">GitHub</a>\n          </nav>\n        </div>\n      </footer>\n    </div>\n  );\n}\n''',
)

route_specs = {
    "about": "about",
    "utm-timetable": "timetable",
    "campus-map": "map",
    "gap-planner": "gaps",
    "campus-routing": "routing",
    "acorn-import": "acorn",
}
for route_name, key in route_specs.items():
    write(
        f"src/routes/{route_name}.tsx",
        f'''import {{ createFileRoute }} from "@tanstack/react-router";\nimport {{ PublicFeaturePage }} from "@/components/PublicFeaturePage";\nimport {{ PUBLIC_FEATURE_PAGES }} from "@/content/public-feature-pages";\n\nconst page = PUBLIC_FEATURE_PAGES.{key};\n\nexport const Route = createFileRoute("/{route_name}")({{\n  head: () => ({{\n    meta: [\n      {{ title: page.seoTitle }},\n      {{ name: "description", content: page.description }},\n    ],\n  }}),\n  component: () => <PublicFeaturePage page={{page}} />,\n}});\n''',
    )

# ---------------------------------------------------------------------------
# Canonical Gapwise entity/brand SEO.
# ---------------------------------------------------------------------------
seo_builder = r'''import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { PUBLIC_FEATURE_PAGES } from "../src/content/public-feature-pages";

const SITE_ORIGIN = "https://gapwise.ca";
const SOCIAL_IMAGE = `${SITE_ORIGIN}/og-gapwise.png`;
const GITHUB_ORGANIZATION = "https://github.com/Gapwise-for-UTM";
const GITHUB_CORE = `${GITHUB_ORGANIZATION}/gapwise`;

type SeoSection = { title: string; body: string; bullets?: readonly string[] };
type SeoPage = {
  path: string;
  title: string;
  description: string;
  heading: string;
  detail: string;
  sections?: readonly SeoSection[];
  sitemap: boolean;
};

const FEATURE_PAGES: readonly SeoPage[] = Object.values(PUBLIC_FEATURE_PAGES).map((page) => ({
  path: page.path,
  title: page.seoTitle,
  description: page.description,
  heading: page.title,
  detail: page.lead,
  sections: page.sections,
  sitemap: true,
}));

const PAGES: readonly SeoPage[] = [
  {
    path: "/",
    title: "Gapwise — UTM Timetable, Gap Planner & Campus Routes",
    description:
      "Gapwise is a privacy-first campus planner for University of Toronto Mississauga students: import your ACORN timetable locally, understand gaps, and plan campus routes.",
    heading: "Make the time between classes count.",
    detail:
      "Import an ACORN .ics timetable in your browser, understand the usable time between classes, and navigate source-backed UTM campus routes. Guest mode and a demo work without an account.",
    sections: [
      {
        title: "Your timetable, connected to campus context",
        body: "Gapwise combines class times, rooms, UTM buildings, deterministic travel time, and gap budgets so the schedule can answer more than when the next class begins.",
      },
      {
        title: "Private by architecture",
        body: "The original ACORN .ics file is parsed locally in the browser. Private sync is optional, public campus data stays separate from private student state, and foreground location is not retained as a movement history.",
      },
      {
        title: "Algorithms where correctness matters",
        body: "Gap durations, leave-by times, route selection, and other computable values use deterministic code. Optional AI interfaces are bounded to the places where interpretation is actually useful.",
      },
    ],
    sitemap: true,
  },
  ...FEATURE_PAGES,
  {
    path: "/places",
    title: "UTM Campus Places — Gapwise",
    description:
      "Explore source-backed UTM dining, study, service, library, and recreation places with explicit freshness and conservative handling of unknown hours.",
    heading: "Practical places at UTM, with source-backed details.",
    detail:
      "Gapwise keeps place identity, source provenance, and freshness explicit. Missing live hours stay unknown instead of being guessed as open or closed.",
    sitemap: true,
  },
  {
    path: "/places/davis-food-court",
    title: "Davis Food Court at UTM — Gapwise",
    description:
      "Source-backed location and practical details for Davis Food Court in the William G. Davis Building at UTM.",
    heading: "Davis Food Court at UTM",
    detail:
      "Gapwise records this dining location in the William G. Davis Building and links back to the official UTM Hospitality source for current information.",
    sitemap: true,
  },
  {
    path: "/places/utm-library",
    title: "UTM Library — Hazel McCallion Academic Learning Centre | Gapwise",
    description:
      "Source-backed location and practical details for UTM's Hazel McCallion Academic Learning Centre and library.",
    heading: "UTM Library and Hazel McCallion Academic Learning Centre",
    detail:
      "Gapwise records the library as a source-backed campus place for individual study, group study, and library services, while leaving unbundled current hours unknown.",
    sitemap: true,
  },
  {
    path: "/places/rawc",
    title: "UTM RAWC — Recreation, Athletics & Wellness | Gapwise",
    description:
      "Source-backed location and practical details for UTM's Recreation, Athletics and Wellness Centre (RAWC).",
    heading: "UTM Recreation, Athletics and Wellness Centre",
    detail:
      "Gapwise records RAWC as a source-backed recreation and fitness destination and links to the official UTM athletics source for current information.",
    sitemap: true,
  },
  {
    path: "/developers",
    title: "Gapwise API & SDKs — Developers",
    description:
      "Build with the Gapwise public UTM building, place, routing, and deterministic gap-planning API, OpenAPI contract, and official SDKs.",
    heading: "Deterministic UTM campus intelligence for developers.",
    detail:
      "Gapwise publishes a bounded public API for UTM buildings, places, routing, and gap planning, with OpenAPI plus JavaScript/TypeScript and Python SDK documentation.",
    sitemap: true,
  },
  {
    path: "/ai",
    title: "Gapwise AI — Connect Gapwise to AI Assistants",
    description:
      "Connect explicitly delegated Gapwise timetable context and deterministic UTM campus intelligence to compatible AI assistants through Gapwise's secure remote MCP service.",
    heading: "Your Gapwise context, with an assistant you choose.",
    detail:
      "Gapwise AI exposes public campus intelligence plus narrowly delegated timetable, availability, gap-planning, and compatibility-scoped planning capabilities. Academic meetings remain read-only and AI access can be revoked.",
    sitemap: true,
  },
  {
    path: "/support",
    title: "Support — Gapwise",
    description:
      "Support for Gapwise accounts, timetables, AI connectors, privacy, security, revocation, and troubleshooting.",
    heading: "Help with Gapwise.",
    detail:
      "Find first-party guidance for connector authorization, missing schedule context, rejected writes, revocation, privacy, security reporting, and service status.",
    sitemap: true,
  },
  {
    path: "/trust",
    title: "Trust Center — Gapwise",
    description:
      "Evidence-backed privacy, security, accessibility, data-flow, AI permission, incident-response, and independence information for Gapwise.",
    heading: "Gapwise Trust Center",
    detail:
      "Review implementation-backed privacy and security boundaries, accessibility evidence, incident processes, subprocessors, AI permissions, and open items that still require human or provider confirmation.",
    sitemap: true,
  },
  {
    path: "/privacy",
    title: "Privacy — Gapwise",
    description:
      "How Gapwise handles timetable, account, planning, AI, analytics, and foreground location data, including browser-local ACORN parsing.",
    heading: "Privacy at Gapwise",
    detail:
      "The original ACORN .ics file is parsed in the browser. Guest mode is first-class, private cloud sync is optional, and precise live location is foreground-only when requested.",
    sitemap: true,
  },
  {
    path: "/security",
    title: "Vulnerability Disclosure — Gapwise",
    description:
      "How to report a suspected Gapwise security vulnerability privately and safely, including the preferred private reporting path.",
    heading: "Report a Gapwise security issue privately.",
    detail:
      "Gapwise publishes a vulnerability disclosure policy and canonical security.txt. Do not place exploit details, credentials, tokens, or private student data in public issues.",
    sitemap: true,
  },
  {
    path: "/accessibility",
    title: "Accessibility — Gapwise",
    description:
      "Gapwise's accessibility target, current automated and keyboard-test evidence, known limitations, and feedback path.",
    heading: "Accessibility is an ongoing Gapwise practice.",
    detail:
      "Gapwise uses WCAG 2.2 Level AA as a product and review target while clearly separating current automated evidence from manual or independent assessment that has not occurred.",
    sitemap: true,
  },
  {
    path: "/terms",
    title: "Terms — Gapwise",
    description:
      "Terms and important notices for the independent Gapwise student timetable, gap-planning, and campus-routing application for UTM.",
    heading: "Gapwise terms and notices",
    detail:
      "Gapwise is an independent student project. Review the current product terms and notices without implying University of Toronto approval or endorsement.",
    sitemap: false,
  },
];

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function canonicalUrl(path: string) {
  return new URL(path, `${SITE_ORIGIN}/`).href;
}

function outputPath(path: string) {
  if (path === "/") return "index.html";
  return `_seo/${path.slice(1).replaceAll("/", "--")}.html`;
}

function homepageStructuredData(page: SeoPage) {
  const organizationId = `${SITE_ORIGIN}/#organization`;
  const websiteId = `${SITE_ORIGIN}/#website`;
  const appId = `${SITE_ORIGIN}/#app`;
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": organizationId,
        name: "Gapwise",
        alternateName: ["Gapwise UTM", "Gapwise for UTM"],
        url: `${SITE_ORIGIN}/`,
        description:
          "Privacy-first campus intelligence and day planning for University of Toronto Mississauga students.",
        logo: {
          "@type": "ImageObject",
          url: `${SITE_ORIGIN}/icon-512.png`,
          width: 512,
          height: 512,
        },
        founder: {
          "@type": "Person",
          name: "Andrew Muratov",
          url: "https://github.com/andrewmuratov",
        },
        email: "support@gapwise.ca",
        sameAs: [GITHUB_ORGANIZATION],
      },
      {
        "@type": "WebSite",
        "@id": websiteId,
        name: "Gapwise",
        alternateName: ["Gapwise UTM", "Gapwise for UTM"],
        url: `${SITE_ORIGIN}/`,
        description: page.description,
        inLanguage: "en-CA",
        publisher: { "@id": organizationId },
      },
      {
        "@type": "WebApplication",
        "@id": appId,
        name: "Gapwise",
        alternateName: ["Gapwise UTM", "Gapwise for UTM"],
        url: `${SITE_ORIGIN}/`,
        description: page.description,
        applicationCategory: "EducationalApplication",
        operatingSystem: "Any",
        isAccessibleForFree: true,
        inLanguage: "en-CA",
        creator: { "@id": organizationId },
        publisher: { "@id": organizationId },
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "CAD",
        },
        audience: {
          "@type": "Audience",
          audienceType: "University of Toronto Mississauga students",
        },
        featureList: [
          "Browser-local ACORN timetable import",
          "UTM timetable and deterministic gap planning",
          "UTM campus map and routing",
          "Optional encrypted private sync",
        ],
        sameAs: [GITHUB_CORE],
      },
    ],
  };
}

function metadata(page: SeoPage) {
  const canonical = canonicalUrl(page.path);
  const title = escapeHtml(page.title);
  const description = escapeHtml(page.description);
  const schema =
    page.path === "/"
      ? `\n    <script type="application/ld+json">${JSON.stringify(homepageStructuredData(page)).replaceAll("<", "\\u003c")}</script>`
      : "";

  return `
    <title>${title}</title>
    <meta name="description" content="${description}" />
    <meta name="application-name" content="Gapwise" />
    <meta name="robots" content="index, follow, max-image-preview:large" />
    <link rel="canonical" href="${canonical}" />
    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="Gapwise" />
    <meta property="og:locale" content="en_CA" />
    <meta property="og:title" content="${title}" />
    <meta property="og:description" content="${description}" />
    <meta property="og:url" content="${canonical}" />
    <meta property="og:image" content="${SOCIAL_IMAGE}" />
    <meta property="og:image:width" content="1200" />
    <meta property="og:image:height" content="630" />
    <meta property="og:image:alt" content="Gapwise — make the time between classes count" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${title}" />
    <meta name="twitter:description" content="${description}" />
    <meta name="twitter:image" content="${SOCIAL_IMAGE}" />${schema}`;
}

function fallback(page: SeoPage) {
  const links = [
    ["/", "Gapwise home"],
    ["/about", "About Gapwise"],
    ["/utm-timetable", "UTM timetable"],
    ["/gap-planner", "Gap planner"],
    ["/campus-map", "Campus map"],
    ["/campus-routing", "Campus routing"],
    ["/acorn-import", "ACORN import"],
    ["/places", "UTM campus places"],
    ["/developers", "Developer API and SDKs"],
    ["/ai", "Gapwise AI"],
    ["/support", "Support"],
    ["/trust", "Trust Center"],
    ["/privacy", "Privacy"],
    ["/accessibility", "Accessibility"],
  ] as const;
  const navigation = links
    .map(([href, label]) => `<a href="${href}">${escapeHtml(label)}</a>`)
    .join(" · ");
  const sections = (page.sections ?? [])
    .map(
      (section) => `<section><h2>${escapeHtml(section.title)}</h2><p>${escapeHtml(section.body)}</p>${
        section.bullets?.length
          ? `<ul>${section.bullets.map((bullet) => `<li>${escapeHtml(bullet)}</li>`).join("")}</ul>`
          : ""
      }</section>`,
    )
    .join("\n");

  return `<main data-gapwise-search-fallback style="max-width:60rem;margin:0 auto;padding:3rem 1.25rem;font-family:system-ui,sans-serif;line-height:1.65">
      <p><strong>Gapwise</strong> · University of Toronto Mississauga</p>
      <h1>${escapeHtml(page.heading)}</h1>
      <p>${escapeHtml(page.description)}</p>
      <p>${escapeHtml(page.detail)}</p>
      ${sections}
      <p>Gapwise is an independent student project for University of Toronto Mississauga. It is not an official University of Toronto service and does not claim university approval, sponsorship, or endorsement.</p>
      <nav aria-label="Gapwise public pages">${navigation}</nav>
    </main>`;
}

function renderDocument(baseHtml: string, page: SeoPage) {
  if (!baseHtml.includes("</head>")) throw new Error("Built index is missing </head>.");
  if (!/<div id="root"><\/div>/.test(baseHtml))
    throw new Error("Built index is missing the empty #root mount point.");

  return baseHtml
    .replace("</head>", `${metadata(page)}\n  </head>`)
    .replace(/<div id="root"><\/div>/, `<div id="root">${fallback(page)}</div>`);
}

function renderSitemap() {
  const urls = PAGES.filter((page) => page.sitemap)
    .map((page) => `  <url><loc>${canonicalUrl(page.path)}</loc></url>`)
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

const distIndexPath = join("dist", "index.html");
const baseHtml = await readFile(distIndexPath, "utf8");

for (const page of PAGES) {
  const destination = join("dist", outputPath(page.path));
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, renderDocument(baseHtml, page));
}

const expectedSitemap = renderSitemap();
const committedSitemap = await readFile(join("public", "sitemap.xml"), "utf8");
if (committedSitemap !== expectedSitemap) {
  throw new Error("public/sitemap.xml is out of sync with the production SEO page inventory.");
}
await writeFile(join("dist", "sitemap.xml"), expectedSitemap);

console.log(
  `Generated ${PAGES.length} crawlable Gapwise HTML entry points and ${PAGES.filter((page) => page.sitemap).length} sitemap URLs.`,
);
'''
write("scripts/build-seo-pages.ts", seo_builder)

write(
    "scripts/check-seo-output.ts",
    '''import { readFile } from "node:fs/promises";\n\nfunction requireText(haystack: string, needle: string, label: string) {\n  if (!haystack.includes(needle)) throw new Error(`${label} is missing ${needle}`);\n}\n\nconst [home, sitemap, robots] = await Promise.all([\n  readFile("dist/index.html", "utf8"),\n  readFile("dist/sitemap.xml", "utf8"),\n  readFile("dist/robots.txt", "utf8"),\n]);\n\nfor (const needle of [\n  '<meta property="og:site_name" content="Gapwise"',\n  '<meta property="og:image:width" content="1200"',\n  '<meta property="og:image:height" content="630"',\n  '<meta name="twitter:card" content="summary_large_image"',\n  '"@type":"WebSite"',\n  '"@type":"Organization"',\n  '"name":"Gapwise"',\n  '"alternateName":["Gapwise UTM","Gapwise for UTM"]',\n  'https://github.com/Gapwise-for-UTM',\n]) requireText(home, needle, "homepage metadata");\n\nfor (const path of [\n  "/about",\n  "/utm-timetable",\n  "/campus-map",\n  "/gap-planner",\n  "/campus-routing",\n  "/acorn-import",\n]) {\n  requireText(sitemap, `<loc>https://gapwise.ca${path}</loc>`, "sitemap");\n}\n\nfor (const privatePath of ["/today", "/timetable", "/gaps", "/oauth/"]) {\n  if (sitemap.includes(`<loc>https://gapwise.ca${privatePath}`)) {\n    throw new Error(`private/stateful path leaked into sitemap: ${privatePath}`);\n  }\n}\nrequireText(robots, "Disallow: /_seo/", "robots.txt");\nrequireText(robots, "Disallow: /api/", "robots.txt");\nrequireText(robots, "Disallow: /oauth/", "robots.txt");\nrequireText(robots, "Sitemap: https://gapwise.ca/sitemap.xml", "robots.txt");\n\nconsole.log("Generated SEO output verified.");\n''',
)

# Update build to verify generated output every time.
package_path = ROOT / "package.json"
package = json.loads(package_path.read_text())
package["scripts"]["build"] = (
    "vite build && bun scripts/build-seo-pages.ts && bun scripts/check-seo-output.ts && bun scripts/check-bundle-budget.ts"
)
package_path.write_text(json.dumps(package, indent=2) + "\n")

# Canonical brand in web manifest.
manifest_path = ROOT / "public/site.webmanifest"
manifest = json.loads(manifest_path.read_text())
manifest["name"] = "Gapwise"
manifest["description"] = (
    "Privacy-first timetable, gap planning, and campus routing for University of Toronto Mississauga students."
)
manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")

# Larger Google-friendly favicon reference. Binary file is generated by the workflow.
index_path = "index.html"
index = read(index_path)
favicon_anchor = '    <link rel="icon" href="/logo-mark.svg" type="image/svg+xml" />\n'
if favicon_anchor not in index:
    raise RuntimeError("index.html: favicon anchor missing")
index = index.replace(
    favicon_anchor,
    favicon_anchor
    + '    <link rel="icon" href="/favicon-192x192.png" sizes="192x192" type="image/png" />\n',
    1,
)
write(index_path, index)

# Vercel: public static rewrites and noindex boundaries stay explicit.
vercel_path = ROOT / "vercel.json"
vercel = json.loads(vercel_path.read_text())
for header in vercel["headers"]:
    if header["source"].startswith("/(favicon.svg|"):
        header["source"] = header["source"].replace(
            "favicon-32x32.png|",
            "favicon-32x32.png|favicon-192x192.png|og-gapwise.png|",
        )
feature_rewrites = [
    {"source": path, "destination": f"/_seo/{path[1:]}.html"}
    for path in [
        "/about",
        "/utm-timetable",
        "/campus-map",
        "/gap-planner",
        "/campus-routing",
        "/acorn-import",
    ]
]
existing_sources = {entry["source"] for entry in vercel["rewrites"]}
insert_at = 0
for rewrite in feature_rewrites:
    if rewrite["source"] not in existing_sources:
        vercel["rewrites"].insert(insert_at, rewrite)
        insert_at += 1
vercel_path.write_text(json.dumps(vercel, indent=2) + "\n")

# Sitemap is a checked-in build contract.
sitemap_paths = [
    "/",
    "/about",
    "/utm-timetable",
    "/campus-map",
    "/gap-planner",
    "/campus-routing",
    "/acorn-import",
    "/places",
    "/places/davis-food-court",
    "/places/utm-library",
    "/places/rawc",
    "/developers",
    "/ai",
    "/support",
    "/trust",
    "/privacy",
    "/security",
    "/accessibility",
]
def canonical(path: str) -> str:
    return "https://gapwise.ca/" if path == "/" else f"https://gapwise.ca{path}"
sitemap = '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
sitemap += "\n".join(f"  <url><loc>{canonical(path)}</loc></url>" for path in sitemap_paths)
sitemap += "\n</urlset>\n"
write("public/sitemap.xml", sitemap)

# Unit tests lock brand entity metadata, indexing boundaries, icon inventory and
# the Personal Items retirement/legacy compatibility boundary.
write(
    "tests/seo.test.ts",
    '''import { describe, expect, test } from "bun:test";\nimport { readFile } from "node:fs/promises";\nimport { listCampusPlaces } from "../src/features/campus-state/snapshot";\n\nconst SITE_ORIGIN = "https://gapwise.ca";\nconst FEATURE_PATHS = [\n  "/about",\n  "/utm-timetable",\n  "/campus-map",\n  "/gap-planner",\n  "/campus-routing",\n  "/acorn-import",\n] as const;\n\nfunction sitemapLocations(xml: string) {\n  return [...xml.matchAll(/<loc>([^<]+)<\\/loc>/g)].map((match) => match[1]);\n}\n\nfunction pngDimensions(bytes: Buffer) {\n  expect(bytes.subarray(1, 4).toString()).toBe("PNG");\n  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };\n}\n\ndescribe("Gapwise searchability and entity metadata", () => {\n  test("publishes a focused sitemap with substantive public feature and place pages", async () => {\n    const sitemap = await readFile("public/sitemap.xml", "utf8");\n    const locations = sitemapLocations(sitemap);\n    const expected = [\n      `${SITE_ORIGIN}/`,\n      ...FEATURE_PATHS.map((path) => `${SITE_ORIGIN}${path}`),\n      `${SITE_ORIGIN}/places`,\n      ...listCampusPlaces().map((place) => `${SITE_ORIGIN}/places/${place.id}`),\n      `${SITE_ORIGIN}/developers`,\n      `${SITE_ORIGIN}/ai`,\n      `${SITE_ORIGIN}/support`,\n      `${SITE_ORIGIN}/trust`,\n      `${SITE_ORIGIN}/privacy`,\n      `${SITE_ORIGIN}/security`,\n      `${SITE_ORIGIN}/accessibility`,\n    ];\n\n    expect(locations).toEqual(expected);\n    for (const privatePath of ["/today", "/timetable", "/gaps", "/route", "/oauth/consent"]) {\n      expect(locations).not.toContain(`${SITE_ORIGIN}${privatePath}`);\n    }\n  });\n\n  test("robots points at the canonical sitemap and keeps internal surfaces out of crawl", async () => {\n    const robots = await readFile("public/robots.txt", "utf8");\n    const directives = robots.split("\\n").filter(Boolean);\n    expect(directives).toContain("User-agent: *");\n    expect(directives).toContain("Allow: /");\n    expect(directives).toContain("Disallow: /_seo/");\n    expect(directives).toContain("Disallow: /api/");\n    expect(directives).toContain("Disallow: /v1");\n    expect(directives).toContain("Disallow: /oauth/");\n    expect(directives).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`);\n  });\n\n  test("build contract makes Gapwise the canonical brand and publishes Website + Organization schema", async () => {\n    const [packageJson, builder] = await Promise.all([\n      readFile("package.json", "utf8").then((value) => JSON.parse(value)),\n      readFile("scripts/build-seo-pages.ts", "utf8"),\n    ]);\n\n    expect(packageJson.scripts.build).toContain("bun scripts/check-seo-output.ts");\n    expect(builder).toContain('title: "Gapwise — UTM Timetable, Gap Planner & Campus Routes"');\n    expect(builder).toContain('name="application-name" content="Gapwise"');\n    expect(builder).toContain('property="og:site_name" content="Gapwise"');\n    expect(builder).toContain('name="twitter:card" content="summary_large_image"');\n    expect(builder).toContain('property="og:image:width" content="1200"');\n    expect(builder).toContain('property="og:image:height" content="630"');\n    expect(builder).toContain('"@type": "WebSite"');\n    expect(builder).toContain('"@type": "Organization"');\n    expect(builder).toContain('name: "Gapwise"');\n    expect(builder).toContain('alternateName: ["Gapwise UTM", "Gapwise for UTM"]');\n    expect(builder).toContain("https://github.com/Gapwise-for-UTM");\n    expect(builder).toContain("data-gapwise-search-fallback");\n  });\n\n  test("publishes a large favicon and a true 1200x630 social image", async () => {\n    const [index, favicon, social] = await Promise.all([\n      readFile("index.html", "utf8"),\n      readFile("public/favicon-192x192.png"),\n      readFile("public/og-gapwise.png"),\n    ]);\n    expect(index).toContain('href="/favicon-192x192.png" sizes="192x192"');\n    expect(pngDimensions(favicon)).toEqual({ width: 192, height: 192 });\n    expect(pngDimensions(social)).toEqual({ width: 1200, height: 630 });\n  });\n\n  test("Vercel serves generated public HTML while preserving noindex app-state boundaries", async () => {\n    const config = JSON.parse(await readFile("vercel.json", "utf8")) as {\n      trailingSlash?: boolean;\n      headers: Array<{ source: string; headers: Array<{ key: string; value: string }> }>;\n      rewrites: Array<{ source: string; destination: string }>;\n    };\n    const rewrite = new Map(config.rewrites.map((entry) => [entry.source, entry.destination]));\n\n    expect(config.trailingSlash).toBe(false);\n    for (const path of FEATURE_PATHS) {\n      expect(rewrite.get(path)).toBe(`/_seo/${path.slice(1)}.html`);\n    }\n    expect(rewrite.get("/places")).toBe("/_seo/places.html");\n    for (const place of listCampusPlaces()) {\n      expect(rewrite.get(`/places/${place.id}`)).toBe(`/_seo/places--${place.id}.html`);\n    }\n\n    const noindexSources = config.headers\n      .filter((entry) =>\n        entry.headers.some(\n          (header) => header.key === "X-Robots-Tag" && header.value === "noindex, nofollow",\n        ),\n      )\n      .map((entry) => entry.source);\n    for (const path of [\n      "/today",\n      "/timetable",\n      "/gaps",\n      "/route/(.*)",\n      "/oauth/(.*)",\n      "/api/(.*)",\n      "/v1",\n      "/v1/(.*)",\n      "/_seo/(.*)",\n    ]) expect(noindexSources).toContain(path);\n  });\n});\n''',
)

write(
    "tests/personal-items-retired.test.ts",
    '''import { describe, expect, test } from "bun:test";\nimport { existsSync } from "node:fs";\nimport { readFile } from "node:fs/promises";\n\ndescribe("retired Personal Items surface", () => {\n  test("current timetable and gap calculations ignore legacy personal items", async () => {\n    const [app, context] = await Promise.all([\n      readFile("src/routes/_app.tsx", "utf8"),\n      readFile("src/features/schedule/use-selected-schedule-context.ts", "utf8"),\n    ]);\n    expect(app).not.toContain("Add personal");\n    expect(app).not.toContain("PersonalItemForm");\n    expect(app).not.toContain("onCreatePersonal=");\n    expect(context).toContain("composeTermSchedule(meetings ?? EMPTY_MEETINGS, [], term)");\n    expect(context).not.toContain("PersonalItem");\n  });\n\n  test("personal-item form/commands are gone but encrypted compatibility storage remains", async () => {\n    expect(existsSync("src/components/PersonalItemForm.tsx")).toBe(false);\n    expect(existsSync("src/features/personal/use-personal-item-commands.ts")).toBe(false);\n    expect(existsSync("src/lib/personal-types.ts")).toBe(true);\n    const [app, privateData] = await Promise.all([\n      readFile("src/routes/_app.tsx", "utf8"),\n      readFile("src/features/security/private-data.ts", "utf8"),\n    ]);\n    expect(app).toContain("personalItems={personalItems}");\n    expect(privateData).toContain("personalItems");\n  });\n\n  test("desktop and mobile gaps are actionable and exact-selection aware", async () => {\n    const [grid, mobile, gapPlan] = await Promise.all([\n      readFile("src/components/TimetableGrid.tsx", "utf8"),\n      readFile("src/components/mobile/MobileTimetable.tsx", "utf8"),\n      readFile("src/components/GapPlan.tsx", "utf8"),\n    ]);\n    expect(grid).toContain('data-gap-interactive="true"');\n    expect(grid).toContain("onOpenGap?.(gap)");\n    expect(grid).toContain("Open gap plan.");\n    expect(grid).not.toContain("onCreatePersonal");\n    expect(grid).not.toContain("onResizePersonal");\n    expect(mobile).toContain("onOpenGapPlan(gap)");\n    expect(mobile).not.toContain("Add personal item");\n    expect(gapPlan).toContain("peekQueuedGapPlanSelection");\n    expect(gapPlan).toContain("subscribeGapPlanSelection");\n  });\n});\n''',
)

# E2E org-migration assertion missed in PR #275 is handled by broad URL migration.
# Add a browser journey for exact gap selection on both responsive timetable variants.
write(
    "e2e/clickable-gaps.e2e.ts",
    '''import { expect, test } from "@playwright/test";\nimport { isMobileProject, watchForAppFailures } from "./helpers";\n\ntest("a timetable gap opens Gap Plan with that exact interval selected", async ({ page }, testInfo) => {\n  const guard = watchForAppFailures(page, String(testInfo.project.use.baseURL));\n  const mobile = isMobileProject(testInfo.project.name);\n\n  await page.goto("/");\n  await page.getByRole("button", { name: "Try a demo" }).click();\n\n  if (mobile) {\n    const nav = page.getByRole("navigation", { name: "Main" });\n    await nav.getByRole("button", { name: "Timetable" }).click();\n    const gap = page.getByRole("button", { name: /gap.*View gap plan/i }).first();\n    const label = await gap.getAttribute("aria-label");\n    const duration = (label ?? "").match(/^(.*?) gap/)?.[1];\n    await gap.click();\n    await expect(page).toHaveURL(/\\/gaps$/);\n    if (duration) {\n      await expect(page.locator(".gap-card[data-selected='true']").getByText(duration).first()).toBeVisible();\n    }\n  } else {\n    const gap = page.locator("[data-gap-interactive='true']").first();\n    const gapId = await gap.getAttribute("data-gap-id");\n    const label = await gap.getAttribute("aria-label");\n    const duration = (label ?? "").match(/^(.*?) gap/)?.[1];\n    expect(gapId).toBeTruthy();\n    await gap.click();\n    await expect(page).toHaveURL(/\\/gaps$/);\n    if (duration) {\n      await expect(page.locator(".gap-card[data-selected='true']").getByText(duration).first()).toBeVisible();\n    }\n  }\n\n  guard.assertClean();\n});\n''',
)

# README + docs state the compatibility boundary instead of implying the retired
# UI is still a general-purpose calendar feature.
readme_path = ROOT / "README.md"
readme = readme_path.read_text()
compat_note = '''\n### Personal-item compatibility\n\nThe current Gapwise web timetable no longer exposes Personal Items as a user-facing calendar feature. Academic Work remains the supported planning surface outside imported ACORN meetings. Legacy personal-item records are still accepted by the encrypted private-data format and preserved during restore/sync so existing users and compatible MCP/API clients are not broken by this UI retirement. Legacy items are not included in the current timetable or gap calculations.\n'''
if "### Personal-item compatibility" not in readme:
    anchor = "## Privacy"
    if anchor in readme:
        readme = readme.replace(anchor, compat_note + "\n" + anchor, 1)
    else:
        readme += compat_note
readme_path.write_text(readme)

cloudflare_path = ROOT / "docs/CLOUDFLARE_PAGES.md"
if cloudflare_path.exists():
    cloudflare = cloudflare_path.read_text().replace(
        "- local timetable and personal-item use;",
        "- local timetable use and backwards-compatible preservation of legacy personal-item payloads;",
    )
    cloudflare_path.write_text(cloudflare)

inventory_path = ROOT / "docs/TRUST_DATA_INVENTORY.md"
if inventory_path.exists():
    inventory = inventory_path.read_text()
    note = "\n> **Current UI boundary:** Personal Items are retained in the private-data contract for backwards compatibility but are no longer surfaced by the web timetable or included in current gap calculations. Academic Work remains the supported user-facing planning layer.\n"
    if "Current UI boundary" not in inventory:
        inventory = note + inventory
    inventory_path.write_text(inventory)

print("One-shot product + SEO source migration applied successfully.")
