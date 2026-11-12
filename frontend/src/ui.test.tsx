import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "./App";
import { loadActiveJob, loadActiveJobLocator, saveActiveJob } from "./activeJobs";

const comparisonChecks = (overrides: Record<string, boolean> = {}) => ({
  same_candidate: true,
  same_model: true,
  memory_retrieved_validated_source: true,
  memory_produced_grounded_team_finding: true,
  baseline_has_no_memory_citations: true,
  baseline_has_no_team_policy_finding: true,
  ...overrides,
});

const partialComparisonChecks = () => {
  const { same_model: _missing, ...checks } = comparisonChecks();
  return checks;
};

function withComparisonIdentity(comparison: Record<string, unknown> | undefined) {
  if (!comparison) return comparison;
  const memory = comparison.memory as Record<string, unknown> | undefined;
  const baseline = comparison.baseline as Record<string, unknown> | undefined;
  const evaluation = comparison.evaluation as Record<string, unknown> | undefined;
  const memoryFindings = Array.isArray(memory?.findings) ? memory.findings as Array<Record<string, unknown>> : [];
  const baselineFindings = Array.isArray(baseline?.findings) ? baseline.findings as Array<Record<string, unknown>> : [];
  const retrieval = memory?.retrieval as Record<string, unknown> | undefined;
  const memoryCitations = new Set(memoryFindings.flatMap((finding) => Array.isArray(finding.evidence_ids) ? finding.evidence_ids.map(String) : []));
  const effectiveRetrieval = {
    validated_evidence: [...memoryCitations].map((decision_id) => ({ decision_id })),
    ...retrieval,
  };
  const defaultCounts = {
    validated_memory_sources: Array.isArray(effectiveRetrieval.validated_evidence) ? effectiveRetrieval.validated_evidence.length : 0,
    memory_findings: memoryFindings.length,
    memory_team_findings: memoryFindings.filter((finding) => finding.category === "team_convention").length,
    memory_citations: memoryCitations.size,
    baseline_findings: baselineFindings.length,
    baseline_team_findings: baselineFindings.filter((finding) => finding.category === "team_convention").length,
    baseline_citations: new Set(baselineFindings.flatMap((finding) => Array.isArray(finding.evidence_ids) ? finding.evidence_ids.map(String) : [])).size,
  };
  const suppliedCounts = evaluation?.counts;
  const counts = suppliedCounts && typeof suppliedCounts === "object" && !Array.isArray(suppliedCounts)
    ? { ...defaultCounts, ...suppliedCounts }
    : suppliedCounts === undefined ? defaultCounts : suppliedCounts;
  return {
    ...comparison,
    evaluation: evaluation ? {
      run_ids: { memory: memory?.run_id, baseline: baseline?.run_id },
      ...evaluation,
      counts,
    } : evaluation,
    memory: memory ? { pr_id: "pr-acme-87", provider: "gemini", model: "gemini-test", ...memory, retrieval: effectiveRetrieval } : memory,
    baseline: baseline ? { pr_id: "pr-acme-87", provider: "gemini", model: "gemini-test", ...baseline } : baseline,
  };
}

const repositories = [
  { id: "repo-acme-commerce", slug: "acme-commerce", display_name: "Acme Commerce" },
];

const prs = [
  { id: "pr-acme-87", number: 87, title: "Update order status", created_at: "2026-10-20T12:00:00Z" },
  { id: "pr-acme-120", number: 120, title: "Ship replacement orders", created_at: "2026-10-25T12:00:00Z" },
];

const evaluationCases = [
  {
    repository_id: "repo-acme-commerce",
    repository_name: "Acme Commerce",
    source_pr_id: "pr-acme-103",
    source_pr_number: 103,
    candidate_pr_id: "pr-acme-120",
    candidate_pr_number: 120,
    decision_id: "DEC-0103",
    decision_status: "active",
    latest_evaluation: {
      job_id: "job-acme-proof",
      passed: true,
      passed_checks: 6,
      total_checks: 6,
      updated_at: "2026-10-27T12:00:00Z",
    },
  },
  {
    repository_id: "repo-analytics-service",
    repository_name: "Analytics Service",
    source_pr_id: "pr-analytics-11",
    source_pr_number: 11,
    candidate_pr_id: "pr-analytics-29",
    candidate_pr_number: 29,
    decision_id: "DEC-0211",
    decision_status: "active",
    latest_evaluation: {
      job_id: "job-analytics-proof",
      passed: true,
      passed_checks: 6,
      total_checks: 6,
      updated_at: "2026-10-27T13:00:00Z",
    },
  },
];

const diff = [
  "diff --git a/src/orders/update.ts b/src/orders/update.ts",
  "--- a/src/orders/update.ts",
  "+++ b/src/orders/update.ts",
  "@@ -16,2 +16,2 @@",
  " context",
  "-previous",
  "+order.status = next;",
].join("\n");

const decisions = [
  {
    id: "DEC-0103",
    repository_id: "repo-acme-commerce",
    title: "Shipping workflow",
    rule_text: "Use the service for status changes.",
    rationale: "Audit events stay with the service.",
    status: "active",
    authority: "reviewer_confirmed",
    source_pr_id: "pr-acme-103",
    source_pr_number: 103,
    supersedes_decision_id: "DEC-0042",
    scope: { paths: ["src/orders"] },
  },
  {
    id: "DEC-0042",
    repository_id: "repo-acme-commerce",
    title: "Order transitions",
    rule_text: "Earlier transition rule.",
    rationale: "The first audit rule.",
    status: "superseded",
    authority: "reviewer_confirmed",
    source_pr_id: "pr-acme-42",
    source_pr_number: 42,
    scope: {},
  },
];

const teamFinding = {
  id: "finding-team",
  category: "team_convention",
  file_path: "src/orders/update.ts",
  new_line: 17,
  severity: "error",
  title: "Direct status write skips the service",
  explanation: "This change writes order status directly.",
  suggested_change: null,
  confidence: "high",
  evidence_ids: ["DEC-0103", "DEC-0042"],
};

const generalFinding = {
  id: "finding-general",
  category: "general",
  file_path: "src/orders/update.ts",
  new_line: null,
  severity: "warning",
  title: "Missing update reason check",
  explanation: "The new field is not checked before it is used.",
  suggested_change: null,
  confidence: "medium",
  evidence_ids: [],
};

function validatedEvidence(decisionId: string, sourcePrNumber: number) {
  return {
    fact_id: `fact-${decisionId}`,
    document_id: `decision-${decisionId}`,
    decision_id: decisionId,
    source_pr_id: `pr-acme-${sourcePrNumber}`,
    source_pr_number: sourcePrNumber,
    repository_id: "repo-acme-commerce",
    repository_slug: "acme-commerce",
    bank_id: "bank-acme-commerce",
    chunk_id: `chunk-${decisionId}`,
  };
}

const review = {
  run_id: "run-1",
  pr_id: "pr-acme-87",
  status: "complete",
  mode: "memory",
  provider: "gemini",
  model: "gemini-test",
  elapsed_ms: 1500,
  findings: [teamFinding, generalFinding],
  retrieval: {
    timings_ms: { query: 400, validation: 200, generation: 900 },
    validated_evidence: [validatedEvidence("DEC-0103", 103), validatedEvidence("DEC-0042", 42)],
  },
};

const jobCreatedAt = new Date(Date.now() - 10 * 60 * 1000).toISOString();
const jobUpdatedAt = new Date(Date.now() - 4 * 60 * 1000).toISOString();
const jobLaterUpdatedAt = new Date(Date.parse(jobUpdatedAt) + 60_000).toISOString();
const jobLatestUpdatedAt = new Date(Date.parse(jobUpdatedAt) + 120_000).toISOString();
const completeReviewJobEnvelope = (overrides: Record<string, unknown> = {}) => ({
  job_id: "job-review",
  pr_id: "pr-acme-87",
  kind: "review",
  status: "complete",
  stage: "complete",
  error_code: null,
  created_at: jobCreatedAt,
  updated_at: jobUpdatedAt,
  review,
  ...overrides,
});
const completeComparisonJobEnvelope = (overrides: Record<string, unknown> = {}) => ({
  job_id: "job-cmp",
  pr_id: "pr-acme-87",
  kind: "comparison",
  status: "complete",
  stage: "complete",
  error_code: null,
  created_at: jobCreatedAt,
  updated_at: jobUpdatedAt,
  ...overrides,
});
const repositoryActiveJob = {
  repository_id: "repo-acme-commerce",
  job_id: "job-cmp",
  pr_id: "pr-acme-87",
  pr_number: 87,
  pr_title: "Update order status",
  kind: "comparison",
  status: "running",
  stage: "running_memory_review",
  created_at: jobCreatedAt,
  updated_at: jobUpdatedAt,
};
const activeReviewJobResponse = {
  pr_id: "pr-acme-87",
  kind: "review",
  job_id: "job-review",
  status: "running",
  stage: "reviewing_diff",
  created_at: jobCreatedAt,
  updated_at: jobUpdatedAt,
};

function json(data: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => data,
    text: async () => JSON.stringify(data),
  } as Response;
}

function installFetch(options?: {
  hindsight?: "starting" | "ready" | "unavailable";
  healthFailures?: number;
  healthGate?: Promise<void>;
  healthPayload?: unknown;
  interruptedJobs?: number;
  decisionsWrapped?: boolean;
  comparison?: Record<string, unknown>;
  completedReview?: Record<string, unknown>;
  latestComparison?: Record<string, unknown>;
  latestReview?: boolean | Record<string, unknown>;
  latestReviewAfterRead?: number;
  latestComparisonAfterRead?: number;
  reviewPollFailures?: number;
  reviewPollHangs?: number;
  reviewJobPayload?: unknown;
  reviewJobPayloads?: unknown[];
  comparisonPollFailures?: number;
  comparisonJobPayload?: unknown;
  comparisonJobPayloads?: unknown[];
  missingReviewJob?: boolean;
  missingComparisonJob?: boolean;
  activeReviewJob?: boolean;
  activeComparisonJob?: boolean;
  activeJobPayload?: unknown;
  reviewRecoveryFailure?: boolean;
  comparisonRecoveryFailure?: boolean;
  reviewRecoveryFailures?: number;
  reviewRecoveryHangs?: number;
  comparisonRecoveryFailures?: number;
  repositoryActiveJobs?: boolean;
  repositoryActiveJobsStartAfter?: number;
  repositoryActiveJobsCompleteAfter?: number;
  repositoryActiveJobFailures?: number;
  repositoryActiveJobPayload?: unknown;
  reusedReviewStart?: boolean;
  reviewCreationPayload?: unknown;
  reviewCreationHangs?: boolean;
  reviewCreationClaimVisible?: boolean;
  reviewCreationClaimVisibleAfterActiveRead?: number;
  reviewRecoveryFailureAtActiveRead?: number;
  reusedComparisonStart?: boolean;
  comparisonCreationPayload?: unknown;
  comparisonCreationHangs?: boolean;
  comparisonCreationClaimVisible?: boolean;
  comparisonCreationClaimVisibleAfterActiveRead?: number;
  comparisonRecoveryFailureAtActiveRead?: number;
  pollDelayMs?: number;
  reviewPollGate?: Promise<void>;
  latestReviewGate?: Promise<void>;
  comparisonPollGate?: Promise<void>;
  latestComparisonGate?: Promise<void>;
  evaluationCaseFailures?: number;
  evaluationCaseFailuresAfter?: number;
  evaluationCaseUpdateAfter?: number;
  evaluationCaseDelayMs?: number;
  pullRequestRepositoryId?: string;
  repositorySlug?: string;
  repositoryCatalog?: unknown;
  pullRequestPayload?: unknown;
  pullRequestCatalog?: unknown;
  decisionCatalog?: unknown;
  evidencePayload?: unknown;
  decisionDetailPayload?: unknown;
  lineagePayload?: unknown;
  summaryPayload?: unknown;
  evaluationCasePayload?: unknown;
}) {
  const hindsight = options?.hindsight ?? "ready";
  let reviewPollFailures = options?.reviewPollFailures ?? 0;
  let reviewPollHangs = options?.reviewPollHangs ?? 0;
  let comparisonPollFailures = options?.comparisonPollFailures ?? 0;
  const reviewJobPayloads = [...(options?.reviewJobPayloads ?? [])];
  const comparisonJobPayloads = [...(options?.comparisonJobPayloads ?? [])];
  let reviewRecoveryFailures = options?.reviewRecoveryFailures ?? (options?.reviewRecoveryFailure ? Number.MAX_SAFE_INTEGER : 0);
  let reviewRecoveryHangs = options?.reviewRecoveryHangs ?? 0;
  let comparisonRecoveryFailures = options?.comparisonRecoveryFailures ?? (options?.comparisonRecoveryFailure ? Number.MAX_SAFE_INTEGER : 0);
  let repositoryActiveJobReads = 0;
  let repositoryActiveJobFailures = options?.repositoryActiveJobFailures ?? 0;
  let evaluationCaseFailures = options?.evaluationCaseFailures ?? 0;
  let evaluationCaseReads = 0;
  let healthFailures = options?.healthFailures ?? 0;
  let reviewCreationClaimed = false;
  let reviewCreationStarted = false;
  let reviewActiveReads = 0;
  let comparisonCreationClaimed = false;
  let comparisonCreationStarted = false;
  let comparisonActiveReads = 0;
  let reviewJobPrId = "pr-acme-87";
  let comparisonJobPrId = "pr-acme-87";
  let latestReviewReads = 0;
  let latestComparisonReads = 0;
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const url = new URL(raw, "http://localhost");
    const path = url.pathname;
    const method = (init?.method ?? "GET").toUpperCase();
    if (path === "/api/health") {
      if (healthFailures > 0) {
        healthFailures -= 1;
        return json({ detail: "application health unavailable" }, 503);
      }
      if (options?.healthGate) await options.healthGate;
      if (options?.healthPayload !== undefined) return json(options.healthPayload);
      return json({ status: "ok", memory: "configured", hindsight, interrupted_jobs: options?.interruptedJobs ?? 0 });
    }
    if (path === "/api/repositories") return json(options?.repositoryCatalog ?? repositories.map((repository) => ({
      ...repository,
      slug: options?.repositorySlug ?? repository.slug,
    })));
    if (path === "/api/evaluation-cases") {
      evaluationCaseReads += 1;
      if (options?.evaluationCasePayload !== undefined) return json(options.evaluationCasePayload);
      if (options?.evaluationCaseDelayMs) await new Promise((resolve) => setTimeout(resolve, options.evaluationCaseDelayMs));
      if (evaluationCaseFailures > 0 && evaluationCaseReads > (options?.evaluationCaseFailuresAfter ?? 0)) {
        evaluationCaseFailures -= 1;
        return json({ detail: "temporary catalog outage" }, 503);
      }
      if (options?.evaluationCaseUpdateAfter && evaluationCaseReads >= options.evaluationCaseUpdateAfter) {
        return json(evaluationCases.map((item, index) => index === 0 ? {
          ...item,
          latest_evaluation: {
            ...item.latest_evaluation,
            job_id: "job-acme-new-proof",
            passed: false,
            passed_checks: 5,
            updated_at: "2026-11-05T00:00:00Z",
          },
        } : item));
      }
      return json(evaluationCases);
    }
    if (path.endsWith("/summary")) {
      return json(options?.summaryPayload ?? {
        repository_id: "repo-acme-commerce",
        slug: "acme-commerce",
        display_name: "Acme Commerce",
        pr_count: prs.length,
        decision_count: decisions.length,
        active_decisions: 1,
        superseded_decisions: 1,
        pending_decisions: 0,
        review_run_count: 4,
        hindsight,
      });
    }
    if (path === "/api/repositories/repo-acme-commerce/review-jobs/active") {
      repositoryActiveJobReads += 1;
      if (options?.repositoryActiveJobPayload !== undefined) return json(options.repositoryActiveJobPayload);
      if (repositoryActiveJobFailures > 0) {
        repositoryActiveJobFailures -= 1;
        return json({ detail: "temporary outage" }, 503);
      }
      const active = options?.repositoryActiveJobs
        && repositoryActiveJobReads > (options.repositoryActiveJobsStartAfter ?? 0)
        && (options.repositoryActiveJobsCompleteAfter === undefined
          || repositoryActiveJobReads <= options.repositoryActiveJobsCompleteAfter);
      return json(active ? [repositoryActiveJob] : []);
    }
    if (path.endsWith("/prs")) return json(options?.pullRequestCatalog ?? prs);
    if (path === "/api/prs/pr-acme-87" && method === "GET") {
      return json(options?.pullRequestPayload ?? { ...prs[0], repository_id: options?.pullRequestRepositoryId ?? "repo-acme-commerce", description: "Sets order status directly.", diff_text: diff });
    }
    if (path === "/api/prs/pr-acme-87/reviews/latest" && method === "GET") {
      latestReviewReads += 1;
      if (options?.latestReviewGate) await options.latestReviewGate;
      const visible = options?.latestReview !== undefined && options.latestReview !== false
        && (options.latestReviewAfterRead === undefined || latestReviewReads >= options.latestReviewAfterRead);
      const latestReview = typeof options?.latestReview === "object" && options.latestReview !== null
        ? options.latestReview
        : review;
      return json({ pr_id: "pr-acme-87", mode: "memory", review: visible ? latestReview : null });
    }
    if (path === "/api/prs/pr-acme-87/comparisons/latest" && method === "GET") {
      latestComparisonReads += 1;
      if (options?.latestComparisonGate) await options.latestComparisonGate;
      const visible = options?.latestComparison !== undefined
        && (options.latestComparisonAfterRead === undefined || latestComparisonReads >= options.latestComparisonAfterRead);
      return json({ pr_id: "pr-acme-87", job_id: visible ? "job-restored" : null, comparison: visible ? withComparisonIdentity(options?.latestComparison) : null });
    }
    if (path === "/api/prs/pr-acme-120/comparisons/latest" && method === "GET") {
      return json({ pr_id: "pr-acme-120", job_id: null, comparison: null });
    }
    if (path === "/api/prs/pr-acme-87/review-jobs/active" && method === "GET") {
      const kind = url.searchParams.get("kind");
      if (kind === "review") reviewActiveReads += 1;
      if (kind === "comparison") comparisonActiveReads += 1;
      if (kind === "comparison" && comparisonRecoveryFailures > 0) {
        comparisonRecoveryFailures -= 1;
        return json({ detail: "temporary recovery outage" }, 503);
      }
      if (kind === "review" && reviewRecoveryFailures > 0) {
        reviewRecoveryFailures -= 1;
        return json({ detail: "temporary recovery outage" }, 503);
      }
      if (kind === "review" && reviewRecoveryHangs > 0) {
        reviewRecoveryHangs -= 1;
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
        });
      }
      if (kind === "review" && options?.reviewRecoveryFailureAtActiveRead === reviewActiveReads) {
        return json({ detail: "manual creation status unavailable" }, 503);
      }
      if (kind === "comparison" && options?.comparisonRecoveryFailureAtActiveRead === comparisonActiveReads) {
        return json({ detail: "manual creation status unavailable" }, 503);
      }
      if (options?.activeJobPayload !== undefined) return json(options.activeJobPayload);
      const lateReviewClaim = reviewCreationStarted
        && reviewActiveReads >= (options?.reviewCreationClaimVisibleAfterActiveRead ?? Number.MAX_SAFE_INTEGER);
      const lateComparisonClaim = comparisonCreationStarted
        && comparisonActiveReads >= (options?.comparisonCreationClaimVisibleAfterActiveRead ?? Number.MAX_SAFE_INTEGER);
      const jobId = kind === "comparison"
        ? options?.activeComparisonJob || comparisonCreationClaimed || lateComparisonClaim ? "job-cmp" : null
        : options?.activeReviewJob || reviewCreationClaimed || lateReviewClaim ? "job-review" : null;
      return json({
        pr_id: "pr-acme-87",
        kind,
        job_id: jobId,
        status: jobId ? "running" : null,
        stage: jobId ? "reviewing_diff" : null,
        created_at: jobId ? jobCreatedAt : null,
        updated_at: jobId ? jobUpdatedAt : null,
      });
    }
    if (path === "/api/prs/pr-acme-120/review-jobs/active" && method === "GET") {
      return json({ pr_id: "pr-acme-120", kind: url.searchParams.get("kind"), job_id: null, status: null, stage: null, created_at: null, updated_at: null });
    }
    if (path.endsWith("/lineage")) {
      const requestedDecisionId = path.split("/").filter(Boolean).at(-2) ?? "DEC-0103";
      return json(options?.lineagePayload ?? {
        decision_id: requestedDecisionId,
        items: [
          { ...decisions[1], effective_at: "2023-12-15T10:00:00Z" },
          { ...decisions[0], effective_at: "2024-01-08T10:00:00Z" },
        ],
      });
    }
    if (path.startsWith("/api/decisions/")) {
      const id = path.split("/").filter(Boolean).pop();
      if (options?.decisionDetailPayload !== undefined) return json(options.decisionDetailPayload);
      if (id === "DEC-0042") {
        return json({
          ...decisions[1],
          superseded_by_decision_id: "DEC-0103",
          memory: { document_id: "decision-DEC-0042", ingestion_status: "ready" },
        });
      }
      return json({ ...decisions[0], memory: { document_id: "decision-DEC-0103", ingestion_status: "ready" } });
    }
    if (path.includes("/decisions")) {
      const decisionCatalog = options?.decisionCatalog ?? decisions;
      return json(options?.decisionsWrapped ? { items: decisionCatalog } : decisionCatalog);
    }
    if (path.endsWith("/review-jobs") && method === "POST") {
      reviewJobPrId = path.split("/")[3];
      if (options?.reviewCreationHangs) {
        reviewCreationStarted = true;
        reviewCreationClaimed = options.reviewCreationClaimVisible !== false;
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
        });
      }
      if (options?.reviewCreationPayload !== undefined) {
        reviewCreationStarted = true;
        reviewCreationClaimed = options.reviewCreationClaimVisible !== false;
        return json(options.reviewCreationPayload, 202);
      }
      return json({ pr_id: path.split("/")[3], job_id: "job-review", kind: "review", status: "queued", stage: "queued", reused: options?.reusedReviewStart === true, created_at: jobCreatedAt, updated_at: jobCreatedAt }, 202);
    }
    if (path === "/api/review-jobs/job-review") {
      if (options?.reviewPollGate) await options.reviewPollGate;
      if (reviewPollHangs > 0) {
        reviewPollHangs -= 1;
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
        });
      }
      if (options?.pollDelayMs) await new Promise((resolve) => setTimeout(resolve, options.pollDelayMs));
      if (options?.missingReviewJob) return json({ detail: "job not found" }, 404);
      if (reviewPollFailures > 0) {
        reviewPollFailures -= 1;
        return json({ detail: "temporary outage" }, 503);
      }
      if (reviewJobPayloads.length > 0) return json(reviewJobPayloads.shift());
      if (options?.reviewJobPayload !== undefined) return json(options.reviewJobPayload);
      return json({
        job_id: "job-review",
        pr_id: reviewJobPrId,
        kind: "review",
        status: "complete",
        stage: "complete",
        error_code: null,
        created_at: jobCreatedAt,
        updated_at: jobUpdatedAt,
        review: options?.completedReview ?? review,
      });
    }
    if (path.endsWith("/comparison") && method === "POST") {
      comparisonJobPrId = path.split("/")[3];
      if (options?.comparisonCreationHangs) {
        comparisonCreationStarted = true;
        comparisonCreationClaimed = options.comparisonCreationClaimVisible !== false;
        return new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
        });
      }
      if (options?.comparisonCreationPayload !== undefined) {
        comparisonCreationStarted = true;
        comparisonCreationClaimed = options.comparisonCreationClaimVisible !== false;
        return json(options.comparisonCreationPayload, 202);
      }
      return json({ pr_id: path.split("/")[3], job_id: "job-cmp", kind: "comparison", status: "queued", stage: "queued", reused: options?.reusedComparisonStart === true, created_at: jobCreatedAt, updated_at: jobCreatedAt }, 202);
    }
    if (path === "/api/review-jobs/job-cmp") {
      if (options?.comparisonPollGate) await options.comparisonPollGate;
      if (options?.pollDelayMs) await new Promise((resolve) => setTimeout(resolve, options.pollDelayMs));
      if (options?.missingComparisonJob) return json({ detail: "job not found" }, 404);
      if (comparisonPollFailures > 0) {
        comparisonPollFailures -= 1;
        return json({ detail: "temporary outage" }, 503);
      }
      if (comparisonJobPayloads.length > 0) return json(comparisonJobPayloads.shift());
      if (options?.comparisonJobPayload !== undefined) return json(options.comparisonJobPayload);
      return json({ job_id: "job-cmp", pr_id: comparisonJobPrId, kind: "comparison", status: "complete", stage: "complete", error_code: null, created_at: jobCreatedAt, updated_at: jobUpdatedAt, comparison: withComparisonIdentity(options?.comparison) });
    }
    if (path.endsWith("/evidence")) return json(options?.evidencePayload ?? { run_id: "run-1", decisions });
    if (path.endsWith("/feedback") && method === "POST") return json({ id: "fb-1", binding: false }, 201);
    return json({ detail: `unmocked ${method} ${path}` }, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  );
}

