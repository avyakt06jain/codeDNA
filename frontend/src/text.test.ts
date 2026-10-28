import { describe, expect, it } from "vitest";
import { bindingCopy, comparisonStageLabel, feedbackPayload, formatSeconds, memoryLabel, preferredPullRequestId, stageLabel, traceSteps } from "./text";

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
