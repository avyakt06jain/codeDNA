# CodeDNA Progress

> Observed implementation state. Requirements and examples in the design documents are not evidence of working behavior.

## Current State

- Date: 2026-11-08
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
- Repository overview now shows repository-scoped queued/running review and comparison jobs with PR links and sanitized diagnostics from one read-only request; no job result polling, creation POST, or provider call is triggered.
- While rows remain active, the overview refreshes only that repository-scoped summary every five seconds and stops automatically when the response is empty, unavailable, navigated away, or unmounted.
- A single polite/atomic status now announces when previously visible active work is no longer running and directs assistive-technology users to inspect the saved result or failure; initial empty state stays silent.
- Transient overview-summary failures now retry at most three times after 1/2/4 seconds, keep existing rows visible while reconnecting, and stop without polling a job result or creating work.
- After overview-summary recovery is exhausted, an explicit `Check active work again` button starts a fresh bounded read-only cycle and disappears on success.
- Manual summary retry now restores focus to the resulting Active work heading, the overview heading for an empty result, or the recreated retry action after another failure.
- Active work now displays a localized, machine-readable `Last checked` time set only after a successful repository-summary response.
- Successful empty summaries now render a compact `No active work` card with its check time rather than leaving monitoring state implicit.
- `No active work` now offers a summary-only refresh that can discover newly queued work from another tab, focus it, and resume normal read-only monitoring.
- Repository summary timers now pause while the document is hidden and resume with one immediate read-only check when visibility returns.
- Memory Lab now reads both held-out cases from a backend-owned SQLite contract, including repository/source/candidate/active-decision metadata, latest stored guardrail results, and direct candidate-selection links.
- Evaluation-catalog reads now recover from transient failures with bounded retries and an explicit GET-only retry action that preserves keyboard position.
- A successfully loaded fixture catalog can now be refreshed through the same GET-only boundary; failed refreshes retain last-known-good case navigation.
- A completed local comparison now refreshes the fixture catalog automatically through one GET-only recovery cycle, without moving focus or creating more provider work.
- Memory Lab's persistent live region announces a selected fixture's automatic stored-result change only when its job, outcome, count, or timestamp changed; unchanged refreshes do not create a second announcement.
- The fixture catalog now displays a parseable localized `Last checked` time set only by a successful response; failed refreshes retain the previous successful observation time.
- The fixture region now exposes initial and refresh activity with `aria-busy`; refresh keeps trusted rows/check time present and uses distinct visible refreshing text.
- Exhausted catalog refreshes explicitly label retained rows as last-known-good with their successful check time; initial failures with no trusted data do not claim a fallback.
- Each fixture's latest stored result now shows its frontend-validated opaque comparison job ID for correlation with persisted background work.
- Each stored comparison update time now uses semantic `time` markup with the API client's normalized ISO UTC value while retaining localized display text.
- Each stored fixture result now states `Passed` or `Needs attention` from its validated pass Boolean beside the guardrail count.
- Automatic stored-result announcements now include the explicit outcome before the exact guardrail count.
- Repeated fixture navigation links now expose repository- and held-out-PR-specific accessible names while retaining concise visible labels.
- The selected fixture link now uses the specific `aria-current="page"` state; unselected links omit it.
- Memory Lab now enables comparison creation only after active/latest persisted recovery has finished for the exact selected PR; controlled async gates verify the barrier and the reused-work announcement without wall-clock timing.
- Review Workspace now enforces the same exact-PR recovery barrier and uses deterministic async gates for both the no-POST readiness check and reused-review announcement.
- Review Workspace now exposes the combined pull-request load and persisted recovery boundary as one named `aria-busy` region; its existing live region remains the only status announcement.
- Memory Lab now exposes comparison-control load/recovery as a named `aria-busy` region independent from the fixture catalog's existing busy state; its existing live region remains the only matching status announcement.
- Initial persisted-recovery failures now leave both run workspaces settled with task-specific alerts, truthful zero-provider-work wording, dependency-aware next steps, and usable normally gated creation controls.
- Review Workspace and Memory Lab now offer task-specific GET-only saved-recovery retries that restore persisted results after a transient failure without a creation POST.
- Manual saved-recovery retries now preserve keyboard position by focusing restored result headings, recreated retry actions after repeated failure, or the named workspace after an empty success.
- Empty successful saved-recovery retries now emit one polite task-specific outcome that confirms no persisted result was found and no provider work started; active reattachment and restored results remain distinct.
- Global Hindsight health remains current after first readiness through 30-second visible-tab checks; starting/unavailable/error states retain two-second checks, hidden tabs issue none, and visibility return reconciles immediately.
- The dependency indicator now shows a localized semantic timestamp for the latest successful health response; failed reads preserve it, while the live region contains only the controlled dependency state label.
- Application-health request failures now preserve the last successful health payload/time but set an explicit read-failure state, force memory work unavailable, and display `Memory status unknown`; a successful response that reports Hindsight unavailable remains separately labeled `Memory unavailable`.
- Consecutive application-health request failures now back off at 2/4/8/16/30 seconds with a 30-second cap; success resets the sequence, while visibility return still triggers an immediate read-only reconciliation.
- An unknown memory state now offers `Check health again`; the single-flight read cancels pending backoff, disables its control while pending, and returns focus to the persistent result status without starting provider work.
- Application-health reads now abort after 10 seconds; timeout enters the same unknown/backoff state, releases the single-flight/manual retry guard, preserves prior successful evidence, and cleanup aborts an outstanding read.
- Read-only review/comparison status, active-job discovery, latest-result recovery, and repository active-summary requests now abort after 10 seconds. Status timeout enters the existing transient reconnect loop for the same locator; saved recovery remains actionable and issues no POST.
- Review and comparison creation responses now time out after 10 seconds without replay: three bounded active-claim GETs reattach a visible backend job, while an unresolved claim clears exact-PR readiness and disables another creation attempt until reconciliation.
- Unresolved creation uncertainty now exposes an exact-PR/kind `Check creation status` action. It checks active work and then the latest persisted result through GET only, keeps creation disabled after read failure, and restores deterministic keyboard focus after resolution.
- Review Workspace now labels latest-result recovery as `Latest saved review restored` across initial load, manual creation-status reconciliation, and missing-job fallback; only a job completion observed through polling says `Review complete`.
- Review Workspace and Memory Lab now display bounded normalized persisted review run IDs in their result summaries. Invalid/overlong IDs are omitted, and the identifiers remain outside live regions and authorization decisions.
- Memory Lab now rejects optional evaluation-level run-ID metadata unless each present ID is valid and matches its nested memory/baseline run. An active completed job with contradictory metadata surfaces a terminal missing-result error and renders no guardrails or misleading ID.
- Memory Lab latest-result recovery now treats only an explicit null comparison as empty. A present result that fails correlation validation surfaces a task-specific integrity alert; manual creation-status reconciliation remains fail-closed, focused, and GET-only.
- Review Workspace latest-result recovery now treats only an explicit null review as empty. A present result must be an object with a valid bounded run ID; otherwise initial/manual recovery surfaces a task-specific integrity alert and renders no findings.
- Completed active-review jobs now pass the same bounded run-ID integrity check. Failure is terminal, clears the active locator, renders no findings, and performs no latest-result fallback or replacement POST.

## In Progress

- Post-MVP trust hardening continues by requiring valid nested run IDs on every Memory Lab comparison, including payloads without optional evaluation-level correlation metadata.

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

Require both nested memory and baseline reviews in every comparison to carry valid bounded run IDs, even when `evaluation.run_ids` is absent. Reject invalid latest and active-job results without rendering guardrails or starting replacement work.

## Session Log

### 2026-11-08 — Active-review correlation integrity

- Goal: Prevent a completed background review job from rendering findings that cannot be correlated to a valid persisted review run.
- Implemented: `api.reviewJob` now normalizes a completed review and requires its `run_id` to pass the bounded correlation grammar. Failure raises `TerminalJobError`, so Review Workspace renders the explicit integrity error, clears the active session locator and diagnostics, and never falls back to the latest-result endpoint or creates replacement work. The HTTP fixture now supports an independently malformed completed review payload.
- Focused check: `npm test -- --run src/ui.test.tsx -t "active job result without a valid review correlation"` → **1 passed, 67 skipped**. The regression verifies one active-job GET, zero latest-result GETs, zero POSTs, no findings, and locator cleanup.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **86 passed across 5 files**; `npm run build` → **PASS**, 40 modules, 332.03 kB JavaScript and 16.43 kB CSS before gzip.
- Live app: API health returned `ok`, Hindsight truthfully remained `unavailable`, and Review Workspace returned HTTP 200 after Vite hot reload.
- Provider safety: this is a deterministic client trust-boundary check on an existing job response. It adds no request and starts no Hindsight/Gemini or paid usage.
- Next: require valid nested memory and baseline run IDs for every comparison payload, even when optional evaluation correlation metadata is absent.

### 2026-11-08 — Truthful invalid-review recovery

