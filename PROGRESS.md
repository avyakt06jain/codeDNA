# CodeDNA Progress

> Observed implementation state. Requirements and examples in the design documents are not evidence of working behavior.

## Current State

- Date: 2026-10-27
- Phase: G1 complete; G2 backend review core is next.
- Implementation: real Hindsight retain/recall, source validation, restart persistence, isolation, and stable-ID reingestion are verified.
- Git: `main` is initialized, connected to GitHub, and the bootstrap commit is pushed.

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

## In Progress

- G2 contract planning: diff parsing, structured finding validation, evidence allowlisting, and an uncontaminated no-memory baseline.

## Blocked

- None for the completed G1 milestone.

## Known Limitations

- Docker is not installed; G1 uses officially supported native Windows Hindsight with embedded pg0.
- The schema currently uses controlled `create_all` initialization for the isolated spike; migrations are deferred until G2.
- Gemini availability is externally rate-limited: startup probes intermittently returned `503 UNAVAILABLE` during otherwise successful runs.
- Gemini free tier reported a zero cached-content storage-token limit. Hindsight logged the failure and completed via uncached fallback; this adds noise and may increase latency.
- The standalone Gemini-backed Hindsight process did not bind its HTTP listener on this Windows host. G1 therefore uses the official in-process server, which was verified.
- First execution downloads and loads local embedding/reranker assets and is materially slower than later runs.
- No review engine, HTTP API, frontend, feedback flow, or ablation implementation exists.

## Next Action

Implement the first G2 thin slice: parse the PR #87 fixture diff, validate new-side line positions, and generate a structured finding from an explicit allowlist containing only the G1-validated `DEC-0042` evidence. Run the same input independently with memory disabled.

## Session Log

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

## Maintenance Checklist

- Review `git status` and `git diff` before every commit.
- Record exact executed commands and observed outcomes; never infer `PASS`.
- Update current state, blockers, limitations, and next action after meaningful work.
- Mark only verified roadmap items complete.
- Update `ARCHITECTURE.md` for changed components, schemas, services, or tradeoffs.
- Add `README.md` only when its setup and verification commands are tested.
