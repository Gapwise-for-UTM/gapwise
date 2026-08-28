# Accessibility regression matrix

This document records what Gapwise verifies in code and automated browser tests. It is evidence tracking, not a certification claim. Manual assistive-technology and real-device testing remains useful where automation cannot prove the experience.

## Covered surfaces

- **Landing / demo import:** core browser journey coverage, native button focus, serious/critical axe gating, and monument auto-rotation disabled under `prefers-reduced-motion`. Demo initialization must settle before scanning.
- **Timetable:** automated coverage after demo initialization, native controls, serious/critical axe gating, and global reduced-motion CSS. Existing timetable data semantics remain unchanged.
- **Gap plan:** keyboard-activatable view controls, native focus behavior, serious/critical axe gating, and global reduced-motion CSS.
- **Day Route:** keyboard-activatable view controls, native focus behavior, serious/critical axe gating, and global reduced-motion CSS. Route preferences are included in the core accessibility journey.
- **Campus explorer:** keyboard-completable search with retained input focus, serious/critical axe gating, and an explicit reduced-motion browser test. Physical accessibility truth still depends on separately verified campus data.
- **Timetable export dialog:** keyboard-openable trigger, Escape-to-close focus restoration, serious/critical axe gating in the open dialog, semantic radio-state regression coverage, and global reduced-motion CSS. Export remains browser-local.
- **Theme switching:** native button interaction plus dark- and light-theme axe gates. Motion preference is independent of theme.
- **Account / settings / onboarding:** existing E2E coverage where flows are available and Radix/native focus behavior. Phase 4 will expand concrete gaps as they are identified. Production identity-provider behavior is outside automated local proof.
- **Loading / empty / error / recovery states:** flow-specific role/status coverage with global reduced-motion CSS. Broader failure and recovery UX remains a later AND-130 phase.

## Regression rules

- Primary journeys must remain completable without a pointer where the underlying browser control supports keyboard interaction.
- Dialogs and sheets must not strand focus; closing a modal should return focus to the invoking control unless the invoking control no longer exists.
- Async status and error messages should use semantic status/live-region behavior where a visual-only update would otherwise be missed.
- Decorative icons must not become redundant accessible names.
- Motion that is not necessary to understand state must respect `prefers-reduced-motion`.
- Automated axe checks block serious and critical violations on maintained critical states, but a clean axe scan does not by itself prove accessibility.
- Campus accessibility labels must never imply physically verified step-free access unless the underlying campus-truth evidence is actually verified.

## Current automated files

- `e2e/accessibility.e2e.ts` — landing, timetable, gap plan, Day Route, theme, reduced motion, and campus explorer checks.
- `e2e/accessibility-focus.e2e.ts` — export-dialog keyboard operation, focus restoration, semantic radio state, and dialog axe checks.
