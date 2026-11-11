import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Decision, type Lineage } from "../api";
import { ErrorNote, LoadingNote } from "../components/Status";
import { designStatus, formatWhen, sourceLabel } from "../text";
import { useWorkspace } from "../workspace";

function matchesLineage(decision: Decision, lineage: Lineage): boolean {
  const index = lineage.items.findIndex((item) => item.id === decision.id);
  if (index < 0) return false;
  const item = lineage.items[index]!;
  const successorId = lineage.items[index + 1]?.id ?? null;
  return decision.repository_id === item.repository_id
    && decision.title === item.title
    && decision.rule_text === item.rule_text
    && decision.rationale === item.rationale
    && decision.status === item.status
    && decision.authority === item.authority
    && decision.source_pr_id === item.source_pr_id
    && decision.source_pr_number === item.source_pr_number
    && decision.supersedes_decision_id === item.supersedes_decision_id
    && decision.superseded_by_decision_id === successorId;
}

export function EvolutionPage() {
  const { repoId = "", decisionId = "" } = useParams();
  const { prs } = useWorkspace();
  const [lineage, setLineage] = useState<Lineage | null>(null);
  const [decision, setDecision] = useState<Decision | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    setLineage(null);
    setDecision(null);
    Promise.allSettled([api.lineage(decisionId, repoId), api.decision(decisionId, repoId)]).then(([lineageResult, decisionResult]) => {
      if (cancelled) return;
      if (lineageResult.status === "rejected") {
        setLineage(null);
        setDecision(null);
        setError("Lineage is unavailable.");
      } else if (decisionResult.status === "rejected") {
        setLineage(null);
        setDecision(null);
        setError("Decision detail is unavailable.");
      } else if (!matchesLineage(decisionResult.value, lineageResult.value)) {
        setLineage(null);
        setDecision(null);
        setError("Decision evolution failed correlation validation.");
      } else {
        setLineage(lineageResult.value);
        setDecision(decisionResult.value);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [decisionId, repoId]);

  const items = lineage?.items ?? [];
  const current = [...items].reverse().find((item) => item.status === "active") ?? null;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <p className="kicker"><Link to={`/repos/${repoId}/dna`}>Team DNA</Link></p>
          <h1>The reasoning stays. The convention can change.</h1>
          <p>How this decision evolved.</p>
        </div>
      </header>
      {loading ? <LoadingNote>Loading decision lineage…</LoadingNote> : null}
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {items.length > 0 ? (
        <ol className="lineage-chain">
          {items.map((item, index) => (
            <li key={item.id} className={item.status === "active" ? "current" : "previous"}>
              {index > 0 ? <span aria-hidden="true">→</span> : null}
              <strong>{item.id}</strong>
              <span>{designStatus(item.status)}</span>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="evolution-layout">
        <section className="card">
          <div className="panel-head"><h2>Timeline</h2></div>
          {items.length === 0 && !loading ? <p className="pad">No lineage was returned for this decision.</p> : null}
          <ol className="timeline">
            {items.map((item) => {
              const source = sourceLabel(item, prs);
              const when = formatWhen(item.effective_at);
              return (
                <li key={item.id} className={item.status === "active" ? "timeline-item current" : "timeline-item previous"}>
                  <div className="finding-tags">
                    <span className={`status ${item.status}`}>{item.status}</span>
                    <span>{designStatus(item.status)}</span>
                    <span className="decision-id">{item.id}</span>
                  </div>
                  <h3>{item.title}</h3>
                  {when ? <p className="quiet">{when}</p> : null}
                  {source ? <p>{source}</p> : null}
                  <p>{item.rule_text}</p>
                  <p>{item.rationale}</p>
                </li>
              );
            })}
          </ol>
        </section>
        <aside className={`card current-panel ${current ? "current" : "previous"}`} aria-label="Current design">
          <h2>Current design</h2>
          {current ? (
            <>
              <div className="finding-tags">
                <span className={`status ${current.status}`}>{current.status}</span>
                <span className="decision-id">{current.id}</span>
              </div>
              <h3>{current.title}</h3>
              <p>{current.rule_text}</p>
              <p>{current.rationale}</p>
              {sourceLabel(current, prs) ? <p>Source {sourceLabel(current, prs)}</p> : null}
              {decision?.id === current.id && decision.memory?.ingestion_status ? (
                <p>Memory ingestion: {decision.memory.ingestion_status}{decision.memory.document_id ? ` · ${decision.memory.document_id}` : ""}</p>
              ) : null}
            </>
          ) : (
            <p>No current design is in this lineage.</p>
          )}
        </aside>
      </div>
    </div>
  );
}
