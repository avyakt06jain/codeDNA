# CodeDNA Progress

> Observed implementation state. Requirements and examples in the design documents are not evidence of working behavior.

## Current State

- Date: 2026-10-30
- Phase: G0–G5 MVP gates complete; the evolved judge demo was exercised against a restarted local API.
- Implementation: The retain → recall → validate → review → feedback → supersede → ablate loop is verified locally against real Hindsight and Gemini. `CODEDNA_DEMO_SCENE=evolved` leaves `DEC-0103` active and `DEC-0042` superseded.
- Git: `main` is initialized, connected to GitHub, and verified checkpoints are pushed without rewriting published history.

## Working

- The three authoritative initial documents are present and readable.
- Python 3.12.0, Git 2.51.0, Node 24.14.0, and npm 11.21.0 are available.
- Bootstrap commit `b770321` is present on `origin/main`.
- Native dependencies installed in ignored `.venv`: Hindsight all-in-one/API/client 1.1.0, SQLAlchemy 2.0.55, Pydantic 2.14.1, python-dotenv 1.2.4, and pytest 9.1.1.
- Minimal SQLite provenance models, deterministic synthetic fixtures, source validation, backend-owned bank selection, and three-operation smoke CLI are implemented.
- Six focused provenance tests pass.
- The CLI reports an unavailable Hindsight service as structured failure with exit code 2.
- The official in-process Hindsight server starts on Windows with embedded pg0, reports API 1.1.0, and shuts down cleanly with the extended cleanup timeout.
- Real retain and differently worded recall resolved one returned fact/chunk to `decision-DEC-0042`, active `DEC-0042`, and synthetic source PR #42.
- A fresh process recalled the same fact and chunk without retaining again, proving pg0 persistence across server restart.
- The `analytics-service` bank returned no results for the same query, and reingestion retained exactly one document with no duplicate results.
- Unified diffs are bounded and parsed with `unidiff`; unsafe paths, binary/malformed input, and non-added line citations fail closed.
- Review runs/findings/evidence are persisted in SQLite, and FastAPI exposes repository, PR, decision, review, and evidence read contracts.
- A real paired PR #87 run produced a memory-backed line-18 finding citing validated `DEC-0042`; the independent baseline contained no team-policy category or evidence IDs.
- React/Vite Review Workspace loads live repository/PR data, renders the changed lines, runs memory or baseline reviews, links findings to lines, and opens validated decision provenance.
- Team DNA renders the backend's active decision, authority, rationale, and source PR.
- Finding feedback is stored durably and remains nonbinding; an ordinary review action cannot promote itself to policy.
- An explicit demo-maintainer supersession retained `DEC-0103`, preserved superseded `DEC-0042`, and a later PR #120 review cited only the new active rule.
- The Memory Lab runs paired same-PR/same-model reviews, persists both, and reports deterministic contamination/provenance checks.
- The guarded reset deleted only the two CodeDNA demo banks and designated demo database, then restored deterministic fixtures.
- A clean-state CLI evaluation and a live browser evaluation both passed all six guardrails.
- Review Workspace and Memory Lab both queue persisted background jobs and poll explicit stages.
- The evolved judge scene is idempotent: `DEC-0103` stays the active shipping rule, and Analytics Service keeps UTC decision `DEC-0211`.
- API startup reconciles stale queued/running jobs to explicit failed state, health reports the count, and the UI explains that a new review is required for a safe retry.
- The labeled evaluation set now has two distinct repository cases: Acme shipping policy and Analytics timestamp policy. Analytics PR #29 omits the expected answer and retrieves only validated `DEC-0211` from source PR #11 in its own bank.
- Memory Lab restores the latest completed comparison for the selected PR after refresh from persisted SQLite runs, without posting a job or calling Hindsight/Gemini again.
- Review evidence and feedback now preserve keyboard position: focus enters each surface, returns to its trigger on close, and the feedback dialog contains Tab navigation plus Escape dismissal.
- Review and Memory Lab progress now use one persistent polite/atomic live region per page; duplicate visible status text is hidden from accessibility APIs, and comparison stages use comparison-specific wording.
- Finding location controls now select the cited file and move focus to the validated changed line; line-less findings fall back to the diff region, and manual file selection/new runs clear stale targets.
- Review Workspace and Memory Lab now preserve the current opaque job ID for the browser tab and resume polling that same backend job after refresh without posting another review/comparison.
- Review and comparison polling now survives up to three consecutive transient network/server failures with bounded 1/2/4-second backoff and an accessible reconnecting status; successful polling resumes the existing job without another POST.
- A confirmed missing active job now clears its stale per-tab locator and restores the latest persisted same-PR review/comparison when available, without creating or replaying work.
- After bounded polling is exhausted, both pages preserve the active locator and offer a same-job `Check again` action that performs status GETs only.
- Review Workspace and Memory Lab expose a collapsed active-job disclosure with only the validated job ID and human-readable status, and remove it at terminal completion.
- With no per-tab locator, both pages now discover the newest backend-owned queued/running job for the same PR and kind, save its validated ID, and resume polling without a POST.
- Review and comparison creation now serialize the same-PR claim, reuse queued/running work, and schedule a background task only for the caller that created the job.
- Review Workspace and Memory Lab now preserve the creation response's `reused` flag and announce reattachment before polling, distinguishing existing provider work from a newly scheduled call.
- Active review/comparison diagnostics now carry backend-owned UTC creation/update timestamps through creation, discovery, and polling; the UI rejects malformed values and shows age with exact local time.
- Review Workspace and Memory Lab now show an accessible warning after three minutes without a persisted job update; it conservatively keeps observing the same job and starts no retry/provider work.

## In Progress

- Post-MVP work continues with repository-level visibility into active background work.

## Blocked

- No implementation blocker. The currently restarted API reports Hindsight unavailable after Gemini returned `503 UNAVAILABLE` during provider verification; saved reviews/comparisons and citation inspection remain usable, while new memory calls require provider recovery and an API restart.

## Known Limitations

