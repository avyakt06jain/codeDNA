# Memory Lab

**Status:** Verified on 2026-10-27 through CLI, API, and browser; active-job recovery and accessible progress/catalog announcements verified through 2026-11-05.

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

The browser displays both cases from `GET /api/evaluation-cases` before the comparison controls. The backend owns the candidate/decision registry, then resolves repository, historical source PR, held-out candidate, active decision, and newest valid completed comparison from SQLite. A missing, inactive, or cross-repository record is omitted. Latest results are recomputed through the normal deterministic evaluator and expose only a sanitized job ID, pass state, passed/total check counts, and UTC update time; absent results are shown honestly. The candidate is selected only if it is also present in that repository's fetched PR list. Catalog reads and links never create provider work, and stored results do not imply current provider availability or general accuracy.

Catalog network errors and HTTP `408`, `425`, `429`, `500`, `502`, `503`, and `504` receive at most three retries after 1, 2, and 4 seconds. Exhaustion or a nonretryable failure renders an alert and `Retry fixture catalog`; that action starts a new bounded GET-only cycle. Manual success focuses the fixture heading, while another failure focuses the recreated retry control. Neither path starts a comparison or provider call.

After success, `Refresh fixture catalog` performs the same bounded read-only cycle so stored comparison results created in another tab can appear without a page reload. A successful refresh replaces the catalog and focuses its heading. If recovery is exhausted, the last successful cases remain visible and navigable alongside the retry alert. Tests assert that refresh and recovery issue no POST.

Successful completion of a new, reattached, or manually rechecked comparison automatically starts one cycle through the same catalog loader. It updates the stored result without another action, does not move keyboard focus, and adds no provider work; only the original explicit comparison action posts a job. Automatic failure retains the previous catalog and exposes the normal retry alert.

The same persistent polite/atomic page status announces that automatic refresh only when the selected fixture's latest job ID, pass state, passed/total count, or update timestamp differs from the prior catalog. The announcement names the repository and exact guardrail count. An unchanged response leaves the single `Comparison complete` status in place; manual refresh uses its existing focus movement, and catalog errors remain assertive alerts.

Every successful catalog response also records the browser observation time and displays it as localized text inside an HTML `time` with an ISO `dateTime`. Failed retries leave the previous value untouched, matching the retained last-known-good rows. This is catalog-read freshness only; it is not a Hindsight/Gemini health or execution timestamp.

The fixture region carries `aria-busy` during both initial loading and later refresh cycles. Initial activity is labeled loading; a refresh is labeled refreshing and leaves previously successful rows plus their check time available. Success or terminal failure clears the busy state, and no focus movement is added beyond the existing manual recovery contract.

The browser polls explicit `starting_hindsight`, `recalling_and_reviewing`, and `reviewing_baseline` stages. Reloading the browser does not erase the stored job or completed runs; API-process termination can still interrupt active in-process execution.

On selection or browser refresh, the UI first checks for a validated active comparison job ID in the current tab's session storage. If present, it resumes the existing `GET /api/review-jobs/{job_id}` polling loop and does not post a replacement job. Without a local locator, it discovers the newest queued/running comparison for the same stored PR and resumes that job when present. Only then does it read `/api/prs/{pr_id}/comparisons/latest`; the backend returns a completed comparison with two persisted runs that both belong to the requested PR, then recomputes the same deterministic guardrails. An empty response renders the normal no-comparison state. None of these recovery paths calls Hindsight/Gemini by itself.

Comparison creation uses the same atomic claim. Concurrent requests for the same PR receive one comparison job ID, and only its creator schedules the memory/baseline branches. A reused response produces an immediate visible and polite reattachment announcement before polling resumes, explicitly stating that neither provider branch was started again.

Memory Lab uses one persistent polite/atomic live region for loading, restoration, and background comparison stages. Comparison-specific labels distinguish memory-assisted work, baseline work, completion, and persisted-result restoration instead of announcing these as a generic review.

Transient status-poll failures display and announce that CodeDNA is reconnecting to the existing comparison. The bounded retry reuses its job ID and does not rerun either model branch.

If all bounded attempts fail, Memory Lab preserves the active comparison locator and shows `Check comparison again`. Activating it polls that same job through GET only, so neither comparison branch is recreated.

A collapsed `Active job details` disclosure remains available while that locator is active or recoverable. It shows only the validated opaque job ID, readable comparison status, sanitized started/updated ages, and exact localized times. Malformed server timestamp values are omitted, and the disclosure disappears on known terminal completion or failure.

After three minutes without a valid `updated_at` change, a visible status warning says that progress has not been reported and that CodeDNA is still checking the same comparison. It does not rerun either model branch or mark the comparison failed.

If that active job returns `404`, Memory Lab clears the stale locator and performs its existing latest-comparison lookup for the selected PR. A stored paired result restores normally; no comparison POST or model branch is started by recovery.

## Reset boundary

`codedna-demo-reset --confirm-demo-reset` deletes only `codedna-repo-acme-commerce`, `codedna-repo-analytics-service`, and a SQLite URL ending in `codedna.sqlite3`. It then recreates the application schema and deterministic synthetic fixtures. Missing banks are treated as already reset; other failures stop the operation.

## Failure behavior

- Provider or Hindsight failure returns a failed request/CLI exit rather than a fabricated comparison.
- Gemini `429` and `503` responses receive at most two bounded retries; other errors fail immediately.
- Any baseline policy/citation contamination makes the comparison fail.
- A relevant but unresolvable or superseded fact cannot satisfy the memory-source check.
