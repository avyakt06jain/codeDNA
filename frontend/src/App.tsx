import { useEffect, useMemo, useState } from "react";
import { api, type Decision, type Finding, type PullRequest, type PullRequestSummary, type Repository, type Review } from "./api";
import "./styles.css";

type Page = "review" | "dna";

export function DiffView({ diff, findings = [] }: { diff: string; findings?: Finding[] }) {
  let newLine = 0;
  const findingLines = new Set(findings.map((finding) => finding.new_line).filter(Boolean));
  return (
    <div className="diff" role="region" aria-label="Pull request diff">
      {diff.split("\n").map((line, index) => {
        const hunk = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)/);
        if (hunk) newLine = Number(hunk[1]) - 1;
        const added = line.startsWith("+") && !line.startsWith("+++");
        const removed = line.startsWith("-") && !line.startsWith("---");
        if (added || (!removed && !line.startsWith("@@") && !line.startsWith("---") && !line.startsWith("+++"))) newLine += 1;
        const shownLine = added || (!removed && !line.startsWith("@@")) ? newLine : null;
        const hasFinding = shownLine !== null && findingLines.has(shownLine);
        return (
          <div className={`diff-line ${added ? "added" : ""} ${removed ? "removed" : ""} ${hasFinding ? "flagged" : ""}`} key={`${index}-${line}`}>
            <span className="line-number">{shownLine ?? ""}</span>
            <code>{line || " "}</code>
            {hasFinding && <span className="line-flag" aria-label="Finding on this line">●</span>}
          </div>
        );
      })}
    </div>
  );
}