- Docker is not installed; G1 uses officially supported native Windows Hindsight with embedded pg0.
- The schema currently uses controlled `create_all` initialization for the isolated spike; migrations are deferred until G2.
- Gemini availability is externally rate-limited: startup probes intermittently returned `503 UNAVAILABLE` during otherwise successful runs.
- Gemini free tier reported a zero cached-content storage-token limit. Hindsight logged the failure and completed via uncached fallback; this adds noise and may increase latency.
- The standalone Gemini-backed Hindsight process did not bind its HTTP listener on this Windows host. G1 therefore uses the official in-process server, which was verified.
- First execution downloads and loads local embedding/reranker assets and is materially slower than later runs.
- Review and comparison jobs are asynchronous and observable. The pull-request page restores its latest completed memory review after refresh. An API crash interrupts active work; the next startup marks that job failed rather than automatically replaying potentially duplicated provider work.
- The baseline model reported a generic missing-`where` concern on the intentionally abbreviated synthetic Prisma fixture. It was persisted honestly and did not receive team-policy authority.
- The authorization model is a narrow demo boundary (`demo-maintainer`), not production authentication or role-based access control.
- The feedback UI exposes accept and dismiss. The evolution page shows the supersession timeline. A free-text correction flow is still limited.
- The evaluation has two synthetic held-out policy cases, so results are reported as case counts, not generalized accuracy claims.
- A same-tab refresh prioritizes its session-stored locator. Closing the tab discards that local copy, but the next tab can rediscover the newest same-PR active job from SQLite; completed results still restore normally.
- A polished recorded video and hackathon portal submission are external presentation actions and are not created or submitted automatically.

## Next Action

Add a read-only active-work summary to the repository overview so ongoing review/comparison jobs are visible without opening each PR.

## Session Log

### 2026-10-30 — Conservative no-progress warning

- Goal: Make a potentially stalled job obvious without claiming failure or automatically replaying external work.
- Implemented: a three-minute `updated_at` boundary, visible status warning outside the collapsed details, conservative same-job wording, and Review Workspace/Memory Lab coverage that preserves the existing locator and issues no POST.
- Focused checks: `npm test -- --run src/ui.test.tsx src/text.test.ts --pool=vmThreads --maxWorkers=1 --isolate=false` → **31 passed across 2 files**; `npm run build` → **PASS**, 40 modules, 315.08 kB JavaScript and 14.10 kB CSS before gzip.
- Regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest -q` → **32 passed**; `npm test -- --run --pool=vmThreads --maxWorkers=1 --isolate=false` → **34 passed across 4 files**.
- Provider scope: **NOT RUN** — stale state is derived from already persisted timestamps; the tests assert the existing job remains and no replacement POST is made.
- Known behavior: a legitimate blocking provider call can cross three minutes because `updated_at` advances at stage boundaries, not inside the provider SDK. The warning therefore says only that progress is unreported.
- Live app check: the existing app refreshed and rendered the persisted Acme overview (4 PRs, 2 decisions, 16 review runs) while Hindsight remained truthfully `Memory unavailable`; no background job or provider call was started.
- Next: add a read-only active-work summary to the repository overview.

### 2026-10-30 — Sanitized active-job age

- Goal: Make queued/running work diagnosable by age without exposing provider payloads, review content, or credentials.
- Implemented: unambiguous UTC `created_at`/`updated_at` on queue, discovery, and status responses; client-side parse/normalization; polling updates; and collapsed started/updated age fields with exact localized times in Review Workspace and Memory Lab.
- Focused checks: `python -m pytest ...::test_queue_endpoints_reuse_active_jobs_and_schedule_once` → **1 passed**; `npm test -- --run src/ui.test.tsx src/text.test.ts --pool=vmThreads --maxWorkers=1 --isolate=false` → **30 passed across 2 files**.
- Corrections: the first `npm run build` **FAILED** on the saved/discovered locator union; explicit optional timing fields fixed the type. The first focused UI run then **FAILED 2 tests** because saved session locators correctly have no timestamp before a successful status response; the cases now use backend active-job discovery and verify both timestamps. The first full backend run **FAILED 1 existing exact-payload assertion** after the intentional response expansion; the assertion now verifies the original fields plus UTC timestamps. A later focused UI run exposed one existing reconnect announcement that lasted only the test environment's 1 ms backoff; a 50 ms mocked response delay now makes both reconnect tests deterministic without changing production timing.
- Regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest -q` → **32 passed**; `npm test -- --run --pool=vmThreads --maxWorkers=1 --isolate=false` → **33 passed across 4 files**; `npm run build` → **PASS**, 40 modules, 314.69 kB JavaScript and 13.94 kB CSS before gzip.
- Provider scope: **NOT RUN** — this slice reads persisted job metadata only and does not invoke Hindsight or Gemini.
- Live app check: the existing app loaded its persisted Acme overview (4 PRs, 2 decisions, 16 review runs); Hindsight remained truthfully `Memory unavailable`, and no review/comparison was started.
- Next: add a truthful stale-job warning derived from `updated_at` without replaying work.

### 2026-10-30 — Visible active-work reuse

- Goal: Tell a user when their review or comparison click reattached to already-running work instead of scheduling another provider request.
- Implemented: typed `StartedJob` creation results, preserved backend `reused` flags, immediate Review Workspace and Memory Lab reattachment stages, task-specific accessible wording, and component regressions that hold polling briefly to observe the transient state.
- Focused checks: `npm test -- --run src/ui.test.tsx src/text.test.ts --pool=vmThreads --maxWorkers=1 --isolate=false` → **29 passed across 2 files**. The first `npm run build` **FAILED** because `startReview` still typed its response as `ReviewJob`; narrowing that response to `ReviewJob & { reused?: boolean }` fixed the contract. The controlled rerun → **PASS**, 40 modules, 313.31 kB JavaScript and 13.83 kB CSS before gzip.
- Regression: the first full frontend run exposed a timing race in the new Memory Lab test because it clicked while initial restoration still disabled the control; awaiting the enabled state fixed the test without changing production behavior. `npm test -- --run --pool=vmThreads --maxWorkers=1 --isolate=false` → **32 passed across 4 files**. `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest -q` → **32 passed**.
- Provider scope: **NOT RUN** — the slice consumes an existing queue response and polls mocked persisted jobs; it does not execute Hindsight/Gemini work.
- Live app check: the existing Vite/API app refreshed successfully and rendered the persisted Acme overview (4 PRs, 2 decisions, 16 review runs). Hindsight remained truthfully `Memory unavailable`; no provider request was triggered.
- Next: expose sanitized job creation/update timestamps for stalled-work diagnosis.

