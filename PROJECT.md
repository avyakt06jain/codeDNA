# PROJECT.md — CodeDNA Product Definition and Hackathon Brief

> **Product source of truth:** What we are building, why, for whom, what success looks like, and what not to build yet. Read with `AGENTS.md` and `ARCHITECTURE.md`.
>
> **Status:** Initial design specification; does not assert an existing implementation.
>
> **Last design consolidation:** 2026-10-26. Update this document when product decisions change.

---

## 1. Product identity

| Field | Definition |
|---|---|
| Product | **CodeDNA** |
| Tagline | **Your codebase has a history. Your reviewer should remember why.** |
| Short pitch | A memory-driven AI code reviewer that turns previous pull-request decisions and developer feedback into explainable, evolving engineering context for future reviews. |
| Core insight | Most code review tools inspect the present diff; useful team-specific engineering rationale is scattered across earlier PRs, discussions, fixes, and decisions. |
| Primary user | Engineering team reviewer, developer, or tech lead reviewing code in an established repository |
| Secondary user | New engineer trying to understand why a team's code uses certain patterns |
| Hackathon | **HackwithHyderabad 3.0 — AI Agents That Learn Using Hindsight** |
| Required technology | **Hindsight (Vectorize)** for real long-term agent memory |
| Team | **Fanatical Devs** — Anshika Prasad, Avyakt Jain, Mohit Gupta |
| Product type | Focused, inspectable developer tool; not a generic chat interface |
| Initial execution | Free/local software on ordinary laptop/desktop, no dedicated GPU, no paid hosting |

**Alternative positioning, for speech:** "Most AI reviewers understand your code. CodeDNA is designed to remember why your team writes it that way."

**One-line closing:** "Pull requests end. Decisions shouldn't."

## 2. The problem

Engineering teams accumulate decisions through reviews: architectural guardrails, incident lessons, API contracts, error-handling exceptions, security considerations, migration practices, and preferences. These decisions are often hidden in closed PRs and discussions rather than encoded in machine-readable rules.

Common consequences:

1. A developer repeats a previously rejected pattern without knowing why it was rejected.
2. Another reviewer spends time explaining the same repository-specific principle again.
3. A new hire sees the code but not the architectural history behind it.
4. A generic LLM code reviewer recommends technically reasonable but locally inappropriate changes.
5. The team's guidance changes, yet tools and documentation may continue repeating an older rule.
6. Unsubstantiated AI review recommendations have weak trust because reviewers cannot inspect the supporting evidence.

**Root problem:** Important institutional engineering knowledge is generated continuously but is not conveniently available, scoped, validated, and current at the moment of the next code review.

CodeDNA does **not** assert that all competing tools are stateless or that no prior product uses PR history. Its differentiator must be **provenance + controlled decision evolution + feedback + visibly demonstrated memory causality**, not just the existence of persistent memory.

## 3. The solution

CodeDNA ingests meaningful team-confirmed review decisions and outcomes, persists their original source in application storage, retains experience in Hindsight, and retrieves potentially relevant memories for a new PR. The review engine checks those retrieved facts against **current authoritative decision status** before producing evidence-backed, line-linked recommendations.

A human can inspect a finding's historical source, accept or reject advice, confirm a new convention, or supersede an old one. That activity becomes part of the next review's usable history.

### Three signature capabilities

1. **Decision provenance:** "Why was this recommendation made?" Every team-specific finding links back to a real source PR and an applicable confirmed decision; no fabricated citations.
2. **Living conventions:** "Is that decision still active?" A previous rule can be challenged, refined, or superseded by a later authorized decision, while its history remains accessible.
3. **Feedback-driven adaptation:** "Will the reviewer repeat a rejected recommendation?" Feedback is retained and influences later reviews without automatically treating every rejection as universal policy.

### Two supporting capabilities

4. **Repository-specific intelligence:** Each repository has an isolated Hindsight bank and authoritative decision registry.
5. **Memory Impact Lab:** Same PR, same underlying model, same analysis prompt, different presence/absence of validated historical context; show actual results, evidence and traces.

## 4. What CodeDNA is NOT

- Not a complete GitHub clone or an autonomous software engineer.
- Not a bot that simply summarizes old PRs in a chat window.
- Not a generic code linter with “AI-powered” branding.
- Not model-weight fine-tuning or autonomous reinforcement learning; **learning means memory-driven decision adaptation**.
- Not a claim that every past comment is authoritative.
- Not a production-ready enterprise security/compliance system on day one.
- Not a guaranteed detector of payment bugs or any other vulnerability class.
- Not a platform that secretly sends private code to free public APIs. The demo uses synthetic/public data and documents provider data policies.
- Not a fake-memory demo driven by hard-coded answer text.

