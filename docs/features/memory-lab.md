# Memory Lab

**Status:** Verified on 2026-10-27 through CLI, API, and browser; active-job recovery and accessible progress/catalog announcements verified through 2026-11-06.

## Experiment contract

Memory Lab queues one persisted comparison job that runs the same stored candidate PR through the same `GeminiReviewModel` instance and structured schema. The memory run recalls and validates Hindsight evidence. The baseline skips recall entirely and receives an empty evidence list. Both runs are persisted before comparison.

The deterministic evaluator passes only when:

- candidate PR and provider/model match;
- memory returned at least one SQLite-validated source;
- a memory team finding cites only a retrieved, validated decision;
- baseline contains neither evidence IDs nor a team-convention finding.

The UI displays normalized persisted run IDs, timings, findings, categories, citations, and every guardrail. Each memory/baseline column shows only an ID accepted by the bounded `review-...` or `run-...` frontend grammar; invalid values are omitted. These are correlation handles outside live regions, not authorization. The UI does not claim that a passing comparison proves general review accuracy.

Both nested reviews must carry IDs that pass the bounded `review-...` or `run-...` grammar, exact slot roles, explicit terminal status, and independently matching input identity: `memory.mode` must be `memory`, `baseline.mode` must be `baseline`, both `status` values must be `complete`, and both branches must carry the same non-empty `pr_id`, `provider`, and `model`. Their `pr_id` must also equal the PR used to start, poll, or restore the current workspace operation; matching branches for a different candidate are invalid. Missing, malformed, swapped, partial, failed, context-mismatched, or mutually mismatched branch metadata rejects the comparison before the general review normalizer can default it. The evaluation must include Boolean values for the six backend-defined checks: `same_candidate`, `same_model`, `memory_retrieved_validated_source`, `memory_produced_grounded_team_finding`, `baseline_has_no_memory_citations`, and `baseline_has_no_team_policy_finding`. The first two checks must be true and agree with the independently compared branch fields. The other four must agree with normalized content: memory evidence is non-empty, memory team-policy citations are non-empty and all resolve to validated decision IDs, and the baseline has neither citations nor team-convention findings. A missing, non-Boolean, or content-contradicting required check rejects the whole comparison; additional Boolean detail can still render. `evaluation.passed` is also required and Boolean. It must equal the conjunction of the normalized Boolean checks; a missing result, `passed: true` with any false check, or `passed: false` with all true checks is rejected. `evaluation.run_ids` is required, both entries must pass the same bounded grammar, and each must exactly equal its nested review ID. The seven evaluator counts are required finite non-negative integers and must equal values independently derived from normalized validated evidence, findings, team findings, and unique citations. A branch-state/role/identity failure, incomplete check/count set, missing outcome, missing/invalid nested or evaluation ID, malformed container, content mismatch, request-context mismatch, or outcome contradiction rejects the comparison. Latest-result recovery surfaces its task-specific stored-comparison integrity alert. Active completed-job polling reports `finished with invalid correlation metadata` for a present rejected payload and reserves `finished without a result` for a structurally absent payload. Both are terminal, clear the locator, and render no guardrails or partial correlation handle.

## Labeled cases

- Acme Commerce: historical PR #103 → held-out PR #120 → active `DEC-0103`.
- Analytics Service: historical PR #11 → held-out PR #29 → active `DEC-0211`.

The analytics candidate uses locale-formatted timestamp persistence but its title, description, diff, and generated memory query omit the expected representation, decision/document IDs, and source PR ID. Repository lookup selects `codedna-repo-analytics-service`; the baseline receives no memory evidence. Both cases passed the same six guardrails against real Hindsight/Gemini. This is a count of two synthetic cases, not an accuracy benchmark.

The browser displays both cases from `GET /api/evaluation-cases` before the comparison controls. The backend owns the candidate/decision registry, then resolves repository, historical source PR, held-out candidate, active decision, and newest valid completed comparison from SQLite. A missing, inactive, or cross-repository record is omitted. Latest results are recomputed through the normal deterministic evaluator and expose only a sanitized job ID, pass state, passed/total check counts, and UTC update time; absent results are shown honestly. The candidate is selected only if it is also present in that repository's fetched PR list. Catalog reads and links never create provider work, and stored results do not imply current provider availability or general accuracy.

Catalog network errors and HTTP `408`, `425`, `429`, `500`, `502`, `503`, and `504` receive at most three retries after 1, 2, and 4 seconds. Exhaustion or a nonretryable failure renders an alert and `Retry fixture catalog`; that action starts a new bounded GET-only cycle. Manual success focuses the fixture heading, while another failure focuses the recreated retry control. Neither path starts a comparison or provider call.

After success, `Refresh fixture catalog` performs the same bounded read-only cycle so stored comparison results created in another tab can appear without a page reload. A successful refresh replaces the catalog and focuses its heading. If recovery is exhausted, the last successful cases remain visible and navigable alongside the retry alert. Tests assert that refresh and recovery issue no POST.

Successful completion of a new, reattached, or manually rechecked comparison automatically starts one cycle through the same catalog loader. It updates the stored result without another action, does not move keyboard focus, and adds no provider work; only the original explicit comparison action posts a job. Automatic failure retains the previous catalog and exposes the normal retry alert.

The same persistent polite/atomic page status announces that automatic refresh only when the selected fixture's latest job ID, pass state, passed/total count, or update timestamp differs from the prior catalog. The announcement names the repository, states `Passed` or `Needs attention` from the validated pass Boolean, and gives the exact guardrail count. An unchanged response leaves the single `Comparison complete` status in place; manual refresh uses its existing focus movement, and catalog errors remain assertive alerts.