- Goal: Prevent a malformed persisted latest review from appearing as usable findings without an inspectable run correlation ID.
- Implemented: `api.latestReview` now returns `null` only for an explicit null review. A non-null value must be an object whose normalized `run_id` passes the bounded grammar; otherwise `InvalidReviewResultError` enters the existing task-specific recovery alert. Initial recovery offers the GET-only saved-recovery retry. Manual creation-status reconciliation remains uncertain, keeps creation disabled, and refocuses `Check creation status`. Neither path renders findings.
- Focused checks: `npm test -- --run src/ui.test.tsx -t "invalid stored review"` → **2 passed, 65 skipped**. The cases assert one latest-result GET and zero POSTs on initial recovery, plus exactly one original creation POST and two latest-result GETs during manual reconciliation.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **85 passed across 5 files**; `npm run build` → **PASS**, 40 modules, 331.94 kB JavaScript and 16.43 kB CSS before gzip.
- Live app: API health returned `ok`, Hindsight truthfully remained `unavailable`, and Review Workspace returned HTTP 200 after Vite hot reload.
- Provider safety: the slice validates an existing application response in the browser, adds no request, and starts no Hindsight/Gemini or paid usage.
- Next: reject malformed review correlation IDs at the completed active-job boundary too.

### 2026-11-08 — Truthful invalid-comparison recovery

- Goal: Keep a corrupt persisted comparison distinguishable from a legitimate no-result response across every latest-result recovery boundary.
- Implemented: `api.latestComparison` now returns `null` only for an explicit null comparison. A non-null payload rejected by structural/run-correlation normalization throws `InvalidComparisonResultError`. Initial recovery renders the existing actionable saved-recovery alert; manual creation-status reconciliation remains uncertain, keeps creation disabled, and refocuses `Check creation status`. Neither path renders guardrails or starts replacement work.
- Focused checks: the first command used the repository-relative path from inside `frontend` and failed with `No test files found`; corrected command `npm test -- --run src/ui.test.tsx -t "invalid stored comparison"` → **2 passed, 63 skipped**. The cases assert one latest-result GET and zero POSTs on initial recovery, plus exactly one original creation POST and two latest-result GETs during manual reconciliation.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **83 passed across 5 files**; `npm run build` → **PASS**, 40 modules, 331.73 kB JavaScript and 16.43 kB CSS before gzip.
- Live app: the previous listeners were absent, so the API and Vite were restarted as hidden local processes with Hindsight autostart disabled. API health returned `ok`, Hindsight truthfully reported `unavailable`, and Memory Lab returned HTTP 200.
- Provider safety: the implementation validates an existing application response in the browser. Tests and live startup used no Hindsight/Gemini request and enabled no paid service.
- Next: apply the same absent-versus-invalid integrity boundary to persisted latest reviews.

### 2026-11-07 — Comparison run-ID correlation integrity

- Goal: Prevent Memory Lab from presenting evaluation correlation metadata that contradicts the two persisted runs it summarizes.
- Implemented: comparison normalization now treats optional `evaluation.run_ids` as a consistency check. Every present memory/baseline ID must pass the bounded run-ID grammar and exactly match the corresponding normalized nested review. Absent metadata remains valid; malformed containers, invalid IDs, and mismatches reject the comparison. A completed job with rejected metadata follows the existing terminal missing-result path and renders no guardrails or contradictory ID.
- Focused checks: `npm test -- --run src/text.test.ts src/ui.test.tsx -t "comparison run correlation|evaluation run IDs contradict"` → **2 passed, 71 skipped across 2 files**. Unit cases cover valid, absent, malformed, invalid, and mismatched metadata; the product case verifies a terminal alert and no misleading result rendering.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **81 passed across 5 files**; `npm run build` → **PASS**, 40 modules, 331.58 kB JavaScript and 16.43 kB CSS before gzip.
- Live app: API health remained `ok`, Hindsight truthfully remained `unavailable`, and Memory Lab returned HTTP 200 after Vite hot reload.
- Provider safety: validation occurs entirely in the browser against an existing response and adds no request, provider call, or paid usage.
- Next: make invalid persisted latest-comparison payloads visibly distinct from a legitimate no-result response.

### 2026-11-07 — Inspectable bounded review run IDs

- Goal: Let judges correlate visible Review Workspace and Memory Lab results with persisted API runs without rendering unbounded server strings.
- Implemented: added a shared run-ID normalizer accepting only bounded `review-...` or `run-...` identifiers. Review payloads and optional comparison evaluation metadata use it. Review Workspace renders the accepted ID in its run summary; each Memory Lab column renders its own accepted ID. Invalid IDs are omitted, code text wraps safely, and the values remain outside live regions.
- Focused checks: `npm test -- --run src/text.test.ts src/ui.test.tsx -t "bounded review run identifiers|design mismatch and a general|memory-lab trace"` → **3 passed, 68 skipped across 2 files**. Coverage includes valid, markup-like, and overlong normalization plus both product surfaces.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **79 passed across 5 files**; `npm run build` → **PASS**, 40 modules, 331.39 kB JavaScript and 16.43 kB CSS before gzip.
- Live app: API health remained `ok`, Hindsight truthfully remained `unavailable`, and Review Workspace plus Memory Lab each returned HTTP 200 after Vite hot reload.
- Provider safety: this slice only validates and renders identifiers already present in application responses. It adds no HTTP request, Hindsight/Gemini call, or paid usage.
- Next: fail closed when optional evaluation-level run-ID correlation disagrees with the two nested comparison runs.

### 2026-11-07 — Truthful restored-review stage

- Goal: Stop presenting a persisted Review Workspace result as though a new review had just completed.
- Implemented: added the controlled frontend stage `review_restored` with label `Latest saved review restored`. Initial latest-result load, manual creation-status latest-result recovery, and missing-active-job fallback now use it. Results that complete through active job polling still use `Review complete`. The persistent polite live region remains the single matching status announcement.
- Focused checks: `npm test -- --run src/text.test.ts src/ui.test.tsx -t "restored|restores the latest memory|clears a missing active review"` → **3 passed, 67 skipped** across one executed and one filter-skipped file. Assertions cover initial recovery, manual creation-status recovery, missing-job fallback, visible text, and one exact live-region announcement.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **78 passed across 5 files**; `npm run build` → **PASS**, 40 modules, 331.08 kB JavaScript and 16.36 kB CSS before gzip.
- Live app: API health remained `ok`, Hindsight truthfully remained `unavailable`, and Review Workspace returned HTTP 200 after Vite hot reload.
- Provider safety: this is display-only state derived from existing persisted-result GETs; it sends no additional request and starts no provider work.
- Next: expose sanitized persisted run IDs in both product result summaries, matching the Memory Lab feature contract.

### 2026-11-07 — Creation-status completed-result restoration coverage

- Goal: Verify that manual reconciliation restores backend work that completed after the creation response was lost but before an active claim could be observed.
- Implemented: the frontend HTTP fixture can delay latest review/comparison visibility until the second latest-result read. Two regressions drive one ambiguous creation POST, confirm five exact-kind active reads remain empty, then restore the completed result through the manual latest-result fallback. Review findings and comparison guardrails receive focus; neither path polls a job endpoint or sends a replacement POST.
- Focused checks: `npm test -- --run src/ui.test.tsx -t "completed review found during manual|completed comparison found during manual"` → **2 passed, 60 skipped**.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **78 passed across 5 files**; `npm run build` → **PASS**, 40 modules, 331.01 kB JavaScript and 16.36 kB CSS before gzip.
- Live app: API health remained `ok`, Hindsight truthfully remained `unavailable`, and Review Workspace plus Memory Lab each returned HTTP 200 after frontend hot reload.
- Provider safety: both cases are deterministic frontend fixtures and exercise application GET contracts only after the single simulated creation request. No Hindsight/Gemini runtime or paid usage is involved.
- Next: distinguish restored Review Workspace results from newly completed reviews in visible and live-region wording.

### 2026-11-07 — Creation-status late-claim and outage coverage

- Goal: Prove the manual creation-status boundary remains safe when backend state changes late or the status read itself fails.
- Implemented: deterministic Review Workspace and Memory Lab fixtures can expose an active claim only on the explicit fifth active read or fail that exact read. Four component regressions cover both tasks. Late claims reattach and complete after one creation POST without consulting latest-result fallback; status-read failures keep creation disabled, recreate/focus `Check creation status`, and do not issue a latest-result read.
- Focused checks: `npm test -- --run src/ui.test.tsx -t "manual creation-status|creation status read fails"` → **4 passed, 56 skipped**.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **76 passed across 5 files**; `npm run build` → **PASS**, 40 modules, 331.01 kB JavaScript and 16.36 kB CSS before gzip.
- Live app: API health remained `ok`, Hindsight truthfully remained `unavailable`, and Review Workspace plus Memory Lab each returned HTTP 200 after frontend hot reload.
- Provider safety: all new cases use frontend HTTP fixtures and assert one creation POST total. They do not start Hindsight, Gemini, or the local provider runtime.
- Next: cover completed-result restoration discovered by the same manual GET-only boundary.

### 2026-11-07 — Explicit creation-status reconciliation

