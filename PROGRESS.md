# CodeDNA Progress

> Observed implementation state. Requirements and examples in the design documents are not evidence of working behavior.

## Current State

- Date: 2026-10-27
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

## In Progress

- Post-MVP reliability work continues with interrupted-job reconciliation and broader uncontaminated evaluation fixtures. The review page still does not reload a finished job after refresh.

## Blocked

- None for the completed MVP gates.

## Known Limitations

- Docker is not installed; G1 uses officially supported native Windows Hindsight with embedded pg0.
- The schema currently uses controlled `create_all` initialization for the isolated spike; migrations are deferred until G2.
- Gemini availability is externally rate-limited: startup probes intermittently returned `503 UNAVAILABLE` during otherwise successful runs.
- Gemini free tier reported a zero cached-content storage-token limit. Hindsight logged the failure and completed via uncached fallback; this adds noise and may increase latency.
- The standalone Gemini-backed Hindsight process did not bind its HTTP listener on this Windows host. G1 therefore uses the official in-process server, which was verified.
- First execution downloads and loads local embedding/reranker assets and is materially slower than later runs.
- Review and comparison jobs are asynchronous and observable. Refreshing the pull-request page does not replay the on-screen findings, and stopping the API interrupts an in-process job.
- The baseline model reported a generic missing-`where` concern on the intentionally abbreviated synthetic Prisma fixture. It was persisted honestly and did not receive team-policy authority.
- The authorization model is a narrow demo boundary (`demo-maintainer`), not production authentication or role-based access control.
- The feedback UI exposes accept and dismiss. The evolution page shows the supersession timeline. A free-text correction flow is still limited.
- The evaluation has one synthetic held-out policy case, so results are reported as counts, not generalized accuracy claims.
- A polished recorded video and hackathon portal submission are external presentation actions and are not created or submitted automatically.

## Next Action

Reconcile queued/running jobs interrupted by an API restart, then expand the labeled evaluation set without contaminating baselines.

## Session Log

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
