# Observable background review jobs

**Status:** Verified, updated 2026-10-28.

## Contract

`POST /api/prs/{pr_id}/review-jobs` validates the stored PR, persists a queued `review` job, returns `202 Accepted`, and schedules review execution after the response. `POST /api/prs/{pr_id}/comparison` does the same for a paired `comparison` job. Clients poll `GET /api/review-jobs/{job_id}`.

Stages are `queued`, `starting_hindsight`, `recalling_and_reviewing`, `reviewing_diff`, `reviewing_baseline`, `complete`, and `failed`. Single-review completion embeds one persisted serialized `ReviewRun`; comparison completion embeds persisted memory/baseline runs and deterministic evaluation. Unexpected exceptions expose only `review_service_unavailable`; known application validation errors use bounded error codes.

The browser maps stages to readable loading text and stops after six minutes. After a creation response, it stores the validated opaque job ID in per-tab session storage under the job kind and PR ID. A refresh resumes polling that same job through `GET`; it does not repeat the creation `POST`. Success and known terminal failure clear the locator, while unmount, timeout, and transient request errors preserve it for later recovery. The original synchronous review route remains for smoke/compatibility use, while Review Workspace uses jobs.

While a job is active or recoverable, both pages render a collapsed `Active job details` disclosure. It contains only the already validated opaque job ID and a controlled human-readable status label. Completion or known terminal failure removes it. Provider request/response bodies, prompts, credentials, recalled text, and raw errors are never placed in this disclosure.

Each status GET independently classifies retryable failures. Network errors and HTTP `408`, `425`, `429`, `500`, `502`, `503`, and `504` receive at most three consecutive retries after 1, 2, and 4 seconds. The page announces a review- or comparison-specific reconnecting state during backoff. A successful GET resets the counter; non-retryable responses and the fourth consecutive transient failure surface without another automatic request. After exhaustion, an explicit `Check review again` or `Check comparison again` action starts another status loop for the preserved opaque job ID. Automatic and manual retries are GET-only and never create or replay provider work.

An HTTP `404` has separate terminal meaning: the saved active-job locator no longer resolves. The page clears that locator, queries the existing latest-completed endpoint for the same PR, and restores the persisted result if present. When no completed result exists, it asks for a new explicit run. Neither branch sends a job-creation POST.

## Trust and reliability boundaries

- Repository and PR identity still come from application storage.
- Workers open an independent SQLAlchemy session; request sessions are never reused across threads.
- Job state and completed results survive browser reloads.
- The session-stored job ID is a recovery locator, not an authorization decision; repository/PR ownership and work execution remain backend controlled.
- Closing a tab discards its active locator. Completed runs remain recoverable from SQLite; cross-tab active-job discovery is not implemented.
- Active work does not resume after API-process termination because the local MVP uses in-process FastAPI background tasks, not an external worker queue.
- The shared Hindsight server is API-owned, while each worker creates its own SDK client to avoid sharing event-loop-bound client state across threads.
- The next API startup atomically marks every leftover `queued`/`running` job `failed` with `job_interrupted_by_restart`. It does not replay work that may already have called an external provider or partially persisted a run.
- `/api/health` reports the number reconciled during this process start, and the UI renders an accessible safe-retry notice when the count is nonzero.

## Verification

- Unit tests cover review/comparison queued-to-complete persistence and sanitized unexpected failure.
- Recovery tests cover queued/running reconciliation, idempotency, and preservation of completed/already-failed jobs.
- Component tests preload active review and comparison locators, restore each result through GET-only polling, assert zero POST requests, and assert terminal cleanup.
- Component tests inject a transient `503` into each active-job polling flow, observe the reconnecting state, then verify the original job completes after exactly two GETs and zero POSTs.
- Component tests exhaust four consecutive `503` responses for each page, verify the active locator remains, activate `Check again`, and confirm the original job completes after one additional GET and zero POSTs.
- Those exhaustion cases also verify the collapsed disclosure shows the expected sanitized job ID/status and disappears after terminal completion.
- Component tests inject a missing active review and comparison, then verify one status GET, one latest-result GET, zero POSTs, persisted-result rendering, and stale-locator cleanup for each flow.
- A live paired job returned queued state immediately and later resolved to two persisted runs with all six provenance/contamination guardrails passing.
- An isolated live API restart converted a persisted queued job to `job_interrupted_by_restart` and reported `interrupted_jobs: 1` without touching the running demo.