- Goal: Resolve a lost creation response without requiring a page reload or risking another provider request.
- Implemented: Review Workspace and Memory Lab now expose `Check creation status` only for an unresolved creation outcome. The action reruns the existing bounded same-PR/kind active lookup and latest-result fallback through GET only. It reattaches visible work, restores completed work, or truthfully reports an empty boundary and reenables the explicit run control; read failure keeps the control disabled. Manual resolution focuses the restored result, named workspace, or recreated check action.
- Focused checks: `npm test -- --run src/ui.test.tsx -t "lost review creation|lost comparison creation"` → **2 passed, 54 skipped**. Both cases prove one timed-out creation POST, three automatic claim reads, one explicit active/latest reconciliation, no replacement POST, reenabled creation after a successful empty boundary, and focus on the named workspace.
- Build: `npm run build` → **PASS**, 40 modules, 330.95 kB JavaScript and 16.36 kB CSS before gzip.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **72 passed across 5 files**; `npm run build` → **PASS**, 40 modules, 331.01 kB JavaScript and 16.36 kB CSS before gzip.
- Live app: the prior local listeners were no longer running, so the API and Vite were restarted with provider autostart disabled. API health returned `ok`, Hindsight truthfully remained `unavailable`, and Review Workspace plus Memory Lab each returned HTTP 200.
- Provider safety: the manual action calls only application-owned status/result GETs. It cannot start Hindsight, Gemini, a review, or either comparison branch.
- Next: cover a failed manual status read and a claim that appears during that manual boundary in both workspaces.

### 2026-11-07 — Ambiguity-safe creation response recovery

- Goal: Bound a lost or hung creation response without risking a duplicate review/comparison POST or provider call.
- Implemented: review and comparison creation responses abort after 10 seconds, then perform three short GET-only same-PR/same-kind active-claim checks. A visible claim is returned as reattached work and normal same-ID polling continues. If no claim is visible, a dedicated uncertainty error clears the page's exact-PR readiness marker, disables creation, and instructs the user to reload for reconciliation; the client never automatically replays the POST.
- Focused checks: `npm test -- --run src/ui.test.tsx -t "lost review-creation|lost creation response"` → **2 passed, 53 skipped**. Tests prove a lost response with a committed claim completes after exactly one POST and one reconciliation read beyond initial recovery; the no-claim case performs exactly one POST plus three reconciliation reads, displays the truthful uncertainty, and leaves creation disabled.
- Build: `npm run build` → **PASS**, 40 modules, 330.05 kB JavaScript and 16.36 kB CSS before gzip.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **71 passed across 5 files**; `npm run build` → **PASS**, 40 modules, 330.05 kB JavaScript and 16.36 kB CSS before gzip.
- Live app: after Vite hot reload, the existing API returned `ok`, Hindsight truthfully remained `unavailable`, and Review Workspace returned HTTP 200.
- Provider safety: reconciliation reads application-owned SQLite job state only. No timeout path issues a second creation request, starts a second provider branch, or treats absence during an outage as proof that no backend work exists.
- Next: replace the reload requirement with an explicit GET-only creation-status reconciliation action.

### 2026-11-07 — Bounded background-job read lifetime

- Goal: Prevent a hung job-status or saved-recovery GET from stranding observable work while preserving the atomic creation boundary.
- Implemented: job status, same-PR active discovery, latest completed review/comparison recovery, and repository active-work summary now use a shared 10-second abortable read boundary. Status timeout is classified as transient and reconnects to the unchanged job ID with existing 1/2/4-second recovery; initial saved recovery surfaces its existing GET-only actionable error. Job-creation POSTs are intentionally unchanged and never automatically replayed.
- Focused checks: `npm test -- --run src/ui.test.tsx -t "timed-out active review|hung saved-review|reattaches to an active review"` → **3 passed, 50 skipped**. The new cases prove one hung status GET aborts then completes through exactly one same-ID retry, and one hung active-discovery GET becomes an actionable saved-recovery error; both issue zero POSTs.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **69 passed across 5 files**; `npm run build` → **PASS**, 40 modules, 329.27 kB JavaScript and 16.36 kB CSS before gzip.
- Live app: after Vite hot reload, the existing API returned `ok`, Hindsight truthfully remained `unavailable`, and the overview returned HTTP 200.
- Provider safety: abort/retry applies only to application read contracts. It neither cancels backend provider work nor creates a replacement review/comparison.
- Next: reconcile an ambiguous creation response through active-job discovery before allowing any new POST.

### 2026-11-07 — Bounded application-health request lifetime

- Goal: Prevent an application-health fetch that never settles from permanently holding the global observer's single-flight guard and manual recovery control.
- Implemented: each health GET receives its own abort signal and a 10-second browser timeout. Abort follows the existing application-health failure path, retains last-known-good state, releases `healthChecking`, schedules normal backoff, and permits `Check health again`; provider cleanup aborts any outstanding request on unmount.
- Focused checks: `npm test -- --run src/workspace.test.tsx` → **5 passed**. The new deterministic fake-timer case proves no early timeout at 9,999 ms, abort/fail-closed transition at 10,000 ms, guard release, and successful manual recovery through a second GET.
- Regression correction: the first final frontend run **FAILED 1/67** because an existing overview assertion synchronously queried the independently loaded empty active-work region. Changing that assertion to await the region's documented asynchronous read boundary fixed the test without altering product behavior; the exact rerun passed.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; final `npm test -- --run` → **67 passed across 5 files**; final `npm run build` → **PASS**, 40 modules, 329.03 kB JavaScript and 16.36 kB CSS before gzip.
- Live app: after Vite hot reload, the existing API returned `ok`, Hindsight truthfully remained `unavailable`, and the overview returned HTTP 200.
- Provider safety: aborting a browser request neither starts nor retries Hindsight/Gemini work. The health endpoint remains a read-only application-state contract.
- Next: bound hung read-only background-job status/recovery GETs without automatically replaying job creation.

### 2026-11-07 — Manual application-health reconciliation

- Goal: Let a judge or keyboard user reconcile an unknown memory state immediately instead of waiting through automatic backoff.
- Implemented: the workspace exposes its existing health observer through a single-flight manual action. The shell renders `Check health again` only after an application-health read failure, disables and relabels it while pending, cancels the scheduled backoff read, and focuses the persistent memory status after success or failure.
- Focused checks: `npm test -- --run src/workspace.test.tsx src/ui.test.tsx -t "health|Hindsight first becomes ready|pauses health"` → **8 passed, 47 skipped**; dedicated manual recovery coverage verifies two total health GETs, disabled duplicate activation, successful recovery, and deterministic focus restoration.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **66 passed across 5 files**; `npm run build` → **PASS**, 40 modules, 328.87 kB JavaScript and 16.36 kB CSS before gzip.
- Live app: after Vite hot reload, the existing API returned `ok`, Hindsight truthfully remained `unavailable`, and the overview returned HTTP 200.
- Provider safety: manual reconciliation calls only the existing application `GET /api/health` contract. It does not start or probe Hindsight directly, call Gemini, submit jobs, or enable paid usage.
- Next: bound a health fetch that never settles so the single-flight observer always becomes recoverable.

### 2026-11-07 — Bounded application-health failure recovery

- Goal: Avoid indefinite two-second traffic while the application health endpoint is unreachable without weakening conservative memory gating or visibility recovery.
- Implemented: consecutive request failures now retry after 2/4/8/16/30 seconds and remain capped at 30 seconds. Any successful health response resets the failure count; a visibility return still cancels the pending timer and performs one immediate read-only reconciliation.
- Focused checks: `npm test -- --run src/workspace.test.tsx` → **4 passed**. Tests verify increasing delays, the 30-second cap, reset after a successful unavailable response, preservation of the fail-closed state, and existing hidden/visible behavior.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **66 passed across 5 files**; `npm run build` → **PASS**, 40 modules, 328.34 kB JavaScript and 16.10 kB CSS before gzip.
- Live app: after Vite hot reload, the existing API returned `ok`, Hindsight truthfully remained `unavailable`, and the overview returned HTTP 200.
- Provider safety: the schedule applies only to `GET /api/health`; it does not start Hindsight, call Gemini, create jobs, or enable paid usage.
- Next: expose a keyboard-accessible read-only retry action when the application-health read is failing.

### 2026-11-07 — Distinct application-health failure state

- Goal: Distinguish inability to read application health from a successful health response that confirms Hindsight is unavailable, without allowing stale readiness to enable memory work.
- Implemented: the workspace keeps the last successful health payload and observation time, records request failure independently, and derives an unavailable effective memory state whenever that read fails. The shell announces `Memory status unknown` plus the failed-current-check detail for application/API failures; a successful response with unavailable Hindsight remains `Memory unavailable`.
- Focused checks: `npm test -- --run src/workspace.test.tsx src/ui.test.tsx` → **53 passed across 2 files**. Coverage proves a ready cached payload cannot keep memory enabled after a failed read, the successful timestamp is preserved, successful unavailable responses remain distinct, and successful reconciliation clears read failure.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **64 passed across 5 files**; `npm run build` → **PASS**, 40 modules, 328.29 kB JavaScript and 16.10 kB CSS before gzip.
- Live app: after Vite hot reload, the existing API returned `ok`, Hindsight truthfully remained `unavailable`, and the overview returned HTTP 200.
- Provider safety: this changes only interpretation of the existing read-only application-health request. It starts no Hindsight process, Gemini call, review job, or paid usage.
- Next: add bounded backoff for consecutive application-health transport failures while preserving visibility-return reconciliation.

