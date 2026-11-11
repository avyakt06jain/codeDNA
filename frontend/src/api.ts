import { isValidUnifiedDiff } from "./diffFiles";

export type HindsightState = "starting" | "ready" | "unavailable";

const MAX_PROVIDER_ID_LENGTH = 80;
const MAX_MODEL_ID_LENGTH = 160;
const MAX_REPOSITORY_ID_LENGTH = 160;
const MAX_REPOSITORY_SLUG_LENGTH = 160;
const MAX_REPOSITORY_NAME_LENGTH = 200;
const MAX_PULL_REQUEST_ID_LENGTH = 80;
const MAX_PULL_REQUEST_TITLE_LENGTH = 240;
const MAX_PULL_REQUEST_DESCRIPTION_LENGTH = 20_000;
const MAX_DIFF_BYTES = 100_000;
const MAX_DECISION_ID_LENGTH = 80;
const MAX_DECISION_TITLE_LENGTH = 240;
const MAX_DECISION_TEXT_LENGTH = 20_000;
const SAFE_REPOSITORY_ID = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;
const SAFE_REPOSITORY_SLUG = /^[a-z0-9][a-z0-9-]*$/;
const FINDING_CATEGORIES = new Set(["general", "team_convention"]);
const FINDING_SEVERITIES = new Set(["info", "warning", "error"]);
const FINDING_CONFIDENCES = new Set(["low", "medium", "high"]);
const DECISION_STATUSES = new Set(["proposed", "active", "superseded", "revoked"]);
const DECISION_AUTHORITIES = new Set(["proposed", "reviewer_confirmed"]);

export type Health = {
  status?: string;
  memory?: string;
  hindsight?: HindsightState;
  interrupted_jobs?: number;
};

export type Repository = {
  id: string;
  slug: string;
  display_name: string;
};

export type EvaluationCase = {
  repository_id: string;
  repository_name: string;
  source_pr_id: string;
  source_pr_number: number;
  candidate_pr_id: string;
  candidate_pr_number: number;
  decision_id: string;
  decision_status: string;
  latest_evaluation: {
    job_id: string;
    passed: boolean;
    passed_checks: number;
    total_checks: number;
    updated_at?: string;
  } | null;
};

export type Summary = {
  repository_id?: string;
  slug?: string;
  display_name?: string;
  pr_count?: number;
  decision_count?: number;
  active_decisions?: number;
  superseded_decisions?: number;
  pending_decisions?: number;
  review_run_count?: number;
  hindsight?: HindsightState;
};

export type PullRequestSummary = {
  id: string;
  number: number;
  title: string;
  created_at?: string;
};

export type PullRequest = PullRequestSummary & {
  repository_id: string;
  description: string;
  diff_text: string;
};

export type Decision = {
  id: string;
  repository_id?: string;
  title: string;
  rule_text: string;
  rationale: string;
  status: string;
  authority?: string;
  source_pr_id?: string | null;
  source_pr_number?: number | null;
  supersedes_decision_id?: string | null;
  superseded_by_decision_id?: string | null;
  scope?: unknown;
  effective_at?: string | null;
  memory?: {
    document_id?: string;
    ingestion_status?: string;
  } | null;
};

export type LineageItem = {
  id: string;
  title: string;
  rule_text: string;
  rationale: string;
  status: string;
  source_pr_id?: string | null;
  source_pr_number?: number | null;
  effective_at?: string | null;
};

export type Lineage = {
  decision_id: string;
  items: LineageItem[];
};

export type Timings = {
  query?: number;
  recall?: number;
  validation?: number;
  generation?: number;
};

export type Finding = {
  id: string;
  category: "general" | "team_convention";
  file_path: string;
  new_line: number | null;
  severity: "info" | "warning" | "error";
  title: string;
  explanation: string;
  suggested_change: string | null;
  confidence: "low" | "medium" | "high";
  evidence_ids: string[];
};

export type Review = {
  run_id: string;
  status: string;
  mode: "baseline" | "memory";
  model?: string;
  provider?: string;
  elapsed_ms?: number;
  pr_id?: string;
  retrieval?: {
    query?: string | null;
    timings_ms?: Timings;
    validated_evidence?: unknown[];
  };
  validation?: {
    dropped?: unknown[];
  };
  findings: Finding[];
};

export type Comparison = {
  evaluation: {
    passed: boolean;
    checks: Record<string, boolean>;
    counts: Record<string, number>;
    run_ids: { memory: string; baseline: string };
  };
  memory: Review;
  baseline: Review;
};

export type ReviewJob = {
  job_id?: string;
  id?: string;
  status?: string;
  stage?: string;
  error_code?: string | null;
  review?: Review;
  comparison?: Comparison;
  evaluation?: Comparison["evaluation"];
  memory?: Review;
  baseline?: Review;
  created_at?: string;
  updated_at?: string;
};

export type JobTiming = {
  createdAt?: string;
  updatedAt?: string;
};

export type StartedJob = JobTiming & {
  jobId: string;
  reused: boolean;
};

export type ActiveJob = JobTiming & {
  jobId: string;
};

export type RepositoryActiveJob = JobTiming & {
  jobId: string;
  prId: string;
  prNumber: number;
  prTitle: string;
  kind: "review" | "comparison";
  status: "queued" | "running";
  stage: string;
};

export type FeedbackResult = {
  id: string;
  binding: boolean;
};

