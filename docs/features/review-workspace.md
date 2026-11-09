# Review Workspace

**Status:** Verified live on 2026-10-27; refresh recovery, keyboard behavior, and exact-PR creation readiness verified by component tests through 2026-11-06.

The G3 React client reads repositories, pull requests, decisions, review results, and evidence from FastAPI. It never receives credentials or arbitrary Hindsight bank IDs. The primary view shows a bounded stored diff, actual added-line numbers, review mode, model, elapsed time, validated findings, and an evidence drawer. Team DNA shows authoritative decision state and source references.

Memory and baseline actions call the same backend review contract with only `memory_enabled` changed. Loading disables duplicate review actions; API failures produce a visible error; an empty validated result explicitly avoids claiming the code is bug-free.

Evidence and feedback are keyboard-safe. Opening either surface moves focus into it. Closing the evidence panel restores focus to its `View evidence` trigger. The feedback dialog traps Tab and Shift+Tab, closes on Escape, and restores focus to its `Dismiss` trigger. This behavior does not change review or policy contracts.

Background review progress is announced through one persistent polite/atomic live region. The visible progress and loading treatments are hidden from the accessibility tree when that region already carries the same message, preventing duplicate stage announcements. Feedback confirmation uses the same region; errors remain assertive alerts.

After the backend accepts a review, the page keeps its validated opaque job ID in per-tab session storage. Refreshing the same tab resumes GET-only polling of that job instead of issuing another review POST. Completion and known terminal failure clear the locator; cancellation, timeout, and transient polling errors keep it available for recovery. If no local locator exists, the page first discovers the newest queued/running review for the same stored PR. Only when none exists does it restore the latest completed memory review from SQLite.

A review returned by that latest-result fallback is visibly and politely labeled `Latest saved review restored` through the frontend-only `review_restored` stage. Initial refresh restoration, manual creation-status restoration, and missing-job fallback use the same label. A review that reaches terminal completion while its job is actively polled remains `Review complete`, preventing saved evidence from being presented as newly generated work.

The result summary shows the persisted review run ID only after the API client accepts the bounded `review-...` or `run-...` grammar. For latest-result recovery, an explicitly null review is the only empty state; a present non-object review or one with an invalid/overlong run ID raises a task-specific integrity error and renders no findings. Latest and active-job review results must also carry a `pr_id` exactly equal to the route/request PR, explicit `status: complete`, an explicit `memory` or `baseline` mode, and provider/model strings containing non-whitespace text. Latest reads and newly started/retried jobs require the mode to equal the requested control state; a rediscovered active job whose original mode is not present in the client locator still must declare either valid mode. Missing, blank, defaulted, nonterminal, different-PR, or known-mode-mismatched state follows the same fail-closed path, even if its run ID is valid. Active failure is terminal: the workspace renders an integrity error, clears the saved locator and active-job disclosure, makes no latest-result fallback, and never posts replacement work. The ID is correlation text, not authorization, and sits outside the page's live status region.

`Run CodeDNA Review` stays disabled until pull-request loading and that recovery sequence have both completed for the exact route PR. Route changes clear the recovery marker before the control can create work. Tests hold latest-result recovery and reused-job polling behind explicit promise gates, proving the control barrier, zero recovery POSTs, and the reattachment announcement without wall-clock delays.

The page exposes one named `Review workspace` region with `aria-busy=true` for that combined load/recovery boundary and `false` after it settles. The visible loading note remains present, while the existing polite/atomic live region is the only element with status semantics for the loading message. This busy state adds no request, focus movement, or provider work.

If active/latest recovery fails, including when a non-null stored review lacks a valid correlation ID, the region settles to `aria-busy=false` and an assertive task-specific alert includes the sanitized failure detail, states that recovery started no review or provider call, and tells the user the run control is available when dependencies are ready. Under unresolved creation status, the same invalid payload keeps creation disabled and recreates/focuses `Check creation status`. The existing memory-readiness gate still applies; the message does not bypass it or claim that unobserved backend work is absent.

