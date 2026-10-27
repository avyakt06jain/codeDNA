# Observable background review jobs

**Status:** Verified on 2026-10-27.

## Contract

`POST /api/prs/{pr_id}/review-jobs` validates the stored PR, persists a queued job, returns `202 Accepted`, and schedules review execution after the response. Clients poll `GET /api/review-jobs/{job_id}`.

Stages are `queued`, `starting_hindsight`, `recalling_and_reviewing`, `reviewing_diff`, `complete`, and `failed`. Completion embeds the persisted, serialized `ReviewRun`. Unexpected exceptions expose only `review_service_unavailable`; known application validation errors use bounded error codes.

The browser maps stages to readable loading text and stops after six minutes. The original synchronous review route remains for smoke/compatibility use, while Review Workspace uses jobs.

## Trust and reliability boundaries

- Repository and PR identity still come from application storage.
- Workers open an independent SQLAlchemy session; request sessions are never reused across threads.
- Job state and completed results survive browser reloads.
- Active work does not survive API-process termination because the local MVP uses in-process FastAPI background tasks, not an external worker queue.
- Memory Lab comparison is not yet migrated to jobs.

## Verification

- Unit tests cover queued-to-complete persistence and sanitized unexpected failure.
- A live baseline job returned queued state immediately and later resolved to a persisted, citation-free baseline review.
