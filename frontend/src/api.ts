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
  async review(prId: string, memoryEnabled: boolean) {
    const created = await request<{ run_id: string }>(`/api/prs/${prId}/reviews`, {
      method: "POST",
      body: JSON.stringify({ memory_enabled: memoryEnabled })
    });
    return request<Review>(`/api/reviews/${created.run_id}`);
  },
  evidence: (runId: string) => request<{ decisions: Decision[] }>(`/api/reviews/${runId}/evidence`)
};
