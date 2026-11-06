# Observable background review jobs

**Status:** Verified, updated 2026-10-29.

## Contract

`POST /api/prs/{pr_id}/review-jobs` and `POST /api/prs/{pr_id}/comparison` validate the stored PR and atomically claim work. SQLite uses `BEGIN IMMEDIATE` before the active-job check; other SQL dialects lock the stored PR row. If a queued/running job already exists for that PR and kind, the response returns its ID and `reused: true` without scheduling another task. Otherwise the API persists one queued job, returns `reused: false`, and schedules execution after the response. Clients poll `GET /api/review-jobs/{job_id}`.

The frontend keeps `reused` as part of its typed creation result. When true, Review Workspace or Memory Lab immediately renders and politely announces that it reattached to existing work and did not start another provider call/branch. Normal stage polling then continues against the returned job ID.

Stages are `queued`, `starting_hindsight`, `recalling_and_reviewing`, `reviewing_diff`, `reviewing_baseline`, `complete`, and `failed`. Single-review completion embeds one persisted serialized `ReviewRun`; comparison completion embeds persisted memory/baseline runs and deterministic evaluation. Unexpected exceptions expose only `review_service_unavailable`; known application validation errors use bounded error codes.

The browser maps stages to readable loading text and stops after six minutes. Creation, active-discovery, and job-status responses include only UTC `created_at` and `updated_at` job timestamps alongside the existing sanitized state. The client accepts only parseable timestamp strings, normalizes them to ISO UTC, and updates the diagnostic values after every successful poll. After a creation response, it stores the validated opaque job ID in per-tab session storage under the job kind and PR ID. A refresh resumes polling that same job through `GET`; it does not repeat the creation `POST`. Success and known terminal failure clear the locator, while unmount, timeout, and transient request errors preserve it for later recovery. The original synchronous review route remains for smoke/compatibility use, while Review Workspace uses jobs.

When per-tab storage has no locator, the page calls `GET /api/prs/{pr_id}/review-jobs/active?kind=review|comparison`. The backend verifies the PR exists and selects only the newest queued/running job for that exact PR and kind. A returned opaque ID passes the same client validator, is restored to session storage, and resumes normal status polling. Only when no active job exists does the page read the latest completed result.

While a job is active or recoverable, both pages render a collapsed `Active job details` disclosure. It contains only the already validated opaque job ID, a controlled human-readable status label, and started/updated ages with exact local times. Completion or known terminal failure removes it. Provider request/response bodies, prompts, credentials, recalled text, and raw errors are never placed in this disclosure.

If a parseable persisted `updated_at` remains unchanged for three minutes, a warning appears outside the collapsed disclosure and is exposed as a status message. It says only that the job has not reported progress; it does not label the worker failed or stuck. CodeDNA continues polling the same job ID and does not create a retry, replacement job, or provider call. A blocking provider operation can legitimately cross the threshold, so the warning is diagnostic rather than terminal.

Each status GET independently classifies retryable failures. Network errors and HTTP `408`, `425`, `429`, `500`, `502`, `503`, and `504` receive at most three consecutive retries after 1, 2, and 4 seconds. The page announces a review- or comparison-specific reconnecting state during backoff. A successful GET resets the counter; non-retryable responses and the fourth consecutive transient failure surface without another automatic request. After exhaustion, an explicit `Check review again` or `Check comparison again` action starts another status loop for the preserved opaque job ID. Automatic and manual retries are GET-only and never create or replay provider work.

An HTTP `404` has separate terminal meaning: the saved active-job locator no longer resolves. The page clears that locator, queries the existing latest-completed endpoint for the same PR, and restores the persisted result if present. When no completed result exists, it asks for a new explicit run. Neither branch sends a job-creation POST.

## Trust and reliability boundaries

