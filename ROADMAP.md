# CodeDNA Roadmap

> Intent and prioritized delivery plan. Status is updated only from observed repository state and executed checks.

## Status legend

- **Not started**: no implementation exists.
- **In progress**: work exists but acceptance criteria are not fully verified.
- **Blocked**: progress requires an unavailable external input or dependency.
- **Verified**: every listed acceptance criterion has been executed successfully.

## G0 — Repository and documentation bootstrap

**Status:** Verified

### Deliverables

- Initialize Git on `main` and connect the approved GitHub remote.
- Preserve `AGENTS.md`, `PROJECT.md`, and `ARCHITECTURE.md` as initial authority.
- Add `.gitignore`, this roadmap, and `PROGRESS.md`.
- Establish the commit/push and documentation-update discipline from `AGENTS.md`.

### Acceptance criteria

- The bootstrap files are committed and pushed to `origin/main`.
- No implementation or verification is claimed by the initial commit.
- Secrets, databases, runtime state, caches, and build outputs are ignored.

## G1 — Real Hindsight memory proof

**Status:** Verified

**Priority:** First implementation milestone

### Dependencies

- Native Windows Python environment with pinned Hindsight all-in-one/client packages. **Verified.**
- Working Gemini API key with free-tier access to `gemini-3.1-flash-lite`. **Verified for G1 run.**
- Network access for dependency and model downloads.

### Deliverables

- Minimal SQLite provenance registry for repositories, PR sources, decisions, and memory documents. **Implemented; unit tested.**
- Backend-controlled repository-to-Hindsight-bank mapping. **Verified live.**
- Real retain of synthetic PR #42 decision `DEC-0042` as `decision-DEC-0042`. **Verified.**
- Semantically related recall from PR #87 context with source chunks. **Verified.**
- Deterministic provenance validation against SQLite. **Verified.**
- Recall after a clean Hindsight process restart without re-retaining. **Verified.**
- Second-bank isolation and stable-document reingestion checks. **Verified.**

### Acceptance criteria

- Hindsight health/version and configured provider are observed successfully.
- Retain completes against real Hindsight.
- Recall returns relevant evidence and resolves it to active `DEC-0042` and source PR #42.
- Recall still resolves after service restart without a retain call.
- The `analytics-service` bank does not expose `DEC-0042`.
- Reusing the stable document ID does not accumulate duplicate source documents.
- Exact commands, versions, outputs, failures, and limitations are recorded in `PROGRESS.md`.

### Risks

- Gemini free-tier demand/quota can still transiently block extraction; the startup probe returned intermittent 503 responses during the successful run.
- Gemini cached-content storage is unavailable on the tested free tier; Hindsight 1.1.0 fell back to uncached calls.
- First-run Hindsight/embedding model downloads may be large or slow.
- The in-process runtime is the verified Windows G1 path; the standalone Gemini-backed listener stalled before binding on this host.

## G2 — Backend review core

**Status:** Verified

**Verified evidence:** The real paired PR #87 run used Gemini `gemini-3.1-flash-lite` in both modes. Memory mode produced a validated line-18 team-convention finding citing `DEC-0042`; baseline produced a distinct generic finding and contained no team-policy category or evidence IDs.

- Diff parsing and new-side line validation. **Verified.**
- Memory query building, Hindsight recall, policy filtering, structured Gemini generation, and evidence validation. **Verified.**
- Persisted review runs and controlled no-memory baseline. **Verified.**
- FastAPI repository, PR, decision, review, and evidence read contracts. **Verified with contract tests.**

## G3 — Product UI

**Status:** Verified

- Review Workspace with real fixture diff, memory/baseline actions, findings, evidence drawer, and truthful loading/empty/error states. **Verified live.**
- Team DNA active-decision/source inspection. **Verified live.** Decision mutation remains intentionally in G4.

## G4 — Feedback and living conventions

**Status:** Verified

- Persisted feedback with nonbinding-by-default semantics. **Verified.** Attempts to promote ordinary feedback directly to policy fail closed.
- Explicit maintainer-authorized supersession from `DEC-0042` to `DEC-0103`. **Verified.** Both historical records remain stored.
- Stable Hindsight retain of `decision-DEC-0103` and PR #103 to PR #120 behavior proof. **Verified live.** Recall returned both decisions; SQLite rejected the superseded one, and the accepted line-31 finding cited only `DEC-0103`/PR #103.
- Reviewer Accept/Not Applicable controls persist feedback from the Review Workspace. **Implemented and covered by frontend build/tests; live browser mutation remains part of G5 E2E.**

