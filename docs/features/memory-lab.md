# Memory Lab

**Status:** Verified on 2026-10-27 through CLI, API, and browser.

## Experiment contract

Memory Lab queues one persisted comparison job that runs the same stored candidate PR through the same `GeminiReviewModel` instance and structured schema. The memory run recalls and validates Hindsight evidence. The baseline skips recall entirely and receives an empty evidence list. Both runs are persisted before comparison.

The deterministic evaluator passes only when:

- candidate PR and provider/model match;
- memory returned at least one SQLite-validated source;
- a memory team finding cites only a retrieved, validated decision;
- baseline contains neither evidence IDs nor a team-convention finding.

The UI displays raw run IDs, timings, findings, categories, citations, and every guardrail. It does not claim that a passing comparison proves general review accuracy.

## Labeled cases

- Acme Commerce: historical PR #103 → held-out PR #120 → active `DEC-0103`.
- Analytics Service: historical PR #11 → held-out PR #29 → active `DEC-0211`.

The analytics candidate uses locale-formatted timestamp persistence but its title, description, diff, and generated memory query omit the expected representation, decision/document IDs, and source PR ID. Repository lookup selects `codedna-repo-analytics-service`; the baseline receives no memory evidence. Both cases passed the same six guardrails against real Hindsight/Gemini. This is a count of two synthetic cases, not an accuracy benchmark.

The browser polls explicit `starting_hindsight`, `recalling_and_reviewing`, and `reviewing_baseline` stages. Reloading the browser does not erase the stored job or completed runs; API-process termination can still interrupt active in-process execution.

## Reset boundary

`codedna-demo-reset --confirm-demo-reset` deletes only `codedna-repo-acme-commerce`, `codedna-repo-analytics-service`, and a SQLite URL ending in `codedna.sqlite3`. It then recreates the application schema and deterministic synthetic fixtures. Missing banks are treated as already reset; other failures stop the operation.

## Failure behavior

- Provider or Hindsight failure returns a failed request/CLI exit rather than a fabricated comparison.
- Gemini `429` and `503` responses receive at most two bounded retries; other errors fail immediately.
- Any baseline policy/citation contamination makes the comparison fail.
- A relevant but unresolvable or superseded fact cannot satisfy the memory-source check.