### 2026-10-30 — Atomic active-job reuse

- Goal: Prevent simultaneous tabs from scheduling duplicate provider work after both observe no active locator.
- Implemented: a transactional job claim that uses SQLite `BEGIN IMMEDIATE` (or a stored-PR row lock on other SQL dialects), returns the active same-PR/same-kind job when present, and exposes `reused`; queue endpoints add a background task only for the creating claim.
- Focused check: `..\.venv\Scripts\python.exe -m pytest -q tests/test_review_jobs.py tests/test_judge_demo.py` → **15 passed**. Two concurrent SQLite claims produced one row/job ID and one creator; repeated review and comparison route calls returned `reused: true` and left the second `BackgroundTasks` collection empty.
- Regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 ..\.venv\Scripts\python.exe -m pytest -q` → **32 passed**; `npm test -- --run --pool=vmThreads --maxWorkers=1 --isolate=false` → **30 passed across 4 files**; `npm run build` → **PASS**, 40 modules, 312.94 kB JavaScript and 13.83 kB CSS before gzip.
- Provider scope: **NOT RUN** — tests inspect persisted claims and scheduled task counts without executing Hindsight/Gemini work.
- Next: surface reuse explicitly in Review Workspace and Memory Lab status text.

### 2026-10-29 — Same-PR active-job discovery

- Goal: Recover observability after a tab closes or loses session storage without tempting a duplicate review/comparison submission.
- Implemented: backend-owned newest-active lookup scoped to stored PR and job kind; a sanitized read-only endpoint; frontend job-ID validation; discovery before latest-result fallback; and session-locator restoration for both pages.
- Focused checks: `..\.venv\Scripts\python.exe -m pytest -q tests/test_review_jobs.py tests/test_judge_demo.py` → **13 passed**; `npm test -- --run src/ui.test.tsx --pool=vmThreads --maxWorkers=1 --isolate=false` → **21 passed**. New UI cases prove discovery, one status GET, zero creation POSTs, no latest-result read, and terminal locator cleanup for review and comparison.
- Build correction: the first `npm run build` **FAILED** because strict TypeScript correctly identified `asString` could return `undefined` inside the new validator. Normalizing that value to an empty string before the regex fixed the error.
- Regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 ..\.venv\Scripts\python.exe -m pytest -q` → **30 passed**; `npm test -- --run --pool=vmThreads --maxWorkers=1 --isolate=false` → **30 passed across 4 files**; `npm run build` → **PASS**, 40 modules, 312.94 kB JavaScript and 13.83 kB CSS before gzip.
- Provider scope: **NOT RUN** — active discovery and polling are read-only; tests assert zero POSTs and no Hindsight/Gemini result is claimed.
- Live app check: the first hot-reloaded page truthfully showed `Not Found` against the old API process. After restarting only that API on the updated source, PR #87 restored its saved `DEC-0103` finding with no new review; Vite remained running.
- Next: atomically reuse an existing active job at creation time to close the remaining simultaneous-tab race.

### 2026-10-29 — Sanitized active-job details

- Goal: Make long-running and temporarily unreachable work diagnosable without exposing provider requests, credentials, or private review content.
- Implemented: a reusable collapsed `Active job details` disclosure on Review Workspace and Memory Lab; validated opaque locator tracking across start/reattach/retry; human-readable stage display; and terminal cleanup.
- Focused check: `npm test -- --run src/ui.test.tsx src/text.test.ts` → **25 passed across 2 files**. Review and comparison cases verify the disclosure contains only the expected job ID/status after four transient failures and disappears after the same job completes.
- First full frontend run: **FAILED before collecting tests** with four `vitest-pool` worker startup timeouts because it overlapped orphaned workers from an interrupted earlier command. No assertion failed; the processes exited before the controlled rerun.
- Regression: `npm test -- --run --pool=vmThreads --maxWorkers=1 --isolate=false` → **28 passed across 4 files**; `npm run build` → **PASS**, 40 modules, 312.32 kB JavaScript and 13.83 kB CSS before gzip; `CODEDNA_HINDSIGHT_AUTOSTART=0 ..\.venv\Scripts\python.exe -m pytest -q` → **29 passed**.
- Provider scope: **NOT RUN** — this UI observes existing sanitized job state and does not create Hindsight/Gemini traffic.
- Live app check: Vite and the API had stopped after the interrupted worker run; both verified README commands were restarted in hidden processes. The PR #87 workspace again rendered its saved `DEC-0103` finding while Hindsight warmed, without starting a new review.
- Next: add read-only active-job discovery across tab loss.

### 2026-10-28 — Same-job manual status retry

- Goal: Let a user resume observation after all bounded transient polling retries fail, without refreshing the page or creating duplicate provider work.
- Implemented: typed polling-exhaustion state; preserved active locators; accessible `Check review again` and `Check comparison again` actions; GET-only status rechecks; terminal cleanup; and the existing stale-job persisted-result fallback on a manual recheck.
- Focused check: `npm test -- --run src/ui.test.tsx` → **19 passed**. The two new cases each exhaust four `503` responses, preserve the original locator, activate the retry action, finish on the fifth status GET, assert zero POSTs, and verify terminal locator cleanup.
- Regression: `npm test -- --run` → **28 passed across 4 files**; `npm run build` → **PASS**, 39 modules, 311.35 kB JavaScript and 13.46 kB CSS before gzip; `CODEDNA_HINDSIGHT_AUTOSTART=0 ..\.venv\Scripts\python.exe -m pytest -q` → **29 passed**.
- Provider scope: **NOT RUN** — this recovery path only observes an already accepted job; deterministic component tests prove that no Hindsight/Gemini request is created.
- Live app check: the running PR #87 workspace still rendered its persisted `DEC-0103` finding and truthfully reported memory unavailable; no provider restart was required.
- Next: add compact, sanitized job details for diagnosing long-running work.

