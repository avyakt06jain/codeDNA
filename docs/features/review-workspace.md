# Review Workspace

**Status:** Verified live on 2026-10-27; keyboard focus behavior verified by component tests on 2026-10-28.

The G3 React client reads repositories, pull requests, decisions, review results, and evidence from FastAPI. It never receives credentials or arbitrary Hindsight bank IDs. The primary view shows a bounded stored diff, actual added-line numbers, review mode, model, elapsed time, validated findings, and an evidence drawer. Team DNA shows authoritative decision state and source references.

Memory and baseline actions call the same backend review contract with only `memory_enabled` changed. Loading disables duplicate review actions; API failures produce a visible error; an empty validated result explicitly avoids claiming the code is bug-free.

Evidence and feedback are keyboard-safe. Opening either surface moves focus into it. Closing the evidence panel restores focus to its `View evidence` trigger. The feedback dialog traps Tab and Shift+Tab, closes on Escape, and restores focus to its `Dismiss` trigger. This behavior does not change review or policy contracts.

Background review progress is announced through one persistent polite/atomic live region. The visible progress and loading treatments are hidden from the accessibility tree when that region already carries the same message, preventing duplicate stage announcements. Feedback confirmation uses the same region; errors remain assertive alerts.

Finding locations are navigation controls rather than decorative labels. Activating a line-specific location selects its file and moves programmatic focus to the validated changed line, which receives a visible focus outline and an accessible line label. Findings without a line fall back to the diff region. Manual file selection and a new review clear the previous target.

Verification includes focused accessibility regressions, the full frontend suite, a strict TypeScript production build, and a live browser run that displayed the real line-18 `DEC-0042` finding and PR #42 provenance.