const API_ROOT = import.meta.env.VITE_API_URL ?? "";
const POLL_ATTEMPTS = 360;
const POLL_DELAY_MS = 1000;
const POLL_RETRY_DELAYS_MS = import.meta.env.MODE === "test" ? [1, 2, 4] as const : [1000, 2000, 4000] as const;
const JOB_READ_TIMEOUT_MS = import.meta.env.MODE === "test" ? 50 : 10_000;
const CREATION_RESPONSE_TIMEOUT_MS = import.meta.env.MODE === "test" ? 50 : 10_000;
const CREATION_RECONCILE_DELAYS_MS = import.meta.env.MODE === "test" ? [0, 1, 2] as const : [0, 250, 750] as const;
const SAFE_JOB_ID = /^job-[A-Za-z0-9_-]{1,80}$/;
const SAFE_RUN_ID = /^(?:review|run)-[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/;
const REQUIRED_COMPARISON_CHECKS = [
  "same_candidate",
  "same_model",
  "memory_retrieved_validated_source",
  "memory_produced_grounded_team_finding",
  "baseline_has_no_memory_citations",
  "baseline_has_no_team_policy_finding",
] as const;
const REQUIRED_COMPARISON_COUNTS = [
  "validated_memory_sources",
  "memory_findings",
  "memory_team_findings",
  "memory_citations",
  "baseline_findings",
  "baseline_team_findings",
  "baseline_citations",
] as const;

class ApiRequestError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export function isTransientRequestError(reason: unknown): boolean {
  return reason instanceof TypeError
    || (reason instanceof ApiRequestError && [408, 425, 429, 500, 502, 503, 504].includes(reason.status));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function normalizeJobTimestamp(value: unknown): string | undefined {
  const raw = asString(value);
  if (!raw) return undefined;
  const timestamp = Date.parse(raw);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

export function normalizeRunId(value: unknown): string {
  const runId = asString(value) ?? "";
  return SAFE_RUN_ID.test(runId) ? runId : "";
}

function jobTimingFrom(raw: Record<string, unknown>): JobTiming {
  return {
    createdAt: normalizeJobTimestamp(raw.created_at),
    updatedAt: normalizeJobTimestamp(raw.updated_at),
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!response.ok) {
    const message = await response.text();
    let detail = message;
    try {
      const parsed = JSON.parse(message) as { detail?: unknown };
      if (typeof parsed.detail === "string" && parsed.detail.trim()) detail = parsed.detail;
    } catch {
      detail = message;
    }
    throw new ApiRequestError(detail || `Request failed (${response.status})`, response.status);
  }
  return response.json() as Promise<T>;
}

async function requestJobRead<T>(path: string): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, JOB_READ_TIMEOUT_MS);
  try {
    return await request<T>(path, { signal: controller.signal });
  } catch (reason) {
    if (timedOut) throw new TypeError("The background-job read timed out.");
    throw reason;
  } finally {
    window.clearTimeout(timeout);
  }
}

class CreationResponseTimeoutError extends Error {}

async function requestCreation<T>(path: string, init: RequestInit): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, CREATION_RESPONSE_TIMEOUT_MS);
  try {
    return await request<T>(path, { ...init, signal: controller.signal });
  } catch (reason) {
    if (timedOut) throw new CreationResponseTimeoutError("The job creation response timed out.");
    throw reason;
  } finally {
    window.clearTimeout(timeout);
  }
}

function unwrapRecords(payload: unknown): Record<string, unknown>[] {
  if (Array.isArray(payload)) return payload.filter(isRecord);
  if (isRecord(payload) && Array.isArray(payload.items)) return payload.items.filter(isRecord);
  return [];
}

function readScope(raw: Record<string, unknown>): unknown {
  if (raw.scope != null) return raw.scope;
  if (typeof raw.scope_json === "string") {
    try {
      return JSON.parse(raw.scope_json) as unknown;
    } catch {
      return raw.scope_json;
    }
  }
  return raw.scope_json;
}

function normalizeDecision(raw: Record<string, unknown>): Decision {
  const memory = isRecord(raw.memory) ? raw.memory : null;
  return {
    id: String(raw.id ?? ""),
    repository_id: asString(raw.repository_id),
    title: String(raw.title ?? ""),
    rule_text: String(raw.rule_text ?? ""),
    rationale: String(raw.rationale ?? ""),
    status: String(raw.status ?? ""),
    authority: asString(raw.authority),
    source_pr_id: raw.source_pr_id == null ? null : String(raw.source_pr_id),
    source_pr_number: asNumber(raw.source_pr_number) ?? null,
    supersedes_decision_id: raw.supersedes_decision_id == null ? null : String(raw.supersedes_decision_id),
    superseded_by_decision_id: raw.superseded_by_decision_id == null ? null : String(raw.superseded_by_decision_id),
    scope: readScope(raw),
    effective_at: raw.effective_at == null ? null : String(raw.effective_at),
    memory: memory
      ? {
          document_id: asString(memory.document_id),
          ingestion_status: asString(memory.ingestion_status),
        }
      : null,
  };
}

function normalizeDecisionItem(raw: Record<string, unknown>, repositoryId: string): Decision | null {
  const id = asString(raw.id)?.trim();
  const itemRepositoryId = asString(raw.repository_id)?.trim();
  const title = asString(raw.title)?.trim();
  const ruleText = asString(raw.rule_text)?.trim();
  const rationale = asString(raw.rationale)?.trim();
  const status = asString(raw.status)?.trim();
  const authority = asString(raw.authority)?.trim();
  const sourcePrId = asString(raw.source_pr_id)?.trim();
  const sourcePrNumber = asNumber(raw.source_pr_number);
  const supersedesDecisionId = raw.supersedes_decision_id == null
    ? null
    : asString(raw.supersedes_decision_id)?.trim();
  if (!id || id.length > MAX_DECISION_ID_LENGTH || !SAFE_REPOSITORY_ID.test(id)
    || itemRepositoryId !== repositoryId
    || !title || title.length > MAX_DECISION_TITLE_LENGTH
    || !ruleText || ruleText.length > MAX_DECISION_TEXT_LENGTH
    || !rationale || rationale.length > MAX_DECISION_TEXT_LENGTH
    || !status || !DECISION_STATUSES.has(status)
    || !authority || !DECISION_AUTHORITIES.has(authority)
    || !sourcePrId || sourcePrId.length > MAX_PULL_REQUEST_ID_LENGTH || !SAFE_REPOSITORY_ID.test(sourcePrId)
    || sourcePrNumber === undefined || !Number.isInteger(sourcePrNumber) || sourcePrNumber < 1
    || !isRecord(raw.scope)
    || (supersedesDecisionId != null && (!supersedesDecisionId
      || supersedesDecisionId.length > MAX_DECISION_ID_LENGTH
      || !SAFE_REPOSITORY_ID.test(supersedesDecisionId)
      || supersedesDecisionId === id))) return null;
  return {
    id,
    repository_id: itemRepositoryId,
    title,
    rule_text: ruleText,
    rationale,
    status,
    authority,
    source_pr_id: sourcePrId,
    source_pr_number: sourcePrNumber,
    supersedes_decision_id: supersedesDecisionId,
    scope: raw.scope,
  };
}

