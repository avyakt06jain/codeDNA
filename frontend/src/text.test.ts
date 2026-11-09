import { describe, expect, it } from "vitest";
import { normalizeComparison, normalizeJobTimestamp, normalizeReview, normalizeRunId } from "./api";
import { JOB_STALE_AFTER_MS, isStaleJob } from "./components/ActiveJobDetails";
import { bindingCopy, comparisonStageLabel, feedbackPayload, formatSeconds, memoryLabel, preferredPullRequestId, stageLabel, traceSteps } from "./text";

const comparisonChecks = (overrides: Record<string, boolean> = {}) => ({
  same_candidate: true,
  same_model: true,
  memory_retrieved_validated_source: true,
  memory_produced_grounded_team_finding: true,
  baseline_has_no_memory_citations: true,
  baseline_has_no_team_policy_finding: true,
  ...overrides,
});

describe("feedback reasons", () => {
  it("maps each dismiss choice to a stored action and keeps the label", () => {
    expect(feedbackPayload("not_applicable", "")).toEqual({ action: "not_applicable", reason: "Not applicable to this change" });
    expect(feedbackPayload("incorrect", "wrong pr")).toEqual({ action: "rejected", reason: "Incorrect historical evidence: wrong pr" });
    expect(feedbackPayload("outdated", "")).toEqual({ action: "rejected", reason: "Outdated team convention" });
    expect(feedbackPayload("other", "wording")).toEqual({ action: "corrected", reason: "Other reason: wording" });
  });

  it("describes a false binding flag as non-binding", () => {
    expect(bindingCopy(false)).toMatch(/non-binding/i);
    expect(bindingCopy(false)).toMatch(/does not change the active design/i);
  });
});

