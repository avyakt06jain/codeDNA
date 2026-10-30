# Review Workspace

**Status:** Verified live on 2026-10-27; refresh recovery and keyboard behavior verified by component tests on 2026-10-28.

The G3 React client reads repositories, pull requests, decisions, review results, and evidence from FastAPI. It never receives credentials or arbitrary Hindsight bank IDs. The primary view shows a bounded stored diff, actual added-line numbers, review mode, model, elapsed time, validated findings, and an evidence drawer. Team DNA shows authoritative decision state and source references.

Memory and baseline actions call the same backend review contract with only `memory_enabled` changed. Loading disables duplicate review actions; API failures produce a visible error; an empty validated result explicitly avoids claiming the code is bug-free.

Evidence and feedback are keyboard-safe. Opening either surface moves focus into it. Closing the evidence panel restores focus to its `View evidence` trigger. The feedback dialog traps Tab and Shift+Tab, closes on Escape, and restores focus to its `Dismiss` trigger. This behavior does not change review or policy contracts.

Background review progress is announced through one persistent polite/atomic live region. The visible progress and loading treatments are hidden from the accessibility tree when that region already carries the same message, preventing duplicate stage announcements. Feedback confirmation uses the same region; errors remain assertive alerts.

After the backend accepts a review, the page keeps its validated opaque job ID in per-tab session storage. Refreshing the same tab resumes GET-only polling of that job instead of issuing another review POST. Completion and known terminal failure clear the locator; cancellation, timeout, and transient polling errors keep it available for recovery. If no local locator exists, the page first discovers the newest queued/running review for the same stored PR. Only when none exists does it restore the latest completed memory review from SQLite.

The creation endpoint also closes the simultaneous-tab race: if another ordinary review is already queued/running for the PR, it returns that job with `reused: true` and schedules no second provider task. The workspace preserves that response field and visibly announces reattachment before polling the existing job.

During a transient polling failure, the persistent live region and visible stage explain that CodeDNA is reconnecting to the existing review. The bounded retry does not enable the run action or create another job.

If all bounded attempts fail, the workspace preserves the active job locator and shows `Check review again`. Activating it polls that same job through GET only; it does not submit the diff or invoke the provider again.

A collapsed `Active job details` disclosure remains available while that locator is active or recoverable. It shows only the validated opaque job ID, readable review status, sanitized started/updated ages, and exact localized times. Malformed server timestamp values are omitted. The disclosure disappears on known terminal completion or failure.

If the backend confirms that the saved active job is missing, the workspace clears the stale locator and reads the latest completed memory review for that PR. It restores that review when available; otherwise it shows explicit guidance to start a new review. This fallback is read-only.

Finding locations are navigation controls rather than decorative labels. Activating a line-specific location selects its file and moves programmatic focus to the validated changed line, which receives a visible focus outline and an accessible line label. Findings without a line fall back to the diff region. Manual file selection and a new review clear the previous target.

Verification includes focused accessibility regressions, the full frontend suite, a strict TypeScript production build, and a live browser run that displayed the real line-18 `DEC-0042` finding and PR #42 provenance.
