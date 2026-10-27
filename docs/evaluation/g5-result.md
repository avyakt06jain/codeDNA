# G5 evaluation result — 2026-10-27

This is a recorded result for one synthetic held-out case, PR #120. It is not a generalized accuracy benchmark.

## Clean CLI run

- Command: `codedna-evaluation-smoke`
- Model/provider: `gemini-3.1-flash-lite` / Gemini
- Result: **PASS, 6 of 6 guardrails**
- Memory run: `review-bf56a41e201e4590`, 78,626 ms, one team-convention finding, one validated source and citation (`DEC-0103`, source PR #103)
- Baseline run: `review-b4f800b3e9184943`, 26,449 ms, one general finding, zero memory citations, zero team-policy findings
- Generated findings dropped by validation: zero in both runs

The immediately preceding clean attempt failed on a transient Gemini `503 UNAVAILABLE` during the baseline call. That failure led to the bounded transient-error retry; it was not counted as a pass.

## Live browser run

- Surface: Memory Lab at `http://127.0.0.1:5173`
- Result: **PASS, 6 of 6 guardrails**
- Memory run: `review-a9c2ce1f1fc74a39`, 4.9 s, `DEC-0103`
- Baseline run: `review-215fbf1c9b5f4636`, 2.3 s, no memory citation

The latency difference between runs and executions reflects local model warmup plus external provider conditions; it is not presented as a performance claim.

## Post-G5 analytics expansion — 2026-10-27

- Candidate: synthetic Analytics Service PR #29; historical source PR #11 was absent from candidate/model baseline context.
- Job: `job-e1afe7434b974c8c`
- Result: **PASS, 6 of 6 guardrails**
- Memory run: `review-166ed59f23614459`, 15,778 ms, two team-convention findings, one validated source and citation (`DEC-0211`, source PR #11, analytics bank only)
- Baseline run: `review-a3d5f1e523ec4ae8`, 2,000 ms, one general finding, zero citations, zero team-policy findings
- Retrieval query used by the already-running API: `Review historical guidance relevant to changed behavior in src/events/session.ts.`

This expands the recorded set to two synthetic held-out cases. It still does not support a generalized accuracy percentage.
