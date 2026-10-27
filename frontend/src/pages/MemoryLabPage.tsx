import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type Comparison, type PullRequestSummary, type Review } from "../api";
import { FindingArticle } from "../components/FindingArticle";
import { EmptyNote, ErrorNote, LoadingNote } from "../components/Status";
import { formatSeconds, humanize, preferredPullRequestId, stageLabel, traceSteps } from "../text";
import { useWorkspace } from "../workspace";

function RunColumn({ title, note, review }: { title: string; note: string; review: Review }) {
  return (
    <section className="card lab-column" aria-label={title}>
      <div className="panel-head">
        <div>
          <h2>{title}</h2>
          <p>{note}</p>
        </div>
        {typeof review.elapsed_ms === "number" ? <span>{formatSeconds(review.elapsed_ms)}</span> : null}
      </div>
      {review.model ? <p className="quiet pad-x">{review.model}</p> : null}
      {review.findings.length === 0 ? <EmptyNote title="No validated findings" /> : (
        <div className="finding-list">
          {review.findings.map((finding) => <FindingArticle key={finding.id} finding={finding} />)}
        </div>
      )}
    </section>
  );
}

export function MemoryLabPage() {
  const { repoId = "" } = useParams();
  const { hindsight } = useWorkspace();
  const alive = useRef(true);
  const [prs, setPrs] = useState<PullRequestSummary[]>([]);
  const [prId, setPrId] = useState("");
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [comparison, setComparison] = useState<Comparison | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    api.prs(repoId)
      .then((rows) => {
        if (cancelled) return;
        setPrs(rows);
        setPrId((current) => (rows.some((item) => item.id === current) ? current : preferredPullRequestId(rows, repoId)));
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [repoId]);

  useEffect(() => {
    setComparison(null);
    setStage("");
  }, [prId]);

  const selected = prs.some((item) => item.id === prId) ? prId : "";
  const blocked = hindsight !== "ready";
  const steps = traceSteps(comparison?.memory.retrieval?.timings_ms);

  async function runComparison() {
    if (!selected) return;
    setRunning(true);
    setError("");
    setComparison(null);
    setStage("queued");
    try {
      const result = await api.comparison(selected, (next) => {
        if (alive.current) setStage(next);
      }, () => alive.current);
      if (!result || !alive.current) return;
      setComparison(result);
      setStage("complete");
    } catch (reason) {
      if (!alive.current) return;
      setError(reason instanceof Error ? reason.message : "Comparison failed");
      setStage("");
    } finally {
      if (alive.current) setRunning(false);
    }
  }

  return (
    <div className="page">
      <header className="page-head review-head">
        <div>
          <h1>Memory Lab</h1>
          <p>Same change. Same model. Memory is the only variable.</p>
        </div>
      </header>
      <div className="lab-controls">
        <label>
          Pull request
          <select aria-label="Pull request" value={selected} onChange={(event) => setPrId(event.target.value)}>
            {prs.length === 0 ? <option value="">No pull requests</option> : null}
            {prs.map((item) => <option key={item.id} value={item.id}>#{item.number} {item.title}</option>)}
          </select>
        </label>
        <button type="button" className="primary" disabled={!selected || running || blocked || loading} onClick={() => void runComparison()}>
          Run comparison
        </button>
      </div>
      {blocked ? <p className="hint">Comparison waits until memory is connected. A baseline review can still run from the pull request.</p> : null}
      {loading ? <LoadingNote>Loading pull requests…</LoadingNote> : null}
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {running ? <p className="stage" role="status">{stageLabel(stage)}</p> : null}
      {!comparison && !running && !loading ? <EmptyNote title="No comparison yet">Run both modes to compare validated findings and guardrails.</EmptyNote> : null}
      {comparison ? (
        <>
          <div className="lab-columns">
            <RunColumn title="Memory disabled" note="This run does not receive team memory." review={comparison.baseline} />
            <RunColumn title="With team memory" note="This run can recall repository memory." review={comparison.memory} />
          </div>
          {steps.length > 0 ? (
            <ol className="trace" aria-label="Review stage timings">
              {steps.map((step) => (
                <li key={step.key}>
                  <span className="trace-step">{step.step}</span>
                  <strong>{step.title}</strong>
                  <span title={`${step.ms} ms`}>{formatSeconds(step.ms)}</span>
                  <small>{step.detail}</small>
                </li>
              ))}
            </ol>
          ) : (
            <p className="hint">This run did not include stage timings.</p>
          )}
          <section className="card guardrails" aria-label="Guardrails">
            <div className="panel-head"><h2>Guardrails</h2></div>
            {typeof comparison.evaluation.passed === "boolean" ? (
              <p className={comparison.evaluation.passed ? "pass-line" : "fail-line"}>
                {comparison.evaluation.passed ? "Guardrails passed" : "Guardrails need attention"}
              </p>
            ) : null}
            {Object.keys(comparison.evaluation.checks).length === 0 ? <p className="pad">No guardrail results on this run.</p> : (
              <ul className="checks">
                {Object.entries(comparison.evaluation.checks).map(([name, passed]) => (
                  <li key={name} className={passed ? "pass" : "fail"}>
                    <span aria-hidden="true">{passed ? "✓" : "×"}</span>
                    <span>{humanize(name)}</span>
                    <span className="sr-only">{passed ? "passed" : "failed"}</span>
                  </li>
                ))}
              </ul>
            )}
            {comparison.evaluation.counts ? (
              <dl className="counts">
                {Object.entries(comparison.evaluation.counts).map(([name, value]) => (
                  <div key={name}>
                    <dt>{humanize(name)}</dt>
                    <dd>{value}</dd>
                  </div>
                ))}
              </dl>
            ) : null}
          </section>
        </>
      ) : null}
    </div>
  );
}