function normalizeDecisionCatalog(payload: unknown, repositoryId: string): Decision[] {
  const rows = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.items) ? payload.items : null;
  if (!rows || !rows.every(isRecord)) {
    throw new InvalidDecisionCatalogError("The decision catalog failed provenance validation.");
  }
  const decisions = rows.map((row) => normalizeDecisionItem(row, repositoryId));
  if (decisions.some((decision) => decision === null)) {
    throw new InvalidDecisionCatalogError("The decision catalog failed provenance validation.");
  }
  const valid = decisions as Decision[];
  const ids = new Set(valid.map((decision) => decision.id));
  if (ids.size !== valid.length
    || valid.some((decision) => decision.supersedes_decision_id != null
      && !ids.has(decision.supersedes_decision_id))) {
    throw new InvalidDecisionCatalogError("The decision catalog failed provenance validation.");
  }
  return valid;
}

function normalizeEvidenceResponse(
  payload: unknown,
  runId: string,
  repositoryId: string,
  expectedDecisionIds: string[],
): { decisions: Decision[] } {
  if (!isRecord(payload) || payload.run_id !== runId || !Array.isArray(payload.decisions)
    || !payload.decisions.every(isRecord)) {
    throw new InvalidEvidenceResponseError("The evidence response failed provenance validation.");
  }
  const expectedIds = new Set(expectedDecisionIds);
  const decisions = payload.decisions.map((row) => normalizeDecisionItem(row, repositoryId));
  if (expectedIds.size === 0 || decisions.some((decision) => decision === null)) {
    throw new InvalidEvidenceResponseError("The evidence response failed provenance validation.");
  }
  const valid = decisions as Decision[];
  const returnedIds = new Set(valid.map((decision) => decision.id));
  if (valid.some((decision) => decision.authority !== "reviewer_confirmed")
    || returnedIds.size !== valid.length || returnedIds.size !== expectedIds.size
    || [...expectedIds].some((decisionId) => !returnedIds.has(decisionId))) {
    throw new InvalidEvidenceResponseError("The evidence response failed provenance validation.");
  }
  return { decisions: valid };
}

function normalizeLineageItem(raw: Record<string, unknown>): LineageItem {
  return {
    id: String(raw.id ?? ""),
    title: String(raw.title ?? ""),
    rule_text: String(raw.rule_text ?? ""),
    rationale: String(raw.rationale ?? ""),
    status: String(raw.status ?? ""),
    source_pr_id: raw.source_pr_id == null ? null : String(raw.source_pr_id),
    source_pr_number: asNumber(raw.source_pr_number) ?? null,
    effective_at: raw.effective_at == null ? null : String(raw.effective_at),
  };
}

function normalizeFinding(raw: Record<string, unknown>): Finding {
  const category = raw.category === "team_convention" ? "team_convention" : "general";
  const severity = raw.severity === "info" || raw.severity === "error" || raw.severity === "warning" ? raw.severity : "warning";
  const confidence = raw.confidence === "low" || raw.confidence === "high" || raw.confidence === "medium" ? raw.confidence : "medium";
  return {
    id: String(raw.id ?? ""),
    category,
    file_path: String(raw.file_path ?? ""),
    new_line: asNumber(raw.new_line) ?? null,
    severity,
    title: String(raw.title ?? "Finding"),
    explanation: String(raw.explanation ?? ""),
    suggested_change: raw.suggested_change == null ? null : String(raw.suggested_change),
    confidence,
    evidence_ids: Array.isArray(raw.evidence_ids) ? raw.evidence_ids.map(String) : [],
  };
}

function isValidFinding(raw: Record<string, unknown>): boolean {
  const validLine = raw.new_line === null
    || (typeof raw.new_line === "number" && Number.isInteger(raw.new_line) && raw.new_line >= 1);
  return typeof raw.id === "string" && raw.id.trim().length > 0 && raw.id.length <= 80
    && typeof raw.file_path === "string" && raw.file_path.trim().length > 0 && raw.file_path.length <= 500
    && validLine
    && typeof raw.category === "string" && FINDING_CATEGORIES.has(raw.category)
    && typeof raw.severity === "string" && FINDING_SEVERITIES.has(raw.severity)
    && typeof raw.title === "string" && raw.title.trim().length >= 8 && raw.title.length <= 140
    && typeof raw.explanation === "string" && raw.explanation.trim().length >= 20 && raw.explanation.length <= 2000
    && (raw.suggested_change === null
      || (typeof raw.suggested_change === "string" && raw.suggested_change.length <= 2000))
    && typeof raw.confidence === "string" && FINDING_CONFIDENCES.has(raw.confidence)
    && Array.isArray(raw.evidence_ids) && raw.evidence_ids.length <= 5
    && raw.evidence_ids.every((item) => typeof item === "string" && item.trim().length > 0)
    && (raw.category === "team_convention" ? raw.evidence_ids.length > 0 : raw.evidence_ids.length === 0);
}

function isValidEvidenceProvenance(raw: Record<string, unknown>): boolean {
  const requiredText = [
    raw.fact_id,
    raw.document_id,
    raw.decision_id,
    raw.source_pr_id,
    raw.repository_id,
    raw.repository_slug,
    raw.bank_id,
  ];
  return requiredText.every((value) => typeof value === "string" && value.trim().length > 0)
    && typeof raw.source_pr_number === "number"
    && Number.isInteger(raw.source_pr_number)
    && raw.source_pr_number >= 1;
}

