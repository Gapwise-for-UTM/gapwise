# Accessibility conformance evidence worksheet

**Internal working document — not a VPAT, certification, or conformance report**

This maintainable worksheet prepares evidence for a future Accessibility Conformance Report (ACR) or procurement response. It must not be published or represented as a formal VPAT. A completed ACR requires criterion-by-criterion review, an identified product/version and evaluation scope, and human approval. No third-party assessment has been performed.

## Document control

For each evaluation record the product, exact commit SHA and deployed URL, evaluation date, evaluator, browser and assistive-technology versions where applicable, and evidence references. Gapwise uses **WCAG 2.2 Level AA as a planning target**, not as a formal conformance claim. The last worksheet review is August 28, 2026. Re-review after a material UI or test-scope change, a procurement request, or newly verified manual evidence.

## Evidence rules

Use only these statuses; never infer support from the absence of a bug:

- **Supports** — the complete criterion was evaluated for the stated scope with reproducible evidence.
- **Partially supports** — some applicable states were evaluated, with gaps recorded.
- **Does not support** — a verified failure exists.
- **Not applicable** — the criterion does not apply, with a written rationale.
- **Not evaluated** — evidence is absent or insufficient.

For every criterion record the exact commit, route or state, viewport and browser, assistive technology and version where applicable, evaluator, date, result, evidence link, open issue, and retest date. Automated axe results are evidence only for the rules axe checks; they are not evidence for every WCAG criterion and are not screen-reader testing.

## Current evidence inventory

- **Automated rules:** axe-core blocks serious or critical findings in selected critical states through `e2e/accessibility.e2e.ts` and `e2e/accessibility-focus.e2e.ts`. Sampled states only; automation is not a conformance assessment.
- **Keyboard:** selected navigation and view controls, campus search, mobile weekday selection, and export-dialog operation are covered by maintained browser tests. This is not an exhaustive keyboard pass of every route and state.
- **Focus:** the export dialog closes with Escape and restores focus to its trigger. This is representative dialog evidence, not evidence for every overlay.
- **Semantics:** deterministic radio state and selected status/error semantics have regression coverage. Screen-reader output has not been manually verified.
- **Reduced motion:** browser emulation checks selected campus-explorer and monument behavior, and global CSS reduces motion. This does not prove every third-party or future animation.
- **Themes:** selected dark and light states receive axe scans. This is not a complete contrast review of every state.
- **Screen readers:** no repeatable manual pass is recorded. Keep this **Not evaluated** until tester, assistive technology, browser versions, script, date, and results are recorded.
- **Physical campus accessibility:** unknown route evidence fails closed. This is campus-data governance, not proof of web-content conformance.

## Criterion worksheet template

For every applicable WCAG 2.2 A and AA success criterion, create a record containing criterion number and name, status, applicability rationale, routes/states evaluated, method, browser/assistive-technology/version, evidence and commit, gaps or issue, evaluator and date, and retest date. Default new rows to **Not evaluated**; never prefill a support status from automated results alone.

## Manual evaluation scripts to complete

1. **Keyboard-only:** start at the URL, use Tab, Shift+Tab, arrow keys, Enter, Space, and Escape, and record focus order, visibility, traps, operation, dismissal, and focus return.
2. **Screen reader:** record OS, browser, assistive technology, and versions; check landmarks, headings, names, roles, states, instructions, validation, dynamic status, dialogs, and route changes.
3. **Zoom and reflow:** evaluate at required zoom and viewport conditions; record clipping, overlap, two-dimensional scrolling, and loss of content or operation.
4. **Contrast and non-colour cues:** inspect all themes and interactive, error, and focus states using a recorded measurement method.
5. **Motion:** enable reduced motion and check every animated or auto-updating state; record any essential-motion rationale and pause/stop controls.
6. **Mobile and alternative input:** evaluate touch-target behavior and, when available, voice-input and switch-control paths on named devices.

## Publication and procurement gate

Before issuing an ACR or procurement answer, a human owner must freeze and identify the evaluated build and scope; complete all applicable criterion records and reconcile open defects; verify manual screen-reader, keyboard, zoom/reflow, contrast, motion, and mobile evidence; review the current public Accessibility Statement and known limitations for consistency; identify the author and whether evaluation was internal or independent; obtain legal/procurement review of the requested ACR/VPAT edition and terminology; and approve the final document.

Never label an internal evaluation independent or third-party.