## G5 — Evaluation and submission

**Status:** Verified

- Controlled Memory Lab comparison with the same PR/model and memory as the only changed input. **Verified through CLI, API, and live browser.**
- Deterministic checks for source retrieval, grounded team citations, baseline citation leakage, and baseline team-policy leakage. **Verified 6/6.**
- Explicitly guarded demo reset for the designated SQLite database and two synthetic Hindsight banks. **Verified from populated state.**
- Reproducible end-to-end commands, judge demo script, feature/evaluation notes, and truthful limitations. **Documented and executed.**
- Local Review Workspace, Team DNA, and Memory Lab remain available at `http://127.0.0.1:5173` while the development servers are running.

## Post-MVP reliability improvements

- **Verified:** Persisted background review jobs return `202 Accepted`, expose queued/running/stage/complete/failed state, sanitize failures, and let the UI poll without holding one HTTP request open.
- **Verified:** Memory Lab comparisons use the same persisted job boundary, expose separate memory/baseline stages, and return both stored runs plus deterministic evaluation results.
- **Verified:** The judge workspace now provides routed repository overview, PR review, Team DNA, decision evolution, and Memory Lab views with keyboard navigation and explicit dependency health.
- **Verified:** A second isolated `analytics-service` fixture broadens repository navigation without seeding the Acme evaluation answer into its bank.
- **Verified:** The PR workspace restores the latest completed memory review after refresh so evidence and feedback remain available during the judge demo.
- **Verified:** API startup atomically marks stale queued/running jobs as failed with `job_interrupted_by_restart`, reports the count through health, and gives the UI a safe-retry notice without replaying external model calls.
- **Verified:** A second held-out analytics case uses source PR #11, candidate PR #29, `DEC-0211`, and the isolated analytics bank. Its real Hindsight/Gemini comparison passed all six guardrails without placing the expected answer in the candidate or baseline context.
- **Verified:** Memory Lab restores the latest complete, same-PR paired job after refresh through a read-only endpoint; restoration issues no Hindsight/Gemini request and validates both stored runs belong to the candidate.
- **Verified:** Review evidence and feedback have deterministic keyboard focus entry/return; the feedback dialog traps Tab/Shift+Tab and closes on Escape.
- **Verified:** Review and comparison progress use one persistent polite/atomic live region per page, avoid duplicate loading/stage announcements, and distinguish comparison stages from ordinary review stages.
- **Verified:** Finding-location actions select the correct file and move focus to the cited changed line, with a diff-region fallback when a finding has no line.
- **Verified:** Review Workspace and Memory Lab preserve an active opaque job ID in session storage, reattach through the existing read-only job endpoint after a browser refresh, and do not post duplicate provider work.
- **Verified:** Existing-job polling retries three consecutive transient network/HTTP failures with 1/2/4-second backoff, exposes a task-specific reconnecting status, and never posts duplicate provider work.
- **Verified:** When bounded polling is exhausted, Review Workspace and Memory Lab preserve the active locator and expose an in-page `Check again` action that polls the same job ID without a POST.
- **Verified:** Active and recoverable jobs expose a collapsed, sanitized details disclosure containing only the validated opaque job ID and human-readable stage; it clears at terminal completion.
- **Verified:** When per-tab storage is absent, Review Workspace and Memory Lab discover the newest queued/running job for the same stored PR and kind, then resume GET-only polling before completed-result fallback.
- **Verified:** Review and comparison creation atomically reuse same-PR/same-kind active work; concurrent SQLite claims return one job ID and only the creator schedules a background task.
- **Verified:** Review Workspace and Memory Lab preserve the creation response's `reused` signal and announce reattachment before polling the existing job, so a click is not misrepresented as new provider work.
- **Verified:** Queue, active-discovery, and status contracts expose UTC creation/update timestamps; the frontend rejects malformed values and shows sanitized job age plus an exact local time in active-job diagnostics.
- **Verified:** A visible accessible warning appears after three minutes without a persisted job update, conservatively states that progress is unreported, and neither retries nor starts provider work.
- **Verified:** A `404` for a saved active-job locator clears only that locator and falls back to the latest completed same-PR review/comparison through read-only endpoints, with no creation POST.
- **Verified:** The repository overview lists repository-scoped queued/running review and comparison jobs with PR links, sanitized stage/timestamps, and stale warnings through a read-only endpoint; it never polls job results or starts provider work.
- **Verified:** Repository active-work visibility refreshes every five seconds only while active rows exist, then stops on completion, error, navigation, or unmount; tests prove it performs no job-result GET or creation POST.
- **Verified:** A nonempty-to-empty active-work transition produces one conservative polite/atomic announcement; initial empty state and navigation do not claim completion.
- **Verified:** The overview summary retries only transient network/selected HTTP failures with bounded 1/2/4-second delays, preserves existing rows while reconnecting, and performs no job-result GET or creation POST.
- **Verified:** After bounded overview-summary recovery is exhausted, `Check active work again` starts a fresh summary-only cycle; tests prove the action issues no job-result GET or creation POST.
- **Verified:** Manual summary retry preserves keyboard position by focusing restored Active work, the overview heading for an empty success, or the recreated retry action after another failure.
- **Verified:** Active work shows a parseable, localized `Last checked` time from the latest successful repository-summary response; transient failures do not mislabel a failed attempt as fresh.
- **Verified:** A successful empty repository-summary response renders a compact `No active work` state with the same parseable check time, without implying that provider work was run.
- **Verified:** `Check for active work` refreshes an observed-empty summary, discovers work queued elsewhere, restores focus to Active work, and issues no job-result GET or creation POST.
- **Verified:** Repository summary timers pause while the document is hidden; an initially hidden overview performs no summary GET and visibility restoration triggers one immediate read-only check.
- **Verified:** Memory Lab exposes both recorded held-out cases with repository, source PR, candidate PR, decision ID, and 6/6 recorded guardrails; opening a case selects its fetched candidate and starts no provider work.
- **Verified:** `GET /api/evaluation-cases` resolves repository/source/candidate/active-decision metadata and the newest valid stored comparison from SQLite; invalid or cross-repository records fail closed, and the frontend no longer owns fixture identifiers.
- **Verified:** Memory Lab retries transient evaluation-catalog failures after bounded 1/2/4-second delays, exposes a GET-only retry after exhaustion, starts no provider work, and restores keyboard focus after manual recovery.
- **Verified:** A healthy catalog exposes `Refresh fixture catalog`; success updates stored results and focuses the catalog heading, while exhausted refresh preserves last-known-good cases and issues zero POSTs.
- **Verified:** Every successfully completed local comparison triggers one GET-only catalog refresh, immediately reflecting its stored guardrail result without moving focus or creating additional provider work.
- **Verified:** The persistent Memory Lab live region announces only material automatic changes to the selected fixture's stored result, including repository and exact passed/total counts; unchanged refreshes preserve the single comparison-complete announcement.
- **Verified:** The fixture catalog shows a localized, machine-readable `Last checked` time from its latest successful GET; failed refreshes preserve the prior timestamp instead of implying freshness.
- **Verified:** The fixture region exposes `aria-busy` during initial loading and refresh, distinguishes visible loading/refreshing text, and keeps trusted rows plus their prior check time available throughout refresh.
- **Verified:** Exhausted refresh recovery labels retained rows as last-known-good with their preserved check time and does not show that label for an initial failure with no prior data.
- **Verified:** Each stored fixture result shows its validated opaque comparison job ID, and a refresh replaces that correlation handle with the newer SQLite result without extra status/provider requests.
- **Verified:** Stored comparison update times retain localized text inside semantic HTML `time` elements whose `dateTime` values are canonical validated UTC; malformed times remain omitted.
- **Verified:** Every stored fixture result states `Passed` or `Needs attention` from the validated API Boolean beside its guardrail count, so outcome is not conveyed by color or arithmetic alone.
- **Verified:** Automatic fixture-result announcements state `Passed` or `Needs attention` before the exact guardrail count, while unchanged refreshes still avoid duplicate completion announcements.
- **Verified:** Repeated fixture navigation links retain concise visible text but expose repository- and held-out-PR-specific accessible names, including the selected-case state.
- **Verified:** The selected fixture link uses `aria-current="page"`; unselected links omit the attribute and preserve their unique accessible names.
- **Verified:** Memory Lab keeps comparison creation disabled until persisted recovery finishes for the exact selected PR, eliminating the load/recovery race; deterministic promise-gated tests verify both the barrier and the reused-work announcement.
- **Verified:** Review Workspace now applies the same exact-PR recovery barrier; deterministic gates prove no review POST can occur until active/latest persisted recovery completes and that reused work is announced before polling finishes.
- **Verified:** Review Workspace exposes its combined initial load and persisted recovery boundary as one named `aria-busy` region while retaining one live status announcement and visible loading text.
- **Verified:** Memory Lab exposes pull-request/comparison recovery through a separate named `aria-busy` region while its fixture catalog retains an independent busy lifecycle and the page retains one live status announcement.
- **Verified:** Initial persisted-recovery failures in Review Workspace and Memory Lab clear their busy state, state that no provider work was started by recovery, identify the affected task, and leave the normally gated run control usable.
- **Verified:** Task-specific saved-recovery retry actions rerun only PR/active/latest GETs, restore persisted results after a transient failure, remove recovered error state, and issue zero creation POSTs.
- **Verified:** Manual saved-recovery retry preserves keyboard position: restored reviews focus `Review findings`, restored comparisons focus `Guardrails`, repeated failures focus the recreated retry action, and empty success falls back to the named workspace.
- **Verified:** A manual retry that successfully finds neither active work nor a persisted result emits one polite task-specific completion message, explicitly states that no provider work started, keeps the normal empty state, and issues zero POSTs.
- **Verified:** Global Hindsight health remains observable after first readiness: visible tabs recheck ready state every 30 seconds, starting/unavailable state every two seconds, pause all timers while hidden, and reconcile immediately on return.
- **Verified:** The Hindsight indicator shows a localized, machine-readable latest successful health observation time; failed reads preserve that timestamp, and its frequent updates sit outside the state-change live region.
- **Verified:** Failed application-health reads are represented separately from successful responses that report Hindsight unavailable. The former preserves the last successful payload/time as cached evidence, displays `Memory status unknown`, and forces the same unavailable run-control gate without provider work.
- **Verified:** Consecutive application-health transport failures use capped 2/4/8/16/30-second backoff, reset after a successful response, and still reconcile immediately when a hidden tab becomes visible.
- **Verified:** An unknown memory state exposes a single-flight `Check health again` action that cancels pending backoff, uses only `GET /api/health`, disables during the request, and returns keyboard focus to the resulting status.
- **Verified:** Every application-health GET is aborted after 10 seconds; timeout enters the existing unknown/backoff path, releases the single-flight guard, preserves last-known-good context, and remains manually recoverable.
- **Verified:** Background-job status, active discovery, latest-result recovery, and repository active-summary GETs abort after 10 seconds. Status timeout is transient and retries the same job ID; recovery remains actionable and GET-only; creation POSTs are never replayed.
- **Verified:** A creation response that exceeds 10 seconds triggers three bounded GET-only checks for the backend's atomic same-PR/same-kind claim. A discovered job is reattached and polled after exactly one POST; an unresolved outcome disables another creation attempt until page reconciliation.
- **Verified:** An unresolved outcome exposes `Check creation status`, which performs only exact-PR/kind active and latest-result GETs. Active or completed work is resumed, an empty successful boundary safely reenables creation, failures remain fail-closed, and focus moves to the resolved workspace/result or retry action.
- **Verified:** Review Workspace and Memory Lab regressions prove that a claim first visible during the manual check is reattached after exactly one POST, while a manual status-read failure keeps creation disabled, recreates/focuses the action, and performs no latest-result read.
- **Verified:** When active discovery stays empty but a completed review/comparison first appears during manual creation-status reconciliation, each workspace restores it through the latest-result GET, focuses its result heading, performs no job-status poll, and sends no replacement POST.
- **Verified:** Review Workspace labels initial, manual creation-status, and missing-job latest-result recovery as `Latest saved review restored`; newly polled completion remains `Review complete`, and the restored label is emitted once through the persistent live region.
- **Verified:** Review Workspace and both Memory Lab columns display bounded normalized `review-...`/`run-...` correlation IDs outside live regions. Invalid or overlong IDs normalize to absent, and evaluation-level run IDs use the same boundary.
- **Verified:** Optional Memory Lab `evaluation.run_ids` must be a record whose present IDs are valid and equal the normalized nested memory/baseline runs. Absent metadata is accepted; malformed/mismatched metadata rejects the comparison, and a completed job surfaces a terminal error instead of contradictory output.
- **Verified:** Latest-comparison recovery reserves the ordinary empty state for an explicit null result. A present payload that fails structural or run-correlation normalization surfaces an actionable integrity error during initial and manual creation-status recovery, with no replacement POST or provider work.
- **Verified:** Latest-review recovery reserves the ordinary empty state for an explicit null result. A present payload must be an object with a valid bounded run ID or initial/manual recovery surfaces an actionable integrity error, renders no findings, and starts no replacement provider work.
- **Verified:** Completed active-review jobs must return a review with a valid bounded run ID. Invalid correlation metadata produces a terminal integrity error, renders no findings, clears the active locator, and makes no latest-result or replacement creation request.
- **Verified:** Every comparison now requires valid bounded nested memory and baseline run IDs, even without optional evaluation-level metadata. Invalid active/latest/manual results render no guardrails; active completion clears its locator and no recovery path starts replacement work.
- **Verified:** Completed comparison polling distinguishes a structurally missing payload from present-but-invalid correlation metadata with separate terminal errors. Both render no guardrails, clear the active locator, and send no replacement request.
- **Verified:** Every comparison requires exact nested role identity: `memory.mode` is `memory` and `baseline.mode` is `baseline`. Swapped, missing, or malformed modes fail closed across active and latest/manual recovery without guardrails or replacement work.
- **Verified:** Both nested comparison runs must report terminal `complete` status before guardrails render. Partial, failed, or missing branch status fails closed across active and latest/manual recovery without replacement work.
- **Verified:** A present evaluation `passed` flag must equal the conjunction of normalized Boolean guardrail checks. Contradictory headlines fail closed across active and latest/manual recovery without replacement work.
- **Verified:** Completed comparisons must contain all six backend-defined Boolean guardrail checks. Missing or non-Boolean required checks fail closed across active and latest/manual recovery without partial rendering or replacement work.
- **Verified:** Every completed comparison must contain a Boolean `evaluation.passed` consistent with its full guardrail set. Missing outcomes fail closed across active and latest/manual recovery without replacement work.
- **Verified:** Nested memory/baseline reviews must carry matching non-empty `pr_id`, `provider`, and `model` values, while `same_candidate` and `same_model` must be true. Identity mismatches fail closed across active and latest/manual recovery without replacement work.
- **Verified:** Both `evaluation.run_ids` entries are mandatory, bounded, and must equal their nested persisted run IDs. Missing/invalid/mismatched correlation fails closed across active and latest/manual recovery without replacement work.
- **Verified:** All seven evaluation counts are mandatory finite non-negative integers and must match values derived from normalized nested evidence/findings/citations. Invalid or inconsistent counts fail closed across active and latest/manual recovery without replacement work.
- **Verified:** The four evidence/content guardrails are independently recomputed from normalized nested evidence and findings. Contradictory validated-source, grounded-finding, baseline-citation, or baseline-policy claims fail closed across active and latest/manual recovery.
- **Verified:** Comparison normalization is bound to the selected/requested PR. Two internally consistent branches for a different candidate fail closed across active and latest/manual recovery.
- **Verified:** Single-review active/latest normalization is bound to the route/request PR. Missing or different result identity fails closed across active, initial latest, and manual latest recovery.
- **Verified:** Single-review active/latest results must carry explicit `status: complete` and a valid `memory`/`baseline` mode; latest and known-mode job results must match the requested mode. Invalid state fails closed across active and latest/manual recovery.
- **Verified:** Single-review active/latest results require trimmed provider/model identity bounded to the backend's 80/160-character storage limits. Missing, blank, or overlong identity fails closed across active and latest/manual recovery.
- **Verified:** Completed single-review results require an explicit findings array containing only object entries. Missing/malformed collections fail closed while a genuine empty array remains valid.
- **Verified:** Every single-review finding must satisfy the backend field bounds, nullable-line rule, explicit category/severity/confidence enums, and evidence-list shape before normalization. Malformed objects cannot become defaulted review content.
- **Verified:** Completed single-review elapsed time must be a finite non-negative integer before result timing can render. Missing, negative, fractional, or non-finite values fail closed.
- **Next:** Enforce single-review citation/category semantics so team-policy findings cite evidence and general findings cannot present policy evidence.

## Documentation and version-control policy

For every meaningful increment: inspect the diff, run relevant checks, update `ROADMAP.md` and `PROGRESS.md`, commit atomically, and push. Mark tests `NOT RUN` when they were not executed. Update `ARCHITECTURE.md` when contracts or deployment decisions change. Create `README.md` only after its commands have been run successfully.