### 2026-10-28 — Stale active-job fallback

- Goal: Prevent a removed or unknown saved job ID from trapping every refresh in the same `404` error.
- Implemented: typed missing-job terminal errors; active-locator cleanup; read-only fallback to the latest completed same-PR memory review or paired comparison; explicit new-run guidance only when no saved result exists.
- Focused check: `npm test -- --run src/ui.test.tsx --pool=vmThreads --maxWorkers=1 --isolate=false` → **17 passed**. New review and comparison cases each prove one missing-job GET, one latest-result GET, zero POSTs, successful persisted-result rendering, and locator cleanup.
- Regression: `npm test -- --run --pool=vmThreads --maxWorkers=1 --isolate=false` → **26 passed across 4 files**; `npm run build` → **PASS**, 39 modules, 309.58 kB JavaScript and 13.46 kB CSS before gzip; `CODEDNA_HINDSIGHT_AUTOSTART=0 ..\.venv\Scripts\python.exe -m pytest -q` → **29 passed**.
- Provider scope: **NOT RUN** — recovery uses only persisted application state and no Hindsight/Gemini call.
- Live app check: the running Memory Lab restored PR #87's persisted paired comparison, displayed the `DEC-0103` memory finding, baseline without citations, and all six passing guardrails while memory remained truthfully unavailable.
- Next: expose a same-job `Check again` action after transient retries are exhausted.

### 2026-10-28 — Bounded background-job reconnect

- Goal: Keep an accepted review/comparison observable through a short API or network interruption without creating duplicate provider work.
- Implemented: status-aware transient classification, three consecutive GET retries with 1/2/4-second backoff and reset-on-success, task-specific reconnecting announcements, and preservation of the existing active-job locator.
- Test refinement: the first focused run **FAILED 2/21** because the 250 ms reconnect state was too brief for the component harness; production backoff was revised to 1/2/4 seconds. The second run **FAILED 2/21** because the reconnect message intentionally appears in both the live region and visual status. The third run **FAILED 1/21** at the default one-second completion timeout. Assertions now accept the duplicated visual/live text and allow the first one-second retry to complete.
- Final focused check: `npm test -- --run src/ui.test.tsx src/text.test.ts --pool=vmThreads --maxWorkers=1 --isolate=false` → **21 passed across 2 files**.
- Regression: `npm test -- --run --pool=vmThreads --maxWorkers=1 --isolate=false` → **24 passed across 4 files**; `npm run build` → **PASS**, 39 modules, 308.74 kB JavaScript and 13.46 kB CSS before gzip; `CODEDNA_HINDSIGHT_AUTOSTART=0 ..\.venv\Scripts\python.exe -m pytest -q` → **29 passed**.
- Provider scope: **NOT RUN** — deterministic component failures exercise only job-status GETs; they verify zero replacement POSTs and require no Hindsight/Gemini call.
- Live app check: the running PR #87 workspace continued to render its saved `DEC-0103` finding with memory truthfully unavailable; no process or provider restart was needed.
- Next: clear a confirmed stale/missing locator and restore the latest completed result without creating work.

### 2026-10-28 — Active-job refresh reattachment

- Goal: Let a refreshed Review Workspace or Memory Lab continue observing work already accepted by the API without another provider request.
- Implemented: validated per-tab job locators keyed by task kind and PR; split start/poll API methods; refresh-time GET-only reattachment; success/terminal-failure cleanup; preservation across cancellation, timeout, and transient polling errors.
- Focused check: `npm test -- --run src/ui.test.tsx --pool=vmThreads --maxWorkers=1 --isolate=false` → **15 passed**. The first run **FAILED 3/15** because the active comparison locator was declared in the repository-loading effect rather than the comparison effect; moving it into the correct scope resolved the error.
- Regression: `npm test -- --run --pool=vmThreads --maxWorkers=1 --isolate=false` → **24 passed across 4 files**; `npm run build` → **PASS**, 39 modules, 308.27 kB JavaScript and 13.46 kB CSS before gzip; `CODEDNA_HINDSIGHT_AUTOSTART=0 ..\.venv\Scripts\python.exe -m pytest -q` → **29 passed**.
- Provider scope: **NOT RUN** — the change resumes an existing backend job and component tests prove zero replacement POSTs; no paid traffic or new Hindsight/Gemini result was required.
- Live app check: the running PR #87 workspace rendered its persisted one-finding memory review, cited `DEC-0103`, and reported Hindsight truthfully unavailable; the local app remained runnable without restarting providers.
- Next: add bounded transient polling retry and an explicit reconnecting status without creating another job.

### 2026-10-28 — Finding-to-diff keyboard navigation

- Goal: Make a finding's location control land keyboard users on the cited code rather than only changing the selected file.
- Implemented: monotonic focus requests from finding locations, programmatic focus and visible outline on matching new-side lines, diff-region fallback for line-less findings, and stale-target clearing on manual file selection/new review.
- First focused check: **FAILED 1/15** because JavaScript `null === null` incorrectly marked non-code diff rows as fallback targets. The target predicate now requires a non-null line.
- Final focused check: `npm test -- --run src/ui.test.tsx src/diffFiles.test.ts --pool=vmThreads --maxWorkers=1 --isolate=false` → **15 passed across 2 files**.
- Regression: `npm test -- --run --pool=vmThreads --maxWorkers=1 --isolate=false` → **22 passed across 4 files**; `npm run build` → **PASS**, 38 modules, 306.69 kB JavaScript and 13.46 kB CSS before gzip; `CODEDNA_HINDSIGHT_AUTOSTART=0 ..\.venv\Scripts\python.exe -m pytest -q` → **29 passed**.
- Live proof: restarted the API without provider autostart and Vite, opened the restored PR #87 result, activated `src/orders/update.ts:14`, and verified browser accessibility focus moved to `Changed line 14` containing the cited `prisma.order.update` line. The app remains runnable with saved evidence while memory health is unavailable.
- Next: preserve active job identity across a browser refresh and resume polling without creating another provider request.

