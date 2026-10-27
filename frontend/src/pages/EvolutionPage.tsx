import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Decision, type Lineage } from "../api";
import { ErrorNote, LoadingNote } from "../components/Status";
import { designStatus, formatWhen, sourceLabel } from "../text";
import { useWorkspace } from "../workspace";

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
    Promise.allSettled([api.lineage(decisionId), api.decision(decisionId)]).then(([lineageResult, decisionResult]) => {
      if (cancelled) return;
      if (lineageResult.status === "fulfilled") setLineage(lineageResult.value);
      else {
        setLineage(null);
        setError("Lineage is unavailable.");
      }
      setDecision(decisionResult.status === "fulfilled" ? decisionResult.value : null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [decisionId]);

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
