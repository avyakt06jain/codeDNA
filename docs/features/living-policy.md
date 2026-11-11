# Living policy and feedback

**Status:** Verified on 2026-10-27.

## Contract

- A finding may receive accepted, rejected, corrected, or not-applicable feedback.
- Feedback is historical evidence and is always nonbinding. The feedback endpoint refuses direct policy promotion.
- A policy changes only through the separate supersession operation, which requires the controlled `demo-maintainer` actor, an active predecessor, and a source PR in the same repository.
- Supersession preserves the old decision as historical truth, creates a new active decision with a stable memory document, and retains it in the backend-selected repository bank.
- Recall results are reconciled against SQLite. Relevant but superseded facts never become allowlisted review evidence.
- Team DNA accepts a repository decision catalog only when every policy carries the requested repository identity, valid unique decision/source identities, bounded text, explicit lifecycle/authority, object scope, and a non-self predecessor that resolves within the catalog when present. A single invalid row blocks selection and detail reads.

## Verified scenario

Synthetic PR #103 establishes `DEC-0103`: shipping transitions use `OrderWorkflow.shipOrder()`. It supersedes `DEC-0042` without deleting its source history. Synthetic PR #120 uses the old workflow.

`codedna-policy-smoke` starts real Hindsight, recalls both decision documents, rejects `DEC-0042` as non-authoritative, and produces a line-31 finding citing only `DEC-0103` and PR #103. A stored reviewer acceptance remains `binding: false`.

## Errors and trust boundaries

- Unknown finding, inactive predecessor, cross-repository source, or unauthorized actor: reject without policy mutation.
- Hindsight retention failure: preserve truthful ingestion status; do not claim the new decision is retrievable.
- Missing or stale citations: deterministic review validation drops the finding.
- Malformed, duplicated, off-repository, or self-superseding decision catalog row: reject the full catalog before rendering policy content.
- Evidence-detail run mismatch or a malformed, missing, extra, duplicate, or cross-repository cited decision: reject the full response and render no partial provenance links.
- `demo-maintainer` is a local demonstration boundary, not production authentication.

## Checks

- Unit tests cover nonbinding feedback, blocked direct promotion, and transactional supersession state.
- The live smoke proves real retain/recall, historical-versus-active reconciliation, and current-policy review behavior.
