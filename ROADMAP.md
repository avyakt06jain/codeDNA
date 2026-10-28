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
- **Next:** Link finding-location actions to programmatic diff-line focus so keyboard users land on the cited changed line.

## Documentation and version-control policy

For every meaningful increment: inspect the diff, run relevant checks, update `ROADMAP.md` and `PROGRESS.md`, commit atomically, and push. Mark tests `NOT RUN` when they were not executed. Update `ARCHITECTURE.md` when contracts or deployment decisions change. Create `README.md` only after its commands have been run successfully.

