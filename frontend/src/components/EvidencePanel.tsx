import { Link } from "react-router-dom";
import type { Decision, Finding } from "../api";
import { designStatus, sourceLabel } from "../text";

export function EvidencePanel({
  repoId,
  finding,
  decisions,
  pullRequests = [],
  loading,
  error,
  onClose,
}: {
  repoId: string;
  finding: Finding;
  decisions: Decision[];
  pullRequests?: { id: string; number: number }[];
  loading: boolean;
  error: string;
  onClose: () => void;
}) {
  return (
    <section className="card evidence" aria-label="Finding evidence">
      <div className="panel-head">
        <div>
          <p className="kicker">Why this finding</p>
          <h2>{finding.title}</h2>
        </div>
        <button type="button" onClick={onClose}>Close evidence</button>
      </div>
      {loading ? <p role="status">Loading evidence…</p> : null}
      {error ? <p className="form-error" role="alert">{error}</p> : null}
      {!loading && !error && decisions.length === 0 ? <p>No validated decision was returned for this finding.</p> : null}
      {decisions.map((decision) => {
        const source = sourceLabel(decision, pullRequests);
        const current = decision.status === "active";
        return (
          <article key={decision.id} className={current ? "evidence-card current" : "evidence-card previous"}>
            <div className="finding-tags">
              <span className={`status ${decision.status}`}>{decision.status}</span>
              <span>{designStatus(decision.status)}</span>
            </div>
            <h3>{decision.title}</h3>
            <p className="decision-id">{decision.id}</p>
            <h4>Rule</h4>
            <p>{decision.rule_text}</p>
            <h4>Rationale</h4>
            <p>{decision.rationale}</p>
            <h4>Source pull request</h4>
            {source && decision.source_pr_id ? (
              <p><Link to={`/repos/${repoId}/prs/${decision.source_pr_id}`}>{source}</Link></p>
            ) : (
              <p>{source ?? "Source pull request was not recorded."}</p>
            )}
            <h4>How this applies</h4>
            <p>{finding.explanation}</p>
            <Link className="text-link" to={`/repos/${repoId}/dna/${decision.id}`}>Open source decision</Link>
          </article>
        );
      })}
    </section>
  );
}
