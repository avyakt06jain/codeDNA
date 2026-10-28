import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import App from "./App";

const repositories = [
  { id: "repo-acme-commerce", slug: "acme-commerce", display_name: "Acme Commerce" },
];

const prs = [
  { id: "pr-acme-87", number: 87, title: "Update order status", created_at: "2026-10-20T12:00:00Z" },
];

const diff = [
  "diff --git a/src/orders/update.ts b/src/orders/update.ts",
  "--- a/src/orders/update.ts",
  "+++ b/src/orders/update.ts",
  "@@ -16,3 +16,4 @@",
  " context",
  "-previous",
  "+order.status = next;",
].join("\n");

const decisions = [
  {
    id: "DEC-0103",
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
    title: "Order transitions",
    rule_text: "Earlier transition rule.",
    rationale: "The first audit rule.",
    status: "superseded",
    authority: "reviewer_confirmed",
    source_pr_id: "pr-acme-42",
    source_pr_number: 42,
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

const review = {
  run_id: "run-1",
  status: "complete",
  mode: "memory",
  model: "gemini-test",
  elapsed_ms: 1500,
  findings: [teamFinding, generalFinding],
  retrieval: { timings_ms: { query: 400, validation: 200, generation: 900 } },
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
  interruptedJobs?: number;
  decisionsWrapped?: boolean;
  comparison?: Record<string, unknown>;
  latestComparison?: Record<string, unknown>;
  latestReview?: boolean;
}) {
  const hindsight = options?.hindsight ?? "ready";
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const raw = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const path = new URL(raw, "http://localhost").pathname;
    const method = (init?.method ?? "GET").toUpperCase();
    if (path === "/api/health") return json({ status: "ok", memory: "configured", hindsight, interrupted_jobs: options?.interruptedJobs ?? 0 });
    if (path === "/api/repositories") return json(repositories);
    if (path.endsWith("/summary")) {
      return json({
        repository_id: "repo-acme-commerce",
        slug: "acme-commerce",
        display_name: "Acme Commerce",
        pr_count: 6,
        decision_count: 11,
        active_decisions: 3,
        superseded_decisions: 1,
        pending_decisions: 0,
        review_run_count: 4,
        hindsight,
      });
    }
    if (path.endsWith("/prs")) return json(prs);
    if (path === "/api/prs/pr-acme-87" && method === "GET") {
      return json({ ...prs[0], repository_id: "repo-acme-commerce", description: "Sets order status directly.", diff_text: diff });
    }
    if (path === "/api/prs/pr-acme-87/reviews/latest" && method === "GET") {
      return json({ pr_id: "pr-acme-87", mode: "memory", review: options?.latestReview ? review : null });
    }
    if (path === "/api/prs/pr-acme-87/comparisons/latest" && method === "GET") {
      return json({ pr_id: "pr-acme-87", job_id: options?.latestComparison ? "job-restored" : null, comparison: options?.latestComparison ?? null });
    }
    if (path.endsWith("/lineage")) {
      return json({
        decision_id: "DEC-0103",
        items: [
          { ...decisions[1], effective_at: "2023-12-15T10:00:00Z" },
          { ...decisions[0], effective_at: "2024-01-08T10:00:00Z" },
        ],
      });
    }
    if (path.startsWith("/api/decisions/")) {
      const id = path.split("/").filter(Boolean).pop();
      if (id === "DEC-0042") {
        return json({
          ...decisions[1],
          superseded_by_decision_id: "DEC-0103",
          memory: { document_id: "decision-DEC-0042", ingestion_status: "ready" },
        });
      }
      return json({ ...decisions[0], memory: { document_id: "decision-DEC-0103", ingestion_status: "ready" } });
    }
    if (path.includes("/decisions")) return json(options?.decisionsWrapped ? { items: decisions } : decisions);
    if (path.endsWith("/review-jobs") && method === "POST") return json({ job_id: "job-review", status: "queued", stage: "queued" }, 202);
    if (path === "/api/review-jobs/job-review") return json({ status: "complete", stage: "complete", error_code: null, review });
    if (path.endsWith("/comparison") && method === "POST") return json({ job_id: "job-cmp", status: "queued", stage: "queued" }, 202);
    if (path === "/api/review-jobs/job-cmp") return json({ status: "complete", stage: "complete", error_code: null, comparison: options?.comparison });
    if (path.endsWith("/evidence")) return json({ decisions });
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
});

it("announces jobs reconciled after an API restart", async () => {
  installFetch({ interruptedJobs: 2 });
  renderAt("/");
  expect(await screen.findByText("2 interrupted jobs were marked failed after restart. Start a new review to retry safely.")).toBeTruthy();
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
  expect(screen.queryByText(/apply suggestion/i)).toBeNull();
  expect(screen.queryByText(/view on github/i)).toBeNull();
});

it("restores the latest memory review after the pull-request page reloads", async () => {
  installFetch({ latestReview: true });
  renderAt("/repos/repo-acme-commerce/prs/pr-acme-87");
  const team = await screen.findByRole("article", { name: "Direct status write skips the service" });
  expect(team.textContent).toContain("Design mismatch");
  expect(within(team).getByRole("button", { name: "View evidence" })).toBeTruthy();
  expect(within(team).getByRole("button", { name: "Dismiss" })).toBeTruthy();
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
  expect(within(await screen.findByRole("article", { name: "Pull requests" })).getByText("6")).toBeTruthy();
  expect(within(screen.getByRole("article", { name: "Recorded decisions" })).getByText("11")).toBeTruthy();
  expect(within(screen.getByRole("article", { name: "Review runs" })).getByText("4")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Update order status" })).toBeTruthy();
  expect(screen.queryByText(/view on github/i)).toBeNull();
  expect(screen.queryByText(/\bstars\b/i)).toBeNull();
  expect(screen.queryByText(/contributors/i)).toBeNull();
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

it("shows a memory-lab trace only for recorded timings and lists guardrails", async () => {
  installFetch({
    comparison: {
      evaluation: {
        passed: false,
        checks: { same_model: true, baseline_has_no_memory_citations: false },
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
        findings: [generalFinding],
        retrieval: {},
      },
    },
  });
  renderAt("/repos/repo-acme-commerce/lab");
  await screen.findByRole("option", { name: /Update order status/ });
  await screen.findByText("Memory connected");
  fireEvent.click(screen.getByRole("button", { name: "Run comparison" }));
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
  expect(baseline.textContent?.toLowerCase()).not.toContain("historical evidence");
});

it("restores the latest completed comparison without starting a new job", async () => {
  const restored = {
    evaluation: {
      passed: true,
      checks: { same_candidate: true, baseline_has_no_memory_citations: true },
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