### 2026-10-28 — Consolidated review and comparison announcements

- Goal: Make long-running background stages understandable to screen readers without repeating the same status through multiple live regions.
- Implemented: reusable polite/atomic `LiveStatus`; opt-out semantics for duplicate visual loading notes; one announcement stream each for Review Workspace and Memory Lab; comparison-specific queued, memory, baseline, complete, and restored labels.
- Focused check: `npm test -- --run src/ui.test.tsx src/text.test.ts --pool=vmThreads --maxWorkers=1 --isolate=false` → **18 passed across 2 files** after correcting two existing feedback assertions to target the live status rather than duplicate visible text.
- Regression: `npm test -- --run --pool=vmThreads --maxWorkers=1 --isolate=false` → **21 passed across 4 files**; `npm run build` → **PASS**, 38 modules, 306.17 kB JavaScript and 13.38 kB CSS before gzip; `CODEDNA_HINDSIGHT_AUTOSTART=0 ..\.venv\Scripts\python.exe -m pytest -q` → **29 passed**.
- Live proof: the running PR #87 workspace exposed one accessible `Review complete` message, and Memory Lab exposed `Latest comparison restored` alongside the persisted paired result while Hindsight remained truthfully unavailable.
- Next: connect finding location activation to focus on its cited diff line.

### 2026-10-28 — Keyboard focus lifecycle for evidence and feedback

- Goal: Keep keyboard users anchored when opening and closing finding evidence or feedback.
- Implemented: evidence-panel entry and trigger-return focus; feedback-dialog entry/return focus, forward/reverse Tab containment, and Escape dismissal.
- Focused check: `npm test -- --run src/ui.test.tsx --pool=vmThreads --maxWorkers=1 --isolate=false` → **12 passed**. The first threads-pool attempt **FAILED before test collection** because the Windows worker did not respond within 60 seconds; rerunning with the VM threads pool completed normally.
- Regression: `npm test -- --run --pool=vmThreads --maxWorkers=1 --isolate=false` → **20 passed across 4 files**; `npm run build` → **PASS**, 38 modules, 305.28 kB JavaScript and 13.38 kB CSS before gzip; `CODEDNA_HINDSIGHT_AUTOSTART=0 ..\.venv\Scripts\python.exe -m pytest -q` → **29 passed**.
- Live proof: restarted the API without provider autostart and Vite, opened the restored PR #87 review, and verified focus moved to the evidence region then returned to `View evidence`; the feedback dialog received focus and Escape returned it to `Dismiss`. Saved evidence remained usable while memory health truthfully showed unavailable.
- Next: consolidate live-status announcements for review and Memory Lab background stages.

### 2026-10-27 — Refresh-safe Memory Lab comparison

- Goal: Keep completed ablation evidence visible after refresh without spending quota or rerunning external services.
- Implemented: `GET /api/prs/{pr_id}/comparisons/latest`, shared conservative comparison serialization, run-to-PR integrity checks, frontend restoration/loading state, and a no-POST UI regression.
- Backend check: `CODEDNA_HINDSIGHT_AUTOSTART=0 ..\.venv\Scripts\python.exe -m pytest -q` → **29 passed**.
- Frontend checks: initial default-pool full run **FAILED before collecting tests** because four Windows Vitest fork workers timed out during the resource-heavy Hindsight restart. The focused UI suite had passed 11/11. Rerun with one reused worker, `npm test -- --run --pool=threads --maxWorkers=1 --isolate=false`, → **19 passed across 4 files**. `npm run build` → **PASS**, 38 modules, 304.41 kB JavaScript and 13.38 kB CSS before gzip.
- Live proof: restarted the API on port 8000 with current code, refreshed Analytics Memory Lab, and restored job `job-e1afe7434b974c8c` with both persisted runs, timings, `DEC-0211` citations, and all six guardrails visible before memory startup completed. No new comparison job was posted.
- External state: the restarted Hindsight runtime later became unavailable after Gemini returned `503 UNAVAILABLE` during provider verification. CodeDNA exposed `Memory unavailable`; it did not select a fallback or fabricate readiness. Saved comparison inspection remains functional.
- Limitation: only completed comparisons restore; a browser refresh does not reconnect to an active in-process job.
- Next: audit keyboard focus and live-status announcements across review, evidence, and comparison flows.

### 2026-10-27 — Second uncontaminated evaluation case

- Goal: Broaden evaluation beyond the order-status example without leaking the expected answer or crossing repository banks.
- Implemented: analytics source PR #11, held-out candidate PR #29, deterministic timestamp-query concept extraction, repository-specific default candidate selection, and an end-to-end fixture contract test using the real review/provenance/evaluation services.
- Contamination checks: candidate title, description, diff, and generated query omit `UTC`, `toISOString`, `DEC-0211`, `decision-DEC-0211`, and source PR `pr-analytics-11`.
- Deterministic proof: memory mode resolved `DEC-0211`/PR #11 from `codedna-repo-analytics-service`; baseline received no evidence; all six comparison guardrails passed.
- Real live proof: queued job `job-e1afe7434b974c8c` completed against the already-running Hindsight/Gemini app with **6/6 guardrails**. Memory run `review-166ed59f23614459` validated one analytics source and produced two grounded team findings in 15,778 ms; baseline `review-a3d5f1e523ec4ae8` produced one general finding, zero citations, and zero team-policy findings in 2,000 ms.
- UI proof: Analytics Service displayed both PR #11 and held-out PR #29; the repository-specific selector was corrected to prefer PR #29 rather than the historical source.
- Final regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 ..\.venv\Scripts\python.exe -m pytest -q` → **29 passed**; `npm test -- --run` → **18 passed across 4 files**; `npm run build` → **PASS**, 38 modules, 304.03 kB JavaScript and 13.38 kB CSS before gzip.
- Scope: two synthetic cases remain too small for an accuracy percentage.
- Next: restore the latest completed Memory Lab comparison after browser refresh without issuing another provider call.

### 2026-10-27 — Interrupted-job restart reconciliation

- Goal: Prevent persisted queued/running jobs from remaining indefinitely stuck after an API-process interruption.
- Implemented: atomic startup reconciliation to `failed`/`job_interrupted_by_restart`, idempotent terminal-state preservation, health count, and an accessible safe-retry notice in the workspace.
- Safety decision: startup does not automatically replay interrupted work because a crash can occur after external provider calls or partial review persistence; retry remains an explicit new job.
- Focused checks: backend recovery/judge tests → **12 passed**; frontend UI tests → **10 passed**.
- Live isolated process check: a queued job in `recovery-smoke.sqlite3` became failed after starting an API on port 8011; health reported `interrupted_jobs: 1`, and the job returned `job_interrupted_by_restart`. The main demo processes were not stopped.
- Final regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 ..\.venv\Scripts\python.exe -m pytest -q` → **28 passed**; `npm test -- --run` → **17 passed across 4 files**; `npm run build` → **PASS**, 38 modules, 303.94 kB JavaScript and 13.38 kB CSS before gzip.
- Next: add a second separately labeled evaluation case and prove its no-memory baseline remains uncontaminated.