### 2026-11-06 — Inspectable dependency health freshness

- Goal: Let judges distinguish current Hindsight state from an older successful browser observation without adding a provider probe or noisy accessibility announcements.
- Implemented: every successful `/api/health` response records an ISO browser observation time; the shell renders it as localized semantic `time` next to the Hindsight indicator. Failed reads retain the previous successful timestamp. The status role now wraps only the controlled dependency label, leaving the frequently changing timestamp outside the polite live region.
- Focused checks: `npm test -- --run src/workspace.test.tsx src/ui.test.tsx -t "health|Hindsight first becomes ready|pauses health"` → **4 passed, 47 skipped**. Tests prove a failed read preserves the timestamp, a later successful visible reconciliation advances it, and the rendered semantic time is not inside the live status element.
- Build correction: the first `npm run build` **FAILED** because the component assertion's optional `querySelector` result was not narrowed before `contains`. An explicit fail-fast guard corrected only the test typing; the final build passed.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **62 passed across 5 files**; `npm run build` → **PASS**, 40 modules, 328.13 kB JavaScript and 16.10 kB CSS before gzip.
- Live app: the existing API and Vite listeners remained healthy after hot reload; API returned `ok`, the overview returned HTTP 200, and Hindsight truthfully remained `unavailable` without provider autostart.
- Provider safety: this slice only annotates already scheduled application-health responses; it adds no request, provider startup, Gemini call, job creation, or paid usage.
- Next: distinguish health transport failure from a successful unavailable dependency report while keeping both fail-closed.

### 2026-11-06 — Continuous visible-tab Hindsight health

- Goal: Prevent a browser that once observed `ready` from displaying stale connected state after the local dependency later becomes unavailable.
- Implemented: the workspace health observer now continues read-only checks every 30 seconds after readiness, keeps the existing two-second cadence for starting/unavailable/error states, allows only one in-flight request, cancels timers while hidden, reconciles immediately on visibility return, and removes timer/listener state on unmount.
- Focused checks: the first `npm test -- --run src/workspace.test.tsx` **FAILED 2/2** because fake timers also paused Testing Library's polling helper. Replacing those waits with explicit React microtask flushing produced **2 passed** and verified ready-to-unavailable transition, zero hidden checks, and one immediate visible reconciliation.
- Regression correction: the first full frontend run **FAILED 1/61** when comparison recovery rendered its result before the passive focus effect reliably committed focus. The focused rerun reproduced it. Moving the existing saved-recovery focus lifecycle to a layout effect made the render/focus boundary deterministic; its focused rerun passed and the final full suite passed.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **61 passed across 5 files**; `npm run build` → **PASS**, 40 modules, 327.85 kB JavaScript and 16.10 kB CSS before gzip.
- Live app: the existing API and Vite listeners remained healthy after hot reload; API returned `ok`, the browser route returned HTTP 200, and Hindsight truthfully remained `unavailable` without provider autostart.
- Provider safety: the browser calls only the existing application health endpoint. The endpoint reports API-owned state; these checks do not start Hindsight, call Gemini, create jobs, or enable paid usage.
- Next: expose the latest successful health observation time beside the dependency indicator.

### 2026-11-06 — Explicit empty saved-recovery outcome

- Goal: Make a successful manual recovery with no active or persisted work understandable without turning a normal empty state into an error.
- Implemented: Review Workspace and Memory Lab now use their existing polite/atomic live region to announce an exact task-specific empty outcome after manual saved-recovery success. Each message confirms that no provider work started; active-job reattachment and persisted-result restoration do not emit it. The message clears before new work and on PR/selection recovery changes, while keyboard focus remains on the named workspace.
- Initial focused check: `npm test -- --run src/ui.test.tsx -t "announces an empty saved"` **FAILED 2/2** because the assertions assumed the page's live region was the only status element, but the shell intentionally also exposes memory health as status. The assertions were narrowed to the status element with the exact completion text; the rerun **passed 2/2**.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **59 passed across 4 files**; `npm run build` → **PASS**, 40 modules, 327.61 kB JavaScript and 16.10 kB CSS before gzip.
- Live app: the existing local API and Vite listeners remained healthy; API returned `ok`, Hindsight truthfully remained `unavailable`, and both updated routes returned HTTP 200.
- Provider safety: this slice adds only local state, one existing live-region message, and deterministic mocked regressions. It issues zero creation POSTs and no Hindsight, Gemini, or paid request.
- Next: keep a once-ready Hindsight health indicator current through low-frequency visible-tab checks.

### 2026-11-06 — Saved-recovery retry focus

- Goal: Keep keyboard users anchored when a task-specific saved-recovery retry removes its initiating control.
- Implemented: Review Workspace now focuses `Review findings` after a restored result, and Memory Lab focuses `Guardrails`; repeated failures focus the recreated task-specific retry button. A successful empty read focuses the named workspace, and route/selection changes cancel pending focus intent.
- Initial focused check: the first `npm test -- --run src/ui.test.tsx -t "actionable.*recovery fails|retries saved.*recovery"` run **FAILED 1/4** because deferred animation-frame focus remained on the document body after review restoration. Applying focus directly once the recovery boundary settled corrected the behavior; the rerun **passed 4/4**.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **57 passed across 4 files**; `npm run build` → **PASS**, 40 modules, 327.26 kB JavaScript and 16.10 kB CSS before gzip.
- Live app: the prior listeners were absent, so API and Vite were restarted in hidden local processes with `CODEDNA_DEMO_SCENE=evolved` and `CODEDNA_HINDSIGHT_AUTOSTART=0`. Health returned `ok`, Hindsight truthfully remained `unavailable`, and both updated routes returned HTTP 200.
- Provider safety: focus restoration changes only client state and DOM focus; it adds no API, Hindsight, Gemini, or paid request.
- Next: announce a successful manual recovery that finds no persisted result so the workspace fallback has an explicit outcome.

### 2026-11-06 — GET-only saved-recovery retry

- Goal: Let users recheck persisted review/comparison work after a transient initial recovery failure before choosing a creation POST.
- Implemented: task-specific `Retry saved review recovery` and `Retry saved comparison recovery` actions rerun the existing exact-PR active/latest recovery effects; Review Workspace also reloads its PR record, while Memory Lab preserves its independently loaded repository PR list. The failure state clears during the retry; success removes the alert/action and restores the saved result. Starting new work also clears stale recovery-failure UI.
- Focused checks: `npm test -- --run src/ui.test.tsx -t "retries saved.*recovery"` → **2 passed, 44 skipped**; `npm run build` → **PASS**, 40 modules, 326.57 kB JavaScript and 16.10 kB CSS before gzip. Each test injects one active-job GET failure, retries successfully, restores the latest result, verifies two active reads plus one latest read, and proves zero POSTs.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **57 passed across 4 files**; `npm run build` → **PASS**, 40 modules, 326.57 kB JavaScript and 16.10 kB CSS before gzip.
- Live app: API health returned `ok`, Hindsight remained truthfully `unavailable`, and both retry-enabled workspaces returned HTTP 200 after Vite hot reload.
- Provider safety: the retry invokes only existing PR/active/latest GET contracts and cannot start Hindsight/Gemini or paid usage.
- Next: restore keyboard focus deterministically after retry success or repeated failure.

### 2026-11-06 — Actionable initial recovery failures

- Goal: Ensure a cleared busy state never leaves an ambiguous generic error after saved review/comparison recovery fails.
- Implemented: Review Workspace and Memory Lab now name the failed recovery operation, include the sanitized server detail, explicitly state that recovery started no review/comparison provider work, and point to the run control's dependency precondition. Each exact-PR busy state clears and the normal creation control becomes usable when its existing Hindsight rule allows.
- Focused checks: `npm test -- --run src/ui.test.tsx -t "actionable.*recovery fails"` → **2 passed, 42 skipped**; `npm run build` → **PASS**, 40 modules, 326.14 kB JavaScript and 16.10 kB CSS before gzip. Tests inject active-job GET failures and verify task-specific alerts, cleared busy state, enabled controls, and zero POSTs.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **55 passed across 4 files**; `npm run build` → **PASS**, 40 modules, 326.14 kB JavaScript and 16.10 kB CSS before gzip.
- Live app: API health returned `ok`, Hindsight remained truthfully `unavailable`, and both Review Workspace and Memory Lab returned HTTP 200 after Vite hot reload.
- Provider safety: failures and assertions are deterministic frontend mocks; no external request, paid usage, or fabricated Hindsight result was introduced.
- Next: provide GET-only recovery retry actions so a user can recheck persisted work before choosing creation.

### 2026-11-06 — Memory Lab comparison busy-region semantics

