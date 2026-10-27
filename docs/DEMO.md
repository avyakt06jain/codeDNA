# CodeDNA verified demo path

1. Start FastAPI on `127.0.0.1:8000` and Vite on `127.0.0.1:5173` using the README commands.
2. In Review Workspace, select PR #87 to show the direct status mutation and run with memory. Open the evidence drawer to inspect the decision and source PR.
3. In Team DNA, show that policy state and historical source live in application storage rather than model text.
4. Select PR #120 and open Memory Lab. Run comparison.
5. Verify all six guardrails, then contrast the Hindsight-assisted `DEC-0103` team finding with the no-memory general finding.
6. Explain that feedback is nonbinding and `DEC-0042` remains historical after explicit supersession by `DEC-0103`.

For a clean replay, stop the API, execute the guarded reset and evaluation commands from the README, then restart the API. Do not reset while a review request is active.

## Truthful limits to state

- Fixtures are synthetic and the recorded evaluation contains one held-out policy case.
- Gemini is an externally rate-limited free-tier dependency; no paid fallback is enabled.
- Local review requests are synchronous and can be slow during Hindsight/model startup.
- Demo authority labels are not production authentication or RBAC.
- CodeDNA never executes or modifies the candidate repository.