function feedbackBody(fetchMock: ReturnType<typeof installFetch>) {
  const call = fetchMock.mock.calls.find((entry) => String(entry[0]).includes("/feedback"));
  expect(call).toBeTruthy();
  return JSON.parse(String((call?.[1] as RequestInit | undefined)?.body)) as {
    action: string;
    reason: string;
    actor_label: string;
    confirm_as_policy: boolean;
  };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

it("announces jobs reconciled after an API restart", async () => {
  installFetch({ interruptedJobs: 2 });
  renderAt("/");
  expect(await screen.findByText("2 interrupted jobs were marked failed after restart. Start a new review to retry safely.")).toBeTruthy();
});

it("shows the latest successful health check without repeating it in the live status", async () => {
  installFetch();
  renderAt("/");
  const memoryStatus = await screen.findByText("Memory connected");
  const healthTime = memoryStatus.parentElement?.querySelector("time");
  expect(memoryStatus.getAttribute("role")).toBe("status");
  expect(healthTime?.getAttribute("datetime")).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  if (!healthTime) throw new Error("Expected a semantic health check time.");
  expect(memoryStatus.contains(healthTime)).toBe(false);
});

it("distinguishes an application health failure from confirmed Hindsight unavailability", async () => {
  let releaseHealth: () => void = () => undefined;
  const healthGate = new Promise<void>((resolve) => { releaseHealth = resolve; });
  const fetchMock = installFetch({ healthFailures: 1, healthGate });
  renderAt("/");
  const unknown = await screen.findByText("Memory status unknown");
  expect(unknown.getAttribute("role")).toBe("status");
  expect(unknown.parentElement?.textContent).toContain("No successful check yet · current check failed");
  expect(screen.queryByText("Memory unavailable")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Check health again" }));
  const checking = await screen.findByRole("button", { name: "Checking health…" }) as HTMLButtonElement;
  expect(checking.disabled).toBe(true);
  fireEvent.click(checking);
  expect(fetchMock.mock.calls.filter(([input]) => new URL(String(input), "http://localhost").pathname === "/api/health")).toHaveLength(2);
  releaseHealth();
  const connected = await screen.findByText("Memory connected");
  expect(document.activeElement).toBe(connected);
  expect(fetchMock.mock.calls.filter(([input]) => new URL(String(input), "http://localhost").pathname === "/api/health")).toHaveLength(2);
});

it("labels a successful health response with unavailable Hindsight separately", async () => {
  installFetch({ hindsight: "unavailable" });
  renderAt("/");
  expect(await screen.findByText("Memory unavailable")).toBeTruthy();
  expect(screen.queryByText("Memory status unknown")).toBeNull();
  expect(screen.queryByText(/current check failed/)).toBeNull();
});

it("accepts an explicitly unconfigured and unavailable memory runtime", async () => {
  installFetch({ healthPayload: { status: "ok", memory: "unconfigured", hindsight: "unavailable", interrupted_jobs: 0 } });
  renderAt("/");
  expect(await screen.findByText("Memory unavailable")).toBeTruthy();
  expect(screen.queryByText("Memory status unknown")).toBeNull();
});

it.each([
  ["non-object payload", null],
  ["array payload", []],
  ["missing status", { memory: "configured", hindsight: "ready", interrupted_jobs: 0 }],
  ["non-healthy application", { status: "degraded", memory: "configured", hindsight: "ready", interrupted_jobs: 0 }],
  ["invalid memory configuration", { status: "ok", memory: "unknown", hindsight: "ready", interrupted_jobs: 0 }],
  ["missing dependency state", { status: "ok", memory: "configured", interrupted_jobs: 0 }],
  ["invalid dependency state", { status: "ok", memory: "configured", hindsight: "connected", interrupted_jobs: 0 }],
  ["unconfigured but ready memory", { status: "ok", memory: "unconfigured", hindsight: "ready", interrupted_jobs: 0 }],
  ["missing interrupted count", { status: "ok", memory: "configured", hindsight: "ready" }],
  ["negative interrupted count", { status: "ok", memory: "configured", hindsight: "ready", interrupted_jobs: -1 }],
  ["fractional interrupted count", { status: "ok", memory: "configured", hindsight: "ready", interrupted_jobs: 0.5 }],
  ["unsafe interrupted count", { status: "ok", memory: "configured", hindsight: "ready", interrupted_jobs: Number.MAX_VALUE }],
])("treats a health response with %s as an unknown application state", async (_label, healthPayload) => {
  const fetchMock = installFetch({ healthPayload });
  renderAt("/");
  expect(await screen.findByText("Memory status unknown")).toBeTruthy();
  expect(screen.queryByText("Memory connected")).toBeNull();
  expect(screen.queryByText(/interrupted .* marked failed after restart/i)).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

async function reviewedPage() {
  const fetchMock = installFetch();
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  await screen.findByRole("heading", { name: /Update order status/ });
  await screen.findByText("Memory connected");
  fireEvent.click(screen.getByRole("button", { name: "Run CodeDNA Review" }));
  const team = await screen.findByRole("article", { name: "Direct status write skips the service" });
  const general = screen.getByRole("article", { name: "Missing update reason check" });
  expect(screen.getAllByRole("status").filter((item) => item.textContent === "Review complete")).toHaveLength(1);
  return { fetchMock, team, general };
}

it("labels a team finding as a design mismatch and a general finding as general", async () => {
  const { team, general } = await reviewedPage();
  expect(team.textContent).toContain("Design mismatch");
  expect(team.textContent).toContain("Based on team design");
  expect(general.textContent).toContain("General");
  expect(general.textContent?.toLowerCase()).not.toContain("design mismatch");
  expect(general.textContent?.toLowerCase()).not.toContain("based on team design");
  expect(general.textContent?.toLowerCase()).not.toContain("historical evidence");
  expect(within(general).queryByRole("button", { name: "View evidence" })).toBeNull();
  expect(within(team).getByRole("button", { name: "View evidence" })).toBeTruthy();
  expect(screen.getByText("run-1", { selector: "code" })).toBeTruthy();
  expect(screen.queryByText(/apply suggestion/i)).toBeNull();
  expect(screen.queryByText(/view on github/i)).toBeNull();
});

it("moves finding location focus to the cited diff line with a region fallback", async () => {
  const { team, general } = await reviewedPage();
  fireEvent.click(within(team).getByRole("button", { name: "src/orders/update.ts:17" }));
  const changedLine = screen.getByLabelText("Changed line 17");
  expect(document.activeElement).toBe(changedLine);
  expect(changedLine.textContent).toContain("order.status = next;");

  fireEvent.click(within(general).getByRole("button", { name: "src/orders/update.ts" }));
  expect(document.activeElement).toBe(screen.getByRole("region", { name: "Pull request diff" }));
});

it("restores the latest memory review after the pull-request page reloads", async () => {
  installFetch({ latestReview: true });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const team = await screen.findByRole("article", { name: "Direct status write skips the service" });
  expect(team.textContent).toContain("Design mismatch");
  expect(within(team).getByRole("button", { name: "View evidence" })).toBeTruthy();
  expect(within(team).getByRole("button", { name: "Dismiss" })).toBeTruthy();
  expect(screen.getAllByText("Latest saved review restored").length).toBeGreaterThan(0);
  expect(screen.getAllByRole("status").filter((item) => item.textContent === "Latest saved review restored")).toHaveLength(1);
});

it("rejects an off-route pull request before recovering review state", async () => {
  saveActiveJob("review", "pr-acme-87", "job-review");
  const fetchMock = installFetch({
    pullRequestRepositoryId: "repo-analytics-service",
    latestReview: true,
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("The pull request does not belong to this repository.");
  expect(screen.queryByRole("heading", { name: /Update order status/ })).toBeNull();
  expect((screen.getByRole("button", { name: "Run CodeDNA Review" }) as HTMLButtonElement).disabled).toBe(true);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-review"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/review-jobs/active"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it.each([
  ["malformed identity", [{ id: " ", slug: "acme-commerce", display_name: "Acme Commerce" }]],
  ["duplicate repository ID", [
    { id: "repo-acme-commerce", slug: "acme-commerce", display_name: "Acme Commerce" },
    { id: "repo-acme-commerce", slug: "acme-copy", display_name: "Acme Copy" },
  ]],
  ["duplicate repository slug", [
    { id: "repo-acme-commerce", slug: "acme-commerce", display_name: "Acme Commerce" },
    { id: "repo-acme-copy", slug: "acme-commerce", display_name: "Acme Copy" },
  ]],
])("rejects a repository catalog with %s before review recovery", async (_label, repositoryCatalog) => {
  saveActiveJob("review", "pr-acme-87", "job-review");
  const fetchMock = installFetch({ repositoryCatalog, latestReview: true });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  expect((await screen.findAllByText("The repository catalog failed identity validation.")).length).toBeGreaterThan(0);
  expect(screen.queryByRole("heading", { name: /Update order status/ })).toBeNull();
  expect((screen.getByRole("button", { name: "Run CodeDNA Review" }) as HTMLButtonElement).disabled).toBe(true);
  expect(fetchMock.mock.calls.filter((entry) => new URL(String(entry[0]), "http://localhost").pathname === "/api/prs/pr-acme-87")).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-review"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/review-jobs/active"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it.each([
  ["non-object row", [null]],
  ["unsafe ID", [{ ...prs[0], id: "pr acme 87" }]],
  ["non-positive number", [{ ...prs[0], number: 0 }]],
  ["blank title", [{ ...prs[0], title: " " }]],
  ["invalid timestamp", [{ ...prs[0], created_at: "not-a-date" }]],
  ["duplicate ID", [prs[0], { ...prs[1], id: prs[0]!.id }]],
  ["duplicate number", [prs[0], { ...prs[1], number: prs[0]!.number }]],
])("rejects a pull-request catalog with %s before navigation", async (_label, pullRequestCatalog) => {
  const fetchMock = installFetch({ pullRequestCatalog });
  renderAt("/");
  expect((await screen.findAllByText("The pull-request catalog failed identity validation.")).length).toBeGreaterThan(0);
  expect(screen.queryByRole("link", { name: "Update order status" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => new URL(String(entry[0]), "http://localhost").pathname === "/api/prs/pr-acme-87")).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("rejects an invalid pull-request catalog before Memory Lab recovery", async () => {
  saveActiveJob("comparison", "pr-acme-87", "job-cmp");
  const fetchMock = installFetch({ pullRequestCatalog: [{ ...prs[0], title: " " }] });
  renderAt("/repos/repo-acme-commerce/lab?case=pr-acme-87");
  expect((await screen.findAllByText("The pull-request catalog failed identity validation.")).length).toBeGreaterThan(0);
  expect(screen.getByRole("option", { name: "No pull requests" })).toBeTruthy();
  expect((screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement).disabled).toBe(true);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-cmp"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/review-jobs/active"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/comparisons/latest"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

const validPullRequestPayload = {
  ...prs[0],
  repository_id: "repo-acme-commerce",
  description: "Sets order status directly.",
  diff_text: diff,
};

it.each([
  ["non-object shape", []],
  ["unsafe pull-request ID", { ...validPullRequestPayload, id: "pr acme 87" }],
  ["unsafe repository ID", { ...validPullRequestPayload, repository_id: "repo acme" }],
  ["non-positive number", { ...validPullRequestPayload, number: 0 }],
  ["fractional number", { ...validPullRequestPayload, number: 1.5 }],
  ["blank title", { ...validPullRequestPayload, title: " " }],
  ["oversized title", { ...validPullRequestPayload, title: "x".repeat(241) }],
  ["non-string description", { ...validPullRequestPayload, description: 42 }],
  ["oversized description", { ...validPullRequestPayload, description: "x".repeat(20_001) }],
  ["non-string diff", { ...validPullRequestPayload, diff_text: 42 }],
  ["oversized diff", { ...validPullRequestPayload, diff_text: "x".repeat(100_001) }],
  ["malformed diff hunk", { ...validPullRequestPayload, diff_text: "--- a/src/a.ts\n+++ b/src/a.ts\n@@ -1 +1 @@\n+new\n" }],
  ["unsafe diff path", { ...validPullRequestPayload, diff_text: "--- a/../../secret\n+++ b/../../secret\n@@ -0,0 +1 @@\n+x\n" }],
  ["binary diff", { ...validPullRequestPayload, diff_text: "Binary files a/image.png and b/image.png differ\n" }],
  ["invalid creation time", { ...validPullRequestPayload, created_at: "not-a-date" }],
])("rejects a pull request with %s before review recovery", async (_label, pullRequestPayload) => {
  saveActiveJob("review", "pr-acme-87", "job-review");
  const fetchMock = installFetch({ pullRequestPayload, latestReview: true });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("The pull request failed payload validation.");
  expect(screen.queryByRole("heading", { name: /Update order status/ })).toBeNull();
  expect((screen.getByRole("button", { name: "Run CodeDNA Review" }) as HTMLButtonElement).disabled).toBe(true);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-review"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/review-jobs/active"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("surfaces an invalid stored review instead of rendering it without correlation", async () => {
  const fetchMock = installFetch({ latestReview: { ...review, run_id: "invalid id" } });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "Review recovery unavailable: The stored review failed correlation validation.",
  );
  expect(screen.getByRole("button", { name: "Retry saved review recovery" })).toBeTruthy();
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("rejects a stored review for a different pull request", async () => {
  const fetchMock = installFetch({ latestReview: { ...review, pr_id: "pr-acme-120" } });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "Review recovery unavailable: The stored review failed correlation validation.",
  );
  expect(screen.getByRole("button", { name: "Retry saved review recovery" })).toBeTruthy();
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("rejects a stored memory review with the wrong explicit mode", async () => {
  const fetchMock = installFetch({ latestReview: { ...review, mode: "baseline" } });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "Review recovery unavailable: The stored review failed correlation validation.",
  );
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("rejects a stored review without provider identity", async () => {
  const fetchMock = installFetch({ latestReview: { ...review, provider: undefined } });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "Review recovery unavailable: The stored review failed correlation validation.",
  );
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("rejects a stored review with overlong provider identity", async () => {
  const fetchMock = installFetch({ latestReview: { ...review, provider: "p".repeat(81) } });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "Review recovery unavailable: The stored review failed correlation validation.",
  );
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("rejects a stored review without a findings array", async () => {
  const fetchMock = installFetch({ latestReview: { ...review, findings: undefined } });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "Review recovery unavailable: The stored review failed correlation validation.",
  );
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("rejects a stored review with an invalid finding category", async () => {
  const fetchMock = installFetch({
    latestReview: { ...review, findings: [{ ...teamFinding, category: "policy" }] },
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "Review recovery unavailable: The stored review failed correlation validation.",
  );
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("rejects a stored review without elapsed timing", async () => {
  const fetchMock = installFetch({ latestReview: { ...review, elapsed_ms: undefined } });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "Review recovery unavailable: The stored review failed correlation validation.",
  );
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("rejects a stored general finding with policy evidence", async () => {
  const fetchMock = installFetch({
    latestReview: { ...review, findings: [{ ...generalFinding, evidence_ids: ["DEC-0103"] }] },
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "Review recovery unavailable: The stored review failed correlation validation.",
  );
  expect(screen.queryByRole("article", { name: "Missing update reason check" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("rejects a stored team citation absent from validated evidence", async () => {
  const fetchMock = installFetch({
    latestReview: {
      ...review,
      retrieval: { ...review.retrieval, validated_evidence: [{ decision_id: "DEC-other" }] },
    },
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "Review recovery unavailable: The stored review failed correlation validation.",
  );
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("rejects a stored team citation without bank provenance", async () => {
  const evidence = { ...validatedEvidence("DEC-0103", 103), bank_id: undefined };
  const fetchMock = installFetch({
    latestReview: {
      ...review,
      findings: [{ ...teamFinding, evidence_ids: ["DEC-0103"] }],
      retrieval: { ...review.retrieval, validated_evidence: [evidence] },
    },
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "Review recovery unavailable: The stored review failed correlation validation.",
  );
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("rejects stored cited evidence spanning multiple banks", async () => {
  const fetchMock = installFetch({
    latestReview: {
      ...review,
      findings: [{ ...teamFinding, evidence_ids: ["DEC-0103", "DEC-0042"] }],
      retrieval: {
        ...review.retrieval,
        validated_evidence: [
          validatedEvidence("DEC-0103", 103),
          { ...validatedEvidence("DEC-0042", 42), bank_id: "bank-analytics-service" },
        ],
      },
    },
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "Review recovery unavailable: The stored review failed correlation validation.",
  );
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("rejects stored cited evidence from another route repository", async () => {
  const evidence = {
    ...validatedEvidence("DEC-0103", 103),
    repository_id: "repo-analytics-service",
    repository_slug: "analytics-service",
    bank_id: "bank-analytics-service",
  };
  const fetchMock = installFetch({
    latestReview: {
      ...review,
      findings: [{ ...teamFinding, evidence_ids: ["DEC-0103"] }],
      retrieval: { ...review.retrieval, validated_evidence: [evidence] },
    },
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "Review recovery unavailable: The stored review failed correlation validation.",
  );
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("rejects stored cited evidence with an off-catalog repository slug", async () => {
  const fetchMock = installFetch({ repositorySlug: "renamed-acme-commerce", latestReview: true });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "Review recovery unavailable: The stored review failed correlation validation.",
  );
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("reattaches to an active review after refresh without starting another job", async () => {
  saveActiveJob("review", "pr-acme-87", "job-review");
  const fetchMock = installFetch({ reviewPollFailures: 1, pollDelayMs: 50 });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  expect((await screen.findAllByText("Connection interrupted. Reconnecting to the existing review…")).length).toBeGreaterThan(0);
  expect(await screen.findByRole("article", { name: "Direct status write skips the service" }, { timeout: 3000 })).toBeTruthy();
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-review"))).toHaveLength(2);
  expect(loadActiveJob("review", "pr-acme-87")).toBeNull();
});

it("uses the saved baseline mode when validating a refreshed review", async () => {
  saveActiveJob("review", "pr-acme-87", "job-review", { reviewMode: "baseline" });
  const fetchMock = installFetch({
    reviewJobPayload: completeReviewJobEnvelope({ review: { ...review, mode: "memory" } }),
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("invalid correlation metadata");
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(loadActiveJob("review", "pr-acme-87")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it.each([
  ["another job ID", completeReviewJobEnvelope({ job_id: "job-other" })],
  ["another pull request", completeReviewJobEnvelope({ pr_id: "pr-acme-120" })],
  ["another job kind", completeReviewJobEnvelope({ kind: "comparison" })],
  ["an unknown status", completeReviewJobEnvelope({ status: "completed" })],
  ["an unsafe stage", completeReviewJobEnvelope({ stage: "../complete" })],
  ["a contradictory running stage", completeReviewJobEnvelope({ status: "running", stage: "complete" })],
  ["reversed timestamps", completeReviewJobEnvelope({ created_at: jobUpdatedAt, updated_at: jobCreatedAt })],
  ["an error on successful state", completeReviewJobEnvelope({ error_code: "review_service_unavailable" })],
])("rejects a review status envelope for %s before accepting progress or results", async (_case, payload) => {
  saveActiveJob("review", "pr-acme-87", "job-review");
  const fetchMock = installFetch({ reviewJobPayload: payload });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("The job status response failed");
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(loadActiveJob("review", "pr-acme-87")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-review"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("accepts a correlated failed status envelope and exposes only its sanitized code", async () => {
  saveActiveJob("review", "pr-acme-87", "job-review");
  const fetchMock = installFetch({
    reviewJobPayload: completeReviewJobEnvelope({
      status: "failed",
      stage: "failed",
      error_code: "review_service_unavailable",
      review: undefined,
    }),
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("The review failed (review_service_unavailable).");
  expect(loadActiveJob("review", "pr-acme-87")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-review"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("accepts monotonic queued-to-running-to-complete review progress", async () => {
  saveActiveJob("review", "pr-acme-87", "job-review");
  const fetchMock = installFetch({
    reviewJobPayloads: [
      completeReviewJobEnvelope({ status: "queued", stage: "queued", updated_at: jobUpdatedAt, review: undefined }),
      completeReviewJobEnvelope({ status: "running", stage: "reviewing_diff", updated_at: jobLaterUpdatedAt, review: undefined }),
      completeReviewJobEnvelope({ updated_at: jobLatestUpdatedAt }),
    ],
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  expect(await screen.findByRole("article", { name: "Direct status write skips the service" }, { timeout: 5000 })).toBeTruthy();
  expect(loadActiveJob("review", "pr-acme-87")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-review"))).toHaveLength(3);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("rejects a first review status that predates its discovered locator", async () => {
  const fetchMock = installFetch({
    activeJobPayload: { ...activeReviewJobResponse, updated_at: jobLatestUpdatedAt },
    reviewJobPayload: completeReviewJobEnvelope({ updated_at: jobLaterUpdatedAt }),
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("The job status response predates its accepted locator.");
  expect(loadActiveJob("review", "pr-acme-87")).toBeNull();
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/review-jobs/active?kind=review"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-review"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("rejects a first review status that predates its timing-preserving refresh locator", async () => {
  saveActiveJob("review", "pr-acme-87", "job-review", {
    createdAt: jobCreatedAt,
    updatedAt: jobLatestUpdatedAt,
  });
  const fetchMock = installFetch({
    reviewJobPayload: completeReviewJobEnvelope({ updated_at: jobLaterUpdatedAt }),
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("The job status response predates its accepted locator.");
  expect(loadActiveJob("review", "pr-acme-87")).toBeNull();
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/review-jobs/active?kind=review"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-review"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("persists validated active-discovery timing before the first review poll completes", async () => {
  let releaseReviewPoll = () => {};
  const reviewPollGate = new Promise<void>((resolve) => {
    releaseReviewPoll = resolve;
  });
  const fetchMock = installFetch({ activeReviewJob: true, reviewPollGate });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  try {
    await screen.findByText("Active job details");
    await waitFor(() => expect(loadActiveJobLocator("review", "pr-acme-87")).toEqual({
      jobId: "job-review",
      createdAt: jobCreatedAt,
      updatedAt: jobUpdatedAt,
    }));
  } finally {
    await act(async () => releaseReviewPoll());
  }
  expect(await screen.findByRole("article", { name: "Direct status write skips the service" })).toBeTruthy();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/review-jobs/active?kind=review"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("rejects a review status regression without replaying work", async () => {
  saveActiveJob("review", "pr-acme-87", "job-review");
  const fetchMock = installFetch({
    reviewJobPayloads: [
      completeReviewJobEnvelope({ status: "running", stage: "reviewing_diff", updated_at: jobUpdatedAt, review: undefined }),
      completeReviewJobEnvelope({ status: "queued", stage: "queued", updated_at: jobLaterUpdatedAt, review: undefined }),
    ],
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert", {}, { timeout: 3000 });
  expect(alert.textContent).toContain("The job status response failed progression validation.");
  expect(loadActiveJob("review", "pr-acme-87")).toBeNull();
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-review"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("rejects an active job result without a valid review correlation ID", async () => {
  const fetchMock = installFetch({
    activeReviewJob: true,
    completedReview: { ...review, run_id: "invalid id" },
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("The review finished with invalid correlation metadata.");
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-review"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  expect(loadActiveJob("review", "pr-acme-87")).toBeNull();
});

it("rejects an active review result for a different pull request", async () => {
  const fetchMock = installFetch({
    activeReviewJob: true,
    completedReview: { ...review, pr_id: "pr-acme-120" },
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("The review finished with invalid correlation metadata.");
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-review"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  expect(loadActiveJob("review", "pr-acme-87")).toBeNull();
});

it("rejects an active review result without terminal completion state", async () => {
  const fetchMock = installFetch({
    activeReviewJob: true,
    completedReview: { ...review, status: "running" },
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("The review finished with invalid correlation metadata.");
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-review"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  expect(loadActiveJob("review", "pr-acme-87")).toBeNull();
});

it("rejects an active review result without model identity", async () => {
  const fetchMock = installFetch({
    activeReviewJob: true,
    completedReview: { ...review, model: undefined },
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("The review finished with invalid correlation metadata.");
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-review"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  expect(loadActiveJob("review", "pr-acme-87")).toBeNull();
});

it("rejects an active review result with overlong model identity", async () => {
  const fetchMock = installFetch({
    activeReviewJob: true,
    completedReview: { ...review, model: "m".repeat(161) },
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("The review finished with invalid correlation metadata.");
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-review"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  expect(loadActiveJob("review", "pr-acme-87")).toBeNull();
});

it("rejects an active review result with a malformed findings array", async () => {
  const fetchMock = installFetch({
    activeReviewJob: true,
    completedReview: { ...review, findings: "not-an-array" },
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("The review finished with invalid correlation metadata.");
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-review"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  expect(loadActiveJob("review", "pr-acme-87")).toBeNull();
});

it("rejects an active review result with missing required finding text", async () => {
  const fetchMock = installFetch({
    activeReviewJob: true,
    completedReview: { ...review, findings: [{ ...teamFinding, title: undefined }] },
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("The review finished with invalid correlation metadata.");
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-review"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  expect(loadActiveJob("review", "pr-acme-87")).toBeNull();
});

it("rejects an active review result with negative elapsed timing", async () => {
  const fetchMock = installFetch({
    activeReviewJob: true,
    completedReview: { ...review, elapsed_ms: -1 },
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("The review finished with invalid correlation metadata.");
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-review"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  expect(loadActiveJob("review", "pr-acme-87")).toBeNull();
});

it("rejects an active team finding without policy evidence", async () => {
  const fetchMock = installFetch({
    activeReviewJob: true,
    completedReview: { ...review, findings: [{ ...teamFinding, evidence_ids: [] }] },
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("The review finished with invalid correlation metadata.");
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-review"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  expect(loadActiveJob("review", "pr-acme-87")).toBeNull();
});

it("rejects an active team citation with malformed validated evidence", async () => {
  const fetchMock = installFetch({
    activeReviewJob: true,
    completedReview: {
      ...review,
      retrieval: { ...review.retrieval, validated_evidence: [{ source_pr_number: 42 }] },
    },
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("The review finished with invalid correlation metadata.");
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-review"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  expect(loadActiveJob("review", "pr-acme-87")).toBeNull();
});

it("rejects an active team citation with invalid source PR provenance", async () => {
  const evidence = { ...validatedEvidence("DEC-0103", 103), source_pr_number: 0 };
  const fetchMock = installFetch({
    activeReviewJob: true,
    completedReview: {
      ...review,
      findings: [{ ...teamFinding, evidence_ids: ["DEC-0103"] }],
      retrieval: { ...review.retrieval, validated_evidence: [evidence] },
    },
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("The review finished with invalid correlation metadata.");
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-review"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  expect(loadActiveJob("review", "pr-acme-87")).toBeNull();
});

it("rejects active cited evidence spanning multiple repositories", async () => {
  const fetchMock = installFetch({
    activeReviewJob: true,
    completedReview: {
      ...review,
      findings: [{ ...teamFinding, evidence_ids: ["DEC-0103", "DEC-0042"] }],
      retrieval: {
        ...review.retrieval,
        validated_evidence: [
          validatedEvidence("DEC-0103", 103),
          { ...validatedEvidence("DEC-0042", 42), repository_id: "repo-analytics-service" },
        ],
      },
    },
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("The review finished with invalid correlation metadata.");
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-review"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  expect(loadActiveJob("review", "pr-acme-87")).toBeNull();
});

it("rejects active cited evidence from another route repository", async () => {
  const evidence = {
    ...validatedEvidence("DEC-0103", 103),
    repository_id: "repo-analytics-service",
    repository_slug: "analytics-service",
    bank_id: "bank-analytics-service",
  };
  const fetchMock = installFetch({
    activeReviewJob: true,
    completedReview: {
      ...review,
      findings: [{ ...teamFinding, evidence_ids: ["DEC-0103"] }],
      retrieval: { ...review.retrieval, validated_evidence: [evidence] },
    },
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("The review finished with invalid correlation metadata.");
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-review"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  expect(loadActiveJob("review", "pr-acme-87")).toBeNull();
});

it("rejects active cited evidence with an off-catalog repository slug", async () => {
  const fetchMock = installFetch({ repositorySlug: "renamed-acme-commerce", activeReviewJob: true });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("The review finished with invalid correlation metadata.");
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-review"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  expect(loadActiveJob("review", "pr-acme-87")).toBeNull();
});

it("recovers a timed-out active review status read without starting another job", async () => {
  saveActiveJob("review", "pr-acme-87", "job-review");
  const fetchMock = installFetch({ reviewPollHangs: 1, pollDelayMs: 50 });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  expect((await screen.findAllByText("Connection interrupted. Reconnecting to the existing review…")).length).toBeGreaterThan(0);
  expect(await screen.findByRole("article", { name: "Direct status write skips the service" }, { timeout: 3000 })).toBeTruthy();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-review"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it.each([
  ["non-object payload", null],
  ["array payload", []],
  ["different PR", { ...activeReviewJobResponse, pr_id: "pr-acme-120" }],
  ["different kind", { ...activeReviewJobResponse, kind: "comparison" }],
  ["missing job ID", { ...activeReviewJobResponse, job_id: undefined }],
  ["invalid job ID", { ...activeReviewJobResponse, job_id: "review-1" }],
  ["terminal status", { ...activeReviewJobResponse, status: "complete" }],
  ["unsafe stage", { ...activeReviewJobResponse, stage: "reviewing diff" }],
  ["missing creation time", { ...activeReviewJobResponse, created_at: null }],
  ["invalid update time", { ...activeReviewJobResponse, updated_at: "not-a-date" }],
  ["update before creation", { ...activeReviewJobResponse, updated_at: new Date(Date.parse(jobCreatedAt) - 1).toISOString() }],
  ["empty locator with active status", { ...activeReviewJobResponse, job_id: null }],
  ["empty locator with timing", { pr_id: "pr-acme-87", kind: "review", job_id: null, status: null, stage: null, created_at: jobCreatedAt, updated_at: null }],
])("rejects same-PR active review discovery with %s before persisting a locator", async (_label, activeJobPayload) => {
  const fetchMock = installFetch({ activeJobPayload });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("The active job response failed correlation validation.");
  expect(loadActiveJob("review", "pr-acme-87")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("discovers an active review after tab storage is lost without starting another job", async () => {
  const fetchMock = installFetch({ activeReviewJob: true });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  expect(await screen.findByRole("article", { name: "Direct status write skips the service" })).toBeTruthy();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/review-jobs/active?kind=review"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-review"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  expect(loadActiveJob("review", "pr-acme-87")).toBeNull();
});

it("announces when starting a review reuses existing provider work", async () => {
  let releaseReviewPoll = () => {};
  const reviewPollGate = new Promise<void>((resolve) => {
    releaseReviewPoll = resolve;
  });
  const fetchMock = installFetch({ reusedReviewStart: true, reviewPollGate });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  await screen.findByRole("heading", { name: /Update order status/ });
  const run = screen.getByRole("button", { name: "Run CodeDNA Review" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  try {
    expect((await screen.findAllByText("Existing review found. Reattached without starting another provider call.")).length).toBeGreaterThan(0);
  } finally {
    await act(async () => releaseReviewPoll());
  }
  expect(await screen.findByRole("article", { name: "Direct status write skips the service" })).toBeTruthy();
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
});

it("reconciles a lost review-creation response through the backend claim", async () => {
  const fetchMock = installFetch({ reviewCreationHangs: true, pollDelayMs: 50 });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const run = screen.getByRole("button", { name: "Run CodeDNA Review" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  expect((await screen.findAllByText("Existing review found. Reattached without starting another provider call.")).length).toBeGreaterThan(0);
  expect(await screen.findByRole("article", { name: "Direct status write skips the service" }, { timeout: 3000 })).toBeTruthy();
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/review-jobs/active?kind=review"))).toHaveLength(2);
});

it("rejects a mismatched review-creation response and reattaches through the correlated claim", async () => {
  let releaseReviewPoll = () => {};
  const reviewPollGate = new Promise<void>((resolve) => {
    releaseReviewPoll = resolve;
  });
  const fetchMock = installFetch({
    reviewPollGate,
    reviewCreationPayload: {
      pr_id: "pr-acme-120",
      job_id: "job-wrong",
      kind: "review",
      status: "queued",
      stage: "queued",
      reused: false,
      created_at: "2026-10-26T10:00:00Z",
      updated_at: "2026-10-26T10:00:00Z",
    },
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const run = screen.getByRole("button", { name: "Run CodeDNA Review" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  try {
    expect((await screen.findAllByText("Existing review found. Reattached without starting another provider call.")).length).toBeGreaterThan(0);
  } finally {
    await act(async () => releaseReviewPoll());
  }
  expect(await screen.findByRole("article", { name: "Direct status write skips the service" })).toBeTruthy();
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-wrong"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-review"))).toHaveLength(1);
});

it.each([
  ["missing correlation metadata", { job_id: "job-review" }],
  ["a non-Boolean reuse flag", { pr_id: "pr-acme-87", job_id: "job-review", kind: "review", status: "queued", stage: "queued", reused: "false", created_at: "2026-10-26T10:00:00Z", updated_at: "2026-10-26T10:00:00Z" }],
  ["a terminal status", { pr_id: "pr-acme-87", job_id: "job-review", kind: "review", status: "complete", stage: "complete", reused: false, created_at: "2026-10-26T10:00:00Z", updated_at: "2026-10-26T10:00:00Z" }],
  ["an unsafe stage", { pr_id: "pr-acme-87", job_id: "job-review", kind: "review", status: "queued", stage: "../queued", reused: false, created_at: "2026-10-26T10:00:00Z", updated_at: "2026-10-26T10:00:00Z" }],
  ["reversed timestamps", { pr_id: "pr-acme-87", job_id: "job-review", kind: "review", status: "queued", stage: "queued", reused: false, created_at: "2026-10-26T10:00:01Z", updated_at: "2026-10-26T10:00:00Z" }],
])("fails closed when a review-creation response has %s and no correlated claim", async (_case, payload) => {
  const fetchMock = installFetch({ reviewCreationPayload: payload, reviewCreationClaimVisible: false });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const run = screen.getByRole("button", { name: "Run CodeDNA Review" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("The review creation response was lost and no active job is visible yet.");
  expect(run.disabled).toBe(true);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-review"))).toHaveLength(0);
});

it("fails closed, then reconciles a lost review creation through GET-only status", async () => {
  const fetchMock = installFetch({ reviewCreationHangs: true, reviewCreationClaimVisible: false });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const run = screen.getByRole("button", { name: "Run CodeDNA Review" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("The review creation response was lost and no active job is visible yet.");
  expect(alert.textContent).toContain("Use Check creation status before trying again.");
  expect(run.disabled).toBe(true);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/review-jobs/active?kind=review"))).toHaveLength(4);
  const check = screen.getByRole("button", { name: "Check creation status" });
  check.focus();
  fireEvent.click(check);
  expect(await screen.findByText(/Creation status checked\. No active or completed review was found/)).toBeTruthy();
  await waitFor(() => expect(run.disabled).toBe(false));
  expect(document.activeElement).toBe(screen.getByRole("region", { name: "Review workspace" }));
  expect(screen.queryByRole("button", { name: "Check creation status" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/review-jobs/active?kind=review"))).toHaveLength(5);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(2);
});

it("reattaches when a review claim appears during the manual creation-status check", async () => {
  let releaseReviewPoll = () => {};
  const reviewPollGate = new Promise<void>((resolve) => {
    releaseReviewPoll = resolve;
  });
  const fetchMock = installFetch({
    reviewCreationHangs: true,
    reviewCreationClaimVisible: false,
    reviewCreationClaimVisibleAfterActiveRead: 5,
    reviewPollGate,
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const run = screen.getByRole("button", { name: "Run CodeDNA Review" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  const check = await screen.findByRole("button", { name: "Check creation status" });
  fireEvent.click(check);
  try {
    expect((await screen.findAllByText("Existing review found. Reattached without starting another provider call.")).length).toBeGreaterThan(0);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("region", { name: "Review workspace" })));
  } finally {
    await act(async () => releaseReviewPoll());
  }
  expect(await screen.findByRole("article", { name: "Direct status write skips the service" })).toBeTruthy();
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/review-jobs/active?kind=review"))).toHaveLength(5);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(1);
});

it("keeps review creation disabled when the manual creation-status read fails", async () => {
  const fetchMock = installFetch({
    reviewCreationHangs: true,
    reviewCreationClaimVisible: false,
    reviewRecoveryFailureAtActiveRead: 5,
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const run = screen.getByRole("button", { name: "Run CodeDNA Review" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  fireEvent.click(await screen.findByRole("button", { name: "Check creation status" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Review creation status is still unavailable: manual creation status unavailable");
  const retry = screen.getByRole("button", { name: "Check creation status" });
  await waitFor(() => expect(document.activeElement).toBe(retry));
  expect(run.disabled).toBe(true);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/review-jobs/active?kind=review"))).toHaveLength(5);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(1);
});

it("restores a completed review found during manual creation-status reconciliation", async () => {
  const fetchMock = installFetch({
    reviewCreationHangs: true,
    reviewCreationClaimVisible: false,
    latestReview: true,
    latestReviewAfterRead: 2,
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const run = screen.getByRole("button", { name: "Run CodeDNA Review" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  fireEvent.click(await screen.findByRole("button", { name: "Check creation status" }));
  expect(await screen.findByRole("article", { name: "Direct status write skips the service" })).toBeTruthy();
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { name: /Review findings/ })));
  expect(screen.getAllByText("Latest saved review restored").length).toBeGreaterThan(0);
  expect(screen.queryByRole("button", { name: "Check creation status" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/review-jobs/active?kind=review"))).toHaveLength(5);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-review"))).toHaveLength(0);
});

it("keeps creation uncertain when manual reconciliation finds an invalid stored review", async () => {
  const fetchMock = installFetch({
    reviewCreationHangs: true,
    reviewCreationClaimVisible: false,
    latestReview: { ...review, run_id: "invalid id" },
    latestReviewAfterRead: 2,
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const run = screen.getByRole("button", { name: "Run CodeDNA Review" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  fireEvent.click(await screen.findByRole("button", { name: "Check creation status" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "Review creation status is still unavailable: The stored review failed correlation validation.",
  );
  const retry = screen.getByRole("button", { name: "Check creation status" });
  await waitFor(() => expect(document.activeElement).toBe(retry));
  expect(run.disabled).toBe(true);
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
});

it("keeps creation uncertain when manual reconciliation finds a review for another pull request", async () => {
  const fetchMock = installFetch({
    reviewCreationHangs: true,
    reviewCreationClaimVisible: false,
    latestReview: { ...review, pr_id: "pr-acme-120" },
    latestReviewAfterRead: 2,
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const run = screen.getByRole("button", { name: "Run CodeDNA Review" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  fireEvent.click(await screen.findByRole("button", { name: "Check creation status" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "Review creation status is still unavailable: The stored review failed correlation validation.",
  );
  const retry = screen.getByRole("button", { name: "Check creation status" });
  await waitFor(() => expect(document.activeElement).toBe(retry));
  expect(run.disabled).toBe(true);
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
});

it("keeps creation uncertain when manual reconciliation finds a review without an explicit mode", async () => {
  const fetchMock = installFetch({
    reviewCreationHangs: true,
    reviewCreationClaimVisible: false,
    latestReview: { ...review, mode: undefined },
    latestReviewAfterRead: 2,
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const run = screen.getByRole("button", { name: "Run CodeDNA Review" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  fireEvent.click(await screen.findByRole("button", { name: "Check creation status" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "Review creation status is still unavailable: The stored review failed correlation validation.",
  );
  const retry = screen.getByRole("button", { name: "Check creation status" });
  await waitFor(() => expect(document.activeElement).toBe(retry));
  expect(run.disabled).toBe(true);
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
});

it("keeps creation uncertain when manual reconciliation finds blank provider identity", async () => {
  const fetchMock = installFetch({
    reviewCreationHangs: true,
    reviewCreationClaimVisible: false,
    latestReview: { ...review, provider: "   " },
    latestReviewAfterRead: 2,
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const run = screen.getByRole("button", { name: "Run CodeDNA Review" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  fireEvent.click(await screen.findByRole("button", { name: "Check creation status" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "Review creation status is still unavailable: The stored review failed correlation validation.",
  );
  const retry = screen.getByRole("button", { name: "Check creation status" });
  await waitFor(() => expect(document.activeElement).toBe(retry));
  expect(run.disabled).toBe(true);
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
});

it("keeps creation uncertain when manual reconciliation finds oversized provider identity", async () => {
  const fetchMock = installFetch({
    reviewCreationHangs: true,
    reviewCreationClaimVisible: false,
    latestReview: { ...review, provider: "p".repeat(81) },
    latestReviewAfterRead: 2,
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const run = screen.getByRole("button", { name: "Run CodeDNA Review" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  fireEvent.click(await screen.findByRole("button", { name: "Check creation status" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "Review creation status is still unavailable: The stored review failed correlation validation.",
  );
  const retry = screen.getByRole("button", { name: "Check creation status" });
  await waitFor(() => expect(document.activeElement).toBe(retry));
  expect(run.disabled).toBe(true);
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
});

it("keeps creation uncertain when manual reconciliation finds an invalid finding entry", async () => {
  const fetchMock = installFetch({
    reviewCreationHangs: true,
    reviewCreationClaimVisible: false,
    latestReview: { ...review, findings: [null] },
    latestReviewAfterRead: 2,
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const run = screen.getByRole("button", { name: "Run CodeDNA Review" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  fireEvent.click(await screen.findByRole("button", { name: "Check creation status" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "Review creation status is still unavailable: The stored review failed correlation validation.",
  );
  const retry = screen.getByRole("button", { name: "Check creation status" });
  await waitFor(() => expect(document.activeElement).toBe(retry));
  expect(run.disabled).toBe(true);
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
});

it("keeps creation uncertain when manual reconciliation finds invalid finding confidence", async () => {
  const fetchMock = installFetch({
    reviewCreationHangs: true,
    reviewCreationClaimVisible: false,
    latestReview: { ...review, findings: [{ ...teamFinding, confidence: "certain" }] },
    latestReviewAfterRead: 2,
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const run = screen.getByRole("button", { name: "Run CodeDNA Review" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  fireEvent.click(await screen.findByRole("button", { name: "Check creation status" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "Review creation status is still unavailable: The stored review failed correlation validation.",
  );
  const retry = screen.getByRole("button", { name: "Check creation status" });
  await waitFor(() => expect(document.activeElement).toBe(retry));
  expect(run.disabled).toBe(true);
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
});

it("keeps creation uncertain when manual reconciliation finds fractional elapsed timing", async () => {
  const fetchMock = installFetch({
    reviewCreationHangs: true,
    reviewCreationClaimVisible: false,
    latestReview: { ...review, elapsed_ms: 1.5 },
    latestReviewAfterRead: 2,
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const run = screen.getByRole("button", { name: "Run CodeDNA Review" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  fireEvent.click(await screen.findByRole("button", { name: "Check creation status" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "Review creation status is still unavailable: The stored review failed correlation validation.",
  );
  const retry = screen.getByRole("button", { name: "Check creation status" });
  await waitFor(() => expect(document.activeElement).toBe(retry));
  expect(run.disabled).toBe(true);
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
});

it("keeps creation uncertain when manual reconciliation finds an uncited team finding", async () => {
  const fetchMock = installFetch({
    reviewCreationHangs: true,
    reviewCreationClaimVisible: false,
    latestReview: { ...review, findings: [{ ...teamFinding, evidence_ids: [] }] },
    latestReviewAfterRead: 2,
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const run = screen.getByRole("button", { name: "Run CodeDNA Review" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  fireEvent.click(await screen.findByRole("button", { name: "Check creation status" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "Review creation status is still unavailable: The stored review failed correlation validation.",
  );
  const retry = screen.getByRole("button", { name: "Check creation status" });
  await waitFor(() => expect(document.activeElement).toBe(retry));
  expect(run.disabled).toBe(true);
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
});

it("keeps creation uncertain when manual reconciliation cannot resolve a team citation", async () => {
  const fetchMock = installFetch({
    reviewCreationHangs: true,
    reviewCreationClaimVisible: false,
    latestReview: { ...review, retrieval: { timings_ms: review.retrieval.timings_ms } },
    latestReviewAfterRead: 2,
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const run = screen.getByRole("button", { name: "Run CodeDNA Review" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  fireEvent.click(await screen.findByRole("button", { name: "Check creation status" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "Review creation status is still unavailable: The stored review failed correlation validation.",
  );
  const retry = screen.getByRole("button", { name: "Check creation status" });
  await waitFor(() => expect(document.activeElement).toBe(retry));
  expect(run.disabled).toBe(true);
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
});

it("keeps creation uncertain when manual reconciliation lacks source PR provenance", async () => {
  const evidence = { ...validatedEvidence("DEC-0103", 103), source_pr_id: "" };
  const fetchMock = installFetch({
    reviewCreationHangs: true,
    reviewCreationClaimVisible: false,
    latestReview: {
      ...review,
      findings: [{ ...teamFinding, evidence_ids: ["DEC-0103"] }],
      retrieval: { ...review.retrieval, validated_evidence: [evidence] },
    },
    latestReviewAfterRead: 2,
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const run = screen.getByRole("button", { name: "Run CodeDNA Review" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  fireEvent.click(await screen.findByRole("button", { name: "Check creation status" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "Review creation status is still unavailable: The stored review failed correlation validation.",
  );
  const retry = screen.getByRole("button", { name: "Check creation status" });
  await waitFor(() => expect(document.activeElement).toBe(retry));
  expect(run.disabled).toBe(true);
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
});

it("keeps creation uncertain when cited evidence disagrees on repository slug", async () => {
  const fetchMock = installFetch({
    reviewCreationHangs: true,
    reviewCreationClaimVisible: false,
    latestReview: {
      ...review,
      findings: [{ ...teamFinding, evidence_ids: ["DEC-0103", "DEC-0042"] }],
      retrieval: {
        ...review.retrieval,
        validated_evidence: [
          validatedEvidence("DEC-0103", 103),
          { ...validatedEvidence("DEC-0042", 42), repository_slug: "analytics-service" },
        ],
      },
    },
    latestReviewAfterRead: 2,
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const run = screen.getByRole("button", { name: "Run CodeDNA Review" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  fireEvent.click(await screen.findByRole("button", { name: "Check creation status" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "Review creation status is still unavailable: The stored review failed correlation validation.",
  );
  const retry = screen.getByRole("button", { name: "Check creation status" });
  await waitFor(() => expect(document.activeElement).toBe(retry));
  expect(run.disabled).toBe(true);
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
});

it("keeps creation uncertain when cited evidence belongs to another route repository", async () => {
  const evidence = {
    ...validatedEvidence("DEC-0103", 103),
    repository_id: "repo-analytics-service",
    repository_slug: "analytics-service",
    bank_id: "bank-analytics-service",
  };
  const fetchMock = installFetch({
    reviewCreationHangs: true,
    reviewCreationClaimVisible: false,
    latestReview: {
      ...review,
      findings: [{ ...teamFinding, evidence_ids: ["DEC-0103"] }],
      retrieval: { ...review.retrieval, validated_evidence: [evidence] },
    },
    latestReviewAfterRead: 2,
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const run = screen.getByRole("button", { name: "Run CodeDNA Review" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  fireEvent.click(await screen.findByRole("button", { name: "Check creation status" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "Review creation status is still unavailable: The stored review failed correlation validation.",
  );
  const retry = screen.getByRole("button", { name: "Check creation status" });
  await waitFor(() => expect(document.activeElement).toBe(retry));
  expect(run.disabled).toBe(true);
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
});

it("keeps creation uncertain when cited evidence has an off-catalog repository slug", async () => {
  const fetchMock = installFetch({
    repositorySlug: "renamed-acme-commerce",
    reviewCreationHangs: true,
    reviewCreationClaimVisible: false,
    latestReview: review,
    latestReviewAfterRead: 2,
  });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const run = screen.getByRole("button", { name: "Run CodeDNA Review" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  fireEvent.click(await screen.findByRole("button", { name: "Check creation status" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "Review creation status is still unavailable: The stored review failed correlation validation.",
  );
  const retry = screen.getByRole("button", { name: "Check creation status" });
  await waitFor(() => expect(document.activeElement).toBe(retry));
  expect(run.disabled).toBe(true);
  expect(screen.queryByRole("article", { name: "Direct status write skips the service" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
});

it("keeps review creation disabled until persisted recovery completes", async () => {
  let releaseLatestReview = () => {};
  const latestReviewGate = new Promise<void>((resolve) => {
    releaseLatestReview = resolve;
  });
  const fetchMock = installFetch({ latestReviewGate });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  await waitFor(() => expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(1));
  const workspace = screen.getByRole("region", { name: "Review workspace" });
  const run = screen.getByRole("button", { name: "Run CodeDNA Review" }) as HTMLButtonElement;
  expect(workspace.getAttribute("aria-busy")).toBe("true");
  expect(screen.getAllByText("Loading pull request…")).toHaveLength(2);
  expect(screen.getAllByRole("status").filter((item) => item.textContent === "Loading pull request…")).toHaveLength(1);
  expect(run.disabled).toBe(true);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  await act(async () => releaseLatestReview());
  await waitFor(() => expect(run.disabled).toBe(false));
  expect(workspace.getAttribute("aria-busy")).toBe("false");
  expect(screen.queryByText("Loading pull request…")).toBeNull();
});

it("leaves an actionable review state when persisted recovery fails", async () => {
  const fetchMock = installFetch({ reviewRecoveryFailure: true });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Review recovery unavailable: temporary recovery outage");
  expect(alert.textContent).toContain("No review or provider call was started");
  expect(alert.textContent).toContain("start a new review when dependencies are ready");
  expect(screen.getByRole("region", { name: "Review workspace" }).getAttribute("aria-busy")).toBe("false");
  expect((screen.getByRole("button", { name: "Run CodeDNA Review" }) as HTMLButtonElement).disabled).toBe(false);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  const retry = screen.getByRole("button", { name: "Retry saved review recovery" });
  retry.focus();
  fireEvent.click(retry);
  const recreated = await screen.findByRole("button", { name: "Retry saved review recovery" });
  await waitFor(() => expect(document.activeElement).toBe(recreated));
});

it("times out a hung saved-review recovery read without starting provider work", async () => {
  const fetchMock = installFetch({ reviewRecoveryHangs: 1 });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Review recovery unavailable: The background-job read timed out.");
  expect(alert.textContent).toContain("No review or provider call was started");
  expect(screen.getByRole("button", { name: "Retry saved review recovery" })).toBeTruthy();
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("retries saved review recovery through GET only", async () => {
  const fetchMock = installFetch({ reviewRecoveryFailures: 1, latestReview: true });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const retry = await screen.findByRole("button", { name: "Retry saved review recovery" });
  fireEvent.click(retry);
  expect(await screen.findByRole("article", { name: "Direct status write skips the service" })).toBeTruthy();
  const findingsHeading = screen.getByRole("heading", { name: /^Review findings/ });
  await waitFor(() => expect(document.activeElement).toBe(findingsHeading));
  expect(screen.queryByRole("button", { name: "Retry saved review recovery" })).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/review-jobs/active?kind=review"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("announces an empty saved review recovery without starting work", async () => {
  const fetchMock = installFetch({ reviewRecoveryFailures: 1 });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const retry = await screen.findByRole("button", { name: "Retry saved review recovery" });
  fireEvent.click(retry);
  const message = "Saved review recovery completed. No persisted review was found, and no provider work was started.";
  await waitFor(() => expect(screen.getAllByRole("status").some((item) => item.textContent === message)).toBe(true));
  expect(document.activeElement).toBe(screen.getByRole("region", { name: "Review workspace" }));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("checks an existing review again after bounded polling is exhausted", async () => {
  const fetchMock = installFetch({ activeReviewJob: true, reviewPollFailures: 4 });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const retry = await screen.findByRole("button", { name: "Check review again" });
  const details = screen.getByText("Active job details").closest("details");
  expect(details).toBeTruthy();
  fireEvent.click(screen.getByText("Active job details"));
  expect(within(details as HTMLElement).getByText("job-review")).toBeTruthy();
  expect(within(details as HTMLElement).getByText("Status temporarily unavailable")).toBeTruthy();
  expect(details?.querySelector(`time[datetime="${jobCreatedAt}"]`)).toBeTruthy();
  expect(details?.querySelector(`time[datetime="${jobUpdatedAt}"]`)).toBeTruthy();
  expect(details?.querySelectorAll(".job-time small")).toHaveLength(2);
  const staleWarning = screen.getByText(/has not reported progress for at least 3 minutes/i);
  expect(staleWarning.getAttribute("role")).toBe("status");
  expect(staleWarning.textContent).toContain("no retry or provider call was started");
  expect(loadActiveJob("review", "pr-acme-87")).toBe("job-review");
  fireEvent.click(retry);
  expect(await screen.findByRole("article", { name: "Direct status write skips the service" })).toBeTruthy();
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-review"))).toHaveLength(5);
  expect(loadActiveJob("review", "pr-acme-87")).toBeNull();
  expect(screen.queryByText("Active job details")).toBeNull();
});

it("clears a missing active review and restores the latest completed result", async () => {
  saveActiveJob("review", "pr-acme-87", "job-review");
  const fetchMock = installFetch({ missingReviewJob: true, latestReview: true });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  expect(await screen.findByRole("article", { name: "Direct status write skips the service" })).toBeTruthy();
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-review"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/reviews/latest"))).toHaveLength(1);
  expect(loadActiveJob("review", "pr-acme-87")).toBeNull();
  expect(screen.getAllByText("Latest saved review restored").length).toBeGreaterThan(0);
});

it("shows active and superseded evidence for a design-mismatch finding", async () => {
  const { team } = await reviewedPage();
  const evidenceButton = within(team).getByRole("button", { name: "View evidence" });
  evidenceButton.focus();
  fireEvent.click(evidenceButton);
  const panel = await screen.findByRole("region", { name: "Finding evidence" });
  expect(document.activeElement).toBe(panel);
  expect(panel.textContent).toContain("active");
  expect(panel.textContent).toContain("superseded");
  expect(panel.textContent).toContain("Use the service for status changes.");
  expect(panel.textContent).toContain("Earlier transition rule.");
  expect(panel.textContent).toContain("This change writes order status directly.");
  expect(panel.textContent).toContain("PR #103");
  expect(panel.textContent).toContain("PR #42");
  fireEvent.click(within(panel).getByRole("button", { name: "Close evidence" }));
  expect(document.activeElement).toBe(evidenceButton);
});

it.each([
  ["non-object payload", []],
  ["another run", { run_id: "run-other", decisions }],
  ["non-array decisions", { run_id: "run-1", decisions: {} }],
  ["non-object decision", { run_id: "run-1", decisions: [null] }],
  ["another repository", { run_id: "run-1", decisions: [{ ...decisions[0], repository_id: "repo-analytics-service" }, decisions[1]] }],
  ["missing cited decision", { run_id: "run-1", decisions: [decisions[0]] }],
  ["unexpected decision", { run_id: "run-1", decisions: [...decisions, { ...decisions[1], id: "DEC-9999" }] }],
  ["duplicate decision", { run_id: "run-1", decisions: [decisions[0], decisions[0]] }],
  ["malformed provenance", { run_id: "run-1", decisions: [{ ...decisions[0], source_pr_number: 0 }, decisions[1]] }],
  ["unconfirmed authority", { run_id: "run-1", decisions: [{ ...decisions[0], authority: "proposed" }, decisions[1]] }],
])("rejects evidence detail with %s before provenance rendering", async (_label, evidencePayload) => {
  const fetchMock = installFetch({ evidencePayload });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  await screen.findByRole("heading", { name: /Update order status/ });
  fireEvent.click(await screen.findByRole("button", { name: "Run CodeDNA Review" }));
  const team = await screen.findByRole("article", { name: "Direct status write skips the service" });
  fireEvent.click(within(team).getByRole("button", { name: "View evidence" }));
  const panel = await screen.findByRole("region", { name: "Finding evidence" });
  expect(await within(panel).findByText("The evidence response failed provenance validation.")).toBeTruthy();
  expect(within(panel).queryByText("Shipping workflow")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).endsWith("/evidence"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/feedback"))).toHaveLength(0);
});

it("contains keyboard focus in feedback and restores the dismiss trigger on Escape", async () => {
  const { team } = await reviewedPage();
  const dismiss = within(team).getByRole("button", { name: "Dismiss" });
  dismiss.focus();
  fireEvent.click(dismiss);
  const dialog = screen.getByRole("dialog");
  expect(document.activeElement).toBe(dialog);
  fireEvent.keyDown(window, { key: "Tab" });
  expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Close feedback" }));
  fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
  expect(document.activeElement).toBe(within(dialog).getByRole("button", { name: "Cancel" }));
  fireEvent.keyDown(window, { key: "Escape" });
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(document.activeElement).toBe(dismiss);
});

it("states that dismiss feedback does not change the active design", async () => {
  const { fetchMock, team } = await reviewedPage();
  fireEvent.click(within(team).getByRole("button", { name: "Dismiss" }));
  const dialog = screen.getByRole("dialog");
  expect(dialog.textContent).toMatch(/does not change the active design/i);
  fireEvent.click(screen.getByLabelText("Outdated team convention"));
  fireEvent.change(screen.getByLabelText("Additional context"), { target: { value: "Audit lives elsewhere" } });
  fireEvent.click(screen.getByRole("button", { name: "Save feedback" }));
  expect(await screen.findByText(/non-binding/i, { selector: '[role="status"]' })).toBeTruthy();
  const body = feedbackBody(fetchMock);
  expect(body.action).toBe("rejected");
  expect(body.reason).toContain("Outdated team convention");
  expect(body.reason).toContain("Audit lives elsewhere");
  expect(body.actor_label).toBe("demo-reviewer");
  expect(body.confirm_as_policy).toBe(false);
});

it("posts accept as non-binding feedback", async () => {
  const { fetchMock, team } = await reviewedPage();
  fireEvent.click(within(team).getByRole("button", { name: "Accept" }));
  expect(await screen.findByText(/non-binding/i, { selector: '[role="status"]' })).toBeTruthy();
  const body = feedbackBody(fetchMock);
  expect(body.action).toBe("accepted");
  expect(body.actor_label).toBe("demo-reviewer");
  expect(body.confirm_as_policy).toBe(false);
});

it("keeps memory review disabled until Hindsight is ready and still allows a baseline", async () => {
  installFetch({ hindsight: "starting" });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  await screen.findByRole("heading", { name: /Update order status/ });
  expect(screen.getByText("Preparing memory")).toBeTruthy();
  const run = screen.getByRole("button", { name: "Run CodeDNA Review" }) as HTMLButtonElement;
  expect(run.disabled).toBe(true);
  fireEvent.click(screen.getByRole("switch", { name: "Memory enabled" }));
  expect((screen.getByRole("button", { name: "Run CodeDNA Review" }) as HTMLButtonElement).disabled).toBe(false);
});

it("shows overview counts from the summary without GitHub metrics", async () => {
  installFetch();
  renderAt("/");
  expect(within(await screen.findByRole("article", { name: "Pull requests" })).getByText(String(prs.length))).toBeTruthy();
  expect(within(screen.getByRole("article", { name: "Recorded decisions" })).getByText(String(decisions.length))).toBeTruthy();
  expect(within(screen.getByRole("article", { name: "Review runs" })).getByText("4")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Update order status" })).toBeTruthy();
  expect(screen.queryByText(/view on github/i)).toBeNull();
  expect(screen.queryByText(/\bstars\b/i)).toBeNull();
  expect(screen.queryByText(/contributors/i)).toBeNull();
  expect(screen.queryByText(/Active work is no longer running/i)).toBeNull();
  const emptyWork = await screen.findByRole("region", { name: "No active work" });
  expect(within(emptyWork).getByText(/No queued or running CodeDNA reviews or Memory Lab comparisons/i)).toBeTruthy();
  const lastChecked = within(emptyWork).getByText(/Last checked/i).querySelector("time");
  expect(Number.isFinite(Date.parse(lastChecked?.getAttribute("datetime") ?? ""))).toBe(true);
});

const validSummaryPayload = {
  repository_id: "repo-acme-commerce",
  slug: "acme-commerce",
  display_name: "Acme Commerce",
  pr_count: prs.length,
  decision_count: decisions.length,
  active_decisions: 1,
  superseded_decisions: 1,
  pending_decisions: 0,
  review_run_count: 4,
  hindsight: "ready",
};

it.each([
  ["non-object payload", []],
  ["another repository", { ...validSummaryPayload, repository_id: "repo-analytics-service" }],
  ["unsafe slug", { ...validSummaryPayload, slug: "Acme Commerce" }],
  ["blank display name", { ...validSummaryPayload, display_name: " " }],
  ["negative count", { ...validSummaryPayload, review_run_count: -1 }],
  ["fractional count", { ...validSummaryPayload, pr_count: 1.5 }],
  ["inconsistent decision subtotal", { ...validSummaryPayload, active_decisions: 2, superseded_decisions: 2 }],
  ["invalid memory state", { ...validSummaryPayload, hindsight: "connected" }],
  ["PR count mismatch", { ...validSummaryPayload, pr_count: prs.length + 1 }],
  ["decision count mismatch", { ...validSummaryPayload, decision_count: decisions.length + 1 }],
])("rejects repository summary with %s before aggregate rendering", async (_label, summaryPayload) => {
  installFetch({ summaryPayload });
  renderAt("/");
  expect(await screen.findByText("Repository summary is unavailable.")).toBeTruthy();
  expect(screen.queryByRole("region", { name: "Repository counts" })).toBeNull();
});

it("derives Team DNA counts from trusted decisions when summary validation fails", async () => {
  installFetch({ summaryPayload: { ...validSummaryPayload, decision_count: decisions.length + 1 } });
  renderAt("/repos/repo-acme-commerce/dna");
  expect(await screen.findByRole("button", { name: "Shipping workflow" })).toBeTruthy();
  expect(screen.getByText(`${decisions.length} recorded · 1 active · 1 superseded · 0 pending`)).toBeTruthy();
});

it("shows repository active work without starting or polling provider work", async () => {
  const fetchMock = installFetch({ repositoryActiveJobs: true });
  renderAt("/");
  const section = await screen.findByRole("region", { name: "Active work" });
  expect(screen.queryByRole("region", { name: "No active work" })).toBeNull();
  expect(within(section).getByRole("link", { name: "PR #87: Update order status" })).toBeTruthy();
  expect(within(section).getByText(/Memory Lab comparison · running · running memory review/i)).toBeTruthy();
  const lastChecked = within(section).getByText(/Last checked/i).querySelector("time");
  expect(lastChecked).toBeTruthy();
  expect(Number.isFinite(Date.parse(lastChecked?.getAttribute("datetime") ?? ""))).toBe(true);
  expect(within(section).getByText(/has not reported progress for at least 3 minutes/i)).toBeTruthy();
  fireEvent.click(within(section).getByText("Active job details"));
  expect(within(section).getByText("job-cmp")).toBeTruthy();
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-cmp"))).toHaveLength(0);
});

it("accepts a wrapped active-work catalog without starting provider work", async () => {
  const fetchMock = installFetch({ repositoryActiveJobPayload: { items: [repositoryActiveJob] } });
  renderAt("/");
  expect(await screen.findByRole("region", { name: "Active work" })).toBeTruthy();
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-cmp"))).toHaveLength(0);
});

it.each([
  ["non-array payload", {}],
  ["non-object row", [null]],
  ["cross-repository row", [{ ...repositoryActiveJob, repository_id: "repo-analytics-service" }]],
  ["invalid job ID", [{ ...repositoryActiveJob, job_id: "comparison-1" }]],
  ["unsafe PR ID", [{ ...repositoryActiveJob, pr_id: "pr acme 87" }]],
  ["invalid PR number", [{ ...repositoryActiveJob, pr_number: 1.5 }]],
  ["blank PR title", [{ ...repositoryActiveJob, pr_title: " " }]],
  ["invalid kind", [{ ...repositoryActiveJob, kind: "sync" }]],
  ["terminal status", [{ ...repositoryActiveJob, status: "complete" }]],
  ["blank stage", [{ ...repositoryActiveJob, stage: " " }]],
  ["unsafe stage", [{ ...repositoryActiveJob, stage: "running memory" }]],
  ["oversized stage", [{ ...repositoryActiveJob, stage: "s".repeat(81) }]],
  ["missing creation time", [{ ...repositoryActiveJob, created_at: null }]],
  ["update before creation", [{ ...repositoryActiveJob, updated_at: new Date(Date.parse(jobCreatedAt) - 1).toISOString() }]],
  ["duplicate job ID", [repositoryActiveJob, { ...repositoryActiveJob, kind: "review" }]],
  ["duplicate active claim", [repositoryActiveJob, { ...repositoryActiveJob, job_id: "job-other" }]],
  ["conflicting PR identity", [repositoryActiveJob, { ...repositoryActiveJob, job_id: "job-other", kind: "review", pr_title: "Another title" }]],
  ["duplicate PR number", [repositoryActiveJob, { ...repositoryActiveJob, job_id: "job-other", pr_id: "pr-acme-120", kind: "review" }]],
])("rejects an active-work summary with %s as a whole", async (_label, repositoryActiveJobPayload) => {
  const fetchMock = installFetch({ repositoryActiveJobPayload });
  renderAt("/");
  expect(await screen.findByText("Active work is unavailable.")).toBeTruthy();
  expect(screen.queryByRole("region", { name: "Active work" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/"))).toHaveLength(0);
});

it("discovers work started after an observed empty summary without reloading", async () => {
  const fetchMock = installFetch({ repositoryActiveJobs: true, repositoryActiveJobsStartAfter: 1 });
  renderAt("/");
  const refresh = await screen.findByRole("button", { name: "Check for active work" });
  refresh.focus();
  fireEvent.click(refresh);
  const activeHeading = await screen.findByRole("heading", { name: "Active work" });
  await waitFor(() => expect(document.activeElement).toBe(activeHeading));
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/repositories/repo-acme-commerce/review-jobs/active")).length).toBeGreaterThanOrEqual(2);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/"))).toHaveLength(0);
});

it("refreshes the overview only while active work remains", async () => {
  const fetchMock = installFetch({
    repositoryActiveJobs: true,
    repositoryActiveJobsCompleteAfter: 1,
  });
  renderAt("/");
  expect(await screen.findByRole("region", { name: "Active work" })).toBeTruthy();
  await waitFor(() => expect(screen.queryByRole("region", { name: "Active work" })).toBeNull());
  const completionMessage = "Active work is no longer running. Open the pull request to inspect its saved result or failure.";
  const completion = screen.getByText(completionMessage);
  expect(completion.getAttribute("role")).toBe("status");
  expect(screen.getAllByRole("status").filter((item) => item.textContent === completionMessage)).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/repositories/repo-acme-commerce/review-jobs/active"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-cmp"))).toHaveLength(0);
});

it("pauses active-summary polling while hidden and checks once when visible", async () => {
  let visibilityState: DocumentVisibilityState = "hidden";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibilityState);
  const fetchMock = installFetch();
  renderAt("/");
  await new Promise((resolve) => setTimeout(resolve, 30));
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/repositories/repo-acme-commerce/review-jobs/active"))).toHaveLength(0);
  visibilityState = "visible";
  document.dispatchEvent(new Event("visibilitychange"));
  await waitFor(() => expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/repositories/repo-acme-commerce/review-jobs/active"))).toHaveLength(1));
  expect(await screen.findByRole("region", { name: "No active work" })).toBeTruthy();
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("retries a transient overview-summary failure without creating work", async () => {
  const fetchMock = installFetch({ repositoryActiveJobFailures: 1 });
  renderAt("/");
  expect(await screen.findByText("Active work status was interrupted. Retrying the read-only summary…")).toBeTruthy();
  await waitFor(() => expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/repositories/repo-acme-commerce/review-jobs/active"))).toHaveLength(2));
  expect(screen.queryByText("Active work is unavailable.")).toBeNull();
  expect(screen.queryByText("Active work status was interrupted. Retrying the read-only summary…")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/"))).toHaveLength(0);
});

it("checks the read-only overview summary again after retries are exhausted", async () => {
  const fetchMock = installFetch({ repositoryActiveJobFailures: 4 });
  renderAt("/");
  const retry = await screen.findByRole("button", { name: "Check active work again" });
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/repositories/repo-acme-commerce/review-jobs/active"))).toHaveLength(4);
  retry.focus();
  fireEvent.click(retry);
  await waitFor(() => expect(screen.queryByRole("button", { name: "Check active work again" })).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Repository overview" })));
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/repositories/repo-acme-commerce/review-jobs/active"))).toHaveLength(5);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/"))).toHaveLength(0);
});

it("returns focus to the retry action when another bounded cycle fails", async () => {
  const fetchMock = installFetch({ repositoryActiveJobFailures: 8 });
  renderAt("/");
  const retry = await screen.findByRole("button", { name: "Check active work again" });
  retry.focus();
  fireEvent.click(retry);
  await waitFor(() => expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/repositories/repo-acme-commerce/review-jobs/active"))).toHaveLength(8));
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("button", { name: "Check active work again" })));
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("moves focus to restored active work after a manual summary retry", async () => {
  const fetchMock = installFetch({ repositoryActiveJobFailures: 4, repositoryActiveJobs: true });
  renderAt("/");
  const retry = await screen.findByRole("button", { name: "Check active work again" });
  retry.focus();
  fireEvent.click(retry);
  const heading = await screen.findByRole("heading", { name: "Active work" });
  await waitFor(() => expect(document.activeElement).toBe(heading));
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("lists wrapped decisions and opens the evolution lineage", async () => {
  installFetch({ decisionsWrapped: true });
  renderAt("/repos/repo-acme-commerce/dna");
  expect(await screen.findByRole("button", { name: "Shipping workflow" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /add decision/i })).toBeNull();
  expect(screen.queryByText(/add decision/i)).toBeNull();
  fireEvent.change(screen.getByLabelText("Status"), { target: { value: "superseded" } });
  expect(await screen.findByRole("button", { name: "Order transitions" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Shipping workflow" })).toBeNull();
  fireEvent.change(screen.getByLabelText("Status"), { target: { value: "all" } });
  fireEvent.change(screen.getByLabelText("Search decisions"), { target: { value: "zzzz" } });
  expect(screen.queryByRole("button", { name: "Shipping workflow" })).toBeNull();
  fireEvent.change(screen.getByLabelText("Search decisions"), { target: { value: "" } });
  fireEvent.click(await screen.findByRole("link", { name: "View evolution" }));
  expect(await screen.findByRole("heading", { name: "The reasoning stays. The convention can change." })).toBeTruthy();
  expect(screen.getAllByText("DEC-0042").length).toBeGreaterThan(0);
  expect(screen.getAllByText("DEC-0103").length).toBeGreaterThan(0);
  expect(screen.getAllByText("superseded").length).toBeGreaterThan(0);
  expect(screen.getByRole("heading", { name: "Current design" })).toBeTruthy();
  cleanup();
  renderAt("/repos/repo-acme-commerce/dna/DEC-0042");
  const current = await screen.findByRole("complementary", { name: "Current design" });
  expect(current.textContent).toContain("DEC-0103");
  expect(current.textContent).toContain("Use the service for status changes.");
  expect(current.textContent).not.toContain("decision-DEC-0042");
  expect(current.textContent).not.toContain("Superseded by");
});

it.each([
  ["non-object payload", []],
  ["another repository", { ...decisions[0], repository_id: "repo-analytics-service", title: "Untrusted detail", memory: { document_id: "decision-DEC-0103", ingestion_status: "ready" } }],
  ["another decision", { ...decisions[0], id: "DEC-9999", title: "Untrusted detail", memory: { document_id: "decision-DEC-9999", ingestion_status: "ready" } }],
  ["invalid memory status", { ...decisions[0], title: "Untrusted detail", memory: { document_id: "decision-DEC-0103", ingestion_status: "complete" } }],
  ["partial memory identity", { ...decisions[0], title: "Untrusted detail", memory: { document_id: null, ingestion_status: "ready" } }],
  ["self successor", { ...decisions[0], title: "Untrusted detail", superseded_by_decision_id: "DEC-0103", memory: { document_id: "decision-DEC-0103", ingestion_status: "ready" } }],
])("rejects decision detail with %s before replacing catalog policy", async (_label, decisionDetailPayload) => {
  const fetchMock = installFetch({ decisionDetailPayload });
  renderAt("/repos/repo-acme-commerce/dna");
  expect(await screen.findByRole("button", { name: "Shipping workflow" })).toBeTruthy();
  await waitFor(() => expect(fetchMock.mock.calls.filter((entry) => new URL(String(entry[0]), "http://localhost").pathname === "/api/decisions/DEC-0103")).toHaveLength(1));
  expect(screen.queryByText("Untrusted detail")).toBeNull();
  expect(screen.getByRole("heading", { name: "Shipping workflow" })).toBeTruthy();
});

it("rejects invalid decision detail before rendering an otherwise valid evolution", async () => {
  installFetch({ decisionDetailPayload: [] });
  renderAt("/repos/repo-acme-commerce/dna/DEC-0103");
  expect(await screen.findByText("Decision detail is unavailable.")).toBeTruthy();
  expect(screen.queryByText("Use the service for status changes.")).toBeNull();
  expect(screen.getByText("No lineage was returned for this decision.")).toBeTruthy();
});

it("rejects decision detail that contradicts its valid lineage", async () => {
  installFetch({ decisionDetailPayload: { ...decisions[0], title: "Conflicting detail", memory: { document_id: "decision-DEC-0103", ingestion_status: "ready" } } });
  renderAt("/repos/repo-acme-commerce/dna/DEC-0103");
  expect(await screen.findByText("Decision evolution failed correlation validation.")).toBeTruthy();
  expect(screen.queryByText("Conflicting detail")).toBeNull();
  expect(screen.queryByText("Use the service for status changes.")).toBeNull();
});

it.each([
  ["non-object payload", []],
  ["another requested decision", { decision_id: "DEC-9999", items: [{ ...decisions[0], effective_at: "2024-01-08T10:00:00Z" }] }],
  ["empty items", { decision_id: "DEC-0103", items: [] }],
  ["non-object item", { decision_id: "DEC-0103", items: [null] }],
  ["another repository", { decision_id: "DEC-0103", items: [{ ...decisions[0], repository_id: "repo-analytics-service", effective_at: "2024-01-08T10:00:00Z" }] }],
  ["duplicate ID", { decision_id: "DEC-0103", items: [{ ...decisions[0], effective_at: "2024-01-08T10:00:00Z" }, { ...decisions[0], effective_at: "2024-01-09T10:00:00Z" }] }],
  ["missing requested item", { decision_id: "DEC-0103", items: [{ ...decisions[1], effective_at: "2023-12-15T10:00:00Z" }] }],
  ["broken predecessor", { decision_id: "DEC-0103", items: [{ ...decisions[1], effective_at: "2023-12-15T10:00:00Z" }, { ...decisions[0], supersedes_decision_id: "DEC-9999", effective_at: "2024-01-08T10:00:00Z" }] }],
  ["descending time", { decision_id: "DEC-0103", items: [{ ...decisions[1], effective_at: "2024-01-08T10:00:00Z" }, { ...decisions[0], effective_at: "2023-12-15T10:00:00Z" }] }],
  ["multiple active policies", { decision_id: "DEC-0103", items: [{ ...decisions[1], status: "active", effective_at: "2023-12-15T10:00:00Z" }, { ...decisions[0], effective_at: "2024-01-08T10:00:00Z" }] }],
  ["nonterminal active policy", { decision_id: "DEC-0103", items: [{ ...decisions[1], status: "active", effective_at: "2023-12-15T10:00:00Z" }, { ...decisions[0], status: "revoked", effective_at: "2024-01-08T10:00:00Z" }] }],
])("rejects decision lineage with %s before evolution rendering", async (_label, lineagePayload) => {
  installFetch({ lineagePayload });
  renderAt("/repos/repo-acme-commerce/dna/DEC-0103");
  expect(await screen.findByText("Lineage is unavailable.")).toBeTruthy();
  expect(screen.queryByText("Use the service for status changes.")).toBeNull();
  expect(screen.getByText("No lineage was returned for this decision.")).toBeTruthy();
});

it.each([
  ["non-object row", [null]],
  ["another repository", [{ ...decisions[0], repository_id: "repo-analytics-service" }]],
  ["unsafe ID", [{ ...decisions[0], id: "DEC 0103" }]],
  ["blank title", [{ ...decisions[0], title: " " }]],
  ["blank rule", [{ ...decisions[0], rule_text: " " }]],
  ["blank rationale", [{ ...decisions[0], rationale: " " }]],
  ["invalid status", [{ ...decisions[0], status: "current" }]],
  ["invalid authority", [{ ...decisions[0], authority: "model_generated" }]],
  ["invalid source PR", [{ ...decisions[0], source_pr_number: 0 }]],
  ["non-object scope", [{ ...decisions[0], scope: ["src/orders"] }]],
  ["self-supersession", [{ ...decisions[0], supersedes_decision_id: "DEC-0103" }]],
  ["unresolved predecessor", [{ ...decisions[0], supersedes_decision_id: "DEC-9999" }]],
  ["duplicate ID", [decisions[0], { ...decisions[1], id: decisions[0]!.id }]],
])("rejects a decision catalog with %s before policy detail reads", async (_label, decisionCatalog) => {
  const fetchMock = installFetch({ decisionCatalog });
  renderAt("/repos/repo-acme-commerce/dna");
  expect(await screen.findByText("The decision catalog failed provenance validation.")).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Shipping workflow" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => new URL(String(entry[0]), "http://localhost").pathname.startsWith("/api/decisions/"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("shows a memory-lab trace only for recorded timings and lists guardrails", async () => {
  installFetch({
    comparison: {
      evaluation: {
        passed: false,
        checks: comparisonChecks({ baseline_has_no_memory_citations: false }),
        counts: { memory_findings: 1 },
      },
      memory: {
        run_id: "run-m",
        status: "complete",
        mode: "memory",
        elapsed_ms: 1800,
        findings: [teamFinding],
        retrieval: { timings_ms: { query: 400, generation: 900 } },
      },
      baseline: {
        run_id: "run-b",
        status: "complete",
        mode: "baseline",
        elapsed_ms: 1200,
        findings: [{ ...generalFinding, evidence_ids: ["DEC-0103"] }],
        retrieval: {},
      },
    },
  });
  renderAt("/repos/repo-acme-commerce/lab");
  await screen.findByRole("option", { name: /Update order status/ });
  await screen.findByText("Memory connected");
  const run = screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  expect(await screen.findByText("0.4s")).toBeTruthy();
  expect(screen.getAllByRole("status").filter((item) => item.textContent === "Comparison complete")).toHaveLength(1);
  expect(screen.getAllByRole("status").some((item) => item.textContent === "Review complete")).toBe(false);
  expect(screen.getByText("0.9s")).toBeTruthy();
  expect(screen.queryByText("Hindsight recall")).toBeNull();
  expect(screen.queryByText("2.3s")).toBeNull();
  expect(screen.queryByText("0.8s")).toBeNull();
  expect(screen.getByText("same model")).toBeTruthy();
  expect(screen.getByText("baseline has no memory citations")).toBeTruthy();
  const memory = screen.getByRole("region", { name: "With team memory" });
  const baseline = screen.getByRole("region", { name: "Memory disabled" });
  expect(within(memory).getByText("Design mismatch")).toBeTruthy();
  expect(within(baseline).getByText("General")).toBeTruthy();
  expect(within(memory).getByText("run-m", { selector: "code" })).toBeTruthy();
  expect(within(baseline).getByText("run-b", { selector: "code" })).toBeTruthy();
  expect(baseline.textContent?.toLowerCase()).not.toContain("historical evidence");
});

it("rejects a completed comparison whose evaluation run IDs contradict its nested runs", async () => {
  const fetchMock = installFetch({
    comparison: {
      evaluation: {
        passed: true,
        checks: comparisonChecks(),
        run_ids: { memory: "run-wrong", baseline: "run-b" },
      },
      memory: { run_id: "run-m", status: "complete", mode: "memory", findings: [teamFinding] },
      baseline: { run_id: "run-b", status: "complete", mode: "baseline", findings: [generalFinding] },
    },
  });
  renderAt("/repos/repo-acme-commerce/lab");
  await screen.findByRole("option", { name: /Update order status/ });
  const run = screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  expect((await screen.findByRole("alert")).textContent).toContain("The comparison finished with invalid correlation metadata.");
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(screen.queryByText("run-wrong")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
});

it("rejects a completed comparison whose nested runs lack valid correlation IDs", async () => {
  const fetchMock = installFetch({
    comparison: {
      evaluation: { passed: true, checks: comparisonChecks() },
      memory: { run_id: "invalid id", status: "complete", mode: "memory", findings: [teamFinding] },
      baseline: { run_id: "run-b", status: "complete", mode: "baseline", findings: [generalFinding] },
    },
  });
  renderAt("/repos/repo-acme-commerce/lab");
  await screen.findByRole("option", { name: /Update order status/ });
  const run = screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  expect((await screen.findByRole("alert")).textContent).toContain("The comparison finished with invalid correlation metadata.");
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(screen.queryByText("run-b", { selector: "code" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-cmp"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
  expect(loadActiveJob("comparison", "pr-acme-87")).toBeNull();
});

it("rejects a completed comparison whose memory and baseline roles are swapped", async () => {
  const fetchMock = installFetch({
    comparison: {
      evaluation: { passed: true, checks: comparisonChecks() },
      memory: { run_id: "run-m", status: "complete", mode: "baseline", findings: [teamFinding] },
      baseline: { run_id: "run-b", status: "complete", mode: "memory", findings: [generalFinding] },
    },
  });
  renderAt("/repos/repo-acme-commerce/lab");
  await screen.findByRole("option", { name: /Update order status/ });
  const run = screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  expect((await screen.findByRole("alert")).textContent).toContain("The comparison finished with invalid correlation metadata.");
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(screen.queryByText("run-m", { selector: "code" })).toBeNull();
  expect(screen.queryByText("run-b", { selector: "code" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-cmp"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
  expect(loadActiveJob("comparison", "pr-acme-87")).toBeNull();
});

it("rejects a completed comparison with an incomplete nested branch", async () => {
  const fetchMock = installFetch({
    comparison: {
      evaluation: { passed: true, checks: comparisonChecks() },
      memory: { run_id: "run-m", status: "running", mode: "memory", findings: [teamFinding] },
      baseline: { run_id: "run-b", status: "complete", mode: "baseline", findings: [generalFinding] },
    },
  });
  renderAt("/repos/repo-acme-commerce/lab");
  await screen.findByRole("option", { name: /Update order status/ });
  const run = screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  expect((await screen.findByRole("alert")).textContent).toContain("The comparison finished with invalid correlation metadata.");
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(screen.queryByText("run-m", { selector: "code" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-cmp"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
  expect(loadActiveJob("comparison", "pr-acme-87")).toBeNull();
});

it("rejects a completed comparison whose pass headline contradicts its guardrails", async () => {
  const fetchMock = installFetch({
    comparison: {
      evaluation: { passed: true, checks: comparisonChecks({ baseline_has_no_memory_citations: false }) },
      memory: { run_id: "run-m", status: "complete", mode: "memory", findings: [teamFinding] },
      baseline: { run_id: "run-b", status: "complete", mode: "baseline", findings: [generalFinding] },
    },
  });
  renderAt("/repos/repo-acme-commerce/lab");
  await screen.findByRole("option", { name: /Update order status/ });
  const run = screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  expect((await screen.findByRole("alert")).textContent).toContain("The comparison finished with invalid correlation metadata.");
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(screen.queryByText("run-m", { selector: "code" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-cmp"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
  expect(loadActiveJob("comparison", "pr-acme-87")).toBeNull();
});

it("rejects a completed comparison with a partial guardrail set", async () => {
  const fetchMock = installFetch({
    comparison: {
      evaluation: { passed: true, checks: partialComparisonChecks() },
      memory: { run_id: "run-m", status: "complete", mode: "memory", findings: [teamFinding] },
      baseline: { run_id: "run-b", status: "complete", mode: "baseline", findings: [generalFinding] },
    },
  });
  renderAt("/repos/repo-acme-commerce/lab");
  await screen.findByRole("option", { name: /Update order status/ });
  const run = screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  expect((await screen.findByRole("alert")).textContent).toContain("The comparison finished with invalid correlation metadata.");
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(screen.queryByText("run-m", { selector: "code" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-cmp"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
  expect(loadActiveJob("comparison", "pr-acme-87")).toBeNull();
});

it("rejects a completed comparison without an explicit overall outcome", async () => {
  const fetchMock = installFetch({
    comparison: {
      evaluation: { checks: comparisonChecks() },
      memory: { run_id: "run-m", status: "complete", mode: "memory", findings: [teamFinding] },
      baseline: { run_id: "run-b", status: "complete", mode: "baseline", findings: [generalFinding] },
    },
  });
  renderAt("/repos/repo-acme-commerce/lab");
  await screen.findByRole("option", { name: /Update order status/ });
  const run = screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  expect((await screen.findByRole("alert")).textContent).toContain("The comparison finished with invalid correlation metadata.");
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(screen.queryByText("run-m", { selector: "code" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-cmp"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
  expect(loadActiveJob("comparison", "pr-acme-87")).toBeNull();
});

it("rejects a completed comparison whose nested candidate identities differ", async () => {
  const fetchMock = installFetch({
    comparison: {
      evaluation: { passed: true, checks: comparisonChecks() },
      memory: { run_id: "run-m", status: "complete", mode: "memory", pr_id: "pr-other", findings: [teamFinding] },
      baseline: { run_id: "run-b", status: "complete", mode: "baseline", findings: [generalFinding] },
    },
  });
  renderAt("/repos/repo-acme-commerce/lab");
  await screen.findByRole("option", { name: /Update order status/ });
  const run = screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  expect((await screen.findByRole("alert")).textContent).toContain("The comparison finished with invalid correlation metadata.");
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(screen.queryByText("run-m", { selector: "code" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-cmp"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
  expect(loadActiveJob("comparison", "pr-acme-87")).toBeNull();
});

it("rejects a completed comparison without evaluation run IDs", async () => {
  const fetchMock = installFetch({
    comparison: {
      evaluation: { passed: true, checks: comparisonChecks(), run_ids: undefined },
      memory: { run_id: "run-m", status: "complete", mode: "memory", findings: [teamFinding] },
      baseline: { run_id: "run-b", status: "complete", mode: "baseline", findings: [generalFinding] },
    },
  });
  renderAt("/repos/repo-acme-commerce/lab");
  await screen.findByRole("option", { name: /Update order status/ });
  const run = screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  expect((await screen.findByRole("alert")).textContent).toContain("The comparison finished with invalid correlation metadata.");
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(screen.queryByText("run-m", { selector: "code" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-cmp"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
  expect(loadActiveJob("comparison", "pr-acme-87")).toBeNull();
});

it("rejects a completed comparison without evaluation counts", async () => {
  const fetchMock = installFetch({
    comparison: {
      evaluation: { passed: true, checks: comparisonChecks(), counts: null },
      memory: { run_id: "run-m", status: "complete", mode: "memory", findings: [teamFinding] },
      baseline: { run_id: "run-b", status: "complete", mode: "baseline", findings: [generalFinding] },
    },
  });
  renderAt("/repos/repo-acme-commerce/lab");
  await screen.findByRole("option", { name: /Update order status/ });
  const run = screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  expect((await screen.findByRole("alert")).textContent).toContain("The comparison finished with invalid correlation metadata.");
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(screen.queryByText("run-m", { selector: "code" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-cmp"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
  expect(loadActiveJob("comparison", "pr-acme-87")).toBeNull();
});

it("rejects a completed comparison whose retrieved-source guardrail contradicts its evidence", async () => {
  const fetchMock = installFetch({
    comparison: {
      evaluation: { passed: true, checks: comparisonChecks() },
      memory: { run_id: "run-m", status: "complete", mode: "memory", findings: [teamFinding], retrieval: { validated_evidence: [] } },
      baseline: { run_id: "run-b", status: "complete", mode: "baseline", findings: [generalFinding] },
    },
  });
  renderAt("/repos/repo-acme-commerce/lab");
  await screen.findByRole("option", { name: /Update order status/ });
  const run = screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  expect((await screen.findByRole("alert")).textContent).toContain("The comparison finished with invalid correlation metadata.");
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-cmp"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
  expect(loadActiveJob("comparison", "pr-acme-87")).toBeNull();
});

it("rejects a completed comparison for a different candidate PR", async () => {
  const fetchMock = installFetch({
    comparison: {
      evaluation: { passed: true, checks: comparisonChecks() },
      memory: { run_id: "run-m", status: "complete", mode: "memory", pr_id: "pr-acme-120", findings: [teamFinding] },
      baseline: { run_id: "run-b", status: "complete", mode: "baseline", pr_id: "pr-acme-120", findings: [generalFinding] },
    },
  });
  renderAt("/repos/repo-acme-commerce/lab");
  await screen.findByRole("option", { name: /Update order status/ });
  const run = screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  expect((await screen.findByRole("alert")).textContent).toContain("The comparison finished with invalid correlation metadata.");
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-cmp"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
  expect(loadActiveJob("comparison", "pr-acme-87")).toBeNull();
});

it("keeps a structurally missing completed comparison distinct from invalid correlation", async () => {
  const fetchMock = installFetch();
  renderAt("/repos/repo-acme-commerce/lab");
  await screen.findByRole("option", { name: /Update order status/ });
  const run = screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  expect((await screen.findByRole("alert")).textContent).toContain("The comparison finished without a result.");
  expect(screen.queryByText("invalid correlation metadata")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-cmp"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
  expect(loadActiveJob("comparison", "pr-acme-87")).toBeNull();
});

it("makes both recorded held-out evaluation fixtures inspectable in Memory Lab", async () => {
  installFetch();
  renderAt("/repos/repo-acme-commerce/lab");
  const fixtures = await screen.findByRole("region", { name: "Verified evaluation fixtures" });
  expect(within(fixtures).getByText("2 cases")).toBeTruthy();
  expect(within(fixtures).getByText("Source PR #103 → held-out PR #120")).toBeTruthy();
  expect(within(fixtures).getByText("DEC-0103 · active")).toBeTruthy();
  expect(within(fixtures).getByText("Source PR #11 → held-out PR #29")).toBeTruthy();
  expect(within(fixtures).getByText("DEC-0211 · active")).toBeTruthy();
  expect(within(fixtures).getAllByText("Passed")).toHaveLength(2);
  expect(within(fixtures).getAllByText("Passed").every((item) => item.tagName === "STRONG")).toBe(true);
  expect(within(fixtures).getAllByText(/6\/6 guardrails passed in latest stored run/)).toHaveLength(2);
  expect(within(fixtures).getByText("job-acme-proof").tagName).toBe("CODE");
  expect(within(fixtures).getByText("job-analytics-proof").tagName).toBe("CODE");
  expect(fixtures.querySelector('time[datetime="2026-10-27T12:00:00.000Z"]')).toBeTruthy();
  expect(fixtures.querySelector('time[datetime="2026-10-27T13:00:00.000Z"]')).toBeTruthy();
  const lastChecked = within(fixtures).getByText(/Last checked/i).querySelector("time");
  expect(Number.isFinite(Date.parse(lastChecked?.getAttribute("datetime") ?? ""))).toBe(true);
  const links = [
    within(fixtures).getByRole("link", { name: "Open case: Acme Commerce held-out PR #120" }),
    within(fixtures).getByRole("link", { name: "Open case: Analytics Service held-out PR #29" }),
  ] as HTMLAnchorElement[];
  expect(links.map((link) => link.getAttribute("href"))).toEqual([
    "/repos/repo-acme-commerce/lab?case=pr-acme-120",
    "/repos/repo-analytics-service/lab?case=pr-analytics-29",
  ]);
});

it.each([
  ["non-array payload", {}],
  ["non-object row", [null]],
  ["unsafe repository ID", [{ ...evaluationCases[0], repository_id: "repo acme" }]],
  ["blank repository name", [{ ...evaluationCases[0], repository_name: " " }]],
  ["unsafe source PR", [{ ...evaluationCases[0], source_pr_id: "pr acme 103" }]],
  ["invalid source number", [{ ...evaluationCases[0], source_pr_number: -1 }]],
  ["same source and candidate", [{ ...evaluationCases[0], source_pr_id: "pr-acme-120", source_pr_number: 120 }]],
  ["unsafe decision ID", [{ ...evaluationCases[0], decision_id: "DEC 0103" }]],
  ["non-active decision", [{ ...evaluationCases[0], decision_status: "superseded" }]],
  ["non-object stored result", [{ ...evaluationCases[0], latest_evaluation: "recorded" }]],
  ["non-Boolean outcome", [{ ...evaluationCases[0], latest_evaluation: { ...evaluationCases[0]!.latest_evaluation, passed: "yes" } }]],
  ["fractional guardrail count", [{ ...evaluationCases[0], latest_evaluation: { ...evaluationCases[0]!.latest_evaluation, passed_checks: 5.5 } }]],
  ["incomplete guardrail total", [{ ...evaluationCases[0], latest_evaluation: { ...evaluationCases[0]!.latest_evaluation, total_checks: 5 } }]],
  ["contradictory outcome", [{ ...evaluationCases[0], latest_evaluation: { ...evaluationCases[0]!.latest_evaluation, passed: false } }]],
  ["invalid result timestamp", [{ ...evaluationCases[0], latest_evaluation: { ...evaluationCases[0]!.latest_evaluation, updated_at: "not-a-date" } }]],
  ["duplicate candidate ID", [evaluationCases[0], { ...evaluationCases[1], candidate_pr_id: evaluationCases[0]!.candidate_pr_id }]],
  ["duplicate repository candidate number", [evaluationCases[0], { ...evaluationCases[1], repository_id: evaluationCases[0]!.repository_id, candidate_pr_number: evaluationCases[0]!.candidate_pr_number }]],
  ["duplicate stored job", [evaluationCases[0], { ...evaluationCases[1], latest_evaluation: { ...evaluationCases[1]!.latest_evaluation, job_id: evaluationCases[0]!.latest_evaluation.job_id } }]],
])("rejects an evaluation fixture catalog with %s as a whole", async (_label, evaluationCasePayload) => {
  const fetchMock = installFetch({ evaluationCasePayload });
  renderAt("/repos/repo-acme-commerce/lab");
  expect(await screen.findByText("Fixture catalog unavailable: The evaluation fixture catalog failed identity validation.")).toBeTruthy();
  expect(screen.queryByRole("link", { name: /Open case:/ })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("opens a recorded fixture on its held-out candidate without starting work", async () => {
  const fetchMock = installFetch();
  renderAt("/repos/repo-acme-commerce/lab?case=pr-acme-120");
  const selector = await screen.findByRole("combobox", { name: "Pull request" }) as HTMLSelectElement;
  await waitFor(() => expect(selector.value).toBe("pr-acme-120"));
  const selectedCase = screen.getByRole("link", { name: "Case selected: Acme Commerce held-out PR #120" });
  expect(selectedCase.getAttribute("href")).toBe("/repos/repo-acme-commerce/lab?case=pr-acme-120");
  expect(selectedCase.getAttribute("aria-current")).toBe("page");
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("refreshes a healthy fixture catalog through GET only", async () => {
  const fetchMock = installFetch({ evaluationCaseUpdateAfter: 2, evaluationCaseDelayMs: 50 });
  renderAt("/repos/repo-acme-commerce/lab");
  const fixtures = screen.getByRole("region", { name: "Verified evaluation fixtures" });
  expect(fixtures.getAttribute("aria-busy")).toBe("true");
  expect(await within(fixtures).findAllByText(/6\/6 guardrails passed in latest stored run/)).toHaveLength(2);
  expect(fixtures.getAttribute("aria-busy")).toBe("false");
  const checkedBefore = within(fixtures).getByText(/Last checked/i).querySelector("time")?.getAttribute("datetime");
  fireEvent.click(within(fixtures).getByRole("button", { name: "Refresh fixture catalog" }));
  expect(fixtures.getAttribute("aria-busy")).toBe("true");
  expect(within(fixtures).getByText("Source PR #103 → held-out PR #120")).toBeTruthy();
  expect(within(fixtures).getByText(/Last checked/i).querySelector("time")?.getAttribute("datetime")).toBe(checkedBefore);
  expect(within(fixtures).getByText("Refreshing fixture catalog…")).toBeTruthy();
  expect(await within(fixtures).findByText(/5\/6 guardrails passed in latest stored run/)).toBeTruthy();
  expect(within(fixtures).getByText("Needs attention").tagName).toBe("STRONG");
  expect(within(fixtures).getByText("job-acme-new-proof").tagName).toBe("CODE");
  expect(fixtures.querySelector('time[datetime="2026-11-05T00:00:00.000Z"]')).toBeTruthy();
  expect(fixtures.getAttribute("aria-busy")).toBe("false");
  await waitFor(() => expect(document.activeElement).toBe(within(fixtures).getByRole("heading", { name: "Verified evaluation fixtures" })));
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/evaluation-cases"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("preserves the last fixture catalog when refresh recovery is exhausted", async () => {
  const fetchMock = installFetch({ evaluationCaseFailures: 4, evaluationCaseFailuresAfter: 1 });
  renderAt("/repos/repo-acme-commerce/lab");
  const fixtures = await screen.findByRole("region", { name: "Verified evaluation fixtures" });
  expect(await within(fixtures).findByText("Source PR #103 → held-out PR #120")).toBeTruthy();
  const checkedBefore = within(fixtures).getByText(/Last checked/i).querySelector("time")?.getAttribute("datetime");
  fireEvent.click(within(fixtures).getByRole("button", { name: "Refresh fixture catalog" }));
  expect(await within(fixtures).findByRole("button", { name: "Retry fixture catalog" })).toBeTruthy();
  expect(within(fixtures).getByText("Source PR #103 → held-out PR #120")).toBeTruthy();
  expect(within(fixtures).getByText(/Last checked/i).querySelector("time")?.getAttribute("datetime")).toBe(checkedBefore);
  const stale = within(fixtures).getByText(/Showing last-known-good fixture data/);
  expect(stale.textContent).toMatch(/failed refresh did not replace these rows/i);
  expect(stale.querySelector("time")?.getAttribute("datetime")).toBe(checkedBefore);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/evaluation-cases"))).toHaveLength(5);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("refreshes the fixture catalog after its comparison completes", async () => {
  const comparison = {
    evaluation: { passed: true, checks: comparisonChecks(), counts: { memory_findings: 1 } },
    memory: { run_id: "run-case-memory", status: "complete", mode: "memory", pr_id: "pr-acme-120", findings: [teamFinding], retrieval: {} },
    baseline: { run_id: "run-case-baseline", status: "complete", mode: "baseline", pr_id: "pr-acme-120", findings: [generalFinding], retrieval: {} },
  };
  const fetchMock = installFetch({ comparison, evaluationCaseUpdateAfter: 2 });
  renderAt("/repos/repo-acme-commerce/lab?case=pr-acme-120");
  const run = await screen.findByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await vi.waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  expect(await screen.findByText("Guardrails passed")).toBeTruthy();
  expect(await screen.findByText(/5\/6 guardrails passed in latest stored run/)).toBeTruthy();
  expect(screen.getByText(/Fixture catalog updated for Acme Commerce: Needs attention — 5 of 6 guardrails passed/).getAttribute("role")).toBe("status");
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/evaluation-cases"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
  expect(fetchMock.mock.calls.some((entry) => String(entry[0]).includes("/api/prs/pr-acme-120/comparison"))).toBe(true);
});

it("does not announce an unchanged fixture result after comparison completion", async () => {
  const comparison = {
    evaluation: { passed: true, checks: comparisonChecks(), counts: { memory_findings: 1 } },
    memory: { run_id: "run-case-memory", status: "complete", mode: "memory", pr_id: "pr-acme-120", findings: [teamFinding], retrieval: {} },
    baseline: { run_id: "run-case-baseline", status: "complete", mode: "baseline", pr_id: "pr-acme-120", findings: [generalFinding], retrieval: {} },
  };
  const fetchMock = installFetch({ comparison });
  renderAt("/repos/repo-acme-commerce/lab?case=pr-acme-120");
  const run = await screen.findByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await vi.waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  expect(await screen.findByText("Guardrails passed")).toBeTruthy();
  await waitFor(() => expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/evaluation-cases"))).toHaveLength(2));
  expect(screen.getByText("Comparison complete").getAttribute("role")).toBe("status");
});

it("recovers a transient fixture-catalog outage without starting work", async () => {
  const fetchMock = installFetch({ evaluationCaseFailures: 1 });
  renderAt("/repos/repo-acme-commerce/lab");
  const fixtures = await screen.findByRole("region", { name: "Verified evaluation fixtures" });
  expect(await within(fixtures).findByText("2 cases")).toBeTruthy();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/evaluation-cases"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("retries an exhausted fixture catalog through GET only", async () => {
  const fetchMock = installFetch({ evaluationCaseFailures: 4 });
  renderAt("/repos/repo-acme-commerce/lab");
  const retry = await screen.findByRole("button", { name: "Retry fixture catalog" });
  expect(screen.getByRole("alert").textContent).toMatch(/Fixture catalog unavailable/i);
  expect(screen.queryByText(/Showing last-known-good fixture data/)).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/evaluation-cases"))).toHaveLength(4);
  fireEvent.click(retry);
  const fixtures = screen.getByRole("region", { name: "Verified evaluation fixtures" });
  expect(await within(fixtures).findByText("2 cases")).toBeTruthy();
  await waitFor(() => expect(document.activeElement).toBe(within(fixtures).getByRole("heading", { name: "Verified evaluation fixtures" })));
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/evaluation-cases"))).toHaveLength(5);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("returns focus to fixture-catalog retry after another bounded failure", async () => {
  const fetchMock = installFetch({ evaluationCaseFailures: 8 });
  renderAt("/repos/repo-acme-commerce/lab");
  fireEvent.click(await screen.findByRole("button", { name: "Retry fixture catalog" }));
  const retry = await screen.findByRole("button", { name: "Retry fixture catalog" });
  await waitFor(() => expect(document.activeElement).toBe(retry));
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/evaluation-cases"))).toHaveLength(8);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("restores the latest completed comparison without starting a new job", async () => {
  const restored = {
    evaluation: {
      passed: true,
      checks: comparisonChecks(),
      counts: { memory_findings: 1 },
    },
    memory: {
      run_id: "run-restored-memory",
      status: "complete",
      mode: "memory",
      findings: [teamFinding],
      retrieval: { timings_ms: { recall: 250 } },
    },
    baseline: {
      run_id: "run-restored-baseline",
      status: "complete",
      mode: "baseline",
      findings: [generalFinding],
      retrieval: {},
    },
  };
  const fetchMock = installFetch({ latestComparison: restored });
  renderAt("/repos/repo-acme-commerce/lab");
  expect(await screen.findByText("Guardrails passed")).toBeTruthy();
  expect(screen.getByText("Latest comparison restored")).toBeTruthy();
  expect(screen.getByText("0.3s")).toBeTruthy();
  const posts = fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST");
  expect(posts).toHaveLength(0);
});

it("surfaces an invalid stored comparison instead of treating it as missing", async () => {
  const invalid = {
    evaluation: {
      passed: true,
      checks: comparisonChecks(),
    },
    memory: { run_id: "run-stored-memory", status: "running", mode: "memory", findings: [teamFinding], retrieval: {} },
    baseline: { run_id: "run-stored-baseline", status: "complete", mode: "baseline", findings: [generalFinding], retrieval: {} },
  };
  const fetchMock = installFetch({ latestComparison: invalid });
  renderAt("/repos/repo-acme-commerce/lab");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "Comparison recovery unavailable: The stored comparison failed correlation validation.",
  );
  expect(screen.getByRole("button", { name: "Retry saved comparison recovery" })).toBeTruthy();
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/comparisons/latest"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("rejects a stored comparison whose pass headline contradicts its guardrails", async () => {
  const invalid = {
    evaluation: { passed: false, checks: comparisonChecks() },
    memory: { run_id: "run-stored-memory", status: "complete", mode: "memory", findings: [teamFinding], retrieval: {} },
    baseline: { run_id: "run-stored-baseline", status: "complete", mode: "baseline", findings: [generalFinding], retrieval: {} },
  };
  const fetchMock = installFetch({ latestComparison: invalid });
  renderAt("/repos/repo-acme-commerce/lab");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Comparison recovery unavailable: The stored comparison failed correlation validation.");
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/comparisons/latest"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("rejects a stored comparison with a partial guardrail set", async () => {
  const invalid = {
    evaluation: { passed: true, checks: partialComparisonChecks() },
    memory: { run_id: "run-stored-memory", status: "complete", mode: "memory", findings: [teamFinding], retrieval: {} },
    baseline: { run_id: "run-stored-baseline", status: "complete", mode: "baseline", findings: [generalFinding], retrieval: {} },
  };
  const fetchMock = installFetch({ latestComparison: invalid });
  renderAt("/repos/repo-acme-commerce/lab");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Comparison recovery unavailable: The stored comparison failed correlation validation.");
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/comparisons/latest"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("rejects a stored comparison without an explicit overall outcome", async () => {
  const invalid = {
    evaluation: { checks: comparisonChecks() },
    memory: { run_id: "run-stored-memory", status: "complete", mode: "memory", findings: [teamFinding], retrieval: {} },
    baseline: { run_id: "run-stored-baseline", status: "complete", mode: "baseline", findings: [generalFinding], retrieval: {} },
  };
  const fetchMock = installFetch({ latestComparison: invalid });
  renderAt("/repos/repo-acme-commerce/lab");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Comparison recovery unavailable: The stored comparison failed correlation validation.");
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/comparisons/latest"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("rejects a stored comparison whose nested provider identities differ", async () => {
  const invalid = {
    evaluation: { passed: true, checks: comparisonChecks() },
    memory: { run_id: "run-stored-memory", status: "complete", mode: "memory", findings: [teamFinding], retrieval: {} },
    baseline: { run_id: "run-stored-baseline", status: "complete", mode: "baseline", provider: "other-provider", findings: [generalFinding], retrieval: {} },
  };
  const fetchMock = installFetch({ latestComparison: invalid });
  renderAt("/repos/repo-acme-commerce/lab");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Comparison recovery unavailable: The stored comparison failed correlation validation.");
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/comparisons/latest"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("rejects a stored comparison with a missing evaluation run ID", async () => {
  const invalid = {
    evaluation: { passed: true, checks: comparisonChecks(), run_ids: { memory: "run-stored-memory" } },
    memory: { run_id: "run-stored-memory", status: "complete", mode: "memory", findings: [teamFinding], retrieval: {} },
    baseline: { run_id: "run-stored-baseline", status: "complete", mode: "baseline", findings: [generalFinding], retrieval: {} },
  };
  const fetchMock = installFetch({ latestComparison: invalid });
  renderAt("/repos/repo-acme-commerce/lab");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Comparison recovery unavailable: The stored comparison failed correlation validation.");
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/comparisons/latest"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("rejects a stored comparison with an invalid evaluation count", async () => {
  const invalid = {
    evaluation: { passed: true, checks: comparisonChecks(), counts: { baseline_citations: -1 } },
    memory: { run_id: "run-stored-memory", status: "complete", mode: "memory", findings: [teamFinding], retrieval: {} },
    baseline: { run_id: "run-stored-baseline", status: "complete", mode: "baseline", findings: [generalFinding], retrieval: {} },
  };
  const fetchMock = installFetch({ latestComparison: invalid });
  renderAt("/repos/repo-acme-commerce/lab");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Comparison recovery unavailable: The stored comparison failed correlation validation.");
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/comparisons/latest"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("rejects a stored comparison whose baseline citation guardrail contradicts its findings", async () => {
  const invalid = {
    evaluation: { passed: true, checks: comparisonChecks() },
    memory: { run_id: "run-stored-memory", status: "complete", mode: "memory", findings: [teamFinding] },
    baseline: {
      run_id: "run-stored-baseline",
      status: "complete",
      mode: "baseline",
      findings: [{ ...generalFinding, evidence_ids: ["DEC-0103"] }],
    },
  };
  const fetchMock = installFetch({ latestComparison: invalid });
  renderAt("/repos/repo-acme-commerce/lab");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Comparison recovery unavailable: The stored comparison failed correlation validation.");
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/comparisons/latest"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("rejects a stored comparison for a different candidate PR", async () => {
  const invalid = {
    evaluation: { passed: true, checks: comparisonChecks() },
    memory: { run_id: "run-stored-memory", status: "complete", mode: "memory", pr_id: "pr-acme-120", findings: [teamFinding] },
    baseline: { run_id: "run-stored-baseline", status: "complete", mode: "baseline", pr_id: "pr-acme-120", findings: [generalFinding] },
  };
  const fetchMock = installFetch({ latestComparison: invalid });
  renderAt("/repos/repo-acme-commerce/lab");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Comparison recovery unavailable: The stored comparison failed correlation validation.");
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/comparisons/latest"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("reattaches to an active comparison after refresh without starting another job", async () => {
  const resumed = {
    evaluation: {
      passed: true,
      checks: comparisonChecks(),
      counts: { memory_findings: 1 },
    },
    memory: {
      run_id: "run-resumed-memory",
      status: "complete",
      mode: "memory",
      findings: [teamFinding],
      retrieval: { timings_ms: { recall: 250 } },
    },
    baseline: {
      run_id: "run-resumed-baseline",
      status: "complete",
      mode: "baseline",
      findings: [generalFinding],
      retrieval: {},
    },
  };
  saveActiveJob("comparison", "pr-acme-87", "job-cmp");
  const fetchMock = installFetch({ comparison: resumed, comparisonPollFailures: 1, pollDelayMs: 50 });
  renderAt("/repos/repo-acme-commerce/lab");
  expect((await screen.findAllByText("Connection interrupted. Reconnecting to the existing comparison…")).length).toBeGreaterThan(0);
  expect(await screen.findByText("Guardrails passed", {}, { timeout: 3000 })).toBeTruthy();
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-cmp"))).toHaveLength(2);
  expect(loadActiveJob("comparison", "pr-acme-87")).toBeNull();
});

it("rejects a cross-kind comparison status envelope before accepting its result", async () => {
  saveActiveJob("comparison", "pr-acme-87", "job-cmp");
  const fetchMock = installFetch({
    comparisonJobPayload: completeComparisonJobEnvelope({ kind: "review", comparison: withComparisonIdentity({
      evaluation: { passed: true, checks: comparisonChecks() },
      memory: { run_id: "run-wrong-memory", status: "complete", mode: "memory", findings: [teamFinding] },
      baseline: { run_id: "run-wrong-baseline", status: "complete", mode: "baseline", findings: [generalFinding] },
    }) }),
  });
  renderAt("/repos/repo-acme-commerce/lab");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("The job status response failed correlation validation.");
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(loadActiveJob("comparison", "pr-acme-87")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-cmp"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/comparisons/latest"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("rejects a comparison update-time regression without accepting later-stage output", async () => {
  saveActiveJob("comparison", "pr-acme-87", "job-cmp");
  const fetchMock = installFetch({
    comparisonJobPayloads: [
      completeComparisonJobEnvelope({ status: "running", stage: "recalling_and_reviewing", updated_at: jobLaterUpdatedAt }),
      completeComparisonJobEnvelope({ status: "running", stage: "reviewing_baseline", updated_at: jobUpdatedAt }),
    ],
  });
  renderAt("/repos/repo-acme-commerce/lab");
  const alert = await screen.findByRole("alert", {}, { timeout: 3000 });
  expect(alert.textContent).toContain("The job status response failed progression validation.");
  expect(loadActiveJob("comparison", "pr-acme-87")).toBeNull();
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-cmp"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/comparisons/latest"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("rejects a first comparison status that predates its creation response", async () => {
  const fetchMock = installFetch({
    comparisonCreationPayload: {
      pr_id: "pr-acme-87",
      job_id: "job-cmp",
      kind: "comparison",
      status: "queued",
      stage: "queued",
      reused: false,
      created_at: jobCreatedAt,
      updated_at: jobLatestUpdatedAt,
    },
    comparisonJobPayload: completeComparisonJobEnvelope({ updated_at: jobLaterUpdatedAt }),
  });
  renderAt("/repos/repo-acme-commerce/lab");
  await screen.findByRole("option", { name: /Update order status/ });
  const run = screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("The job status response predates its accepted locator.");
  expect(loadActiveJob("comparison", "pr-acme-87")).toBeNull();
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-cmp"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/comparisons/latest"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
});

it("discovers an active comparison after tab storage is lost without starting another job", async () => {
  const resumed = {
    evaluation: { passed: true, checks: comparisonChecks(), counts: { memory_findings: 1 } },
    memory: { run_id: "run-discovered-memory", status: "complete", mode: "memory", findings: [teamFinding], retrieval: {} },
    baseline: { run_id: "run-discovered-baseline", status: "complete", mode: "baseline", findings: [generalFinding], retrieval: {} },
  };
  const fetchMock = installFetch({ comparison: resumed, activeComparisonJob: true });
  renderAt("/repos/repo-acme-commerce/lab");
  expect(await screen.findByText("Guardrails passed")).toBeTruthy();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/review-jobs/active?kind=comparison"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-cmp"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/comparisons/latest"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  expect(loadActiveJob("comparison", "pr-acme-87")).toBeNull();
});

it("rejects cross-kind active comparison discovery before persisting or polling its locator", async () => {
  const fetchMock = installFetch({ activeJobPayload: activeReviewJobResponse });
  renderAt("/repos/repo-acme-commerce/lab");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("The active job response failed correlation validation.");
  expect(loadActiveJob("comparison", "pr-acme-87")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/comparisons/latest"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("announces when starting a comparison reuses existing provider work", async () => {
  let releaseComparisonPoll = () => {};
  const comparisonPollGate = new Promise<void>((resolve) => {
    releaseComparisonPoll = resolve;
  });
  const comparison = {
    evaluation: { passed: true, checks: comparisonChecks(), counts: { memory_findings: 1 } },
    memory: { run_id: "run-reused-memory", status: "complete", mode: "memory", findings: [teamFinding], retrieval: {} },
    baseline: { run_id: "run-reused-baseline", status: "complete", mode: "baseline", findings: [generalFinding], retrieval: {} },
  };
  const fetchMock = installFetch({ comparison, reusedComparisonStart: true, comparisonPollGate });
  renderAt("/repos/repo-acme-commerce/lab");
  await screen.findByRole("option", { name: /Update order status/ });
  const run = screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await vi.waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  try {
    expect((await screen.findAllByText("Existing comparison found. Reattached without starting either provider branch.")).length).toBeGreaterThan(0);
  } finally {
    await act(async () => releaseComparisonPoll());
  }
  expect(await screen.findByText("Guardrails passed")).toBeTruthy();
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
});

it("rejects a cross-kind comparison-creation response and reattaches through the correlated claim", async () => {
  let releaseComparisonPoll = () => {};
  const comparisonPollGate = new Promise<void>((resolve) => {
    releaseComparisonPoll = resolve;
  });
  const comparison = {
    evaluation: { passed: true, checks: comparisonChecks(), counts: { memory_findings: 1 } },
    memory: { run_id: "run-correlated-memory", status: "complete", mode: "memory", findings: [teamFinding], retrieval: {} },
    baseline: { run_id: "run-correlated-baseline", status: "complete", mode: "baseline", findings: [generalFinding], retrieval: {} },
  };
  const fetchMock = installFetch({
    comparison,
    comparisonPollGate,
    comparisonCreationPayload: {
      pr_id: "pr-acme-87",
      job_id: "job-wrong",
      kind: "review",
      status: "queued",
      stage: "queued",
      reused: false,
      created_at: "2026-10-26T10:00:00Z",
      updated_at: "2026-10-26T10:00:00Z",
    },
  });
  renderAt("/repos/repo-acme-commerce/lab");
  await screen.findByRole("option", { name: /Update order status/ });
  const run = screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  try {
    expect((await screen.findAllByText("Existing comparison found. Reattached without starting either provider branch.")).length).toBeGreaterThan(0);
  } finally {
    await act(async () => releaseComparisonPoll());
  }
  expect(await screen.findByText("Guardrails passed")).toBeTruthy();
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-wrong"))).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-cmp"))).toHaveLength(1);
});

it("reconciles a lost comparison creation through an explicit GET-only check", async () => {
  const fetchMock = installFetch({ comparisonCreationHangs: true, comparisonCreationClaimVisible: false });
  renderAt("/repos/repo-acme-commerce/lab");
  await screen.findByRole("option", { name: /Update order status/ });
  const run = screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("The comparison creation response was lost and no active job is visible yet.");
  expect(run.disabled).toBe(true);
  const check = screen.getByRole("button", { name: "Check creation status" });
  check.focus();
  fireEvent.click(check);
  expect(await screen.findByText(/Creation status checked\. No active or completed comparison was found/)).toBeTruthy();
  await waitFor(() => expect(run.disabled).toBe(false));
  expect(document.activeElement).toBe(screen.getByRole("region", { name: "Comparison workspace" }));
  expect(screen.queryByRole("button", { name: "Check creation status" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/review-jobs/active?kind=comparison"))).toHaveLength(5);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/comparisons/latest"))).toHaveLength(2);
});

it("reattaches when a comparison claim appears during the manual creation-status check", async () => {
  let releaseComparisonPoll = () => {};
  const comparisonPollGate = new Promise<void>((resolve) => {
    releaseComparisonPoll = resolve;
  });
  const comparison = {
    evaluation: { passed: true, checks: comparisonChecks(), counts: { memory_findings: 1 } },
    memory: { run_id: "run-late-memory", status: "complete", mode: "memory", findings: [teamFinding], retrieval: {} },
    baseline: { run_id: "run-late-baseline", status: "complete", mode: "baseline", findings: [generalFinding], retrieval: {} },
  };
  const fetchMock = installFetch({
    comparison,
    comparisonCreationHangs: true,
    comparisonCreationClaimVisible: false,
    comparisonCreationClaimVisibleAfterActiveRead: 5,
    comparisonPollGate,
  });
  renderAt("/repos/repo-acme-commerce/lab");
  await screen.findByRole("option", { name: /Update order status/ });
  const run = screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  fireEvent.click(await screen.findByRole("button", { name: "Check creation status" }));
  try {
    expect((await screen.findAllByText("Existing comparison found. Reattached without starting either provider branch.")).length).toBeGreaterThan(0);
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("region", { name: "Comparison workspace" })));
  } finally {
    await act(async () => releaseComparisonPoll());
  }
  expect(await screen.findByText("Guardrails passed")).toBeTruthy();
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/review-jobs/active?kind=comparison"))).toHaveLength(5);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/comparisons/latest"))).toHaveLength(1);
});

it("keeps comparison creation disabled when the manual creation-status read fails", async () => {
  const fetchMock = installFetch({
    comparisonCreationHangs: true,
    comparisonCreationClaimVisible: false,
    comparisonRecoveryFailureAtActiveRead: 5,
  });
  renderAt("/repos/repo-acme-commerce/lab");
  await screen.findByRole("option", { name: /Update order status/ });
  const run = screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  fireEvent.click(await screen.findByRole("button", { name: "Check creation status" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Comparison creation status is still unavailable: manual creation status unavailable");
  const retry = screen.getByRole("button", { name: "Check creation status" });
  await waitFor(() => expect(document.activeElement).toBe(retry));
  expect(run.disabled).toBe(true);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/review-jobs/active?kind=comparison"))).toHaveLength(5);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/comparisons/latest"))).toHaveLength(1);
});

it("restores a completed comparison found during manual creation-status reconciliation", async () => {
  const completed = {
    evaluation: { passed: true, checks: comparisonChecks(), counts: { memory_findings: 1 } },
    memory: { run_id: "run-restored-memory", status: "complete", mode: "memory", findings: [teamFinding], retrieval: {} },
    baseline: { run_id: "run-restored-baseline", status: "complete", mode: "baseline", findings: [generalFinding], retrieval: {} },
  };
  const fetchMock = installFetch({
    comparisonCreationHangs: true,
    comparisonCreationClaimVisible: false,
    latestComparison: completed,
    latestComparisonAfterRead: 2,
  });
  renderAt("/repos/repo-acme-commerce/lab");
  await screen.findByRole("option", { name: /Update order status/ });
  const run = screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  fireEvent.click(await screen.findByRole("button", { name: "Check creation status" }));
  expect(await screen.findByText("Guardrails passed")).toBeTruthy();
  await waitFor(() => expect(document.activeElement).toBe(screen.getByRole("heading", { name: "Guardrails" })));
  expect(screen.queryByRole("button", { name: "Check creation status" })).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/review-jobs/active?kind=comparison"))).toHaveLength(5);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/comparisons/latest"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-cmp"))).toHaveLength(0);
});

it("keeps creation uncertain when manual reconciliation finds an invalid stored comparison", async () => {
  const invalid = {
    evaluation: {
      passed: true,
      checks: comparisonChecks(),
    },
    memory: { run_id: "run-stored-memory", status: "complete", mode: "memory", findings: [teamFinding], retrieval: {} },
    baseline: { run_id: "run-stored-baseline", status: "failed", mode: "baseline", findings: [generalFinding], retrieval: {} },
  };
  const fetchMock = installFetch({
    comparisonCreationHangs: true,
    comparisonCreationClaimVisible: false,
    latestComparison: invalid,
    latestComparisonAfterRead: 2,
  });
  renderAt("/repos/repo-acme-commerce/lab");
  await screen.findByRole("option", { name: /Update order status/ });
  const run = screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  fireEvent.click(await screen.findByRole("button", { name: "Check creation status" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain(
    "Comparison creation status is still unavailable: The stored comparison failed correlation validation.",
  );
  const retry = screen.getByRole("button", { name: "Check creation status" });
  await waitFor(() => expect(document.activeElement).toBe(retry));
  expect(run.disabled).toBe(true);
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/comparisons/latest"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
});

it("keeps creation uncertain when manual reconciliation finds contradictory guardrails", async () => {
  const invalid = {
    evaluation: { passed: true, checks: comparisonChecks({ same_candidate: false }) },
    memory: { run_id: "run-stored-memory", status: "complete", mode: "memory", findings: [teamFinding], retrieval: {} },
    baseline: { run_id: "run-stored-baseline", status: "complete", mode: "baseline", findings: [generalFinding], retrieval: {} },
  };
  const fetchMock = installFetch({
    comparisonCreationHangs: true,
    comparisonCreationClaimVisible: false,
    latestComparison: invalid,
    latestComparisonAfterRead: 2,
  });
  renderAt("/repos/repo-acme-commerce/lab");
  await screen.findByRole("option", { name: /Update order status/ });
  const run = screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  fireEvent.click(await screen.findByRole("button", { name: "Check creation status" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Comparison creation status is still unavailable: The stored comparison failed correlation validation.");
  expect(run.disabled).toBe(true);
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/comparisons/latest"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
});

it("keeps creation uncertain when manual reconciliation finds partial guardrails", async () => {
  const invalid = {
    evaluation: { passed: true, checks: partialComparisonChecks() },
    memory: { run_id: "run-stored-memory", status: "complete", mode: "memory", findings: [teamFinding], retrieval: {} },
    baseline: { run_id: "run-stored-baseline", status: "complete", mode: "baseline", findings: [generalFinding], retrieval: {} },
  };
  const fetchMock = installFetch({
    comparisonCreationHangs: true,
    comparisonCreationClaimVisible: false,
    latestComparison: invalid,
    latestComparisonAfterRead: 2,
  });
  renderAt("/repos/repo-acme-commerce/lab");
  await screen.findByRole("option", { name: /Update order status/ });
  const run = screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  fireEvent.click(await screen.findByRole("button", { name: "Check creation status" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Comparison creation status is still unavailable: The stored comparison failed correlation validation.");
  expect(run.disabled).toBe(true);
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/comparisons/latest"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
});

it("keeps creation uncertain when manual reconciliation finds no overall outcome", async () => {
  const invalid = {
    evaluation: { checks: comparisonChecks() },
    memory: { run_id: "run-stored-memory", status: "complete", mode: "memory", findings: [teamFinding], retrieval: {} },
    baseline: { run_id: "run-stored-baseline", status: "complete", mode: "baseline", findings: [generalFinding], retrieval: {} },
  };
  const fetchMock = installFetch({
    comparisonCreationHangs: true,
    comparisonCreationClaimVisible: false,
    latestComparison: invalid,
    latestComparisonAfterRead: 2,
  });
  renderAt("/repos/repo-acme-commerce/lab");
  await screen.findByRole("option", { name: /Update order status/ });
  const run = screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  fireEvent.click(await screen.findByRole("button", { name: "Check creation status" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Comparison creation status is still unavailable: The stored comparison failed correlation validation.");
  expect(run.disabled).toBe(true);
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/comparisons/latest"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
});

it("keeps creation uncertain when manual reconciliation finds mismatched models", async () => {
  const invalid = {
    evaluation: { passed: true, checks: comparisonChecks() },
    memory: { run_id: "run-stored-memory", status: "complete", mode: "memory", findings: [teamFinding], retrieval: {} },
    baseline: { run_id: "run-stored-baseline", status: "complete", mode: "baseline", model: "other-model", findings: [generalFinding], retrieval: {} },
  };
  const fetchMock = installFetch({
    comparisonCreationHangs: true,
    comparisonCreationClaimVisible: false,
    latestComparison: invalid,
    latestComparisonAfterRead: 2,
  });
  renderAt("/repos/repo-acme-commerce/lab");
  await screen.findByRole("option", { name: /Update order status/ });
  const run = screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  fireEvent.click(await screen.findByRole("button", { name: "Check creation status" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Comparison creation status is still unavailable: The stored comparison failed correlation validation.");
  expect(run.disabled).toBe(true);
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/comparisons/latest"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
});

it("keeps creation uncertain when manual reconciliation finds mismatched run IDs", async () => {
  const invalid = {
    evaluation: { passed: true, checks: comparisonChecks(), run_ids: { memory: "run-stored-memory", baseline: "run-other" } },
    memory: { run_id: "run-stored-memory", status: "complete", mode: "memory", findings: [teamFinding], retrieval: {} },
    baseline: { run_id: "run-stored-baseline", status: "complete", mode: "baseline", findings: [generalFinding], retrieval: {} },
  };
  const fetchMock = installFetch({
    comparisonCreationHangs: true,
    comparisonCreationClaimVisible: false,
    latestComparison: invalid,
    latestComparisonAfterRead: 2,
  });
  renderAt("/repos/repo-acme-commerce/lab");
  await screen.findByRole("option", { name: /Update order status/ });
  const run = screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  fireEvent.click(await screen.findByRole("button", { name: "Check creation status" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Comparison creation status is still unavailable: The stored comparison failed correlation validation.");
  expect(run.disabled).toBe(true);
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/comparisons/latest"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
});

it("keeps creation uncertain when manual reconciliation finds inconsistent counts", async () => {
  const invalid = {
    evaluation: { passed: true, checks: comparisonChecks(), counts: { memory_findings: 99 } },
    memory: { run_id: "run-stored-memory", status: "complete", mode: "memory", findings: [teamFinding], retrieval: {} },
    baseline: { run_id: "run-stored-baseline", status: "complete", mode: "baseline", findings: [generalFinding], retrieval: {} },
  };
  const fetchMock = installFetch({
    comparisonCreationHangs: true,
    comparisonCreationClaimVisible: false,
    latestComparison: invalid,
    latestComparisonAfterRead: 2,
  });
  renderAt("/repos/repo-acme-commerce/lab");
  await screen.findByRole("option", { name: /Update order status/ });
  const run = screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  fireEvent.click(await screen.findByRole("button", { name: "Check creation status" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Comparison creation status is still unavailable: The stored comparison failed correlation validation.");
  expect(run.disabled).toBe(true);
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/comparisons/latest"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
});

it("keeps creation uncertain when manual reconciliation finds an ungrounded finding guardrail", async () => {
  const invalid = {
    evaluation: { passed: true, checks: comparisonChecks() },
    memory: {
      run_id: "run-stored-memory",
      status: "complete",
      mode: "memory",
      findings: [teamFinding],
      retrieval: { validated_evidence: [{ decision_id: "DEC-other" }] },
    },
    baseline: { run_id: "run-stored-baseline", status: "complete", mode: "baseline", findings: [generalFinding] },
  };
  const fetchMock = installFetch({
    comparisonCreationHangs: true,
    comparisonCreationClaimVisible: false,
    latestComparison: invalid,
    latestComparisonAfterRead: 2,
  });
  renderAt("/repos/repo-acme-commerce/lab");
  await screen.findByRole("option", { name: /Update order status/ });
  const run = screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  fireEvent.click(await screen.findByRole("button", { name: "Check creation status" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Comparison creation status is still unavailable: The stored comparison failed correlation validation.");
  expect(run.disabled).toBe(true);
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/comparisons/latest"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
});

it("keeps creation uncertain when manual reconciliation finds a different candidate PR", async () => {
  const invalid = {
    evaluation: { passed: true, checks: comparisonChecks() },
    memory: { run_id: "run-stored-memory", status: "complete", mode: "memory", pr_id: "pr-acme-120", findings: [teamFinding] },
    baseline: { run_id: "run-stored-baseline", status: "complete", mode: "baseline", pr_id: "pr-acme-120", findings: [generalFinding] },
  };
  const fetchMock = installFetch({
    comparisonCreationHangs: true,
    comparisonCreationClaimVisible: false,
    latestComparison: invalid,
    latestComparisonAfterRead: 2,
  });
  renderAt("/repos/repo-acme-commerce/lab");
  await screen.findByRole("option", { name: /Update order status/ });
  const run = screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await waitFor(() => expect(run.disabled).toBe(false));
  fireEvent.click(run);
  fireEvent.click(await screen.findByRole("button", { name: "Check creation status" }));
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Comparison creation status is still unavailable: The stored comparison failed correlation validation.");
  expect(run.disabled).toBe(true);
  expect(screen.queryByText("Guardrails passed")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/comparisons/latest"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(1);
});

it("keeps comparison creation disabled until persisted recovery completes", async () => {
  let releaseLatestComparison = () => {};
  const latestComparisonGate = new Promise<void>((resolve) => {
    releaseLatestComparison = resolve;
  });
  const fetchMock = installFetch({ latestComparisonGate });
  renderAt("/repos/repo-acme-commerce/lab");
  await screen.findByRole("option", { name: /Update order status/ });
  const run = screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement;
  await waitFor(() => expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/comparisons/latest"))).toHaveLength(1));
  const workspace = screen.getByRole("region", { name: "Comparison workspace" });
  expect(workspace.getAttribute("aria-busy")).toBe("true");
  expect(screen.getAllByText("Restoring the latest completed comparison…")).toHaveLength(2);
  expect(screen.getAllByRole("status").filter((item) => item.textContent === "Restoring the latest completed comparison…")).toHaveLength(1);
  expect(run.disabled).toBe(true);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  await act(async () => releaseLatestComparison());
  await waitFor(() => expect(run.disabled).toBe(false));
  expect(workspace.getAttribute("aria-busy")).toBe("false");
  expect(screen.queryByText("Restoring the latest completed comparison…")).toBeNull();
});

it("leaves an actionable comparison state when persisted recovery fails", async () => {
  const fetchMock = installFetch({ comparisonRecoveryFailure: true });
  renderAt("/repos/repo-acme-commerce/lab");
  const alert = await screen.findByRole("alert");
  expect(alert.textContent).toContain("Comparison recovery unavailable: temporary recovery outage");
  expect(alert.textContent).toContain("No comparison or provider branch was started");
  expect(alert.textContent).toContain("Run a new comparison when memory is connected");
  expect(screen.getByRole("region", { name: "Comparison workspace" }).getAttribute("aria-busy")).toBe("false");
  expect((screen.getByRole("button", { name: "Run comparison" }) as HTMLButtonElement).disabled).toBe(false);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  const retry = screen.getByRole("button", { name: "Retry saved comparison recovery" });
  retry.focus();
  fireEvent.click(retry);
  const recreated = await screen.findByRole("button", { name: "Retry saved comparison recovery" });
  await waitFor(() => expect(document.activeElement).toBe(recreated));
});

it("retries saved comparison recovery through GET only", async () => {
  const restored = {
    evaluation: { passed: true, checks: comparisonChecks(), counts: { memory_findings: 1 } },
    memory: { run_id: "run-retry-saved-memory", status: "complete", mode: "memory", findings: [teamFinding], retrieval: {} },
    baseline: { run_id: "run-retry-saved-baseline", status: "complete", mode: "baseline", findings: [generalFinding], retrieval: {} },
  };
  const fetchMock = installFetch({ comparisonRecoveryFailures: 1, latestComparison: restored });
  renderAt("/repos/repo-acme-commerce/lab");
  const retry = await screen.findByRole("button", { name: "Retry saved comparison recovery" });
  fireEvent.click(retry);
  expect(await screen.findByText("Guardrails passed")).toBeTruthy();
  const guardrailsHeading = screen.getByRole("heading", { name: "Guardrails" });
  await waitFor(() => expect(document.activeElement).toBe(guardrailsHeading));
  expect(screen.queryByRole("button", { name: "Retry saved comparison recovery" })).toBeNull();
  expect(screen.queryByRole("alert")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/review-jobs/active?kind=comparison"))).toHaveLength(2);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/comparisons/latest"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("announces an empty saved comparison recovery without starting work", async () => {
  const fetchMock = installFetch({ comparisonRecoveryFailures: 1 });
  renderAt("/repos/repo-acme-commerce/lab");
  const retry = await screen.findByRole("button", { name: "Retry saved comparison recovery" });
  fireEvent.click(retry);
  const message = "Saved comparison recovery completed. No persisted comparison was found, and no provider branch was started.";
  await waitFor(() => expect(screen.getAllByRole("status").some((item) => item.textContent === message)).toBe(true));
  expect(document.activeElement).toBe(screen.getByRole("region", { name: "Comparison workspace" }));
  expect(screen.queryByRole("alert")).toBeNull();
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
});

it("checks an existing comparison again after bounded polling is exhausted", async () => {
  const resumed = {
    evaluation: { passed: true, checks: comparisonChecks(), counts: { memory_findings: 1 } },
    memory: { run_id: "run-retry-memory", status: "complete", mode: "memory", findings: [teamFinding], retrieval: {} },
    baseline: { run_id: "run-retry-baseline", status: "complete", mode: "baseline", findings: [generalFinding], retrieval: {} },
  };
  const fetchMock = installFetch({ comparison: resumed, activeComparisonJob: true, comparisonPollFailures: 4 });
  renderAt("/repos/repo-acme-commerce/lab");
  const retry = await screen.findByRole("button", { name: "Check comparison again" });
  const details = screen.getByText("Active job details").closest("details");
  expect(details).toBeTruthy();
  fireEvent.click(screen.getByText("Active job details"));
  expect(within(details as HTMLElement).getByText("job-cmp")).toBeTruthy();
  expect(within(details as HTMLElement).getByText("Status temporarily unavailable")).toBeTruthy();
  expect(details?.querySelector(`time[datetime="${jobCreatedAt}"]`)).toBeTruthy();
  expect(details?.querySelector(`time[datetime="${jobUpdatedAt}"]`)).toBeTruthy();
  expect(details?.querySelectorAll(".job-time small")).toHaveLength(2);
  expect(screen.getByText(/has not reported progress for at least 3 minutes/i)).toBeTruthy();
  expect(loadActiveJob("comparison", "pr-acme-87")).toBe("job-cmp");
  fireEvent.click(retry);
  expect(await screen.findByText("Guardrails passed")).toBeTruthy();
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-cmp"))).toHaveLength(5);
  expect(loadActiveJob("comparison", "pr-acme-87")).toBeNull();
  expect(screen.queryByText("Active job details")).toBeNull();
});

it("clears a missing active comparison and restores the latest completed result", async () => {
  const restored = {
    evaluation: {
      passed: true,
      checks: comparisonChecks(),
      counts: { memory_findings: 1 },
    },
    memory: {
      run_id: "run-fallback-memory",
      status: "complete",
      mode: "memory",
      findings: [teamFinding],
      retrieval: { timings_ms: { recall: 250 } },
    },
    baseline: {
      run_id: "run-fallback-baseline",
      status: "complete",
      mode: "baseline",
      findings: [generalFinding],
      retrieval: {},
    },
  };
  saveActiveJob("comparison", "pr-acme-87", "job-cmp");
  const fetchMock = installFetch({ missingComparisonJob: true, latestComparison: restored });
  renderAt("/repos/repo-acme-commerce/lab");
  expect(await screen.findByText("Guardrails passed")).toBeTruthy();
  expect(screen.getByText("Latest comparison restored")).toBeTruthy();
  expect(fetchMock.mock.calls.filter((entry) => (entry[1]?.method ?? "GET") === "POST")).toHaveLength(0);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/api/review-jobs/job-cmp"))).toHaveLength(1);
  expect(fetchMock.mock.calls.filter((entry) => String(entry[0]).includes("/comparisons/latest"))).toHaveLength(1);
  expect(loadActiveJob("comparison", "pr-acme-87")).toBeNull();
});