- Goal: Expose Memory Lab's comparison-control readiness without conflating it with the independently loaded fixture catalog.
- Implemented: a named `Comparison workspace` region now carries `aria-busy=true` during pull-request loading or persisted comparison recovery and clears when that exact-PR boundary settles. The fixture catalog keeps its own separate `aria-busy`; visible loading/restoration notes and the single polite/atomic live status remain unchanged.
- Focused checks: `npm test -- --run src/ui.test.tsx -t "comparison creation disabled"` → **1 passed, 41 skipped**; `npm run build` → **PASS**, 40 modules, 325.83 kB JavaScript and 16.10 kB CSS before gzip. The test holds latest-result recovery open and verifies comparison-region busy state, one matching status announcement, disabled creation, zero POSTs, and final readiness.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **53 passed across 4 files**; `npm run build` → **PASS**, 40 modules, 325.83 kB JavaScript and 16.10 kB CSS before gzip.
- Live app: the prior listeners were absent, so the API and Vite were restarted in hidden local processes with `CODEDNA_DEMO_SCENE=evolved` and `CODEDNA_HINDSIGHT_AUTOSTART=0`. Health returned `ok`, Hindsight truthfully remained `unavailable`, the catalog returned two cases, and Memory Lab returned HTTP 200.
- Provider safety: this is semantic presentation over existing GET-only recovery; it adds no request, model call, or paid usage.
- Next: audit recovery failures after busy state clears so each workspace leaves a clear task-specific next action.

### 2026-11-06 — Review Workspace busy-region semantics

- Goal: Make Review Workspace's control-readiness boundary explicit to visual and assistive-technology users without adding duplicate announcements.
- Implemented: the named `Review workspace` region now exposes `aria-busy=true` throughout the combined pull-request load and active/latest persisted recovery, then clears only when that boundary settles. The existing visible loading note and single polite/atomic live status remain unchanged.
- Focused check: `npm test -- --run src/ui.test.tsx -t "review creation disabled"` → **1 passed, 41 skipped**. The test holds recovery open, verifies the busy region, disabled creation, visible loading state, exactly one matching status announcement, zero POSTs, and the final ready state.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **53 passed across 4 files**; `npm run build` → **PASS**, 40 modules, 325.74 kB JavaScript and 16.10 kB CSS before gzip.
- Live app: API health returned `ok`, Hindsight remained truthfully `unavailable`, and Review Workspace returned HTTP 200 after Vite hot reload.
- Provider safety: the change is semantic presentation over the existing GET-only recovery boundary; it adds no request and no Hindsight/Gemini work.
- Next: give Memory Lab's comparison controls an equivalent busy region while keeping fixture-catalog activity separate.

### 2026-11-06 — Review recovery start barrier

- Goal: Close the Review Workspace control-readiness gap with the same exact-PR recovery invariant already verified in Memory Lab.
- Implemented: Review Workspace clears its recovered-PR marker on route change and enables `Run CodeDNA Review` only after pull-request loading plus active/latest persisted recovery complete for that exact PR. Recovery remains GET-only and cannot start Hindsight/Gemini work.
- Test hardening: the reused-review announcement now uses a controlled status-poll gate instead of a 100 ms timer, and a new latest-review gate proves the run control remains disabled with zero POSTs until recovery finishes.
- Focused checks: `npm test -- --run src/ui.test.tsx -t "starting a review reuses|review creation disabled"` → **2 passed, 40 skipped**; `npm run build` → **PASS**, 40 modules, 325.68 kB JavaScript and 16.10 kB CSS before gzip.
- Regression finding: the first full frontend run **FAILED 1/53** because an older Memory Lab trace test clicked while its newly enforced recovery barrier still disabled the control. Waiting for the enabled state corrected the test without changing production behavior.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; two consecutive `npm test -- --run` executions → **53 passed across 4 files** each; final `npm run build` → **PASS**, 40 modules, 325.68 kB JavaScript and 16.10 kB CSS before gzip.
- Live app: API health returned `ok`, Hindsight remained truthfully `unavailable`, the evaluation catalog returned two cases, and Review Workspace returned HTTP 200 after Vite hot reload.
- Provider safety: all new tests use mocked GET recovery and issue no external provider request; no paid service was enabled and no Hindsight result was fabricated.
- Next: make the combined Review Workspace load/recovery state explicit as one nonduplicative busy region.

### 2026-11-06 — Comparison recovery start barrier

- Goal: Make reused-comparison announcements deterministic while preserving the guarantee that recovery cannot race a new comparison start.
- Initial finding: replacing the test's 500 ms delay with a controlled polling gate first **FAILED** because the run control could briefly enable before selected-PR recovery began; a fast click was then followed by recovery resetting the active stage. This exposed a production race rather than only a flaky test.
- Implemented: Memory Lab now tracks the PR whose persisted active/latest recovery has completed and keeps `Run comparison` disabled until it matches the selected PR. Reattachment and latest-result recovery remain GET-only and start no Hindsight/Gemini work.
- Test hardening: the reused-work regression now controls completion with an explicit promise gate, and a new regression holds latest-result recovery open to prove the run control stays disabled and issues zero POSTs.
- Focused checks: `npm test -- --run src/ui.test.tsx -t "reuses existing provider work|persisted recovery completes"` → **3 passed, 38 skipped**; `npm run build` → **PASS**, 40 modules, 325.64 kB JavaScript and 16.10 kB CSS before gzip.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; two consecutive `npm test -- --run` executions → **52 passed across 4 files** each; final `npm run build` → **PASS**, 40 modules, 325.64 kB JavaScript and 16.10 kB CSS before gzip.
- Live app: API health returned `ok`, Hindsight remained truthfully `unavailable`, the evaluation catalog returned two cases, and Memory Lab returned HTTP 200 after Vite hot reload.
- Provider safety: all new coverage uses mocked GET recovery and issues no external provider request; paid usage remains disabled and Hindsight results were not fabricated.
- Next: audit Review Workspace for the analogous ordering risk before changing its control contract.

### 2026-11-06 — Specific selected-fixture semantics

- Goal: Expose the selected fixture link as the current page rather than as an unspecified current item.
- Implemented: the active case link now sets `aria-current="page"`; inactive fixture links omit the attribute, and the repository/held-out-PR-specific accessible name remains unchanged.
- Focused check: `npm test -- --run src/ui.test.tsx -t "opens a recorded fixture"` → **1 passed, 39 skipped**.
- Backend regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**.
- Frontend regression: the first full run again had the unrelated existing-comparison reattachment announcement complete before its assertion; its immediate focused rerun passed (**1 passed, 39 skipped**) and `npm test -- --run` then passed **51 tests across 4 files**.
- Frontend build: `npm run build` → **PASS**, 40 modules, 325.57 kB JavaScript and 16.10 kB CSS before gzip.
- Live app: API health returned `ok`, Hindsight remained truthfully `unavailable`, the catalog returned two cases, and Memory Lab returned HTTP 200 after Vite hot reload.
- Provider safety: this semantic attribute change adds no API, Hindsight, or Gemini request.
- Next: stabilize the repeatedly observed reattachment-announcement timing regression.

### 2026-11-06 — Unambiguous fixture navigation links

- Goal: Make repeated fixture navigation controls distinguishable to assistive technology without lengthening their visible labels.
- Implemented: each link now exposes an accessible name containing its action/state, repository name, and held-out PR number; visible `Open case` / `Case selected` text and backend-owned routes are unchanged.
- Focused check: `npm test -- --run src/ui.test.tsx -t "recorded held-out|opens a recorded fixture"` → **2 passed, 38 skipped**.
- Backend regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**.
- Frontend regression: the first full run had one unrelated reattachment-announcement timing miss; its immediate focused rerun passed (**1 passed, 39 skipped**) and `npm test -- --run` then passed **51 tests across 4 files**.
- Frontend build: `npm run build` → **PASS**, 40 modules, 325.57 kB JavaScript and 16.10 kB CSS before gzip.
- Live app: API health returned `ok`, Hindsight remained truthfully `unavailable`, the catalog returned two cases, and Memory Lab returned HTTP 200 after Vite hot reload.
- Provider safety: accessible naming changes only rendered link metadata and adds no API, Hindsight, or Gemini request.
- Next: use the specific `page` value for the selected link's `aria-current` state.

### 2026-11-06 — Explicit outcomes in catalog announcements

- Goal: Make a changed stored result's pass/fail state unambiguous in the existing polite live region.
- Implemented: automatic catalog-refresh announcements now say `Passed` or `Needs attention` from the validated result Boolean before the exact passed/total guardrail count. Unchanged responses still preserve the single comparison-complete announcement.
- Focused check: `npm test -- --run src/ui.test.tsx -t "refreshes the fixture catalog after|does not announce an unchanged"` → **2 passed, 38 skipped**.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **51 passed across 4 files**.
- Frontend build: `npm run build` → **PASS**, 40 modules, 325.46 kB JavaScript and 16.10 kB CSS before gzip.
- Live app: the prior local listeners were no longer present, so the API and Vite were restarted in hidden local processes with `CODEDNA_DEMO_SCENE=evolved` and `CODEDNA_HINDSIGHT_AUTOSTART=0`. Health returned `ok`, Hindsight truthfully returned `unavailable`, the catalog returned two cases, and Memory Lab returned HTTP 200.
- Provider safety: the announcement is derived from the existing sanitized catalog response and adds no request or Hindsight/Gemini work.
- Next: make repeated fixture navigation links uniquely named for assistive technology.

