# CodeDNA verified demo path

Observed on 2026-10-27 against the API restarted from `backend` with `CODEDNA_DEMO_SCENE=evolved` and `CODEDNA_HINDSIGHT_AUTOSTART=1`. Vite was already serving `http://127.0.0.1:5173` and proxying `/api` to port 8000.

1. Start the API with the README environment. `GET /api/health` was `hindsight: starting` about 10 seconds after process start and first reported `hindsight: ready` at 91 seconds. The ready transition fell between 86 and 91 seconds on a 5-second poll. Models were already on disk; a cold download can take longer. Later clicks reuse that server.
2. Open the overview. Acme Commerce shows the direct status write in PR #87. The change is ordinary TypeScript that would compile, and it still writes `status: "shipped"` through Prisma instead of the shipping workflow.
3. With the evolved scene, `DEC-0042` is superseded and `DEC-0103` is the only active Acme decision. Lineage for either id is `DEC-0042` (2026-10-01, `OrderService.transitionOrder()`) then `DEC-0103` (2026-10-22, `OrderWorkflow.shipOrder()`).
4. Run one memory review of `pr-acme-87` only after health says ready. The observed job `job-46388a2357ac42ef` went from queued to complete in 16,242 ms (`starting_hindsight` at 114 ms, `recalling_and_reviewing` at 4,138 ms). Run `review-71b152920a834965` elapsed 12,182 ms. Timings were query 0 ms, recall 1,612 ms, validation 4 ms, and generation 10,546 ms. The only finding was `team_convention` on `src/orders/update.ts` line 14, citing only active `DEC-0103`.
5. Open Team DNA, then View evolution. The chain shows superseded `DEC-0042` and current `DEC-0103`. The current-design card shows the shipping rule and source PR #103.
6. Run one Memory Lab comparison for the same PR. Job `job-227bd332a40b4152` completed in 82,825 ms and `evaluation.passed` was true. All six checks passed: `same_candidate`, `same_model`, `memory_retrieved_validated_source`, `memory_produced_grounded_team_finding`, `baseline_has_no_memory_citations`, and `baseline_has_no_team_policy_finding`. The memory run elapsed 76,238 ms (recall 331 ms, generation 75,887 ms, validation 4 ms) and again cited only `DEC-0103` at line 14. The baseline elapsed 2,386 ms (generation 2,368 ms, recall 0 ms, validation 2 ms) and kept a general finding on line 15 with no evidence ids.
7. Dismiss or accept on a finding stores feedback and does not change the active decision. This pass did not submit a new feedback event: the review page shows findings only for the run started on that page, and the live review above was the one memory run.
8. Select Analytics Service in the sidebar. Historical PR #11 and active `DEC-0211` are separate from the order-status design; held-out PR #29 is the Memory Lab candidate. Its recorded live comparison passed 6/6 guardrails with one validated analytics source and no baseline citation.

For a clean replay, stop the API, execute the guarded reset and evaluation commands from the README, then restart the API with the evolved scene. Do not reset while a review request is active.

## Truthful limits to state

- Fixtures are synthetic and the recorded evaluation contains two held-out policy cases; report them as counts, not an accuracy percentage.
- Gemini is an externally rate-limited free-tier dependency; no paid fallback is enabled. During the first boot in this session Hindsight logged `429 RESOURCE_EXHAUSTED` because the free-tier cached-content storage limit was 0, then continued with an uncached call. The successful review and comparison above did not return 429 or 503.
- The first API boot loads local retrieval models once. Later clicks reuse the running server, but a memory review still calls Gemini and can be slow. The comparison's memory generation was 75,887 ms.
- A same-tab refresh reattaches to an active job and completed results restore from SQLite. Closing the tab loses only the active per-tab locator, not completed data.
- Demo authority labels are not production authentication or RBAC.
- CodeDNA never executes or modifies the candidate repository.