function FindingCard({ finding, onEvidence, onFeedback }: { finding: Finding; onEvidence: () => void; onFeedback: (action: string) => void }) {
  return (
    <article className={`finding severity-${finding.severity}`}>
      <div className="finding-meta">
        <span className="severity">{finding.severity}</span>
        <span>{finding.category === "team_convention" ? "Team convention" : "General"}</span>
        <span>{finding.confidence} confidence</span>
      </div>
      <h3>{finding.title}</h3>
      <p>{finding.explanation}</p>
      <div className="location">{finding.file_path}{finding.new_line ? `:${finding.new_line}` : ""}</div>
      {finding.suggested_change && <pre className="suggestion">{finding.suggested_change}</pre>}
      {finding.evidence_ids.length > 0 && <button className="text-button" onClick={onEvidence}>View evidence · {finding.evidence_ids.join(", ")}</button>}
      <div className="feedback-actions"><span>Was this useful?</span><button onClick={() => onFeedback("accepted")}>Accept</button><button onClick={() => onFeedback("not_applicable")}>Not applicable</button></div>
    </article>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("review");
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [repositoryId, setRepositoryId] = useState("");
  const [prs, setPrs] = useState<PullRequestSummary[]>([]);
  const [prId, setPrId] = useState("");
  const [pr, setPr] = useState<PullRequest | null>(null);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [review, setReview] = useState<Review | null>(null);
  const [evidence, setEvidence] = useState<Decision[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [feedbackStatus, setFeedbackStatus] = useState("");
  const [loading, setLoading] = useState("Loading repositories…");
  const [error, setError] = useState("");

  useEffect(() => {
    api.repositories().then((rows) => {
      setRepositories(rows);
      const acme = rows.find((item) => item.slug === "acme-commerce") ?? rows[0];
      setRepositoryId(acme?.id ?? "");
      setLoading("");
    }).catch((reason: Error) => { setError(reason.message); setLoading(""); });
  }, []);

  useEffect(() => {
    if (!repositoryId) return;
    setReview(null); setPr(null); setError(""); setLoading("Loading repository context…");
    Promise.all([api.prs(repositoryId), api.decisions(repositoryId)]).then(([prRows, decisionRows]) => {
      setPrs(prRows); setDecisions(decisionRows);
      const candidate = prRows.find((item) => item.number === 87) ?? prRows.at(-1);
      setPrId(candidate?.id ?? "");
      setLoading("");
    }).catch((reason: Error) => { setError(reason.message); setLoading(""); });
  }, [repositoryId]);

  useEffect(() => {
    if (!prId) return;
    setReview(null); setLoading("Loading pull request…");
    api.pr(prId).then((row) => { setPr(row); setLoading(""); }).catch((reason: Error) => { setError(reason.message); setLoading(""); });
  }, [prId]);

  const activeRepository = useMemo(() => repositories.find((item) => item.id === repositoryId), [repositories, repositoryId]);

  async function runReview(memoryEnabled: boolean) {
    if (!prId) return;
    setError(""); setReview(null); setEvidence([]);
    setLoading(memoryEnabled ? "Starting Hindsight, recalling team history, and reviewing…" : "Running independent no-memory review…");
    try {
      const result = await api.review(prId, memoryEnabled);
      setReview(result);
      setLoading("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Review failed");
      setLoading("");
    }
  }

  async function openEvidence() {
    if (!review) return;
    try {
      const result = await api.evidence(review.run_id);
      setEvidence(result.decisions); setDrawerOpen(true);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Evidence unavailable");
    }
  }

  async function submitFeedback(findingId: string, action: string) {
    try {
      const result = await api.feedback(findingId, action, action === "accepted" ? "Helpful for this review." : "Not applicable in this context.");
      setFeedbackStatus(result.binding ? "Feedback recorded as policy." : "Feedback recorded as nonbinding review evidence.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Feedback failed");
    }
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <a className="brand" href="#" onClick={(event) => { event.preventDefault(); setPage("review"); }}><span className="brand-mark">C</span><span>CodeDNA</span></a>
        <nav aria-label="Primary navigation">
          <button className={page === "review" ? "active" : ""} onClick={() => setPage("review")}>Review workspace</button>
          <button className={page === "dna" ? "active" : ""} onClick={() => setPage("dna")}>Team DNA</button>
        </nav>
        <span className="runtime-dot"><i /> Local · Hindsight</span>
      </header>

      <main>
        <section className="hero">
          <div><span className="eyebrow">Repository-aware review</span><h1>{page === "review" ? "Review the change. Remember the reason." : "The decisions your codebase remembers."}</h1></div>
          <select aria-label="Repository" value={repositoryId} onChange={(event) => setRepositoryId(event.target.value)}>
            {repositories.map((item) => <option key={item.id} value={item.id}>{item.display_name}</option>)}
          </select>
        </section>

        {error && <div className="notice error" role="alert"><strong>Couldn’t complete that request.</strong><span>{error}</span></div>}
        {loading && <div className="notice loading" role="status"><span className="spinner" /><span>{loading}</span></div>}

        {page === "review" ? (
          <div className="workspace-grid">
            <section className="panel code-panel">
              <div className="panel-head">
                <div><span className="kicker">Candidate pull request</span><h2>{pr ? `#${pr.number} · ${pr.title}` : "Select a pull request"}</h2></div>
                <select aria-label="Pull request" value={prId} onChange={(event) => setPrId(event.target.value)}>{prs.map((item) => <option key={item.id} value={item.id}>#{item.number} {item.title}</option>)}</select>
              </div>
              {pr && <><p className="pr-description">{pr.description}</p><DiffView diff={pr.diff_text} findings={review?.findings} /></>}
            </section>

            <aside className="panel review-panel">
              <div className="panel-head"><div><span className="kicker">Review output</span><h2>{review ? `${review.mode === "memory" ? "Memory-assisted" : "No-memory"} review` : "Ready to analyze"}</h2></div>{review && <span className="run-time">{(review.elapsed_ms / 1000).toFixed(1)}s</span>}</div>
              <div className="review-actions"><button className="primary" disabled={!pr || Boolean(loading)} onClick={() => runReview(true)}>Run with memory</button><button className="secondary" disabled={!pr || Boolean(loading)} onClick={() => runReview(false)}>Run baseline</button></div>
              {!review && !loading && <div className="empty-state"><span>◎</span><h3>No review run yet</h3><p>Memory mode recalls validated team decisions. Baseline sees only this diff.</p></div>}
              {review && <div className="run-summary"><span className={`mode-pill ${review.mode}`}>{review.mode === "memory" ? "Hindsight-assisted" : "Memory disabled"}</span><span>{review.model}</span><span>{review.findings.length} finding{review.findings.length === 1 ? "" : "s"}</span></div>}
              {review?.findings.length === 0 && <div className="empty-state"><h3>No validated findings</h3><p>This means the run returned no findings that passed deterministic validation—not that the code is guaranteed bug-free.</p></div>}
              <div className="findings">{review?.findings.map((finding) => <FindingCard key={finding.id} finding={finding} onEvidence={openEvidence} onFeedback={(action) => submitFeedback(finding.id, action)} />)}</div>
              {feedbackStatus && <div className="feedback-status" role="status">{feedbackStatus}</div>}
            </aside>
          </div>
        ) : (
          <section className="panel dna-panel">
            <div className="panel-head"><div><span className="kicker">{activeRepository?.slug}</span><h2>Confirmed engineering decisions</h2></div><span className="count">{decisions.length} recorded</span></div>
            <div className="decision-list">{decisions.map((decision) => <article className="decision" key={decision.id}><div><span className={`status ${decision.status}`}>{decision.status}</span><span className="decision-id">{decision.id}</span></div><h3>{decision.title}</h3><p className="rule">{decision.rule_text}</p><p>{decision.rationale}</p><footer>Authority: {decision.authority.replace("_", " ")} · Source {decision.source_pr_id}</footer></article>)}</div>
          </section>
        )}
      </main>

      {drawerOpen && <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)}><aside className="drawer" role="dialog" aria-modal="true" aria-label="Finding evidence" onClick={(event) => event.stopPropagation()}><button className="close" aria-label="Close evidence" onClick={() => setDrawerOpen(false)}>×</button><span className="eyebrow">Validated provenance</span><h2>Why CodeDNA raised this</h2>{evidence.map((decision) => <article key={decision.id}><span className="status active">{decision.status}</span><h3>{decision.id} · {decision.title}</h3><p className="rule">{decision.rule_text}</p><p>{decision.rationale}</p><footer>Original source: {decision.source_pr_id}</footer></article>)}</aside></div>}
    </div>
  );
}