### 2026-11-05 — Explicit stored comparison outcomes

- Goal: Make a stored evaluation's outcome understandable without color or guardrail-ratio arithmetic.
- Implemented: each completed fixture now renders a strong textual `Passed` or `Needs attention` label from the API client's validated `passed` Boolean, immediately before its existing passed/total count. Missing results retain the honest no-comparison state.
- Focused check: `npm test -- --run src/ui.test.tsx -t "recorded held-out|refreshes a healthy fixture catalog"` → **2 passed, 38 skipped**. The cases verify two passing labels and replacement with `Needs attention` after a GET-only catalog refresh.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **51 passed across 4 files**.
- Frontend build: `npm run build` → **PASS**, 40 modules, 325.37 kB JavaScript and 16.10 kB CSS before gzip.
- Live app: the prior listeners were absent, so the API and Vite were restarted in hidden local processes with `CODEDNA_DEMO_SCENE=evolved` and `CODEDNA_HINDSIGHT_AUTOSTART=0`. Health returned `ok`, Hindsight truthfully returned `unavailable`, the catalog returned two cases, and Memory Lab returned HTTP 200.
- Provider safety: the label is derived from already validated catalog data and adds no API, Hindsight, or Gemini request.
- Next: add the explicit result outcome to the existing automatic catalog-update announcement.

### 2026-11-05 — Semantic stored-comparison times

- Goal: Make each fixture result's persisted update time machine-readable without changing its localized judge-facing text.
- Implemented: stored comparison `updated_at` values now render inside HTML `time` elements using the API client's canonical validated ISO UTC value. Missing or malformed values remain omitted by existing normalization.
- Initial focused check: **FAILED** because the expected test selectors used source timestamps without the normalizer's `.000Z`; assertions were corrected to the actual canonical contract without changing production behavior.
- Focused rerun: `npm test -- --run src/ui.test.tsx -t "recorded held-out|refreshes a healthy fixture catalog"` → **2 passed, 38 skipped**.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **51 passed across 4 files**.
- Frontend build: `npm run build` → **PASS**, 40 modules, 325.30 kB JavaScript and 16.10 kB CSS before gzip.
- Live app: API health returned `ok`, Hindsight remained truthfully `unavailable`, the catalog returned two cases, and Memory Lab returned HTTP 200.
- Provider safety: this is semantic markup over already validated catalog metadata and adds no network or provider work.
- Next: state each stored evaluation's pass/fail outcome explicitly beside its guardrail count.

### 2026-11-05 — Fixture-to-job correlation

- Goal: Let judges correlate each catalog guardrail result with the persisted comparison job that produced it.
- Implemented: Memory Lab renders the existing frontend-validated opaque `job_id` beside each latest stored result in code styling. Refresh replaces the ID when SQLite returns a newer result; fixtures without a completed comparison show no job ID.
- Focused check: `npm test -- --run src/ui.test.tsx -t "recorded held-out|refreshes a healthy fixture catalog"` → **2 passed, 38 skipped**; the run completed after a long host pause and verified both initial IDs plus replacement by `job-acme-new-proof`.
- Regression: backend `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**. The first combined frontend run was disrupted by another multi-minute host pause and produced unrelated timer/worker failures; immediate `npm test -- --run` rerun → **51 passed across 4 files**.
- Frontend build: `npm run build` → **PASS**, 40 modules, 325.17 kB JavaScript and 16.10 kB CSS before gzip.
- Live app: API health returned `ok`, Hindsight remained truthfully `unavailable`, the catalog returned two cases, and Memory Lab returned HTTP 200.
- Provider safety: job IDs already arrive in the read-only catalog, pass the existing bounded validator, and add no job-status or provider request.
- Next: make each stored comparison update time machine-readable with semantic `time` markup.

### 2026-11-05 — Explicit last-known-good fixture state

- Goal: Prevent retained fixture rows from being mistaken for a successful latest read after catalog refresh recovery is exhausted.
- Implemented: a failed refresh with prior data now displays `Showing last-known-good fixture data`, repeats the preserved check time as a machine-readable `time`, and states that the failed refresh did not replace the rows. Initial-load failure does not show the fallback label because no trusted catalog exists.
- Focused check: `npm test -- --run src/ui.test.tsx -t "preserves the last fixture catalog|retries an exhausted fixture catalog"` → **2 passed, 38 skipped**.
- Regression: backend `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**. The first full frontend run had one unrelated overview empty-state timing miss; immediate `npm test -- --run` rerun → **51 passed across 4 files**.
- Frontend build: `npm run build` → **PASS**, 40 modules, 325.06 kB JavaScript and 16.03 kB CSS before gzip.
- Live app: API health returned `ok`, Hindsight remained truthfully `unavailable`, the catalog returned two cases, and Memory Lab returned HTTP 200.
- Provider safety: the stale label is derived entirely from retained successful browser state and adds no request or provider work.
- Next: display each fixture's sanitized latest comparison job ID for correlation with persisted background work.

### 2026-11-05 — Accessible fixture-catalog busy state

- Goal: Expose catalog loading/refresh activity without hiding previously verified fixture data or implying a new successful read.
- Implemented: the evaluation-fixture region now sets `aria-busy` for initial and refresh cycles. Initial activity says `Loading fixture catalog`; later cycles say `Refreshing fixture catalog` while existing rows and `Last checked` remain present. Busy resets on success or exhausted failure.
- Focused check: `npm test -- --run src/ui.test.tsx -t "refreshes a healthy fixture catalog"` → **1 passed, 39 skipped**. The case verifies initial/refresh busy transitions, retained rows/time during refresh, updated result, focus restoration, two GETs, and zero POSTs.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **51 passed across 4 files**.
- Frontend build: `npm run build` → **PASS**, 40 modules, 324.84 kB JavaScript and 15.97 kB CSS before gzip.
- Live app: API health returned `ok`, Hindsight remained truthfully `unavailable`, the catalog returned two cases, and Memory Lab returned HTTP 200.
- Provider safety: `aria-busy` and activity wording are presentation state over the existing bounded catalog GET cycle and add no request or provider work.
- Next: explicitly label retained rows as last-known-good after refresh recovery is exhausted.

### 2026-11-05 — Inspectable fixture-catalog freshness

- Goal: Let judges distinguish a freshly read SQLite catalog from an older page view without implying that Hindsight or Gemini was contacted.
- Implemented: every successful catalog GET records an ISO observation time and renders a localized `Last checked` HTML `time`. Failed bounded refreshes preserve the previous time alongside last-known-good fixture rows.
- Focused check: `npm test -- --run src/ui.test.tsx -t "recorded held-out|preserves the last fixture catalog"` → **2 passed, 38 skipped**. Coverage verifies a parseable timestamp after success and exact timestamp preservation after four failed refresh attempts.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **51 passed across 4 files**.
- Frontend build: `npm run build` → **PASS**, 40 modules, 324.79 kB JavaScript and 15.97 kB CSS before gzip.
- Live app: API health returned `ok`, Hindsight remained truthfully `unavailable`, the catalog returned two cases, and Memory Lab returned HTTP 200.
- Provider safety: the timestamp is browser-side observation metadata for the existing catalog GET and does not imply provider availability or add a request.
- Next: expose catalog load/refresh activity through `aria-busy` while keeping trusted rows and their prior timestamp present.

### 2026-11-05 — Material catalog-result announcement

- Goal: Make an automatic fixture-result update perceivable to assistive technology without repeating completion status or announcing unchanged data.
- Implemented: the existing persistent polite/atomic Memory Lab region now compares the selected fixture's stored job ID, pass state, counts, and update time. A material change announces the repository and exact passed/total guardrail count; an unchanged refresh leaves `Comparison complete` intact. Manual refresh and failure focus/error behavior remain unchanged.
- Focused checks: `npm test -- --run src/ui.test.tsx -t "fixture result|after its comparison"` → **2 passed, 38 skipped**; `npm test -- --run src/ui.test.tsx` → **40 passed**.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **51 passed across 4 files**.
- Frontend build: `npm run build` → **PASS**, 40 modules, 324.60 kB JavaScript and 15.92 kB CSS before gzip.
- Initial check: the first focused run exposed ambiguous test selection between the global memory status and page live region; the assertion was narrowed to the announcement text. One unrelated catalog-focus timing case also missed its window in that run and passed on the immediate full-file rerun.
- Live app: API health returned `ok`, Hindsight remained truthfully `unavailable`, the catalog returned two cases, and Memory Lab returned HTTP 200.
- Provider safety: announcement logic compares already fetched sanitized records in the browser and adds no request of any kind.
- Next: show a visible catalog `Last checked` time sourced only from successful GET completion.

### 2026-11-05 — Automatic post-comparison catalog synchronization