## 5. Hackathon constraints and judging strategy

The supplied HackwithHyderabad 3.0 brief specifies:

| Criterion | Official weight | Our proof |
|---|---:|---|
| Innovation | **30%** | Provenance and evolving engineering conventions, not a generic chatbot |
| Hindsight Memory | **25%** | Real retain, recall, optional reflect, demonstrable cross-session relevance |
| Technical Implementation | **20%** | Working end-to-end backend, parsed diffs, evidence validation, feedback and errors |
| User Experience | **15%** | Clean PR workspace, clear source panel, understandable side-by-side ablation |
| Real-world Impact | **10%** | Reduced repeated team-specific review discussions; continuity for changing engineering teams |

The organizers favor real professional problems, memory as the star, focused MVPs and a compelling demo. They discourage generic student-centric tutors/managers. Their suggested code-review-agent category is inspiration, **not proof of novelty**.

**Expected submission obligations** described in the brief:

- Public/accessible GitHub repository with clean documented code.
- Demonstration video showing the application.
- Live demonstration for judges.
- Explanation of how Hindsight memory is used.
- Required article, social post and video from **all team members** according to a separately linked official content guide. Obtain and verify that guide; don't invent details or mark those artifacts complete automatically.

**Presentation strategy:** Lead with a repository-specific rule that a generic reviewer might not infer; store the source decision; show a different PR retrieving that decision; show a verified source; demonstrate an updated rule and feedback; finish with an honest local/free build and roadmap. Video narration and presentation mockups are promotional artifacts; not evidence of implementation.

## 6. Users and responsibilities

### Reviewer / maintainer (MVP)

