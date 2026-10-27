export type HindsightState = "starting" | "ready" | "unavailable";

export type Health = {
  status?: string;
  memory?: string;
  hindsight?: HindsightState;
};

export type Repository = {
  id: string;
  slug: string;
  display_name: string;
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
    passed?: boolean;
    checks: Record<string, boolean>;
    counts?: Record<string, number>;
    run_ids?: { memory?: string; baseline?: string };
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
};

export type FeedbackResult = {
  id: string;
  binding: boolean;
};

const API_ROOT = import.meta.env.VITE_API_URL ?? "";
const POLL_ATTEMPTS = 360;
const POLL_DELAY_MS = 1000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function asNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
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
    throw new Error(detail || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
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
    run_id: String(raw.run_id ?? ""),
    status: String(raw.status ?? ""),
    mode,
    model: asString(raw.model),
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

function normalizeComparison(raw: unknown): Comparison | null {
  if (!isRecord(raw)) return null;
  const evaluation = isRecord(raw.evaluation) ? raw.evaluation : null;
  const memory = isRecord(raw.memory) ? raw.memory : null;
  const baseline = isRecord(raw.baseline) ? raw.baseline : null;
  if (!evaluation || !memory || !baseline) return null;
  const checks: Record<string, boolean> = {};
  if (isRecord(evaluation.checks)) {
    for (const [key, value] of Object.entries(evaluation.checks)) {
      if (typeof value === "boolean") checks[key] = value;
    }
  }
  const counts: Record<string, number> = {};
  if (isRecord(evaluation.counts)) {
    for (const [key, value] of Object.entries(evaluation.counts)) {
      if (typeof value === "number") counts[key] = value;
    }
  }
  const runIds = isRecord(evaluation.run_ids) ? evaluation.run_ids : undefined;
  return {
    evaluation: {
      passed: typeof evaluation.passed === "boolean" ? evaluation.passed : undefined,
      checks,
      counts: Object.keys(counts).length > 0 ? counts : undefined,
      run_ids: runIds
        ? {
            memory: asString(runIds.memory),
            baseline: asString(runIds.baseline),
          }
        : undefined,
    },
    memory: normalizeReview(memory),
    baseline: normalizeReview(baseline),
  };
}

function comparisonFromJob(job: ReviewJob & Record<string, unknown>): Comparison | null {
  return normalizeComparison(job.comparison) ?? normalizeComparison(job);
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function pollReviewJob(
  jobId: string,
  onStage?: (stage: string) => void,
  shouldContinue: () => boolean = () => true,
): Promise<(ReviewJob & Record<string, unknown>) | null> {
  for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt += 1) {
    if (!shouldContinue()) return null;
    const job = await request<ReviewJob & Record<string, unknown>>(`/api/review-jobs/${jobId}`);
    if (!shouldContinue()) return null;
    if (job.stage) onStage?.(job.stage);
    if (job.status === "complete" || job.status === "completed" || job.status === "failed") return job;
    await delay(POLL_DELAY_MS);
  }
  throw new Error("The review timed out before it finished.");
}

function jobFailure(job: ReviewJob, fallback: string): Error {
  const code = job.error_code?.trim();
  return new Error(code ? `${fallback} (${code}).` : fallback);
}

export const api = {
  health: async () => normalizeHealth(await request<unknown>("/api/health")),
  repositories: async () => unwrapRecords(await request<unknown>("/api/repositories")).map(normalizeRepository),
  summary: async (repositoryId: string) => normalizeSummary(await request<unknown>(`/api/repositories/${repositoryId}/summary`)),
  prs: async (repositoryId: string) => unwrapRecords(await request<unknown>(`/api/repositories/${repositoryId}/prs`)).map(normalizePullRequestSummary),
  pr: async (prId: string) => normalizePullRequest(await request<unknown>(`/api/prs/${prId}`)),
  decisions: async (repositoryId: string) => unwrapRecords(await request<unknown>(`/api/repositories/${repositoryId}/decisions`)).map(normalizeDecision),
  decision: async (decisionId: string) => normalizeDecision(asRecord(await request<unknown>(`/api/decisions/${decisionId}`))),
  lineage: async (decisionId: string) => normalizeLineage(await request<unknown>(`/api/decisions/${decisionId}/lineage`), decisionId),
  latestReview: async (prId: string, mode: "memory" | "baseline" = "memory") => {
    const payload = await request<unknown>(`/api/prs/${prId}/reviews/latest?mode=${mode}`);
    const row = isRecord(payload) ? payload : {};
    return isRecord(row.review) ? normalizeReview(row.review) : null;
  },
  async review(prId: string, memoryEnabled: boolean, onStage?: (stage: string) => void, shouldContinue?: () => boolean) {
    const created = await request<ReviewJob>(`/api/prs/${prId}/review-jobs`, {
      method: "POST",
      body: JSON.stringify({ memory_enabled: memoryEnabled }),
    });
    const jobId = created.job_id || created.id;
    if (!jobId) throw new Error("The review did not return a job.");
    const job = await pollReviewJob(jobId, onStage, shouldContinue);
    if (!job) return null;
    if (job.status === "failed") throw jobFailure(job, "The review failed");
    if (!isRecord(job.review)) throw new Error("The review finished without a result.");
    return normalizeReview(job.review);
  },
  evidence: async (runId: string) => {
    const payload = await request<unknown>(`/api/reviews/${runId}/evidence`);
    const decisions = isRecord(payload) ? unwrapRecords(payload.decisions ?? payload) : unwrapRecords(payload);
    return { decisions: decisions.map(normalizeDecision) };
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
  async comparison(prId: string, onStage?: (stage: string) => void, shouldContinue?: () => boolean) {
    const created = await request<ReviewJob & Record<string, unknown>>(`/api/prs/${prId}/comparison`, { method: "POST" });
    const jobId = asString(created.job_id) || asString(created.id);
    if (jobId) {
      const job = await pollReviewJob(jobId, onStage, shouldContinue);
      if (!job) return null;
      if (job.status === "failed") throw jobFailure(job, "The comparison failed");
      const comparison = comparisonFromJob(job);
      if (!comparison) throw new Error("The comparison finished without a result.");
      return comparison;
    }
    const immediate = comparisonFromJob(created);
    if (immediate) return immediate;
    throw new Error("The comparison did not start.");
  },
};

function normalizeHealth(payload: unknown): Health {
  const row = isRecord(payload) ? payload : {};
  const hindsight = row.hindsight === "ready" || row.hindsight === "starting" || row.hindsight === "unavailable" ? row.hindsight : undefined;
  return {
    status: asString(row.status),
    memory: asString(row.memory),
    hindsight,
  };
}

function normalizeRepository(raw: Record<string, unknown>): Repository {
  const id = String(raw.id ?? "");
  const slug = String(raw.slug ?? "");
  return {
    id,
    slug,
    display_name: String(raw.display_name ?? slug ?? id ?? "Repository"),
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

function normalizePullRequestSummary(raw: Record<string, unknown>): PullRequestSummary {
  return {
    id: String(raw.id ?? ""),
    number: asNumber(raw.number) ?? 0,
    title: String(raw.title ?? ""),
    created_at: asString(raw.created_at),
  };
}

function normalizePullRequest(payload: unknown): PullRequest {
  const raw = asRecord(payload);
  return {
    ...normalizePullRequestSummary(raw),
    repository_id: String(raw.repository_id ?? ""),
    description: String(raw.description ?? ""),
    diff_text: String(raw.diff_text ?? ""),
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
