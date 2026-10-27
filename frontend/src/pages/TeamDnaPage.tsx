import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Decision, type Summary } from "../api";
import { EmptyNote, ErrorNote, LoadingNote } from "../components/Status";
import { designStatus, formatScope, sourceLabel, statValue } from "../text";
import { useWorkspace } from "../workspace";

function matches(decision: Decision, query: string, status: string): boolean {
  if (status !== "all" && decision.status !== status) return false;
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [decision.title, decision.rule_text, decision.rationale, decision.id, decision.source_pr_id, decision.source_pr_number]
    .filter((part) => part != null)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

export function TeamDnaPage() {
  const { repoId = "" } = useParams();
  const { prs } = useWorkspace();
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<Decision | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    Promise.allSettled([api.decisions(repoId), api.summary(repoId)]).then(([decisionResult, summaryResult]) => {
      if (cancelled) return;
      if (decisionResult.status === "fulfilled") setDecisions(decisionResult.value);
      else {
        setDecisions([]);
        setError(decisionResult.reason instanceof Error ? decisionResult.reason.message : "Decisions are unavailable.");
      }
      setSummary(summaryResult.status === "fulfilled" ? summaryResult.value : null);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [repoId]);

  const filtered = useMemo(() => decisions.filter((item) => matches(item, query, status)), [decisions, query, status]);
  const statuses = useMemo(() => Array.from(new Set(decisions.map((item) => item.status).filter(Boolean))).sort(), [decisions]);

  useEffect(() => {
    const next = decisions.filter((item) => matches(item, query, status));
    setSelectedId((current) => {
      if (next.length === 0) return null;
      return next.some((item) => item.id === current) ? current : next[0].id;
    });
  }, [decisions, query, status]);

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    api.decision(selectedId)
      .then((row) => {
        if (!cancelled) setDetail(row);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  const selected = decisions.find((item) => item.id === selectedId) ?? null;
  const shown = detail && detail.id === selectedId ? detail : selected;
  const scope = shown ? formatScope(shown.scope) : null;
  const activeCount = summary?.active_decisions ?? decisions.filter((item) => item.status === "active").length;
  const supersededCount = summary?.superseded_decisions ?? decisions.filter((item) => item.status === "superseded").length;
  const pendingCount = summary?.pending_decisions ?? decisions.filter((item) => item.status === "proposed").length;
  const recordedCount = summary?.decision_count ?? decisions.length;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Team DNA</h1>
          <p>The design decisions recorded for this repository.</p>
        </div>
      </header>
      <p className="count-line">{statValue(recordedCount)} recorded · {statValue(activeCount)} active · {statValue(supersededCount)} superseded · {statValue(pendingCount)} pending</p>
      <div className="filters">
        <input aria-label="Search decisions" placeholder="Search decisions" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All statuses</option>
          {statuses.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>
      {loading ? <LoadingNote>Loading decisions…</LoadingNote> : null}
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <div className="dna-layout">
        <section className="card">
          {filtered.length === 0 && !loading ? <EmptyNote title="No decisions match this search" /> : null}
          {filtered.length > 0 ? (
            <table className="table">
              <thead>
                <tr><th scope="col">Decision</th><th scope="col">Source</th><th scope="col">Status</th></tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className={item.id === selectedId ? "selected" : undefined}>
                    <td>
                      <button type="button" className="linkish" onClick={() => setSelectedId(item.id)}>{item.title}</button>
                      <p className="clamp">{item.rule_text}</p>
                    </td>
                    <td>{sourceLabel(item, prs) ?? "—"}</td>
                    <td><span className={`status ${item.status}`}>{item.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
        <aside className="card detail-panel">
          {shown ? (
            <>
              <div className="finding-tags">
                <span className={`status ${shown.status}`}>{shown.status}</span>
                <span>{designStatus(shown.status)}</span>
              </div>
              <h2>{shown.title}</h2>
              <p className="decision-id">{shown.id}</p>
              <h3>Rule</h3>
              <p>{shown.rule_text}</p>
              <h3>Rationale</h3>
              <p>{shown.rationale}</p>
              {shown.authority ? <p><strong>Authority.</strong> {shown.authority.replaceAll("_", " ")}</p> : null}
              <p><strong>Source.</strong> {sourceLabel(shown, prs) ?? "Not recorded"}</p>
              {scope ? <p><strong>Scope.</strong> {scope}</p> : null}
              {shown.supersedes_decision_id ? (
                <p>Supersedes <Link to={`/repos/${repoId}/dna/${shown.supersedes_decision_id}`}>{shown.supersedes_decision_id}</Link></p>
              ) : null}
              {shown.superseded_by_decision_id ? (
                <p>Superseded by <Link to={`/repos/${repoId}/dna/${shown.superseded_by_decision_id}`}>{shown.superseded_by_decision_id}</Link></p>
              ) : null}
              {shown.memory?.ingestion_status ? (
                <p>Memory ingestion: {shown.memory.ingestion_status}{shown.memory.document_id ? ` · ${shown.memory.document_id}` : ""}</p>
              ) : null}
              <Link className="primary inline" to={`/repos/${repoId}/dna/${shown.id}`}>View evolution</Link>
            </>
          ) : (
            <EmptyNote title="No matching decision" />
          )}
        </aside>
      </div>
    </div>
  );
}