function normalizeTimings(raw: unknown): Timings | undefined {
  if (!isRecord(raw)) return undefined;
  const timings: Timings = {};
  if (typeof raw.query === "number") timings.query = raw.query;
  if (typeof raw.recall === "number") timings.recall = raw.recall;
  if (typeof raw.validation === "number") timings.validation = raw.validation;
  if (typeof raw.generation === "number") timings.generation = raw.generation;
  return timings;
}

export function normalizeReview(raw: Record<string, unknown>): Review {
  const retrieval = isRecord(raw.retrieval) ? raw.retrieval : undefined;
  const validation = isRecord(raw.validation) ? raw.validation : undefined;
  const mode = raw.mode === "baseline" ? "baseline" : "memory";
  return {
    run_id: normalizeRunId(raw.run_id),
    status: String(raw.status ?? ""),
    mode,
    model: asString(raw.model),
    provider: asString(raw.provider),
    elapsed_ms: asNumber(raw.elapsed_ms),
    pr_id: asString(raw.pr_id),
    retrieval: retrieval
      ? {
          query: retrieval.query == null ? null : String(retrieval.query),
          timings_ms: normalizeTimings(retrieval.timings_ms),
          validated_evidence: Array.isArray(retrieval.validated_evidence) ? retrieval.validated_evidence : undefined,
        }
      : undefined,
    validation: validation && Array.isArray(validation.dropped) ? { dropped: validation.dropped } : undefined,
    findings: Array.isArray(raw.findings) ? raw.findings.filter(isRecord).map(normalizeFinding) : [],
  };
}

function normalizeReviewForPr(
  raw: Record<string, unknown>,
  expectedPrId: string,
  expectedRepositoryId: string,
  expectedRepositorySlug: string,
  expectedMode?: "memory" | "baseline",
): Review | null {
  if (raw.status !== "complete") return null;
  if (raw.mode !== "memory" && raw.mode !== "baseline") return null;
  if (expectedMode !== undefined && raw.mode !== expectedMode) return null;
  if (!Array.isArray(raw.findings)
    || !raw.findings.every((finding) => isRecord(finding) && isValidFinding(finding))) return null;
  if (typeof raw.elapsed_ms !== "number"
    || !Number.isFinite(raw.elapsed_ms)
    || !Number.isInteger(raw.elapsed_ms)
    || raw.elapsed_ms < 0) return null;
  const teamCitations = raw.findings
    .filter((finding) => finding.category === "team_convention")
    .flatMap((finding) => finding.evidence_ids as string[]);
  const validatedEvidence = isRecord(raw.retrieval) && Array.isArray(raw.retrieval.validated_evidence)
    ? raw.retrieval.validated_evidence
    : [];
  const citedDecisionIds = new Set(teamCitations);
  const citedEvidence = validatedEvidence
    .filter(isRecord)
    .filter((evidence) => citedDecisionIds.has(asString(evidence.decision_id)?.trim() ?? ""));
  if (citedEvidence.some((evidence) => !isValidEvidenceProvenance(evidence))) return null;
  const validatedDecisionIds = new Set(citedEvidence
    .map((evidence) => asString(evidence.decision_id)?.trim())
    .filter((decisionId): decisionId is string => Boolean(decisionId)));
  if (teamCitations.some((decisionId) => !validatedDecisionIds.has(decisionId))) return null;
  const evidenceIdentity = citedEvidence[0];
  if (evidenceIdentity && citedEvidence.some((evidence) => (
    evidence.repository_id !== evidenceIdentity.repository_id
    || evidence.repository_slug !== evidenceIdentity.repository_slug
    || evidence.bank_id !== evidenceIdentity.bank_id
  ))) return null;
  if (evidenceIdentity && evidenceIdentity.repository_id !== expectedRepositoryId) return null;
  if (evidenceIdentity && evidenceIdentity.repository_slug !== expectedRepositorySlug) return null;
  const provider = asString(raw.provider)?.trim();
  const model = asString(raw.model)?.trim();
  if (!provider || provider.length > MAX_PROVIDER_ID_LENGTH
    || !model || model.length > MAX_MODEL_ID_LENGTH) return null;
  const review = normalizeReview(raw);
  return review.run_id && review.pr_id === expectedPrId
    ? { ...review, provider, model }
    : null;
}

