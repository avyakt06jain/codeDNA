# CodeDNA Progress

> Observed implementation state. Requirements and examples in the design documents are not evidence of working behavior.

## Current State

- Date: 2026-10-27
- Phase: G1 real Hindsight memory proof.
- Implementation: provenance registry and smoke harness implemented; real retain/recall **unverified**.
- Git: `main` is initialized, connected to GitHub, and the bootstrap commit is pushed.

## Working

- The three authoritative initial documents are present and readable.
- Python 3.12.0, Git 2.51.0, Node 24.14.0, and npm 11.21.0 are available.
- Bootstrap commit `b770321` is present on `origin/main`.
- Native dependencies installed in ignored `.venv`: Hindsight API/client 1.1.0, SQLAlchemy 2.0.55, Pydantic 2.14.1, and pytest 9.1.1.
- Minimal SQLite provenance models, deterministic synthetic fixtures, source validation, backend-owned bank selection, and three-operation smoke CLI are implemented.
- Six focused provenance tests pass.
- The CLI reports an unavailable Hindsight service as structured failure with exit code 2.
- Native Hindsight started successfully with embedded pg0 and the LLM provider disabled; `get_version()` reported API 1.1.0 and the process was stopped cleanly.

## In Progress

- Preparing the first native Hindsight startup with Gemini.
- Real retain, recall, restart persistence, isolation, and stable-document checks remain to be executed.

## Blocked

- A real Hindsight retain/recall run requires a Gemini API key with sufficient free quota; no Gemini/Hindsight environment variable is configured.

## Known Limitations

- Docker is not installed; G1 uses officially supported native Windows Hindsight with embedded pg0.
- The schema currently uses controlled `create_all` initialization for the isolated spike; migrations are deferred until G2.
- Gemini compatibility/quota, actual retain/recall relevance, restart persistence, and bank isolation have not been locally verified.
- Native startup requires process-level UTF-8 environment settings on this Windows console; without them Hindsight 1.1.0 fails while printing its banner.
- No review engine, HTTP API, frontend, feedback flow, or ablation implementation exists.

## Next Action

Provide `HINDSIGHT_API_LLM_API_KEY` through a local ignored `.env`, start native Hindsight, and execute `seed-and-recall`, process restart, `recall-only`, `isolation-check`, and stable-ID reingestion.

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

## Maintenance Checklist

- Review `git status` and `git diff` before every commit.
- Record exact executed commands and observed outcomes; never infer `PASS`.
- Update current state, blockers, limitations, and next action after meaningful work.
- Mark only verified roadmap items complete.
- Update `ARCHITECTURE.md` for changed components, schemas, services, or tradeoffs.
- Add `README.md` only when its setup and verification commands are tested.
