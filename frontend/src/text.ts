import type { PullRequestSummary, Timings } from "./api";

export const DEFAULT_REPO_ID = "repo-acme-commerce";
export const DEFAULT_PR_ID = "pr-acme-87";
export const ANALYTICS_EVALUATION_PR_ID = "pr-analytics-29";

export type FeedbackChoice = "not_applicable" | "incorrect" | "outdated" | "other";

export const FEEDBACK_CHOICES: { id: FeedbackChoice; label: string; action: "not_applicable" | "rejected" | "corrected" }[] = [
  { id: "not_applicable", label: "Not applicable to this change", action: "not_applicable" },
  { id: "incorrect", label: "Incorrect historical evidence", action: "rejected" },
  { id: "outdated", label: "Outdated team convention", action: "rejected" },
  { id: "other", label: "Other reason", action: "corrected" },
];

const STAGES: Record<string, string> = {
  queued: "Review queued",
  starting_hindsight: "Preparing memory",
  recalling_and_reviewing: "Recalling team design and reviewing the diff",
  reviewing_diff: "Reviewing the diff",
  complete: "Review complete",
  completed: "Review complete",
  failed: "The review failed",
};

export const TRACE_STEPS: { key: keyof Timings; title: string; detail: string }[] = [
  { key: "query", title: "Query prepared", detail: "Diff and review context prepared" },
  { key: "recall", title: "Hindsight recall", detail: "Memory recall finished" },
  { key: "validation", title: "Decisions validated", detail: "Citations checked against stored decisions" },
  { key: "generation", title: "Review generated", detail: "Review response generated" },
];

export function feedbackPayload(choice: FeedbackChoice, note: string): { action: string; reason: string } {
  const item = FEEDBACK_CHOICES.find((entry) => entry.id === choice);
  if (!item) throw new Error("Choose a reason.");
  const extra = note.trim();
  return { action: item.action, reason: extra ? `${item.label}: ${extra}` : item.label };
}

export function bindingCopy(binding: boolean): string {
  return binding
    ? "Saved as binding policy."
    : "Saved as non-binding feedback. This does not change the active design.";
}

export function stageLabel(stage?: string | null): string {
  if (!stage) return "Review in progress";
  return STAGES[stage] ?? stage.replaceAll("_", " ");
}

export function memoryState(hindsight?: string | null): "ready" | "unavailable" | "starting" {
  if (hindsight === "ready" || hindsight === "unavailable") return hindsight;
  return "starting";
}

export function memoryLabel(hindsight?: string | null): string {
  const state = memoryState(hindsight);
  if (state === "ready") return "Memory connected";
  if (state === "unavailable") return "Memory unavailable";
  return "Preparing memory";
}

export function designStatus(status?: string | null): string {
  if (status === "active") return "Current design";
  if (status === "superseded") return "Previous design";
  if (status === "proposed") return "Pending confirmation";
  if (status === "revoked") return "Revoked";
  return status || "Unknown";
}

export function sourceLabel(
  item: { source_pr_number?: number | null; source_pr_id?: string | null },
  prs: { id: string; number: number }[] = [],
): string | null {
  if (typeof item.source_pr_number === "number") return `PR #${item.source_pr_number}`;
  const match = prs.find((pr) => pr.id === item.source_pr_id);
  if (match) return `PR #${match.number}`;
  if (item.source_pr_id) return item.source_pr_id;
  return null;
}

export function formatWhen(value?: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

export function formatScope(scope: unknown): string | null {
  if (scope == null || scope === "") return null;
  if (typeof scope === "string") return scope;
  if (Array.isArray(scope)) return scope.map(String).join(", ");
  if (typeof scope === "object") {
    return Object.entries(scope as Record<string, unknown>)
      .map(([key, value]) => `${key}: ${Array.isArray(value) ? value.map(String).join(", ") : String(value)}`)
      .join(" · ");
  }
  return String(scope);
}

export function formatSeconds(ms: number): string {
  return `${(ms / 1000).toFixed(1)}s`;
}

export function humanize(value: string): string {
  return value.replaceAll("_", " ");
}

export function statValue(value: number | undefined): string {
  return typeof value === "number" ? String(value) : "—";
}

export function preferredPullRequestId(prs: PullRequestSummary[], repoId: string): string {
  const targetId = repoId === "repo-analytics-service" ? ANALYTICS_EVALUATION_PR_ID : DEFAULT_PR_ID;
  const targetNumber = repoId === "repo-analytics-service" ? 29 : 87;
  const match = prs.find((item) => item.id === targetId || item.number === targetNumber);
  if (match) return match.id;
  if (prs[0]) return prs[0].id;
  if (repoId === DEFAULT_REPO_ID) return DEFAULT_PR_ID;
  return "";
}

export function recentPullRequests(items: PullRequestSummary[]): PullRequestSummary[] {
  return [...items].sort((left, right) => {
    const leftTime = Date.parse(left.created_at ?? "");
    const rightTime = Date.parse(right.created_at ?? "");
    if (!Number.isNaN(leftTime) && !Number.isNaN(rightTime) && leftTime !== rightTime) return rightTime - leftTime;
    return right.number - left.number;
  });
}

export function traceSteps(timings?: Timings | null): { key: keyof Timings; title: string; detail: string; ms: number; step: number }[] {
  if (!timings) return [];
  return TRACE_STEPS.flatMap((step, index) => {
    const ms = timings[step.key];
    return typeof ms === "number" ? [{ ...step, ms, step: index + 1 }] : [];
  });
}

export function isTeamFinding(category?: string | null): boolean {
  return category === "team_convention";
}