Every successful catalog response also records the browser observation time and displays it as localized text inside an HTML `time` with an ISO `dateTime`. Failed retries leave the previous value untouched, matching the retained last-known-good rows. This is catalog-read freshness only; it is not a Hindsight/Gemini health or execution timestamp.

The fixture region carries `aria-busy` during both initial loading and later refresh cycles. Initial activity is labeled loading; a refresh is labeled refreshing and leaves previously successful rows plus their check time available. Success or terminal failure clears the busy state, and no focus movement is added beyond the existing manual recovery contract.

If refresh recovery is exhausted after a successful read, the recovery block explicitly calls the retained rows last-known-good, repeats the successful ISO/localized check time, and says the failed refresh did not replace them. The fallback label is absent on initial failure because the browser has no prior trusted catalog. A later success clears both the error and stale label.

Each valid latest result also displays its sanitized opaque comparison job ID. The API client accepts only the bounded `job-...` format already used by background-job recovery, and the catalog view does not poll that job or expose its result payload. A later successful catalog read replaces the ID together with the stored counts/time; no-result fixtures show no identifier.

A valid optional result update time is normalized to canonical ISO UTC by the API client and rendered in semantic HTML `time` while its visible value remains localized. Invalid values are omitted rather than guessed. This persisted-job time is distinct from the browser's catalog `Last checked` observation time.

Each valid stored result also states `Passed` or `Needs attention` from its validated pass Boolean before the guardrail count. The textual label is intentionally independent of color and prevents users from having to derive the case outcome from the count. It describes only that recorded synthetic evaluation.

Fixture links keep the short visible `Open case` or `Case selected` wording, but each accessible name also includes the repository and held-out PR number. The selected link uses `aria-current="page"`; other case links omit the attribute. This disambiguates repeated controls and exposes current-page semantics while preserving the same read-only route and zero-provider-work behavior.

The browser polls explicit `starting_hindsight`, `recalling_and_reviewing`, and `reviewing_baseline` stages. Reloading the browser does not erase the stored job or completed runs; API-process termination can still interrupt active in-process execution.

On selection or browser refresh, the UI first checks for a validated active comparison job ID in the current tab's session storage. If present, it resumes the existing `GET /api/review-jobs/{job_id}` polling loop and does not post a replacement job. Without a local locator, it discovers the newest queued/running comparison for the same stored PR and resumes that job when present. Only then does it read `/api/prs/{pr_id}/comparisons/latest`; the backend returns a completed comparison with two persisted runs that both belong to the requested PR, then recomputes the same deterministic guardrails. An explicitly null result renders the normal no-comparison state. A present result that fails structural or run-ID correlation validation throws a task-specific integrity error and renders neither guardrails nor the empty state. None of these recovery paths calls Hindsight/Gemini by itself.

`Run comparison` stays disabled until that recovery sequence has finished for the exact currently selected PR. Changing selection clears the recovery marker before any control can start work. This prevents a fast click from being followed by the recovery effect resetting a newly created or reattached stage. Tests hold latest-result recovery and reused-job polling behind explicit promise gates, proving the control barrier, zero recovery POSTs, and the reattachment announcement without relying on wall-clock delays.

Those controls and their comparison result live in a named `Comparison workspace` region whose `aria-busy` is true during pull-request loading or persisted comparison recovery and false after that boundary settles. This is independent from the fixture catalog's own `aria-busy`, so catalog refresh and comparison readiness are not presented as the same operation. Visible load/restoration notes remain available while the page's existing polite/atomic live region is the only element with matching status semantics.

If active/latest comparison recovery fails, including when a non-null stored result fails correlation validation, the region settles to `aria-busy=false` and an assertive task-specific alert includes the sanitized failure detail, states that recovery started neither comparison provider branch, and directs the user to run a new comparison when memory is connected. Under unresolved creation status, the same invalid payload keeps creation disabled and recreates/focuses `Check creation status`. The normal Hindsight readiness gate remains authoritative, and recovery issues no POST.

`Retry saved comparison recovery` starts a fresh exact-PR recovery generation against the already loaded repository PR list: it checks active comparison work and reads the latest paired result only when no active job exists. It issues no creation POST. Success clears the alert/action and restores or resumes persisted work; another failure recreates the same bounded user choice.

That manual retry also preserves keyboard position. A restored result focuses the `Guardrails` heading, a repeated failure focuses the newly rendered retry button, and a successful empty recovery focuses the named Comparison workspace. Changing the selected PR cancels the pending focus intent.

If the manual retry succeeds but finds neither an active job nor a persisted comparison, the existing polite live region announces that exact empty outcome and confirms neither provider branch started. The ordinary `No comparison yet` surface remains visible; the outcome is not presented as an error. Active reattachment and restored comparisons do not use the empty-result announcement.

Comparison creation uses the same atomic claim. Concurrent requests for the same PR receive one comparison job ID, and only its creator schedules the memory/baseline branches. A reused response produces an immediate visible and polite reattachment announcement before polling resumes, explicitly stating that neither provider branch was started again.

If the creation response is lost and automatic claim reads remain empty, `Run comparison` stays disabled and `Check creation status` performs only same-PR comparison active discovery plus latest paired-result restoration when no claim exists. It resumes a visible job, restores a completed comparison, or reenables an explicit new run after a successful empty boundary. Read failure remains fail-closed. The action sends no POST, starts neither provider branch, and returns focus to Guardrails, the named workspace, or the recreated check action.

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