- Goal: Reflect a newly completed local comparison in the fixture catalog without requiring a second user action.
- Implemented: every successful new, reattached, or manually rechecked comparison completion starts one refresh through the existing bounded `GET /api/evaluation-cases` recovery boundary. Automatic refresh does not move focus; failures preserve last-known-good rows and the existing retry path.
- Focused checks: the new regression passed alone (**1 passed, 38 skipped**), then `npm test -- --run src/ui.test.tsx` → **39 passed**. It proves a completed comparison updates the catalog from 6/6 to the newer stored 5/6 result with exactly one comparison POST and two catalog GETs.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **50 passed across 4 files**.
- Frontend build: `npm run build` → **PASS**, 40 modules, 323.75 kB JavaScript and 15.92 kB CSS before gzip.
- Test environment note: an initial combined run was interrupted by a multi-hour host pause and reported unrelated timer failures; immediate isolated, focused, and full reruns passed.
- Live app: API health returned `ok`, Hindsight remained truthfully `unavailable`, the catalog returned two cases, and Memory Lab returned HTTP 200.
- Provider safety: the explicit comparison action still creates one comparison; its automatic follow-up is only `GET /api/evaluation-cases` and cannot start Hindsight/Gemini work.
- Next: announce a material automatic result change conservatively without duplicating the existing comparison-complete announcement.

### 2026-11-05 — Read-only fixture catalog refresh

- Goal: Let a judge observe stored comparison changes from another tab without reloading Memory Lab or starting provider work.
- Implemented: `Refresh fixture catalog` reuses the bounded GET-only loader, updates latest stored guardrail results, returns focus to the catalog heading, and preserves last-known-good rows when all refresh attempts fail.
- Focused frontend check before the final preservation case: `npm test -- --run src/ui.test.tsx` → **37 passed**.
- Full regression after all cases: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **49 passed across 4 files**. Refresh tests prove a second GET updates 6/6 to a newer stored 5/6 result, exhaustion retains the prior case, focus returns correctly, and zero POSTs are issued.
- Frontend build: `npm run build` → **PASS**, 40 modules, 323.71 kB JavaScript and 15.92 kB CSS before gzip.
- Live app: API health returned `ok`, the catalog returned two cases, Memory Lab returned HTTP 200, and Hindsight remained truthfully `unavailable`.
- Provider safety: healthy refresh and its failure recovery call only `GET /api/evaluation-cases`.
- Next: trigger the same read-only refresh automatically after a comparison completes locally.

### 2026-11-05 — Recoverable evaluation-catalog reads

- Goal: Keep Memory Lab fixture navigation usable through temporary API outages without creating provider work.
- Implemented: transient-only 1/2/4-second catalog retries, terminal error state, explicit `Retry fixture catalog`, fresh bounded retry cycles, cleanup-safe state updates, and focus restoration to the fixture heading after manual recovery or the recreated retry button after repeated failure.
- Focused check: `npm test -- --run src/ui.test.tsx` → **36 passed**. New cases prove one transient failure recovers on the second GET, four failures expose a retry whose fifth GET succeeds, and repeated exhaustion returns focus to the recreated retry control; all paths issue zero POSTs. One rerun exposed an existing reattachment announcement that could complete inside its 100 ms mock window; increasing only that test's mocked status delay to 500 ms made its intermediate-state assertion deterministic.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **47 passed across 4 files**.
- Frontend build: `npm run build` → **PASS**, 40 modules, 323.56 kB JavaScript and 15.89 kB CSS before gzip.
- Live app: API health returned `ok`, the catalog returned two cases, Memory Lab returned HTTP 200, and Hindsight remained truthfully `unavailable`.
- Provider safety: automatic and manual recovery call only `GET /api/evaluation-cases`; tests assert zero comparison POSTs.
- Next: let users refresh a healthy catalog to observe stored comparisons completed in another tab.

### 2026-11-04 — GitHub synchronization recovery

- Goal: Recover the two preserved local commits without rewriting history.
- Verification: `git ls-remote git@github.com:avyakt06jain/codeDNA.git HEAD` succeeded and confirmed the remote still ended at `66880d2` before synchronization.
- Result: unchanged commits `6b1d99a` and `57ece21` pushed successfully with `git push origin main`; no amend or force-push was used.
- Live app: API health remained `ok`, the SQLite-backed evaluation catalog returned two cases, Memory Lab returned HTTP 200, and Hindsight remained truthfully `unavailable`.
- Tests: **NOT RUN — this recovery changed no implementation code; the preserved commits retain their recorded 33-backend/44-frontend verification.**
- Next: make temporary evaluation-catalog read failures explicitly retryable through the GET-only boundary.

### 2026-11-04 — Backend-owned evaluation fixture catalog

- Goal: Remove duplicated fixture truth from the frontend and make each displayed result correspond to authoritative stored records.
- Implemented: `GET /api/evaluation-cases` fail-closed resolution of candidate, active decision, source PR, and repository; newest complete paired comparison evaluation; typed frontend normalization; truthful no-result state; and candidate selection constrained by the repository PR response.
- Focused checks: `.\.venv\Scripts\python.exe -m pytest backend\tests\test_evaluation.py backend\tests\test_judge_demo.py -q` → **13 passed**; `npm test -- --run src/ui.test.tsx src/text.test.ts` → **41 passed across 2 files**.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `.\.venv\Scripts\python.exe -m compileall -q backend\src backend\tests` → **PASS**; `npm test -- --run` → **44 passed across 4 files**.
- Frontend build: `npm run build` → **PASS**, 40 modules, 322.83 kB JavaScript and 15.81 kB CSS before gzip.
- Live correction: the first restart from the repository root **FAILED** with `ModuleNotFoundError: codedna_memory`; the exact prior listener was already stopped, so the API was relaunched from `backend` with the verified `.venv` and no Hindsight autostart.
- Live verification: API health returned `ok`, Hindsight remained truthfully `unavailable`, Memory Lab returned HTTP 200, and the SQLite-backed catalog returned exactly PR #120/`DEC-0103` and PR #29/`DEC-0211`, each with a recomputed 6/6 latest stored result.
- Provider safety: catalog fetch/navigation is read-only and neither starts a comparison nor contacts Hindsight/Gemini.
- Version control: local commit `6b1d99a` was created successfully. Two unchanged `git push origin main` attempts **FAILED** with `git@github.com: Permission denied (publickey). fatal: Could not read from remote repository.`; `ssh-add -l` also returned `Error connecting to agent: Permission denied`, and no Windows `ssh-agent` service is installed. The commit remains intact and local `main` is one commit ahead of `origin/main`.
- Next: make temporary catalog-read failures explicitly retryable through the same GET-only boundary.

### 2026-11-04 — Inspectable Memory Lab fixture catalog

- Goal: Make both verified held-out cases understandable and directly selectable without requiring project-document context.
- Implemented: a two-case Memory Lab manifest names each synthetic repository, source PR, held-out candidate, active decision, and recorded 6/6 result; repository-scoped links select only a candidate present in the fetched PR list and trigger no creation POST.
- Focused frontend check: `npm test -- --run src/ui.test.tsx src/text.test.ts` → **42 passed across 2 files**. One intermediate run **FAILED 1 test** because this suite does not install the `toHaveAttribute` matcher; the assertion was corrected to inspect the DOM attribute directly.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **45 passed across 4 files**.
- Frontend build: `npm run build` → **PASS**, 40 modules, 321.51 kB JavaScript and 15.81 kB CSS before gzip.
- Provider safety: fixture navigation performs only repository PR, active-job, and latest-comparison reads; no Hindsight/Gemini call or comparison POST was made.
- Live app: the candidate-specific Memory Lab route returned HTTP 200 and API health remained `ok`; Hindsight stayed truthfully `unavailable`.
- Limitation: the two-case presentation manifest currently duplicates fixture identifiers in the frontend; actual candidate selection still fails closed against the repository's API-provided PR list.
- Next: return the manifest from a read-only backend endpoint derived from SQLite fixture records.

### 2026-11-04 — Visibility-aware summary polling

- Goal: Avoid read-only background traffic while the overview is not visible, then promptly reconcile when the user returns.
- Implemented: hidden documents cancel pending summary timers; initial/scheduled reads wait for visibility; one immediate summary check runs on return before normal empty/active rules resume; listeners are removed on cleanup.
- Focused frontend check: the first test attempted to hide after a 10 ms test poll was already due and failed its call-count assumption; it was revised to start hidden. Final `npm test -- --run src/ui.test.tsx` → **31 passed**, proving zero hidden summary GETs, one visible-resume GET, and no POST.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **42 passed across 4 files**.
- Frontend build: `npm run build` → **PASS**, 40 modules, 319.18 kB JavaScript and 14.77 kB CSS before gzip.
- Provider safety: visibility handling only suppresses/resumes the SQLite-backed summary GET; no Hindsight/Gemini request was made.
- Live app: loopback returned API `ok` and UI HTTP 200 after hot reload; Hindsight remained truthfully `unavailable` and no provider startup was attempted.
- Next: make the two verified held-out Memory Lab cases visible in-product.

