export type Repository = { id: string; slug: string; display_name: string };
export type PullRequestSummary = { id: string; number: number; title: string; created_at: string };
export type PullRequest = PullRequestSummary & { repository_id: string; description: string; diff_text: string };
export type Decision = {
  id: string;
  title: string;
  rule_text: string;
  rationale: string;
  status: string;
  authority: string;
  source_pr_id: string;
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
  model: string;
  elapsed_ms: number;
  retrieval: { query?: string | null; validated_evidence?: Array<Record<string, unknown>> };
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

const API_ROOT = import.meta.env.VITE_API_URL ?? "";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_ROOT}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) }
  });
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  repositories: () => request<Repository[]>("/api/repositories"),
  prs: (repositoryId: string) => request<PullRequestSummary[]>(`/api/repositories/${repositoryId}/prs`),
  pr: (prId: string) => request<PullRequest>(`/api/prs/${prId}`),
  decisions: (repositoryId: string) => request<Decision[]>(`/api/repositories/${repositoryId}/decisions`),
  async review(prId: string, memoryEnabled: boolean, onProgress?: (stage: string) => void) {
    const created = await request<{ job_id: string }>(`/api/prs/${prId}/review-jobs`, {
      method: "POST",
      body: JSON.stringify({ memory_enabled: memoryEnabled })
    });
    for (let attempt = 0; attempt < 360; attempt += 1) {
      const job = await request<{ status: string; stage: string; error_code: string | null; review?: Review }>(`/api/review-jobs/${created.job_id}`);
      onProgress?.(job.stage);
      if (job.status === "complete" && job.review) return job.review;
      if (job.status === "failed") throw new Error(job.error_code ?? "Review failed");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    throw new Error("Review timed out after 6 minutes");
  },
  evidence: (runId: string) => request<{ decisions: Decision[] }>(`/api/reviews/${runId}/evidence`),
  feedback: (findingId: string, action: string, reason: string) => request<{ id: string; binding: boolean }>(`/api/findings/${findingId}/feedback`, {
    method: "POST",
    body: JSON.stringify({ action, reason, actor_label: "demo-reviewer", confirm_as_policy: false })
  }),
  comparison: (prId: string) => request<Comparison>(`/api/prs/${prId}/comparison`, { method: "POST" })
};