describe("memory and timings", () => {
  it("accepts only parseable job timestamps", () => {
    expect(normalizeJobTimestamp("2026-10-30T06:05:00Z")).toBe("2026-10-30T06:05:00.000Z");
    expect(normalizeJobTimestamp("not-a-time")).toBeUndefined();
    expect(normalizeJobTimestamp(123)).toBeUndefined();
  });

  it("accepts only bounded review run identifiers", () => {
    expect(normalizeRunId("review-06a7ee6cdd874e6d")).toBe("review-06a7ee6cdd874e6d");
    expect(normalizeRunId("run-memory_1")).toBe("run-memory_1");
    expect(normalizeRunId("<script>alert(1)</script>")).toBe("");
    expect(normalizeRunId(`run-${"a".repeat(101)}`)).toBe("");
    expect(normalizeReview({ run_id: "invalid id", findings: [] }).run_id).toBe("");
  });

  it("fails closed when comparison run correlation metadata is malformed or mismatched", () => {
    const emptyContentChecks = comparisonChecks({
      memory_retrieved_validated_source: false,
      memory_produced_grounded_team_finding: false,
    });
    const comparison = {
      evaluation: {
        passed: false,
        checks: emptyContentChecks,
        counts: {
          validated_memory_sources: 0,
          memory_findings: 0,
          memory_team_findings: 0,
          memory_citations: 0,
          baseline_findings: 0,
          baseline_team_findings: 0,
          baseline_citations: 0,
        },
        run_ids: { memory: "run-memory", baseline: "run-baseline" },
      },
      memory: { run_id: "run-memory", status: "complete", mode: "memory", pr_id: "pr-87", provider: "gemini", model: "gemini-test", findings: [] },
      baseline: { run_id: "run-baseline", status: "complete", mode: "baseline", pr_id: "pr-87", provider: "gemini", model: "gemini-test", findings: [] },
    };
    const evaluation = (overrides: Record<string, unknown> = {}) => ({ ...comparison.evaluation, ...overrides });
    expect(normalizeComparison(comparison)?.evaluation.run_ids).toEqual({ memory: "run-memory", baseline: "run-baseline" });
    expect(normalizeComparison({ ...comparison, evaluation: evaluation() })).not.toBeNull();
    expect(normalizeComparison({ ...comparison, evaluation: evaluation({ run_ids: "run-memory" }) })).toBeNull();
    expect(normalizeComparison({
      ...comparison,
      evaluation: evaluation({ run_ids: { memory: "run-other", baseline: "run-baseline" } }),
    })).toBeNull();
    expect(normalizeComparison({
      ...comparison,
      evaluation: evaluation({ run_ids: { memory: "<invalid>", baseline: "run-baseline" } }),
    })).toBeNull();
    expect(normalizeComparison({
      ...comparison,
      evaluation: evaluation(),
      memory: { ...comparison.memory, run_id: "invalid id" },
    })).toBeNull();
    expect(normalizeComparison({
      ...comparison,
      evaluation: evaluation(),
      baseline: { ...comparison.baseline, run_id: undefined },
    })).toBeNull();
    expect(normalizeComparison({
      ...comparison,
      memory: { ...comparison.memory, mode: "baseline" },
      baseline: { ...comparison.baseline, mode: "memory" },
    })).toBeNull();
    expect(normalizeComparison({
      ...comparison,
      baseline: { ...comparison.baseline, mode: undefined },
    })).toBeNull();
    expect(normalizeComparison({
      ...comparison,
      memory: { ...comparison.memory, status: "running" },
    })).toBeNull();
    expect(normalizeComparison({
      ...comparison,
      baseline: { ...comparison.baseline, status: "failed" },
    })).toBeNull();
    expect(normalizeComparison({
      ...comparison,
      baseline: { ...comparison.baseline, status: undefined },
    })).toBeNull();
    expect(normalizeComparison({
      ...comparison,
      evaluation: evaluation({ passed: false, checks: { ...emptyContentChecks, same_candidate: false } }),
    })).toBeNull();
    expect(normalizeComparison({
      ...comparison,
      evaluation: evaluation({ passed: true, checks: emptyContentChecks }),
    })).toBeNull();
    expect(normalizeComparison({
      ...comparison,
      evaluation: evaluation({ passed: false, checks: emptyContentChecks }),
    })?.evaluation.passed).toBe(false);
    const { same_model: _missing, ...partialChecks } = comparisonChecks();
    expect(normalizeComparison({
      ...comparison,
      evaluation: evaluation({ passed: false, checks: partialChecks }),
    })).toBeNull();
    expect(normalizeComparison({
      ...comparison,
      evaluation: evaluation({ passed: undefined }),
    })).toBeNull();
    expect(normalizeComparison({
      ...comparison,
      memory: { ...comparison.memory, pr_id: "pr-other" },
    })).toBeNull();
    expect(normalizeComparison(comparison, "pr-other")).toBeNull();
    expect(normalizeComparison(comparison, "pr-87")).not.toBeNull();
    expect(normalizeComparison({
      ...comparison,
      baseline: { ...comparison.baseline, provider: "other-provider" },
    })).toBeNull();
    expect(normalizeComparison({
      ...comparison,
      baseline: { ...comparison.baseline, model: "other-model" },
    })).toBeNull();
    expect(normalizeComparison({
      ...comparison,
      memory: { ...comparison.memory, pr_id: undefined },
    })).toBeNull();
    expect(normalizeComparison({
      ...comparison,
      evaluation: evaluation({ passed: false, checks: { ...emptyContentChecks, same_model: false } }),
    })).toBeNull();
    expect(normalizeComparison({
      ...comparison,
      evaluation: evaluation({
        passed: false,
        checks: { ...emptyContentChecks, memory_retrieved_validated_source: true },
      }),
    })).toBeNull();
    expect(normalizeComparison({
      ...comparison,
      evaluation: evaluation({ run_ids: undefined }),
    })).toBeNull();
    expect(normalizeComparison({
      ...comparison,
      evaluation: evaluation({ run_ids: { memory: "run-memory" } }),
    })).toBeNull();
    expect(normalizeComparison({
      ...comparison,
      evaluation: evaluation({ counts: undefined }),
    })).toBeNull();
    expect(normalizeComparison({
      ...comparison,
      evaluation: evaluation({ counts: { ...comparison.evaluation.counts, baseline_citations: -1 } }),
    })).toBeNull();
    expect(normalizeComparison({
      ...comparison,
      evaluation: evaluation({ counts: { ...comparison.evaluation.counts, memory_findings: 1 } }),
    })).toBeNull();
  });

  it("marks a job stale only after three minutes without an update", () => {
    const updated = Date.parse("2026-10-30T06:05:00Z");
    expect(isStaleJob("2026-10-30T06:05:00Z", updated + JOB_STALE_AFTER_MS - 1)).toBe(false);
    expect(isStaleJob("2026-10-30T06:05:00Z", updated + JOB_STALE_AFTER_MS)).toBe(true);
    expect(isStaleJob("not-a-time", updated + JOB_STALE_AFTER_MS)).toBe(false);
    expect(isStaleJob(undefined, updated + JOB_STALE_AFTER_MS)).toBe(false);
  });

  it("names the health pill from the hindsight field", () => {
    expect(memoryLabel("starting")).toBe("Preparing memory");
    expect(memoryLabel("ready")).toBe("Memory connected");
    expect(memoryLabel("unavailable")).toBe("Memory unavailable");
  });

  it("shows only recorded stage durations", () => {
    expect(traceSteps(undefined)).toEqual([]);
    expect(traceSteps({})).toEqual([]);
    const steps = traceSteps({ query: 400, generation: 900 });
    expect(steps.map((step) => step.key)).toEqual(["query", "generation"]);
    expect(formatSeconds(400)).toBe("0.4s");
    expect(steps.map((step) => formatSeconds(step.ms))).toEqual(["0.4s", "0.9s"]);
  });

  it("uses comparison-specific progress labels", () => {
    expect(comparisonStageLabel("queued")).toBe("Comparison queued");
    expect(comparisonStageLabel("reviewing_baseline")).toBe("Running the memory-disabled review");
    expect(comparisonStageLabel("complete")).toBe("Comparison complete");
    expect(comparisonStageLabel("comparison_restored")).toBe("Latest comparison restored");
    expect(comparisonStageLabel("reconnecting")).toBe("Connection interrupted. Reconnecting to the existing comparison…");
    expect(stageLabel("reconnecting")).toBe("Connection interrupted. Reconnecting to the existing review…");
    expect(stageLabel("status_unavailable")).toBe("Status temporarily unavailable");
    expect(stageLabel("review_reattached")).toBe("Existing review found. Reattached without starting another provider call.");
    expect(stageLabel("review_restored")).toBe("Latest saved review restored");
    expect(stageLabel("complete")).toBe("Review complete");
    expect(comparisonStageLabel("comparison_reattached")).toBe("Existing comparison found. Reattached without starting either provider branch.");
  });
});

describe("evaluation fixture selection", () => {
  it("prefers each repository's held-out candidate instead of its historical source", () => {
    const analytics = [
      { id: "pr-analytics-11", number: 11, title: "Historical source" },
      { id: "pr-analytics-29", number: 29, title: "Held-out candidate" },
    ];
    expect(preferredPullRequestId(analytics, "repo-analytics-service")).toBe("pr-analytics-29");
  });
});
