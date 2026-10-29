import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api, MissingJobError, PollingUnavailableError, TerminalJobError, type Comparison, type PullRequestSummary, type Review } from "../api";
import { clearActiveJob, loadActiveJob, saveActiveJob } from "../activeJobs";
import { ActiveJobDetails } from "../components/ActiveJobDetails";
import { FindingArticle } from "../components/FindingArticle";
import { EmptyNote, ErrorNote, LiveStatus, LoadingNote } from "../components/Status";
import { comparisonStageLabel, formatSeconds, humanize, preferredPullRequestId, traceSteps } from "../text";
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
  const [restoring, setRestoring] = useState(false);
  const [running, setRunning] = useState(false);
  const [activeJobId, setActiveJobId] = useState("");
  const [retryJobId, setRetryJobId] = useState("");
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
    let cancelled = false;
    const savedJobId = prId ? loadActiveJob("comparison", prId) : null;
    setComparison(null);
    setActiveJobId("");
    setRetryJobId("");
    setStage("");
    setRunning(false);
    if (!prId) {
      setRestoring(false);
      return () => {
        cancelled = true;
      };
    }

    function observeJob(jobId: string) {
      setRestoring(false);
      setActiveJobId(jobId);
      saveActiveJob("comparison", prId, jobId);
      setRunning(true);
      setStage("queued");
      setError("");
      let terminal = false;
      void api.comparisonJob(
        jobId,
        (next) => {
          if (!cancelled) setStage(next);
        },
        () => !cancelled && alive.current,
      ).then((result) => {
        if (!result || cancelled) return;
        terminal = true;
        setRetryJobId("");
        setComparison(result);
        setStage("complete");
      }).catch(async (reason) => {
        if (cancelled) return;
        terminal = reason instanceof TerminalJobError;
        if (reason instanceof MissingJobError) {
          try {
            const restored = await api.latestComparison(prId);
            if (cancelled) return;
            if (restored) {
              setComparison(restored);
              setStage("comparison_restored");
              return;
            }
          } catch (fallbackReason) {
            if (cancelled) return;
            setError(fallbackReason instanceof Error ? fallbackReason.message : "Saved comparison unavailable");
            setStage("");
            return;
          }
          setError("The active comparison is no longer available. Start a new comparison.");
          setStage("");
          return;
        }
        if (reason instanceof PollingUnavailableError) setRetryJobId(jobId);
        setError(reason instanceof Error ? reason.message : "Comparison failed");
        setStage(reason instanceof TerminalJobError ? "" : "status_unavailable");
      }).finally(() => {
        if (terminal) clearActiveJob("comparison", prId, jobId);
        if (!cancelled) {
          if (terminal) setActiveJobId("");
          setRunning(false);
        }
      });
    }

    setRestoring(true);
    setError("");
    void (async () => {
      try {
        const jobId = savedJobId || await api.activeJob(prId, "comparison");
        if (cancelled) return;
        if (jobId) {
          observeJob(jobId);
          return;
        }
        const result = await api.latestComparison(prId);
        if (!cancelled) {
          setComparison(result);
          setStage(result ? "comparison_restored" : "");
        }
      } catch (reason) {
        if (!cancelled) setError(reason instanceof Error ? reason.message : "Comparison recovery unavailable.");
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [prId]);

  const selected = prs.some((item) => item.id === prId) ? prId : "";
  const blocked = hindsight !== "ready";
  const steps = traceSteps(comparison?.memory.retrieval?.timings_ms);
  const liveStatus = stage
    ? comparisonStageLabel(stage)
    : restoring
      ? "Restoring the latest completed comparison…"
      : loading
        ? "Loading pull requests…"
        : "";

  async function runComparison() {
    if (!selected) return;
    setRunning(true);
    setError("");
    setComparison(null);
    setActiveJobId("");
    setRetryJobId("");
    setStage("queued");
    let jobId = "";
    let terminal = false;
    try {
      jobId = await api.startComparison(selected);
      setActiveJobId(jobId);
      saveActiveJob("comparison", selected, jobId);
      const result = await api.comparisonJob(jobId, (next) => {
        if (alive.current) setStage(next);
      }, () => alive.current);
      if (!result || !alive.current) return;
      terminal = true;
      setRetryJobId("");
      setComparison(result);
      setStage("complete");
    } catch (reason) {
      if (!alive.current) return;
      terminal = reason instanceof TerminalJobError;
      if (reason instanceof PollingUnavailableError && jobId) setRetryJobId(jobId);
      setError(reason instanceof Error ? reason.message : "Comparison failed");
      setStage(reason instanceof TerminalJobError || !jobId ? "" : "status_unavailable");
    } finally {
      if (terminal && jobId) clearActiveJob("comparison", selected, jobId);
      if (alive.current) {
        if (terminal) setActiveJobId("");
        setRunning(false);
      }
    }
  }

  async function checkComparisonAgain() {
    if (!retryJobId || !selected) return;
    const jobId = retryJobId;
    setRunning(true);
    setRetryJobId("");
    setError("");
    setStage("queued");
    let terminal = false;
    try {
      const result = await api.comparisonJob(jobId, (next) => {
        if (alive.current) setStage(next);
      }, () => alive.current);
      if (!result || !alive.current) return;
      terminal = true;
      setComparison(result);
      setStage("complete");
    } catch (reason) {
      if (!alive.current) return;
      terminal = reason instanceof TerminalJobError;
      if (reason instanceof MissingJobError) {
        try {
          const restored = await api.latestComparison(selected);
          if (!alive.current) return;
          if (restored) {
            setComparison(restored);
            setStage("comparison_restored");
            return;
          }
        } catch (fallbackReason) {
          if (!alive.current) return;
          setError(fallbackReason instanceof Error ? fallbackReason.message : "Saved comparison unavailable");
          setStage("");
          return;
        }
      }
      if (reason instanceof PollingUnavailableError) setRetryJobId(jobId);
      setError(reason instanceof Error ? reason.message : "Comparison failed");
      setStage(reason instanceof TerminalJobError ? "" : "status_unavailable");
    } finally {
      if (terminal) clearActiveJob("comparison", selected, jobId);
      if (alive.current) {
        if (terminal) setActiveJobId("");
        setRunning(false);
      }
    }
  }

  return (
    <div className="page">
      <LiveStatus>{liveStatus}</LiveStatus>
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
        <button type="button" className="primary" disabled={!selected || running || blocked || loading || restoring} onClick={() => void runComparison()}>
          Run comparison
        </button>
      </div>
      {blocked ? <p className="hint">Comparison waits until memory is connected. A baseline review can still run from the pull request.</p> : null}
      {loading ? <LoadingNote announce={false}>Loading pull requests…</LoadingNote> : null}
      {restoring ? <LoadingNote announce={false}>Restoring the latest completed comparison…</LoadingNote> : null}
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      <ActiveJobDetails jobId={activeJobId} status={comparisonStageLabel(stage)} />
      {retryJobId ? (
        <button type="button" className="secondary" disabled={running} onClick={() => void checkComparisonAgain()}>
          Check comparison again
        </button>
      ) : null}
      {running ? <p className="stage" aria-hidden="true">{comparisonStageLabel(stage)}</p> : null}
      {!comparison && !running && !loading && !restoring ? <EmptyNote title="No comparison yet">Run both modes to compare validated findings and guardrails.</EmptyNote> : null}
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
