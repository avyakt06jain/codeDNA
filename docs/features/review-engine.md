# Review Engine

**Status:** Verified for the synthetic PR #87 G2 slice on 2026-10-27.

## Contract

The engine accepts a stored pull-request ID and a server-selected mode. It parses a bounded unified diff, maps added new-side lines, optionally recalls repository-scoped Hindsight evidence, calls the same structured Gemini adapter in both modes, validates every candidate, and persists the run and accepted findings.

`team_convention` findings require at least one decision ID that was returned by Hindsight for this run and then resolved to an active, reviewer-confirmed decision and source PR in the same repository. `general` findings cannot cite team evidence. Invalid files, lines, decision IDs, or categories are dropped with a private validation reason.

## Trust and ablation boundary

Diffs, PR text, recalled text, and model output are untrusted data. The backend selects the repository bank and evidence allowlist. Baseline mode receives the same diff, model, schema, temperature, and system instruction, but no Hindsight call and no historical-evidence block.

## Errors

Empty, malformed, oversized, binary, or traversal-bearing diffs fail before model invocation. Missing PRs fail explicitly. External provider failures do not produce fabricated findings. Review creation is synchronous for the current fixture and will move to a persisted background job if workloads grow.

## Verification

- Twelve backend tests cover provenance, diff/line validation, citation rejection, baseline isolation, persistence, and FastAPI contracts.
- The real memory run cited only `DEC-0042` on an actual added line and resolved its Hindsight fact to PR #42.
- The paired baseline emitted a generic finding with no historical IDs or team-policy category.