export function normalizeComparison(raw: unknown, expectedPrId?: string): Comparison | null {
  if (!isRecord(raw)) return null;
  const evaluation = isRecord(raw.evaluation) ? raw.evaluation : null;
  const memory = isRecord(raw.memory) ? raw.memory : null;
  const baseline = isRecord(raw.baseline) ? raw.baseline : null;
  if (!evaluation || !memory || !baseline) return null;
  if (memory.mode !== "memory" || baseline.mode !== "baseline") return null;
  if (memory.status !== "complete" || baseline.status !== "complete") return null;
  const memoryPrId = asString(memory.pr_id);
  const baselinePrId = asString(baseline.pr_id);
  const memoryProvider = asString(memory.provider);
  const baselineProvider = asString(baseline.provider);
  const memoryModel = asString(memory.model);
  const baselineModel = asString(baseline.model);
  if (!memoryPrId || memoryPrId !== baselinePrId
    || !memoryProvider || memoryProvider !== baselineProvider
    || !memoryModel || memoryModel !== baselineModel) return null;
  if (expectedPrId !== undefined && memoryPrId !== expectedPrId) return null;
  const rawChecks = evaluation.checks;
  if (!isRecord(rawChecks)
    || REQUIRED_COMPARISON_CHECKS.some((key) => typeof rawChecks[key] !== "boolean")) return null;
  const checks: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(rawChecks)) {
    if (typeof value === "boolean") checks[key] = value;
  }
  if (!checks.same_candidate || !checks.same_model) return null;
  if (typeof evaluation.passed !== "boolean") return null;
  const passed = evaluation.passed;
  if (passed !== Object.values(checks).every(Boolean)) return null;
  const rawCounts = evaluation.counts;
  if (!isRecord(rawCounts)
    || REQUIRED_COMPARISON_COUNTS.some((key) => {
      const value = rawCounts[key];
      return typeof value !== "number" || !Number.isInteger(value) || value < 0;
    })) return null;
  const counts: Record<string, number> = {};
  for (const [key, value] of Object.entries(rawCounts)) {
    if (typeof value === "number" && Number.isInteger(value) && value >= 0) counts[key] = value;
  }
  if (!isRecord(evaluation.run_ids)) return null;
  const runIds = evaluation.run_ids;
  const memoryReview = normalizeReview(memory);
  const baselineReview = normalizeReview(baseline);
  if (!memoryReview.run_id || !baselineReview.run_id) return null;
  const expectedCounts: Record<(typeof REQUIRED_COMPARISON_COUNTS)[number], number> = {
    validated_memory_sources: memoryReview.retrieval?.validated_evidence?.length ?? 0,
    memory_findings: memoryReview.findings.length,
    memory_team_findings: memoryReview.findings.filter((finding) => finding.category === "team_convention").length,
    memory_citations: new Set(memoryReview.findings.flatMap((finding) => finding.evidence_ids)).size,
    baseline_findings: baselineReview.findings.length,
    baseline_team_findings: baselineReview.findings.filter((finding) => finding.category === "team_convention").length,
    baseline_citations: new Set(baselineReview.findings.flatMap((finding) => finding.evidence_ids)).size,
  };
  if (REQUIRED_COMPARISON_COUNTS.some((key) => counts[key] !== expectedCounts[key])) return null;
  const validatedEvidence = memoryReview.retrieval?.validated_evidence ?? [];
  const validatedDecisionIds = new Set(
    validatedEvidence
      .filter(isRecord)
      .map((evidence) => asString(evidence.decision_id))
      .filter((decisionId): decisionId is string => Boolean(decisionId)),
  );
  const memoryTeamFindings = memoryReview.findings.filter((finding) => finding.category === "team_convention");
  const memoryCitations = new Set(memoryReview.findings.flatMap((finding) => finding.evidence_ids));
  const baselineTeamFindings = baselineReview.findings.filter((finding) => finding.category === "team_convention");
  const baselineCitations = new Set(baselineReview.findings.flatMap((finding) => finding.evidence_ids));
  const expectedContentChecks = {
    memory_retrieved_validated_source: validatedEvidence.length > 0,
    memory_produced_grounded_team_finding: memoryTeamFindings.length > 0
      && memoryCitations.size > 0
      && [...memoryCitations].every((decisionId) => validatedDecisionIds.has(decisionId)),
    baseline_has_no_memory_citations: baselineCitations.size === 0,
    baseline_has_no_team_policy_finding: baselineTeamFindings.length === 0,
  };
  if (Object.entries(expectedContentChecks).some(([key, value]) => checks[key] !== value)) return null;
  const memoryRunId = normalizeRunId(runIds.memory);
  const baselineRunId = normalizeRunId(runIds.baseline);
  if (!memoryRunId || memoryRunId !== memoryReview.run_id
    || !baselineRunId || baselineRunId !== baselineReview.run_id) return null;
  return {
    evaluation: {
      passed,
      checks,
      counts,
      run_ids: { memory: memoryRunId, baseline: baselineRunId },
    },
    memory: memoryReview,
    baseline: baselineReview,
  };
}

function comparisonFromJob(job: ReviewJob & Record<string, unknown>, expectedPrId: string): { present: boolean; comparison: Comparison | null } {
  if (job.comparison != null) {
    return { present: true, comparison: normalizeComparison(job.comparison, expectedPrId) };
  }
  const present = job.evaluation != null || job.memory != null || job.baseline != null;
  return { present, comparison: present ? normalizeComparison(job, expectedPrId) : null };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function jobIdFrom(value: unknown): string {
  const jobId = asString(value) ?? "";
  return SAFE_JOB_ID.test(jobId) ? jobId : "";
}

async function pollReviewJob(
  jobId: string,
  onStage?: (stage: string) => void,
  shouldContinue: () => boolean = () => true,
  onTiming?: (timing: JobTiming) => void,
): Promise<(ReviewJob & Record<string, unknown>) | null> {
  let consecutiveFailures = 0;
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    if (!shouldContinue()) return null;
    let job: ReviewJob & Record<string, unknown>;
    try {
      job = await requestJobRead<ReviewJob & Record<string, unknown>>(`/api/review-jobs/${jobId}`);
      consecutiveFailures = 0;
    } catch (reason) {
      if (!isTransientRequestError(reason)) throw reason;
      if (consecutiveFailures >= POLL_RETRY_DELAYS_MS.length) {
        throw new PollingUnavailableError(
          reason instanceof Error ? reason.message : "The job status is temporarily unavailable.",
        );
      }
      onStage?.("reconnecting");
      const retryDelay = POLL_RETRY_DELAYS_MS[consecutiveFailures];
      consecutiveFailures += 1;
      await delay(retryDelay);
      continue;
    }
    if (!shouldContinue()) return null;
    onTiming?.(jobTimingFrom(job));
    if (job.stage) onStage?.(job.stage);
    if (job.status === "complete" || job.status === "completed" || job.status === "failed") return job;
    await delay(POLL_DELAY_MS);
  }
  throw new Error("The review timed out before it finished.");
}

export class TerminalJobError extends Error {}
export class MissingJobError extends TerminalJobError {}
export class PollingUnavailableError extends Error {}
export class CreationOutcomeUnknownError extends Error {}
export class InvalidReviewResultError extends Error {}
export class InvalidComparisonResultError extends Error {}
export class InvalidPullRequestError extends Error {}
export class InvalidRepositoryCatalogError extends Error {}
export class InvalidPullRequestCatalogError extends Error {}
export class InvalidDecisionCatalogError extends Error {}
export class InvalidEvidenceResponseError extends Error {}

