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
- The CLI reports an unavailable Hindsight service as structured failure with exit code 2.

## In Progress

- Preparing the first native Hindsight startup with Gemini.
- Real retain, recall, restart persistence, isolation, and stable-document checks remain to be executed.

## Blocked

- A real Hindsight retain/recall run requires a Gemini API key with sufficient free quota; no Gemini/Hindsight environment variable is configured.

## Known Limitations

- Docker is not installed; G1 uses officially supported native Windows Hindsight with embedded pg0.
- The schema currently uses controlled `create_all` initialization for the isolated spike; migrations are deferred until G2.
- Hindsight startup, Gemini compatibility/quota, actual recall relevance, restart persistence, and bank isolation have not been locally verified.
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

## Maintenance Checklist

- Review `git status` and `git diff` before every commit.
- Record exact executed commands and observed outcomes; never infer `PASS`.
- Update current state, blockers, limitations, and next action after meaningful work.
- Mark only verified roadmap items complete.
- Update `ARCHITECTURE.md` for changed components, schemas, services, or tradeoffs.
- Add `README.md` only when its setup and verification commands are tested.