`Retry saved review recovery` starts a fresh exact-PR recovery generation: it reloads the PR, checks active review work, and reads the latest memory result only when no active job exists. It issues no creation POST. Success clears the alert/action and restores or resumes persisted work; another failure recreates the same bounded user choice.

That manual retry also preserves keyboard position. A restored result focuses the `Review findings` heading, a repeated failure focuses the newly rendered retry button, and a successful empty recovery focuses the named Review workspace. Changing PR cancels the pending focus intent.

If the manual retry succeeds but finds neither an active job nor a persisted review, the existing polite live region announces that exact empty outcome and confirms no provider work started. The ordinary `No review yet` surface remains visible; the outcome is not presented as an error. Active reattachment and restored reviews do not use the empty-result announcement.

The creation endpoint also closes the simultaneous-tab race: if another ordinary review is already queued/running for the PR, it returns that job with `reused: true` and schedules no second provider task. The workspace preserves that response field and visibly announces reattachment before polling the existing job.

If the creation response is lost and three automatic active-claim reads remain empty, the run control stays disabled and `Check creation status` becomes the only recovery action. It performs same-PR review active discovery followed by latest-result restoration only when no active claim exists. A job is reattached, a completed review is restored, or a successful empty result reenables the explicit run control; read failure keeps the boundary closed. The action sends no POST and restores keyboard focus to findings, the workspace, or its recreated action.

During a transient polling failure, the persistent live region and visible stage explain that CodeDNA is reconnecting to the existing review. The bounded retry does not enable the run action or create another job.

If all bounded attempts fail, the workspace preserves the active job locator and shows `Check review again`. Activating it polls that same job through GET only; it does not submit the diff or invoke the provider again.

A collapsed `Active job details` disclosure remains available while that locator is active or recoverable. It shows only the validated opaque job ID, readable review status, sanitized started/updated ages, and exact localized times. Malformed server timestamp values are omitted. The disclosure disappears on known terminal completion or failure.

After three minutes without a valid `updated_at` change, a visible status warning says that progress has not been reported and that CodeDNA is still checking the same review. It does not submit another review or imply the current job has failed.

Before a judge opens the workspace, repository overview can show a read-only active review/comparison summary linked to the owning PR. The summary refreshes every five seconds only while active rows remain; it neither starts work nor polls the job-result endpoint.

When previously visible overview work disappears, a polite status directs screen-reader users into this workspace to inspect the saved result or failure without claiming a successful outcome.

Short overview-summary outages receive the same bounded transient classification as job polling, but retry only the repository summary. Existing rows remain readable and no review/comparison or provider request is created.

If bounded summary recovery is exhausted, `Check active work again` remains a read-only repository operation; it does not enter or replay the review workspace job flow.

Manual summary recovery preserves keyboard position by focusing restored Active work, the overview heading for an empty success, or the retry action if recovery fails again.

Visible Active work includes the latest successful repository-summary check time, separate from each job's backend-owned creation/update timestamps.

When that summary is successfully empty, the overview renders a timestamped `No active work` state rather than implying the review workspace itself was never checked.

The empty-state `Check for active work` action can discover a workspace job queued in another tab, but never creates or replays one.

Overview summary polling pauses in hidden tabs and reconciles once on return, reducing background traffic without changing workspace job execution.

If the backend confirms that the saved active job is missing, the workspace clears the stale locator and reads the latest completed memory review for that PR. It restores that review when available; otherwise it shows explicit guidance to start a new review. This fallback is read-only.

Finding locations are navigation controls rather than decorative labels. Activating a line-specific location selects its file and moves programmatic focus to the validated changed line, which receives a visible focus outline and an accessible line label. Findings without a line fall back to the diff region. Manual file selection and a new review clear the previous target.

Verification includes focused accessibility regressions, the full frontend suite, a strict TypeScript production build, and a live browser run that displayed the real line-18 `DEC-0042` finding and PR #42 provenance.