function jobFailure(job: ReviewJob, fallback: string): TerminalJobError {
  const code = job.error_code?.trim();
  return new TerminalJobError(code ? `${fallback} (${code}).` : fallback);
}

async function reconcileTimedOutCreation(prId: string, kind: "review" | "comparison"): Promise<StartedJob> {
  for (const delayMs of CREATION_RECONCILE_DELAYS_MS) {
    if (delayMs > 0) await delay(delayMs);
    try {
      const active = await api.activeJob(prId, kind);
      if (active) return { ...active, reused: true };
    } catch {
      // A later bounded read may still observe the backend's atomic claim.
    }
  }
  throw new CreationOutcomeUnknownError(
    `The ${kind} creation response was lost and no active job is visible yet. Use Check creation status before trying again.`,
  );
}

export const api = {
  health: async (signal?: AbortSignal) => normalizeHealth(await request<unknown>("/api/health", { signal })),
  repositories: async () => normalizeRepositoryCatalog(await request<unknown>("/api/repositories")),
  evaluationCases: async () => unwrapRecords(await request<unknown>("/api/evaluation-cases")).flatMap((row) => {
    const item = normalizeEvaluationCase(row);
    return item ? [item] : [];
  }),
  summary: async (repositoryId: string) => normalizeSummary(await request<unknown>(`/api/repositories/${repositoryId}/summary`)),
  prs: async (repositoryId: string) => normalizePullRequestCatalog(await request<unknown>(`/api/repositories/${repositoryId}/prs`)),
  pr: async (prId: string, repositoryId: string) => {
    const pullRequest = normalizePullRequest(await request<unknown>(`/api/prs/${prId}`));
    if (!pullRequest) {
      throw new InvalidPullRequestError("The pull request failed payload validation.");
    }
    if (pullRequest.id !== prId || pullRequest.repository_id !== repositoryId) {
      throw new InvalidPullRequestError("The pull request does not belong to this repository.");
    }
    return pullRequest;
  },
  decisions: async (repositoryId: string) => normalizeDecisionCatalog(
    await request<unknown>(`/api/repositories/${repositoryId}/decisions`),
    repositoryId,
  ),
  decision: async (decisionId: string) => normalizeDecision(asRecord(await request<unknown>(`/api/decisions/${decisionId}`))),
  lineage: async (decisionId: string) => normalizeLineage(await request<unknown>(`/api/decisions/${decisionId}/lineage`), decisionId),
  latestReview: async (prId: string, repositoryId: string, repositorySlug: string, mode: "memory" | "baseline" = "memory") => {
    const payload = await requestJobRead<unknown>(`/api/prs/${prId}/reviews/latest?mode=${mode}`);
    const row = isRecord(payload) ? payload : {};
    if (row.review == null) return null;
    if (!isRecord(row.review)) {
      throw new InvalidReviewResultError("The stored review failed correlation validation.");
    }
    const review = normalizeReviewForPr(row.review, prId, repositoryId, repositorySlug, mode);
    if (!review) {
      throw new InvalidReviewResultError("The stored review failed correlation validation.");
    }
    return review;
  },
  latestComparison: async (prId: string) => {
    const payload = await requestJobRead<unknown>(`/api/prs/${prId}/comparisons/latest`);
    const row = isRecord(payload) ? payload : {};
    if (row.comparison == null) return null;
    const comparison = normalizeComparison(row.comparison, prId);
    if (!comparison) {
      throw new InvalidComparisonResultError("The stored comparison failed correlation validation.");
    }
    return comparison;
  },
  activeJob: async (prId: string, kind: "review" | "comparison") => {
    const payload = await requestJobRead<unknown>(`/api/prs/${prId}/review-jobs/active?kind=${kind}`);
    const row = isRecord(payload) ? payload : {};
    const jobId = jobIdFrom(row.job_id);
    return jobId ? { jobId, ...jobTimingFrom(row) } satisfies ActiveJob : null;
  },
  repositoryActiveJobs: async (repositoryId: string) => {
    const rows = unwrapRecords(
      await requestJobRead<unknown>(`/api/repositories/${repositoryId}/review-jobs/active`),
    );
    return rows.flatMap((row): RepositoryActiveJob[] => {
      const jobId = jobIdFrom(row.job_id);
      const kind = row.kind === "review" || row.kind === "comparison" ? row.kind : null;
      const status = row.status === "queued" || row.status === "running" ? row.status : null;
      const prNumber = asNumber(row.pr_number);
      const prId = asString(row.pr_id)?.trim();
      const prTitle = asString(row.pr_title)?.trim();
      const stage = asString(row.stage)?.trim();
      if (!jobId || !kind || !status || !prId || !prTitle || prNumber === undefined || !stage) return [];
      return [{
        jobId,
        prId,
        prNumber,
        prTitle,
        kind,
        status,
        stage,
        ...jobTimingFrom(row),
      }];
    });
  },
  async startReview(prId: string, memoryEnabled: boolean) {
    let created: ReviewJob & { reused?: boolean };
    try {
      created = await requestCreation<ReviewJob & { reused?: boolean }>(`/api/prs/${prId}/review-jobs`, {
        method: "POST",
        body: JSON.stringify({ memory_enabled: memoryEnabled }),
      });
    } catch (reason) {
      if (reason instanceof CreationResponseTimeoutError) return reconcileTimedOutCreation(prId, "review");
      throw reason;
    }
    const jobId = jobIdFrom(created.job_id || created.id);
    if (!jobId) throw new Error("The review did not return a job.");
    return { jobId, reused: created.reused === true, ...jobTimingFrom(created) } satisfies StartedJob;
  },
  async reviewJob(jobId: string, expectedPrId: string, expectedRepositoryId: string, expectedRepositorySlug: string, expectedMode: "memory" | "baseline" | undefined, onStage?: (stage: string) => void, shouldContinue?: () => boolean, onTiming?: (timing: JobTiming) => void) {
    let job: (ReviewJob & Record<string, unknown>) | null;
    try {
      job = await pollReviewJob(jobId, onStage, shouldContinue, onTiming);
    } catch (reason) {
      if (reason instanceof ApiRequestError && reason.status === 404) {
        throw new MissingJobError("The active review is no longer available.");
      }
      throw reason;
    }
    if (!job) return null;
    if (job.status === "failed") throw jobFailure(job, "The review failed");
    if (!isRecord(job.review)) throw new TerminalJobError("The review finished without a result.");
    const review = normalizeReviewForPr(job.review, expectedPrId, expectedRepositoryId, expectedRepositorySlug, expectedMode);
    if (!review) {
      throw new TerminalJobError("The review finished with invalid correlation metadata.");
    }
    return review;
  },
  async review(prId: string, repositoryId: string, repositorySlug: string, memoryEnabled: boolean, onStage?: (stage: string) => void, shouldContinue?: () => boolean) {
    const started = await api.startReview(prId, memoryEnabled);
    return api.reviewJob(started.jobId, prId, repositoryId, repositorySlug, memoryEnabled ? "memory" : "baseline", onStage, shouldContinue);
  },
  evidence: async (runId: string, repositoryId: string, expectedDecisionIds: string[]) => {
    const payload = await request<unknown>(`/api/reviews/${runId}/evidence`);
    return normalizeEvidenceResponse(payload, runId, repositoryId, expectedDecisionIds);
  },
  feedback: async (findingId: string, action: string, reason: string) => {
    const payload = await request<unknown>(`/api/findings/${findingId}/feedback`, {
      method: "POST",
      body: JSON.stringify({
        action,
        reason,
        actor_label: "demo-reviewer",
        confirm_as_policy: false,
      }),
    });
    const row = isRecord(payload) ? payload : {};
    return { id: String(row.id ?? ""), binding: row.binding === true };
  },
  async startComparison(prId: string) {
    let created: ReviewJob & Record<string, unknown>;
    try {
      created = await requestCreation<ReviewJob & Record<string, unknown>>(`/api/prs/${prId}/comparison`, { method: "POST" });
    } catch (reason) {
      if (reason instanceof CreationResponseTimeoutError) return reconcileTimedOutCreation(prId, "comparison");
      throw reason;
    }
    const jobId = jobIdFrom(created.job_id || created.id);
    if (!jobId) throw new Error("The comparison did not return a job.");
    return { jobId, reused: created.reused === true, ...jobTimingFrom(created) } satisfies StartedJob;
  },
  async comparisonJob(jobId: string, expectedPrId: string, onStage?: (stage: string) => void, shouldContinue?: () => boolean, onTiming?: (timing: JobTiming) => void) {
    let job: (ReviewJob & Record<string, unknown>) | null;
    try {
      job = await pollReviewJob(jobId, onStage, shouldContinue, onTiming);
    } catch (reason) {
      if (reason instanceof ApiRequestError && reason.status === 404) {
        throw new MissingJobError("The active comparison is no longer available.");
      }
      throw reason;
    }
    if (!job) return null;
    if (job.status === "failed") throw jobFailure(job, "The comparison failed");
    const result = comparisonFromJob(job, expectedPrId);
    if (!result.present) throw new TerminalJobError("The comparison finished without a result.");
    if (!result.comparison) {
      throw new TerminalJobError("The comparison finished with invalid correlation metadata.");
    }
    return result.comparison;
  },
  async comparison(prId: string, onStage?: (stage: string) => void, shouldContinue?: () => boolean) {
    const started = await api.startComparison(prId);
    return api.comparisonJob(started.jobId, prId, onStage, shouldContinue);
  },
};