### 2026-11-04 — Empty-summary work discovery

- Goal: Discover review/comparison work started in another tab after the overview previously observed no active rows.
- Implemented: `Check for active work` reuses the summary-only bounded cycle, restores focus to newly visible Active work, and resumes ordinary five-second summary monitoring.
- Focused frontend check: the first call-count assertion expected exactly two reads, but restored active work correctly began subsequent monitoring; the assertion was narrowed to require the explicit discovery reads. Final `npm test -- --run src/ui.test.tsx` → **30 passed**, with no job-result GET or POST.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **41 passed across 4 files**.
- Frontend build: `npm run build` → **PASS**, 40 modules, 318.88 kB JavaScript and 14.77 kB CSS before gzip.
- Provider safety: the action calls only the SQLite-backed repository active-summary endpoint; no Hindsight/Gemini request was made.
- Live app: loopback returned API `ok` and UI HTTP 200 after hot reload; Hindsight remained truthfully `unavailable` and no provider startup was attempted.
- Next: suspend read-only polling while the overview tab is hidden.

### 2026-11-04 — Observed empty active-work state

- Goal: Make a successful empty repository job check visible instead of making absence indistinguishable from an unobserved state.
- Implemented: a compact `No active work` card names queued/running review and comparison scope and shows the successful machine-readable/localized check time.
- Focused frontend check: the first run exposed an unrelated focus-effect timing assertion; it was corrected to wait for focus. Final `npm test -- --run src/ui.test.tsx` → **29 passed**, including observed-empty content/timestamp and active/empty mutual exclusion.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **40 passed across 4 files**.
- Frontend build: `npm run build` → **PASS**, 40 modules, 318.77 kB JavaScript and 14.73 kB CSS before gzip.
- Provider safety: the state reuses the existing repository-summary response and adds no API or provider calls.
- Live app: loopback returned API `ok` and UI HTTP 200 after hot reload; Hindsight remained truthfully `unavailable` and no provider startup was attempted.
- Next: let the user refresh this empty summary explicitly without reloading the page.

### 2026-11-04 — Active-summary freshness

- Goal: Let judges distinguish a recently observed job summary from a visually static panel.
- Implemented: `Last checked` uses a parseable `<time>` and localized display value set only after successful repository-summary reads; failed transient attempts retain the previous successful instant.
- Focused frontend check: `npm test -- --run src/ui.test.tsx` → **29 passed**, including a parseable timestamp assertion on visible Active work.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **40 passed across 4 files**.
- Frontend build: `npm run build` → **PASS**, 40 modules, 318.32 kB JavaScript and 14.61 kB CSS before gzip.
- Provider safety: timestamping is client-side and adds no API or provider calls.
- Live app: loopback returned API `ok` and UI HTTP 200 after hot reload; Hindsight remained truthfully `unavailable` and no provider startup was attempted.
- Next: make the successfully observed empty state visible with the same freshness context.

### 2026-11-04 — Manual summary-retry focus recovery

- Goal: Prevent keyboard focus from falling back to the document body when a manual summary retry removes and replaces UI.
- Implemented: focus targets for restored Active work, empty successful recovery, and repeated failure; repository navigation cancels pending focus intent.
- Focused frontend check: the first success assertion ran before the focus effect and failed; it was corrected to wait for focus. Final `npm test -- --run src/ui.test.tsx` → **29 passed**, covering active, empty, and repeated-failure outcomes with no POST.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **40 passed across 4 files**.
- Frontend build: `npm run build` → **PASS**, 40 modules, 318.12 kB JavaScript and 14.55 kB CSS before gzip.
- Provider safety: focus recovery is UI-only and does not start Hindsight/Gemini or job-result work.
- Live app: loopback returned API `ok` and UI HTTP 200 after hot reload; Hindsight remained truthfully `unavailable` and no provider startup was attempted.
- Next: display the last successful active-summary check time.

### 2026-11-04 — Explicit overview-summary retry

- Goal: Let a judge recover repository-level job visibility after bounded automatic retries stop, without starting review/provider work.
- Implemented: `Check active work again` restarts only the repository summary cycle with fresh bounded retry state and clears on a successful response.
- Focused frontend check: `npm test -- --run src/ui.test.tsx` → **27 passed**. The new regression observes four failed summary GETs, one explicit successful summary GET, no job-result GET, and no POST.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **38 passed across 4 files**.
- Frontend build: `npm run build` → **PASS**, 40 modules, 317.66 kB JavaScript and 14.55 kB CSS before gzip.
- Provider safety: the action calls only the SQLite-backed repository active-summary endpoint; no Hindsight/Gemini call was made.
- Live app: loopback returned API `ok` and UI HTTP 200 after hot reload; Hindsight remained truthfully `unavailable` and no provider startup was attempted.
- Next: move focus predictably when successful retry removes its button.

### 2026-11-04 — Bounded overview-summary recovery

- Goal: Keep repository-level job observability resilient to short API/network interruptions without broadening the provider-call boundary.
- Implemented: shared transient-error classification, bounded 1/2/4-second overview retries, visible reconnecting state, success reset, and preservation of already rendered active rows during recovery.
- Focused frontend check: `npm test -- --run src/ui.test.tsx` → **26 passed**. The new regression observes one transient `503`, one successful summary retry, no job-result GET, and no POST.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **37 passed across 4 files**.
- Frontend build: `npm run build` → **PASS**, 40 modules, 317.45 kB JavaScript and 14.55 kB CSS before gzip.
- Provider safety: recovery calls only the repository active-summary GET; no Hindsight/Gemini call was made.
- Live app: loopback returned API `ok`, UI HTTP 200, 0 active jobs, and Hindsight truthfully `unavailable`; Vite hot reload kept the app runnable without provider startup.
- Next: provide an explicit same-summary retry after bounded recovery is exhausted.

### 2026-11-03 — Accessible active-work completion announcement

- Goal: Make overview job disappearance understandable to screen-reader users without claiming whether work succeeded or failed.
- Implemented: one persistent polite/atomic live region that announces only a nonempty-to-empty transition and directs the user to inspect the PR's saved result or failure. Initial empty state and repository changes reset silently.
- Focused frontend check: the first assertion incorrectly assumed the global memory-health status was absent and failed; the assertion was narrowed to the completion message. Unchanged rerun `npm test -- --run src/ui.test.tsx` → **25 passed**.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **36 passed across 4 files**.
- Frontend build: `npm run build` → **PASS**, 40 modules, 317.22 kB JavaScript and 14.55 kB CSS before gzip.
- Provider safety: the change is UI-only and starts no Hindsight/Gemini or job-result request.
- Live app: loopback returned API `ok` and UI HTTP 200 after Vite hot reload; Hindsight remained truthfully `unavailable` and no provider startup was attempted.
- Next: retry bounded transient overview-summary failures without creating work.

### 2026-11-03 — Bounded repository active-work refresh

- Goal: Let the overview reflect completion without a manual reload while preserving the read-only, no-provider boundary.
- Implemented: a five-second active-summary refresh that runs only while rows exist and cancels on empty response, error, repository change, or unmount.
- Focused frontend check: `npm test -- --run src/ui.test.tsx` → **25 passed**. The new regression observes exactly two summary GETs (active then empty), no job-result GET, and no POST.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **36 passed across 4 files**.
- Frontend build: `npm run build` → **PASS**, 40 modules, 316.91 kB JavaScript and 14.55 kB CSS before gzip.
- Provider safety: no Hindsight/Gemini request was made; this slice reads SQLite-backed API state only.
- Live app: loopback verification returned API `ok`, UI HTTP 200, Hindsight truthfully `unavailable`, and 0 active jobs; the app remained running without provider startup.
- Next: announce active-to-empty completion once through a polite live region.

### 2026-11-03 — Repository-level active-work visibility

- Goal: Make ongoing review/comparison jobs visible before a judge opens an individual PR, without causing provider work.
- Implemented: repository-scoped active-job query, sanitized PR/job summary contract, overview Active work panel with PR links, timestamps, and the existing conservative stale warning.
- Backend check: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests\test_review_jobs.py -q` → **6 passed**.
- Frontend focused check: first Vitest attempt failed before collecting tests because its forks worker timed out; unchanged rerun `npm test -- --run src/ui.test.tsx` → **24 passed**.
- Full regression: `CODEDNA_HINDSIGHT_AUTOSTART=0 .\.venv\Scripts\python.exe -m pytest backend\tests -q` → **33 passed**; `npm test -- --run` → **35 passed across 4 files**.
- Frontend build: `npm run build` → **PASS**, 40 modules, 316.72 kB JavaScript and 14.55 kB CSS before gzip.
- Safety: the overview performs one repository read and neither polls individual job results nor issues a creation POST.
- Live app: restarted the API with Hindsight autostart disabled and the Vite UI; loopback checks returned API `ok`, Hindsight `unavailable`, 4 Acme PRs, 16 saved review runs, 0 active jobs, and HTTP 200 for the UI. No provider call was made.
- Next: conservatively refresh the active-work snapshot only while active rows remain.

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