- Repository and PR identity still come from application storage.
- Workers open an independent SQLAlchemy session; request sessions are never reused across threads.
- Job state and completed results survive browser reloads.
- The session-stored job ID is a recovery locator, not an authorization decision; repository/PR ownership and work execution remain backend controlled.
- Closing a tab discards its local locator, but a new tab discovers same-PR active work from SQLite. Simultaneous creation requests serialize and reuse the same active job instead of duplicating provider work.
- The repository overview uses a read-only repository-scoped lookup and lists queued/running jobs with their owning PR, kind, stage, and sanitized timestamps. While rows remain it refreshes only this summary every five seconds, stopping on an empty response, error, repository change, or unmount. It does not poll individual job results or create provider work.
- A persistent polite/atomic live region announces a nonempty-to-empty overview transition exactly once, conservatively saying only that work is no longer running and directing the user to inspect the saved result or failure. Initial empty state and repository navigation remain silent.
- Overview summary reads reuse the frontend's transient classification: network errors and HTTP `408`, `425`, `429`, `500`, `502`, `503`, and `504` retry after 1, 2, and 4 seconds. Existing rows remain visible while reconnecting; success resets the counter, and exhaustion or a nonretryable response stops the summary loop with an explicit error.
- After that loop stops, `Check active work again` starts a fresh bounded cycle against the same repository summary. It does not call an individual job endpoint, submit a review/comparison, or invoke a provider.
- Because the retry button disappears during recovery, focus moves deterministically after resolution: to Active work when rows return, to the overview heading when the result is empty, or to the recreated retry action after another terminal failure.
- Every successful repository active-summary response records a client-side `Last checked` instant. Active work renders it as a localized, machine-readable `<time>`; transient failures do not advance the value.
- A successful empty response renders `No active work` with the same check instant and explicit queued/running review/comparison scope. It does not claim that a provider was contacted.
- `Check for active work` starts a summary-only bounded cycle from that empty state. If another tab queued work, the panel changes to Active work, focus moves to its heading, and ordinary read-only monitoring resumes without a creation POST.
- Repository summary timers pause while `document.visibilityState` is hidden. Initial and scheduled reads wait; returning to visible triggers one immediate summary check, and component cleanup removes both timers and the visibility listener. Exhausted/nonretryable errors remain stopped across visibility changes until the explicit retry action.
- Active work does not resume after API-process termination because the local MVP uses in-process FastAPI background tasks, not an external worker queue.
- The shared Hindsight server is API-owned, while each worker creates its own SDK client to avoid sharing event-loop-bound client state across threads.
- The next API startup atomically marks every leftover `queued`/`running` job `failed` with `job_interrupted_by_restart`. It does not replay work that may already have called an external provider or partially persisted a run.
- `/api/health` reports the number reconciled during this process start, and the UI renders an accessible safe-retry notice when the count is nonzero.
- The shell continues observing the read-only health contract after Hindsight first reports ready: visible tabs use a 30-second ready interval and the existing two-second starting/unavailable interval. Hidden tabs cancel the timer and perform one immediate reconciliation when visible again. Health observation never creates a review job or starts provider work.
- Each successful health response advances a localized semantic `time` beside the Hindsight indicator; failed reads preserve the prior successful check time. The timestamp is outside the dependency state live region, preventing unchanged 30-second observations from producing repeated assistive-technology announcements.

## Verification

- Unit tests cover review/comparison queued-to-complete persistence and sanitized unexpected failure.
- Recovery tests cover queued/running reconciliation, idempotency, and preservation of completed/already-failed jobs.
- Component tests preload active review and comparison locators, restore each result through GET-only polling, assert zero POST requests, and assert terminal cleanup.
- Component tests inject a transient `503` into each active-job polling flow, observe the reconnecting state, then verify the original job completes after exactly two GETs and zero POSTs.
- Component tests exhaust four consecutive `503` responses for each page, verify the active locator remains, activate `Check again`, and confirm the original job completes after one additional GET and zero POSTs.
- Those exhaustion cases also verify the collapsed disclosure shows the expected sanitized job ID/status, both normalized timestamps and their exact visible times, then disappears after terminal completion.
- Timestamp boundary tests prove the no-progress warning is absent one millisecond before three minutes, present at the threshold, ignores missing/malformed values, and remains GET-only in both product pages.
- Component tests start with empty session storage, discover active review/comparison jobs, verify one status GET and zero POST/latest-result calls, then confirm terminal locator cleanup.
- Concurrency and route tests prove two simultaneous SQLite claims create one active row, repeated queue calls return one job ID, and only the creator receives a scheduled background task.
- Component tests inject a missing active review and comparison, then verify one status GET, one latest-result GET, zero POSTs, persisted-result rendering, and stale-locator cleanup for each flow.
- A live paired job returned queued state immediately and later resolved to two persisted runs with all six provenance/contamination guardrails passing.
- An isolated live API restart converted a persisted queued job to `job_interrupted_by_restart` and reported `interrupted_jobs: 1` without touching the running demo.
