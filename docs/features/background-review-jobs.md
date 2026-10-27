# Observable background review jobs

**Status:** Verified on 2026-10-27.

## Contract

`POST /api/prs/{pr_id}/review-jobs` validates the stored PR, persists a queued `review` job, returns `202 Accepted`, and schedules review execution after the response. `POST /api/prs/{pr_id}/comparison` does the same for a paired `comparison` job. Clients poll `GET /api/review-jobs/{job_id}`.

Stages are `queued`, `starting_hindsight`, `recalling_and_reviewing`, `reviewing_diff`, `reviewing_baseline`, `complete`, and `failed`. Single-review completion embeds one persisted serialized `ReviewRun`; comparison completion embeds persisted memory/baseline runs and deterministic evaluation. Unexpected exceptions expose only `review_service_unavailable`; known application validation errors use bounded error codes.

The browser maps stages to readable loading text and stops after six minutes. The original synchronous review route remains for smoke/compatibility use, while Review Workspace uses jobs.

## Trust and reliability boundaries

- Repository and PR identity still come from application storage.
- Workers open an independent SQLAlchemy session; request sessions are never reused across threads.
- Job state and completed results survive browser reloads.
- Active work does not resume after API-process termination because the local MVP uses in-process FastAPI background tasks, not an external worker queue.
- The shared Hindsight server is API-owned, while each worker creates its own SDK client to avoid sharing event-loop-bound client state across threads.

## Verification

- Unit tests cover review/comparison queued-to-complete persistence and sanitized unexpected failure.
- A live paired job returned queued state immediately and later resolved to two persisted runs with all six provenance/contamination guardrails passing.