### 2026-10-27 — Refresh-safe evidence and project handoff

- Goal: Keep the judge-facing finding, evidence, and feedback controls available after a pull-request page refresh and make the repository entry point presentation-ready.
- Implemented: `GET /api/prs/{pr_id}/reviews/latest?mode=memory|baseline`, frontend restoration of the latest completed memory review, a focused UI regression, and a product-level README with the architecture diagram and verified judge commands.
- Checks: `.\.venv\Scripts\python.exe -m pytest backend\tests -q` → **27 passed**; `npm test -- --run` → **16 passed**; `npm run build` → **PASS**, 38 modules.
- Remaining risk: in-process jobs still require reconciliation after an API-process interruption.
- Next: add interrupted-job reconciliation, then broaden uncontaminated evaluation fixtures.

### 2026-10-27 — Judge demo verification

- Goal: Restart the API on port 8000 with the evolved scene, verify health, lineage, one memory review, one Memory Lab comparison, and the UI, then record only what happened.
- API: stopped the previous listener on `127.0.0.1:8000` and started `uvicorn codedna_memory.api:app` from `backend` with `CODEDNA_DEMO_SCENE=evolved` and `CODEDNA_HINDSIGHT_AUTOSTART=1`. Vite on `127.0.0.1:5173` was already serving the current frontend and was left running.
- Health: `{"status":"ok","memory":"configured","hindsight":"ready"}`. On the server that ran the successful review, health was still `starting` about 10 seconds after process start and first reported `ready` at 91 seconds. The first boot in this session also reached `ready`; its last demo retain writes were about 65 seconds after start, and a Gemini cached-content create logged `429 RESOURCE_EXHAUSTED` (free-tier cache limit 0) before the uncached fallback.
- Policy: `DEC-0103` active, `DEC-0042` superseded, lineage in both directions. `pr-analytics-11` and active `DEC-0211` are the UTC analytics rule, not the order rule. All three memory documents were `ingestion_status: ready`.
- Live review: the first attempt, `job-532a5d17e2964592`, failed in about 1.5 seconds with `review_service_unavailable`. Cause: the shared Hindsight client was first used on the startup thread, and a later request thread hit `RuntimeError: Timeout context manager should be used inside a task`. Fix: each request opens its own client for the shared server URL. Focused pytest: `tests/test_judge_demo.py::test_shared_client_is_opened_on_the_caller_thread`, `test_warm_runtime_is_not_started_under_pytest`, and `tests/test_review_jobs.py` → **4 passed**. After restart, `job-46388a2357ac42ef` completed in 16,242 ms and cited only `DEC-0103` as `team_convention` on `src/orders/update.ts` line 14. Run timings: recall 1,612 ms, generation 10,546 ms, validation 4 ms, query 0 ms; run elapsed 12,182 ms.
- Comparison: `job-227bd332a40b4152` completed in 82,825 ms with `evaluation.passed: true` and all six checks true. Memory run elapsed 76,238 ms (generation 75,887 ms, recall 331 ms). Baseline elapsed 2,386 ms, one general finding, no citations.
- UI: the IDE browser server did not stay available, so the clicks were made in headless Chrome. Clicked Overview, Pull Requests (PR #87), Team DNA, View evolution, Memory Lab, and Analytics Service. Evidence and Dismiss were not on the PR page because that page had not started a review. Evolution initially painted `DEC-0042`'s memory document inside the current-design card; the card now shows only the active decision when the opened id is historical. `npm test -- --run src/ui.test.tsx` → **8 passed**.
- Final regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 ..\.venv\Scripts\python.exe -m pytest -q` → **27 passed**; `npm test -- --run` → **15 passed across 4 files**; `npm run build` → **PASS**, 38 modules, 303.64 kB JavaScript and 13.18 kB CSS before gzip. The in-app browser also rendered the running overview with Hindsight `Memory connected` after the managed shell's loopback probe was denied by its sandbox.
- Docs: `README.md`, `docs/DEMO.md`, `PROGRESS.md`, `ARCHITECTURE.md`.
- Next: optional reload of the latest completed review on the pull-request page.

### 2026-10-27 — Observable background review jobs

- Goal: Prevent long Hindsight/model review work from holding the initiating HTTP request open while preserving truthful progress and failure state.
- Implemented: persisted `ReviewJob`, `202` queue endpoint, job-status/result endpoint, background execution with independent DB sessions, sanitized failure codes, and frontend polling with human-readable stages.
- Backend checks: `..\.venv\Scripts\python.exe -m pytest -q` → **18 passed**.
- Frontend checks: `npm test -- --run` → **1 passed**; `npm run build` → **PASS**, 17 modules, 232.79 kB JavaScript and 7.68 kB CSS before gzip. Vitest completed in 63.57 s on this run.
- Live API check: queued `job-361fb644f39f4186` returned immediately, then completed as baseline run `review-06a7ee6cdd874e6d` in 3,359 ms with no evidence IDs and no persisted error.
- Failure test: unexpected model construction text is reduced to `review_service_unavailable`; credentials/provider payloads are not stored in job state.
- Remaining limitation: in-process FastAPI background tasks do not survive API process termination; durable external workers remain future production hardening.
- Next: apply the same observable job contract to Memory Lab comparisons.

### 2026-10-26 — Initial repository bootstrap

- Goal: Inspect supplied project context, establish truthful tracking, and prepare G1.
- Observed files: `AGENTS.md`, `PROJECT.md`, `ARCHITECTURE.md`.
- Toolchain observed: Python 3.12.0, Git 2.51.0, Node 24.14.0, npm 11.21.0.
- Missing at start: Git metadata, package/lock files, migrations, source, tests, `ROADMAP.md`, `PROGRESS.md`, Docker, and Hindsight packages.
- Checks: document and environment inspection only.
- Tests: **NOT RUN — no executable implementation exists**.
- Decision: target native Windows Hindsight/pg0 and Gemini free tier; never silently enable paid usage.
- Next: commit and push bootstrap, then add the minimal provenance-backed memory harness.

### 2026-10-27 — G1 smoke harness implementation

- Goal: Build the smallest source-validated retain/recall harness without starting the review engine or UI.
- Files: `.env.example`, `backend/pyproject.toml`, `backend/requirements.lock`, `backend/src/codedna_memory/`, `backend/tests/test_provenance.py`, `ARCHITECTURE.md`.
- Implemented: four-table provenance registry, synthetic PR #42/PR #87 data, active `DEC-0042`, stable `decision-DEC-0042`, backend-owned repository bank mapping, synchronous retain, chunk-enabled recall, fail-closed provenance resolution, document-count check, isolation operation, and sanitized JSON CLI output.
- Installed: `hindsight-api==1.1.0`, `hindsight-client==1.1.0`, `SQLAlchemy==2.0.55`, `pydantic==2.14.1`, `pytest==9.1.1` in ignored `.venv`.
- Checks: `.\\.venv\\Scripts\\python.exe -m pytest backend\\tests` → **6 passed in 0.89s** on the final pre-commit rerun.
- Checks: `.\\.venv\\Scripts\\python.exe -m compileall -q backend\\src backend\\tests` → **PASS**.
- Failure-path check: `codedna-memory-smoke recall-only` with no service → structured `service_error`, exit code 2, no fabricated success.
- Live integration: **NOT RUN — no Gemini API key is configured and no Hindsight service is running**.
- Risks: Gemini free-tier quota and actual Hindsight retain/recall relevance remain unverified.
- Next: configure the Gemini key locally and execute the complete G1 sequence.

### 2026-10-27 — Native Hindsight preflight

- Goal: Reduce runtime uncertainty without claiming a memory integration pass.
- First attempt: **FAILED** with `UnicodeEncodeError` while printing the Hindsight banner under Windows CP-1252.
- Correction: set process-local `PYTHONUTF8=1` and `PYTHONIOENCODING=utf-8`.
- Second attempt: embedded pg0 initialized; local `BAAI/bge-small-en-v1.5` embeddings and `cross-encoder/ms-marco-MiniLM-L-6-v2` reranker assets downloaded and loaded.
- Check: `Hindsight.get_version()` returned `api_version: 1.1.0`; advertised features included MCP, worker, bank config API, document export/import, LLM trace, and stored document text.
- Provider: explicitly `none`; Gemini connectivity and retain were **NOT RUN**.
- Shutdown: service launcher and child process stopped cleanly.
- Next: start the same runtime with a local Gemini key, then run the complete G1 acceptance sequence.

### 2026-10-27 — G1 real Hindsight acceptance

- Goal: Complete retain → recall → provenance validation → restart → recall → isolation → idempotent reingestion against real Hindsight.
- Runtime: official `hindsight-all==1.1.0` in-process `HindsightServer`, `hindsight-client==1.1.0`, embedded pg0, and Gemini `gemini-3.1-flash-lite`.
- Runtime decision: standalone Gemini-backed `hindsight-api` constructed the app but did not bind its HTTP listener on this Windows host; the official in-process server opened a real localhost API and became the verified G1 path.
- Check: `..\.venv\Scripts\codedna-memory-smoke.exe seed-and-recall --runtime in-process` from `backend` → **PASS**, `validated_source_resolved`, one source fact with a present chunk, source PR #42, active `DEC-0042`, exact document count 1.
- Check after process stop/restart: `..\.venv\Scripts\codedna-memory-smoke.exe recall-only --runtime in-process` → **PASS**, `persisted_source_resolved`, same fact/chunk IDs, exact document count 1, and no retain call.
- Check: `..\.venv\Scripts\codedna-memory-smoke.exe isolation-check --runtime in-process` → **PASS**, `bank_isolated`, no raw or validated results from `codedna-repo-analytics-service`.
- Check: reran `seed-and-recall` → **PASS**, exact document count remained 1 and duplicate result count remained 0.
- Check: `.\.venv\Scripts\python.exe -m pip install -e "backend[dev,service]"` → **PASS** with the pinned all-in-one runtime already satisfied.
- Check: `.\.venv\Scripts\python.exe -m pytest backend\tests` → **6 passed in 1.13s** after the final source-chunk acceptance hardening.
- Final hardened check: `recall-only --runtime in-process` → **PASS** in a fresh process with `chunk_present: true`, validated provenance, and exact document count 1.
- Provider observations: Gemini startup probe intermittently returned `503 UNAVAILABLE` for high demand. Cached-content creation returned `429 RESOURCE_EXHAUSTED` because the tested free tier has a zero cache-storage token limit; Hindsight fell back to uncached calls and all acceptance operations passed. No paid fallback was enabled.
- Security: the credential remained only in ignored `.env`; JSON evidence and tracked files contain no secret.
- Next: begin G2 with a structured, line-valid finding and independent memory-disabled baseline.

### 2026-10-27 — G2 review proof

- Goal: Turn the G1 memory into a real, line-valid structured review and compare it with an uncontaminated baseline.
- Implemented: bounded `unidiff` parser, deterministic memory query, Gemini structured-output adapter, evidence/line/category validator, persisted review tables, FastAPI contracts, and paired smoke CLI.
- Unit/contract checks: `.\.venv\Scripts\python.exe -m pytest backend\tests` → **12 passed in 2.45s**. The FastAPI contract case requires loopback access because the managed sandbox blocks Windows event-loop socketpair creation.
- Live check: `..\.venv\Scripts\codedna-review-smoke.exe` from `backend` → **PASS**.
- Memory result: one `team_convention` error on `src/orders/update.ts:18`, evidence `DEC-0042`, Hindsight fact `4d148327-566e-4f11-bfd5-207ec208d04b`, source PR #42, elapsed 6198 ms after server startup.
- Baseline result: one generic error on line 18 about the abbreviated Prisma call, no evidence IDs, no team-policy category, elapsed 2618 ms.
- Validation: no generated findings were dropped in this run; all accepted lines and evidence passed deterministic checks.
- Next: connect the G3 UI to these persisted live API results.

### 2026-10-27 — G3 live product UI

- Goal: Put the verified backend loop in a readable, judge-demonstrable product surface.
- Implemented: React 19.3.1 + TypeScript 7.0.2 + Vite 8.3.5 workspace, typed API client, responsive diff viewer, line markers, memory/baseline controls, finding cards, evidence drawer, Team DNA view, and honest loading/empty/error states.
- Frontend checks: `npm test` → **1 passed**; `npm run build` → **PASS**, 17 modules transformed, 228.53 kB JavaScript and 6.30 kB CSS before gzip.
- Live browser check: repository and PR #87 loaded from FastAPI; Team DNA showed active `DEC-0042`; memory review completed in 52.6 s; line 18 was flagged; evidence drawer showed the rule, rationale, active status, and source `pr-acme-42`.
- Dependency check: pinned versions installed with `npm audit` reporting **0 vulnerabilities**. `jsdom` was revised from 30.1.3 to 29.0.1 to match Node 24.14.0's supported engine range.
- Next: add G4 feedback and living-policy mutation without weakening authority boundaries.

### 2026-10-27 — G4 feedback and living-policy proof

- Goal: Store human review feedback without accidental policy promotion and prove an explicit new convention supersedes, rather than erases, old guidance.
- Implemented: `FeedbackEvent`, feedback API/UI actions, fail-closed policy promotion, demo-maintainer supersession service/API, PR #103 source, PR #120 candidate, stable `decision-DEC-0103` retention, and `codedna-policy-smoke`.
- Unit checks: `..\.venv\Scripts\python.exe -m pytest -q` from `backend` → **14 passed in 6.3s**. The API contract test now exercises route closures directly because repeated ASGI test transports stalled on this Windows host; live HTTP behavior remains covered by browser/API verification.
- Frontend checks before the live proof: `npm test` → **1 passed**; `npm run build` → **PASS**, 17 modules, 229.37 kB JavaScript and 6.64 kB CSS before gzip.
- First live proof: **FAILED honestly** because Gemini emitted a team-convention finding without `evidence_ids`; deterministic validation dropped it as `team_finding_missing_evidence`.
- Correction: strengthened the structured-output instruction to require exact allowlisted IDs and made partially completed retention retry-safe without relaxing the validator.
- Final live check: `..\.venv\Scripts\codedna-policy-smoke.exe` → **PASS**, exit 0. Recall returned `DEC-0103` and historical `DEC-0042`; SQLite rejected the old fact as `decision_not_authoritative`; the accepted line-31 finding cited only `DEC-0103` and source PR #103.
- Feedback observation: the recorded demo review action remained `binding: false`; direct feedback-to-policy promotion is rejected by service tests.
- Next: build and verify the controlled G5 Memory Lab and end-to-end demo path.

### 2026-10-27 — G5 controlled evaluation and runnable submission

- Goal: Prove what memory causally changes, from a resettable clean demo state, and expose the result in the product.
- Implemented: paired comparison API, deterministic evaluation module, `codedna-evaluation-smoke`, guarded `codedna-demo-reset`, Memory Lab UI, bounded Gemini `429`/`503` retry, and demo/evaluation documentation.
- Reset check: `..\.venv\Scripts\codedna-demo-reset.exe --confirm-demo-reset` → **PASS**, deleted only `codedna-repo-acme-commerce` and `codedna-repo-analytics-service`, recreated the designated SQLite schema, and reseeded both repositories.
- Reset implementation correction: the first attempt failed because the generated low-level bank-list method is async. The corrected implementation uses the installed client's synchronous `delete_bank` wrapper and catches only `NotFoundException` for idempotency.
- First clean evaluation: **FAILED honestly** when Gemini returned `503 UNAVAILABLE` on the baseline call after the memory call. The adapter now performs at most two bounded retries (2 and 4 seconds) for only `429`/`503`; no paid fallback exists.
- Clean CLI rerun: `..\.venv\Scripts\codedna-evaluation-smoke.exe` → **PASS**, 6/6 checks. Memory: one team finding, one validated source/citation (`DEC-0103`/PR #103), 78,626 ms. Baseline: one general finding, zero citations/team findings, 26,449 ms.
- Live browser check: Memory Lab on PR #120 → **PASS**, 6/6 guardrails; memory run `review-a9c2ce1f1fc74a39` showed `DEC-0103` in 4.9 s and baseline `review-215fbf1c9b5f4636` showed no memory citation in 2.3 s.
- Final regression checks: `..\.venv\Scripts\python.exe -m pytest -q` → **16 passed**; `npm test -- --run` → **1 passed**; `npm run build` → **PASS**, 17 modules, 232.28 kB JavaScript and 7.68 kB CSS before gzip.
- Scope: these are two successful executions of one synthetic policy case, not an accuracy percentage or production benchmark.
- Next: preserve the runnable demo and begin reliability-focused continuous improvements.

## Maintenance Checklist

- Review `git status` and `git diff` before every commit.
- Record exact executed commands and observed outcomes; never infer `PASS`.
- Update current state, blockers, limitations, and next action after meaningful work.
- Mark only verified roadmap items complete.
- Update `ARCHITECTURE.md` for changed components, schemas, services, or tradeoffs.
- Add `README.md` only when its setup and verification commands are tested.