function normalizeHealth(payload: unknown): Health {
  const row = isRecord(payload) ? payload : {};
  const hindsight = row.hindsight === "ready" || row.hindsight === "starting" || row.hindsight === "unavailable" ? row.hindsight : undefined;
  return {
    status: asString(row.status),
    memory: asString(row.memory),
    hindsight,
    interrupted_jobs: asNumber(row.interrupted_jobs),
  };
}

function normalizeRepository(raw: Record<string, unknown>): Repository | null {
  const id = asString(raw.id)?.trim();
  const slug = asString(raw.slug)?.trim();
  const displayName = asString(raw.display_name)?.trim();
  if (!id || id.length > MAX_REPOSITORY_ID_LENGTH || !SAFE_REPOSITORY_ID.test(id)
    || !slug || slug.length > MAX_REPOSITORY_SLUG_LENGTH || !SAFE_REPOSITORY_SLUG.test(slug)
    || !displayName || displayName.length > MAX_REPOSITORY_NAME_LENGTH) return null;
  return { id, slug, display_name: displayName };
}

function normalizeRepositoryCatalog(payload: unknown): Repository[] {
  const rows = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.items) ? payload.items : null;
  if (!rows || !rows.every(isRecord)) {
    throw new InvalidRepositoryCatalogError("The repository catalog failed identity validation.");
  }
  const repositories = rows.map(normalizeRepository);
  if (repositories.some((repository) => repository === null)) {
    throw new InvalidRepositoryCatalogError("The repository catalog failed identity validation.");
  }
  const valid = repositories as Repository[];
  if (new Set(valid.map((repository) => repository.id)).size !== valid.length
    || new Set(valid.map((repository) => repository.slug)).size !== valid.length) {
    throw new InvalidRepositoryCatalogError("The repository catalog failed identity validation.");
  }
  return valid;
}