- Select repository and candidate pull request.
- Run memory-assisted review or no-memory comparison.
- Inspect inline findings and their source/decision evidence.
- Accept, reject, mark not applicable, or explain an incorrect recommendation.
- Confirm or revise official conventions (MVP: a demo-level role/confirmation mechanism; don't claim secure enterprise permissions).

### Developer / PR author (MVP)

- See findings on affected lines, relevant context, suggested remediation, and source PR.
- Distinguish generic code observations from team-specific remembered guidance.
- Inspect current and superseded decisions.

### Admin/tech lead (future)

- Control repository permissions, confirm policy authority, review audit logs, manage GitHub integrations and privacy settings.

## 7. The primary demo domain and why it was selected

**Preferred canonical scenario: a fictional e-commerce repository, `acme-commerce`, with a custom order-audit workflow.** This proves memory's value more cleanly than a general payment-idempotency problem because a stateless LLM may already know the latter from generic training data.

### Demo A — New PR repeats a team-specific architectural mistake

**Historical PR #42:** Reviewers confirm that order-status transitions must call `OrderService.transitionOrder()` since direct ORM updates bypass audit-event emission. Store original PR conversation, rationale, decision ID and source ID. Retain an event in the repository's Hindsight bank.

**Later PR #87:** Different code uses `prisma.order.update({ data: { status: 'shipped' } })` directly. It is syntactically valid and may pass ordinary lint rules. CodeDNA recalls the earlier team decision, checks that it is relevant and authoritative, and suggests the approved transition method while citing PR #42.

**Ablation:** The same code is sent to the same review engine without relevant historical memory. The aim is to observe that the team-specific finding is supported only with the memory context; **do not force or fake the baseline to miss the issue**. If baseline also flags it, report honestly and use a more discriminating scenario.

### Demo B — The team's convention changes

**Historical PR #103:** An authorized maintainer confirms `AuditedTransaction` as another approved status-update path because it emits the required audit event. This decision explicitly supersedes/revises the blanket interpretation of PR #42.

**New PR #120:** Code uses the new approved helper. CodeDNA must not give the old blanket warning merely because Hindsight recalled PR #42. It must consult active policy and describe the updated rule when relevant. Keep PR #42 visible as history.

### Demo C — Reviewer feedback becomes useful history

**Historical PR #71:** The AI previously suggested a transaction wrapper for a read-only query. A reviewer marks it not applicable, with rationale. Future similar review should consider the correction; feedback does not become a team-wide rule until explicitly confirmed.

### Demo D — Payment retries (secondary example)

An earlier PR #55 establishes that payment capture retries require idempotency safeguards; a later variant prompts a memory-supported review comment. This is relatable but may be spotted by a general LLM, so use it as an additional showcase, not the only causality test.

### Demo E — Repository isolation

A second fictional repository, `analytics-service`, follows different conventions; its Hindsight bank and authority records must not be accessible from `acme-commerce` reviews.

All demo PRs, decisions, users, and results are **synthetic** until a real project is connected; label them visibly.

## 8. User journeys / MVP flows

### Flow 1: Seed a team decision

1. User opens `Team DNA` for `acme-commerce` and views PR #42 / existing discussion.
2. User clicks `Confirm Decision` and reviews the proposed structured decision/rationale/scope.
3. Backend stores an authoritative decision with status `active` and a source PR in SQLite.
4. Backend retains a normalized descriptive event in repository-specific Hindsight bank, with deterministic document ID.
5. UI shows `processing`, then `ready` only after verified retain completion; errors are shown truthfully.
6. User can click the decision and view the source evidence.

### Flow 2: Review a PR

1. User selects PR #87 with an actual diff.
2. User chooses `Review with Memory`.
3. Backend parses changed files/hunks; prepares memory query; retrieves and validates evidence.
4. Review model receives bounded diff/context plus only applicable verified historical guidance.
5. Backend validates structured outputs and persists review run/findings.
6. UI displays line-linked finding(s), severity and evidence links; user inspects PR #42.

### Flow 3: Give feedback

1. User selects finding and chooses `Accept`, `Reject`, `Not Applicable`, or `Correct`.
2. UI captures optional reason and target scope.
3. Backend persists a feedback event and retains an explanatory experience if appropriate.
4. A developer with policy authority can explicitly confirm a convention; normal feedback remains non-binding evidence.
5. Subsequent related reviews can retrieve/use feedback with provenance.

### Flow 4: Supersede a convention

1. User opens active decision, chooses `Supersede`.
2. User enters a new confirmed rule, rationale, source PR, and scope; backend validates required fields/confirmation.
3. In one DB transaction, mark old decision superseded and create the new active decision linked to it; queue Hindsight retain event.
4. Hindsight stores the **change event**. Old source and extracted history remain for explanation.
5. New reviews use the active policy. If synchronization fails, the SQLite state still accurately records authority; ingestion error is visible and retryable.

### Flow 5: Memory lab comparison

1. User selects a candidate PR and a known historical scenario.
2. Run baseline and memory mode with same code context, same model/version/config, and same prompt template (apart from the memory evidence section).
3. Store outputs, retrieved document IDs, validated evidence IDs, and timing.
4. UI shows differences, links and actual result statuses. Clearly label seeded historical data.

## 9. MVP features and detailed acceptance criteria

| Priority | Feature | Minimal accepted behavior |
|---|---|---|
| P0 | Repository / PR fixture catalog | Load two synthetic repositories, 6–10 internally coherent historical/new PRs, actual diffs; choose a PR |
| P0 | Hindsight ingest | Confirm PR #42 in UI/API; successful real retain with deterministic document ID and source metadata |
| P0 | Hindsight retrieval | Different PR #87 queries retrieve relevant memory from correct bank, after restart |
| P0 | Decision authority | `proposed` vs `active` vs `superseded`; source PR and scope preserved |
| P0 | Review engine | Parse diff, call model, return validated structured findings, handle empty/invalid model results |
| P0 | Evidence-backed findings | Team-specific warning resolves to applicable decision and original source; invalid evidence rejected |
| P0 | Review workspace | Readable changed-code view, findings panel, evidence drawer, progress/error states |
| P0 | Feedback | Persist action and reason; authorized confirmation; feedback retain event when appropriate |
| P0 | Living conventions | Supersede an old rule with a later decision; subsequent review follows active guidance |
| P0 | Memory Lab | Same PR reviewed in both modes; show real outputs and evidence, not canned success |
| P0 | Service/reliability | Local run, setup doc, healthchecks, nonsecret env config, safe retries and understandable failure states |
| P0 | Evaluation suite | Tests for retrieval, provenance, supersession, bank isolation, baseline leakage, error handling |
| P1 | Reflect on conflicting historical memories | Use Hindsight `reflect` for explanation/synthesis, not as policy authority |
| P1 | Search/filter Team DNA | Browse decisions by PR, scope, current status |
| P1 | Better context extraction | Function-level/related-file context, not entire repo |
| P2 | Real GitHub PR import | Read-only import of public PRs or authenticated user-provided ones |
| P2 | GitHub comments / CI | User-approved automated posting and triggered reviews |
| P2 | Organization-scale governance | Strong auth, role management, organization memory, analytics, production observability |

For MVP, P0 is the target. Features may be trimmed only if the mandatory Hindsight memory loop and observable, truthful proof remain complete.

## 10. Screens and navigation

### Review Workspace — default route

- Header: `CodeDNA` logo, repository selector, PR selector, memory-mode controls.
- Diff region: filename tabs/list, unified or split diff, line numbers, added/removed lines.
- Findings region: category (`general` / `team memory`), priority, short title, precise risk explanation, suggested safer action.
- Evidence drawer: decision ID, previous PR title/number, original rationale, active/superseded state, scope, relevant quote, and retrieval metadata.
- Controls: `Review with Memory`, `Review without Memory`, `Accept`, `Reject`, `Not applicable`, `Correct`, `View decision`.
- Honest statuses: `Idle`, `Analyzing`, `Memory unavailable`, `Review finished`, `Partial findings`, `Failed`.

### Team DNA

- Searchable table of decisions with original source, scope, authority, and status.
- Decision detail: timeline, related feedback and supersession linkage, original PR context, memory ingest status.
- Add/confirm decision and supersede decision forms; validation and role restrictions appropriate to demo configuration.

### Memory Lab

- Side-by-side actual result panels for no-memory and Hindsight-assisted runs.
- Inspectable execution trace: query → memory IDs → validation → model request → findings.
- Compare key metrics without fabricated values; show raw counts and failed cases.

### Decision Evolution (tab of Team DNA for MVP)

- Time-ordered lineage of a rule, original/updated sources, status and current applicability.

### Design direction

Treat it as serious developer software: deep charcoal/slate code pane, clean light/dark surrounding UI, restrained green for verified memory, amber for warnings. Legible typography and whitespace > futuristic gradients. Desktop-first, responsive where practical, keyboard navigable controls, sensible loading states. Avoid shiny product dashboards without working underlying behavior.

## 11. Data and evaluation requirements

### Fixture realism

- Build code diffs that make sense in the described TypeScript/Prisma-style repository; source code and stated architectural rule must agree.
- Keep historical events temporally consistent; don't retrospectively seed PR #87 with its target answer.
- Each decision has a source PR, rationale, scope, authority, and time.
- Provide a clean `seed`/`reset` mechanism that clearly distinguishes demo data from evaluator test banks.

### What to measure (only after running tests)

- **Relevant memory recall hit rate:** retrieval of designated prior decision on related cases.
- **Evidence precision:** proportion of citations that genuinely apply and resolve to known source IDs.
- **Team-specific issue identification:** correct identification of planted custom rules/violations.
- **Unsupported recommendation rate:** fabricated or irrelevant policy suggestions.
- **Supersession correctness:** newer rule replaces older blanket advice when scope matches.
- **Cross-bank isolation:** no unapproved fact crossing between repositories.
- **Latency/error rate:** elapsed time and failure cases.

Never fabricate percentages, production outcomes, ROI, API outputs, or claims of model training. Small evals should show actual totals (`6/8`) alongside percentages if used.

## 12. Quality attributes

1. **Reliability:** Fail gracefully when Hindsight/model unavailable; return `degraded` instead of fabricating a memory result.
2. **Explainability:** Every team-specific finding has verifiable provenance; generic findings explicitly labeled.
3. **Consistency:** Same repository, bank, active policy catalog and fixed model settings produce comparable runs; record variability honestly.
4. **Performance:** Reasonable interactive response for a small PR; bounded context and retrieval budgets; no hard real-time promise until measured.
5. **Privacy:** Only public or synthetic sample code through free cloud inference; no secrets or private organizational material.
6. **Security:** Reject prompt injections embedded in source code/comments/memories, validate access to banks and path IDs.
7. **Reproducibility:** Clean seed/reset, versioned configs, fresh startup instructions, exact test commands and expected validation criteria.
8. **Cost:** Avoid paid services and surprise cloud bills. Provider free quotas vary and may become unavailable; surface that honestly.

## 13. Proposed stack and resource limits

A minimal recommended stack (implementation details live in `ARCHITECTURE.md`):

- React + TypeScript + Vite + Tailwind + Lucide; read-only code-diff component.
- Python 3.x + FastAPI + Pydantic + SQLAlchemy; SQLite for app state.
- Official `hindsight-client` against self-hosted Hindsight Docker image with persistent volume, and configured LLM API.
- Gemini API free-tier-eligible model (candidate: `gemini-3.1-flash-lite`, if available and sufficient when tested); central adapter makes provider replaceable.
- Pytest, frontend test runner, synthetic PR fixtures, small evaluation suite.
- No dedicated GPU, no paid database, no paid hosting, no external vector database.

**Important:** local Hindsight still requires system resources and an external LLM provider for some operations; "no hardware" means no **additional paid/specialized hardware**, not zero computer resources. Free model quotas are not guaranteed.

## 14. Work packages and build sequence

Do not overfit timing estimates; actual hackathon duration and individual skill assignments have not been confirmed in this request.

**Gate G0 — Bootstrap:** docs, repo structure, environment setup, minimal tracking files, decide versions.

**Gate G1 — Memory proof:** run Hindsight, retain PR #42, recall from a different PR question, inspect evidence, test persistence/repo separation.

**Gate G2 — Review proof:** parse valid diff, retrieve and validate policies, generate structured review, check citations/lines, compare no-memory baseline.

**Gate G3 — Product UI:** connect PR selector, diff, findings, evidence, feedback to live backend; add loading/failure states.

**Gate G4 — Learning demo:** feedback event ingestion, authoritative confirmation, PR #103 supersession, PR #120 updated behavior, eval suite.

**Gate G5 — Submission quality:** integration tests, seed/reset, demo video, README, clear limitations, hackathon content deliverables.

Suggested parallel ownership **only if consistent with team skills**: Anshika — frontend/UX; Avyakt — Hindsight/review model; Mohit — backend/storage/validation. This is not a confirmed staffing commitment. Freeze API contracts first.

## 15. Future scope — not MVP promises

1. GitHub Apps/OAuth to import actual repository PRs and post approved findings.
2. GitLab/Bitbucket adapters.
3. CI gating and automated review suggestions with human approval.
4. Higher-quality code understanding via AST/tree-sitter, symbol/call graph and targeted project context.
5. Cross-repository organizational knowledge with explicit permissions and scoped aggregation.
6. Governance: access controls, audit logs, retention policies, private deployments, user privacy tooling.
7. Advanced decision graph, impact analysis, contradiction detection and reviewer calibration.
8. Team analytics and controlled studies on review consistency and false positives.
9. Automatic suggestion of candidate conventions for **human confirmation**, not automatic enforcement.
10. Controlled evaluation with real developers on consenting, non-sensitive repositories.

## 16. Open questions — mark as undecided until verified

- Actual hackathon coding window and live-demo duration.
- Who will own which engineering track; team member strengths.
- Whether Hindsight local installation is feasible with each member's RAM/disk limits.
- The exact model version, free-tier daily/rate limits, Hindsight provider compatibility, and data-use settings.
- Which diff-view library handles the desired inline line mapping best.
- Exact minimal policy-authority mechanism in demo and whether real user login is necessary (likely not for MVP).
- Whether `reflect` adds a meaningful judge-visible improvement or is better left P1.
- The official hackathon content guide and required publication formats.

Codex should resolve engineering questions in dependency order, testing assumptions rather than treating this section as permission to endlessly defer implementation.

## 17. Final definition of done

The v0.1 demo is complete only if a clean local setup can:

1. Load synthetic but coherent repository/PR fixtures.
2. Confirm PR #42's architectural decision and retain it in **real Hindsight**.
3. Retrieve it later for the distinct PR #87 and map it back to the real source record.
4. Produce a validated, line-linked finding from an LLM without invented evidence.
5. Show and store developer feedback.
6. Confirm a revised decision from PR #103 and demonstrate correct handling of PR #120.
7. Run same-PR reviews in memory/no-memory modes and truthfully show results.
8. Keep repository A and repository B isolated.
9. Survive restart and handle outages/rate limits honestly.
10. Be reproducible from a documented local setup, tests, fixtures, and demo instructions.

A successful demo is not a screenshot, a mock service, or a persuasive slide. It is observed behavior from the product, with an inspectable memory evidence trail.

## 18. Reference material

- Official HackwithHyderabad 3.0 problem statement — user-supplied hackathon brief (retain locally if available).
- Hindsight docs: https://hindsight.vectorize.io/
- Hindsight Python client: https://hindsight.vectorize.io/sdks/python
- Hindsight repo: https://github.com/vectorize-io/hindsight
- Gemini docs/pricing: https://ai.google.dev/gemini-api/docs and https://ai.google.dev/gemini-api/docs/pricing

**Status disclaimer:** The scenarios in this document express intended prototype functionality. They are not published performance results or proof that integration has already been built.
