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

**Status:** In progress — live integration blocked on Gemini credential

**Priority:** First implementation milestone

### Dependencies

- Native Windows Python environment with compatible pinned Hindsight API/client packages.
- Working Gemini API key with free-tier access to a Hindsight-compatible model.
- Network access for dependency and model downloads.

### Deliverables

- Minimal SQLite provenance registry for repositories, PR sources, decisions, and memory documents. **Implemented; verification checkpoint pending.**
- Backend-controlled repository-to-Hindsight-bank mapping. **Implemented; live service unverified.**
- Real retain of synthetic PR #42 decision `DEC-0042` as `decision-DEC-0042`.
- Semantically related recall from PR #87 context with source chunks.
- Deterministic provenance validation against SQLite.
- Recall after a clean Hindsight process restart without re-retaining.
- Second-bank isolation and stable-document reingestion checks.

### Acceptance criteria

- Hindsight health/version and configured provider are observed successfully.
- Retain completes against real Hindsight.
- Recall returns relevant evidence and resolves it to active `DEC-0042` and source PR #42.
- Recall still resolves after service restart without a retain call.
- The `analytics-service` bank does not expose `DEC-0042`.
- Reusing the stable document ID does not accumulate duplicate source documents.
- Exact commands, versions, outputs, failures, and limitations are recorded in `PROGRESS.md`.

### Risks

- Gemini free-tier quota, region, or model compatibility may block extraction.
- First-run Hindsight/embedding model downloads may be large or slow.
- Native pg0 behavior and installed SDK response shapes remain unverified locally.

## G2 — Backend review core

**Status:** Not started

- Diff parsing and new-side line validation.
- Memory query building, policy filtering, structured review generation, and evidence validation.
- Persisted review runs and controlled no-memory baseline.

## G3 — Product UI

**Status:** Not started

- Review Workspace with real fixture diff, findings, evidence, and truthful errors.
- Team DNA decision inspection and confirmation flow.

## G4 — Feedback and living conventions

**Status:** Not started

- Persisted feedback with nonbinding-by-default semantics.
- Explicit supersession and PR #103 to PR #120 behavior proof.

## G5 — Evaluation and submission

**Status:** Not started

- Controlled Memory Lab comparison, reproducible seed/reset, end-to-end checks, and submission artifacts.

## Documentation and version-control policy

For every meaningful increment: inspect the diff, run relevant checks, update `ROADMAP.md` and `PROGRESS.md`, commit atomically, and push. Mark tests `NOT RUN` when they were not executed. Update `ARCHITECTURE.md` when contracts or deployment decisions change. Create `README.md` only after its commands have been run successfully.