function normalizeEvaluationCase(raw: Record<string, unknown>): EvaluationCase | null {
  const repositoryId = asString(raw.repository_id)?.trim();
  const repositoryName = asString(raw.repository_name)?.trim();
  const sourcePrId = asString(raw.source_pr_id)?.trim();
  const sourcePrNumber = asNumber(raw.source_pr_number);
  const candidatePrId = asString(raw.candidate_pr_id)?.trim();
  const candidatePrNumber = asNumber(raw.candidate_pr_number);
  const decisionId = asString(raw.decision_id)?.trim();
  const decisionStatus = asString(raw.decision_status)?.trim();
  if (!repositoryId || !repositoryName || !sourcePrId || !sourcePrNumber || !candidatePrId || !candidatePrNumber || !decisionId || !decisionStatus) return null;

  const evaluation = isRecord(raw.latest_evaluation) ? raw.latest_evaluation : null;
  let latestEvaluation: EvaluationCase["latest_evaluation"] = null;
  if (evaluation) {
    const jobId = jobIdFrom(evaluation.job_id);
    const passedChecks = asNumber(evaluation.passed_checks);
    const totalChecks = asNumber(evaluation.total_checks);
    if (jobId && typeof evaluation.passed === "boolean" && passedChecks !== undefined && totalChecks !== undefined && passedChecks >= 0 && totalChecks > 0 && passedChecks <= totalChecks) {
      latestEvaluation = {
        job_id: jobId,
        passed: evaluation.passed,
        passed_checks: passedChecks,
        total_checks: totalChecks,
        updated_at: normalizeJobTimestamp(evaluation.updated_at),
      };
    }
  }
  return {
    repository_id: repositoryId,
    repository_name: repositoryName,
    source_pr_id: sourcePrId,
    source_pr_number: sourcePrNumber,
    candidate_pr_id: candidatePrId,
    candidate_pr_number: candidatePrNumber,
    decision_id: decisionId,
    decision_status: decisionStatus,
    latest_evaluation: latestEvaluation,
  };
}

function normalizeSummary(payload: unknown): Summary {
  const row = isRecord(payload) ? payload : {};
  const hindsight = row.hindsight === "ready" || row.hindsight === "starting" || row.hindsight === "unavailable" ? row.hindsight : undefined;
  return {
    repository_id: asString(row.repository_id),
    slug: asString(row.slug),
    display_name: asString(row.display_name),
    pr_count: asNumber(row.pr_count),
    decision_count: asNumber(row.decision_count),
    active_decisions: asNumber(row.active_decisions),
    superseded_decisions: asNumber(row.superseded_decisions),
    pending_decisions: asNumber(row.pending_decisions),
    review_run_count: asNumber(row.review_run_count),
    hindsight,
  };
}

function normalizePullRequestSummary(raw: Record<string, unknown>): PullRequestSummary | null {
  const id = asString(raw.id)?.trim();
  const number = asNumber(raw.number);
  const title = asString(raw.title)?.trim();
  const createdAt = raw.created_at == null ? undefined : normalizeJobTimestamp(raw.created_at);
  if (!id || id.length > MAX_PULL_REQUEST_ID_LENGTH || !SAFE_REPOSITORY_ID.test(id)
    || number === undefined || !Number.isInteger(number) || number < 1
    || !title || title.length > MAX_PULL_REQUEST_TITLE_LENGTH
    || (raw.created_at != null && createdAt === undefined)) return null;
  return { id, number, title, created_at: createdAt };
}

function normalizePullRequestCatalog(payload: unknown): PullRequestSummary[] {
  const rows = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.items) ? payload.items : null;
  if (!rows || !rows.every(isRecord)) {
    throw new InvalidPullRequestCatalogError("The pull-request catalog failed identity validation.");
  }
  const pullRequests = rows.map(normalizePullRequestSummary);
  if (pullRequests.some((pullRequest) => pullRequest === null)) {
    throw new InvalidPullRequestCatalogError("The pull-request catalog failed identity validation.");
  }
  const valid = pullRequests as PullRequestSummary[];
  if (new Set(valid.map((pullRequest) => pullRequest.id)).size !== valid.length
    || new Set(valid.map((pullRequest) => pullRequest.number)).size !== valid.length) {
    throw new InvalidPullRequestCatalogError("The pull-request catalog failed identity validation.");
  }
  return valid;
}

function normalizePullRequest(payload: unknown): PullRequest | null {
  if (!isRecord(payload)) return null;
  const id = asString(payload.id)?.trim();
  const repositoryId = asString(payload.repository_id)?.trim();
  const number = asNumber(payload.number);
  const title = asString(payload.title)?.trim();
  const description = asString(payload.description);
  const diffText = asString(payload.diff_text);
  const createdAt = payload.created_at == null ? undefined : normalizeJobTimestamp(payload.created_at);
  if (!id || id.length > MAX_PULL_REQUEST_ID_LENGTH || !SAFE_REPOSITORY_ID.test(id)
    || !repositoryId || repositoryId.length > MAX_REPOSITORY_ID_LENGTH || !SAFE_REPOSITORY_ID.test(repositoryId)
    || number === undefined || !Number.isInteger(number) || number < 1
    || !title || title.length > MAX_PULL_REQUEST_TITLE_LENGTH
    || description === undefined || description.length > MAX_PULL_REQUEST_DESCRIPTION_LENGTH
    || diffText === undefined || new TextEncoder().encode(diffText).length > MAX_DIFF_BYTES || !isValidUnifiedDiff(diffText)
    || (payload.created_at != null && createdAt === undefined)) return null;
  return {
    id,
    repository_id: repositoryId,
    number,
    title,
    description,
    diff_text: diffText,
    created_at: createdAt,
  };
}

function normalizeLineage(payload: unknown, decisionId: string): Lineage {
  if (Array.isArray(payload)) {
    return { decision_id: decisionId, items: payload.filter(isRecord).map(normalizeLineageItem) };
  }
  const row = isRecord(payload) ? payload : {};
  const items = Array.isArray(row.items) ? row.items.filter(isRecord).map(normalizeLineageItem) : [];
  return { decision_id: String(row.decision_id ?? decisionId), items };
}

function asRecord(payload: unknown): Record<string, unknown> {
  return isRecord(payload) ? payload : {};
}
