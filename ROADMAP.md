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

**Status:** In progress

- Persisted feedback with nonbinding-by-default semantics.
- Explicit supersession and PR #103 to PR #120 behavior proof.

## G5 — Evaluation and submission

**Status:** Not started

- Controlled Memory Lab comparison, reproducible seed/reset, end-to-end checks, and submission artifacts.

## Documentation and version-control policy

For every meaningful increment: inspect the diff, run relevant checks, update `ROADMAP.md` and `PROGRESS.md`, commit atomically, and push. Mark tests `NOT RUN` when they were not executed. Update `ARCHITECTURE.md` when contracts or deployment decisions change. Create `README.md` only after its commands have been run successfully.

