import { useEffect, useRef, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { api, isTransientRequestError, MissingJobError, PollingUnavailableError, TerminalJobError, type Comparison, type EvaluationCase, type JobTiming, type PullRequestSummary, type Review } from "../api";
import { clearActiveJob, loadActiveJob, saveActiveJob } from "../activeJobs";
import { ActiveJobDetails } from "../components/ActiveJobDetails";
import { FindingArticle } from "../components/FindingArticle";
import { EmptyNote, ErrorNote, LiveStatus, LoadingNote } from "../components/Status";
import { comparisonStageLabel, formatSeconds, formatWhen, humanize, preferredPullRequestId, traceSteps } from "../text";
import { useWorkspace } from "../workspace";

const CATALOG_RETRY_DELAYS_MS = import.meta.env.MODE === "test" ? [1, 2, 4] as const : [1000, 2000, 4000] as const;

function wait(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function catalogResultChanged(previous: EvaluationCase | undefined, next: EvaluationCase | undefined) {
  const before = previous?.latest_evaluation;
  const after = next?.latest_evaluation;
  if (!before || !after) return before !== after;
  return before.job_id !== after.job_id
    || before.passed !== after.passed
    || before.passed_checks !== after.passed_checks
    || before.total_checks !== after.total_checks
    || before.updated_at !== after.updated_at;
}

function catalogUpdateAnnouncement(previous: EvaluationCase[], next: EvaluationCase[], candidatePrId: string) {
  const before = previous.find((item) => item.candidate_pr_id === candidatePrId);
  const after = next.find((item) => item.candidate_pr_id === candidatePrId);
  if (!after || !catalogResultChanged(before, after)) return "";
  if (!after.latest_evaluation) return `Fixture catalog updated for ${after.repository_name}: no completed comparison is recorded.`;
  return `Fixture catalog updated for ${after.repository_name}: ${after.latest_evaluation.passed_checks} of ${after.latest_evaluation.total_checks} guardrails passed in the latest stored run.`;
}

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
  const [searchParams] = useSearchParams();
  const requestedCaseId = searchParams.get("case") ?? "";
  const { hindsight } = useWorkspace();
  const alive = useRef(true);
  const casesHeading = useRef<HTMLHeadingElement>(null);
  const casesRetryButton = useRef<HTMLButtonElement>(null);
  const manualCasesRetry = useRef(false);
  const automaticCatalogRefresh = useRef(false);
  const evaluationCasesRef = useRef<EvaluationCase[]>([]);
  const [prs, setPrs] = useState<PullRequestSummary[]>([]);
  const [evaluationCases, setEvaluationCases] = useState<EvaluationCase[]>([]);
  const [casesLoading, setCasesLoading] = useState(true);
  const [casesError, setCasesError] = useState("");
  const [casesRetryKey, setCasesRetryKey] = useState(0);
  const [casesCheckedAt, setCasesCheckedAt] = useState("");
  const [catalogAnnouncement, setCatalogAnnouncement] = useState("");
  const [prId, setPrId] = useState("");
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState(false);
  const [running, setRunning] = useState(false);
  const [activeJobId, setActiveJobId] = useState("");
  const [jobTiming, setJobTiming] = useState<JobTiming>({});
  const [retryJobId, setRetryJobId] = useState("");
  const [stage, setStage] = useState("");
  const [error, setError] = useState("");
  const [comparison, setComparison] = useState<Comparison | null>(null);

  function updateJobTiming(next: JobTiming) {
    setJobTiming((current) => ({
      createdAt: next.createdAt ?? current.createdAt,
      updatedAt: next.updatedAt ?? current.updatedAt,
    }));
  }

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
        setPrId((current) => {
          if (requestedCaseId && rows.some((item) => item.id === requestedCaseId)) return requestedCaseId;
          return rows.some((item) => item.id === current) ? current : preferredPullRequestId(rows, repoId);
        });
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
  }, [repoId, requestedCaseId]);

  useEffect(() => {
    let cancelled = false;
    setCasesLoading(true);
    setCasesError("");
    void (async () => {
      let failure: unknown;
      for (let attempt = 0; attempt <= CATALOG_RETRY_DELAYS_MS.length; attempt += 1) {
        try {
          const rows = await api.evaluationCases();
          if (!cancelled) {
            const previous = evaluationCasesRef.current;
            evaluationCasesRef.current = rows;
            setEvaluationCases(rows);
            setCasesError("");
            setCasesCheckedAt(new Date().toISOString());
            if (automaticCatalogRefresh.current) {
              setCatalogAnnouncement(catalogUpdateAnnouncement(previous, rows, prId));
              automaticCatalogRefresh.current = false;
            }
          }
          return;
        } catch (reason) {
          failure = reason;
          if (!isTransientRequestError(reason) || attempt === CATALOG_RETRY_DELAYS_MS.length) break;
          await wait(CATALOG_RETRY_DELAYS_MS[attempt]);
        }
      }
      if (!cancelled) {
        automaticCatalogRefresh.current = false;
        setCasesError(failure instanceof Error ? failure.message : "Fixture catalog unavailable.");
      }
    })().finally(() => {
      if (!cancelled) setCasesLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [casesRetryKey]);

  useEffect(() => {
    if (!manualCasesRetry.current || casesLoading) return;
    manualCasesRetry.current = false;
    window.requestAnimationFrame(() => {
      if (casesError) casesRetryButton.current?.focus();
      else casesHeading.current?.focus();
    });
  }, [casesError, casesLoading]);

  useEffect(() => {
    let cancelled = false;
    const savedJobId = prId ? loadActiveJob("comparison", prId) : null;
    setComparison(null);
    setActiveJobId("");
    setJobTiming({});
    setRetryJobId("");
    setStage("");
    setRunning(false);
    if (!prId) {
      setRestoring(false);
      return () => {
        cancelled = true;
      };
    }

    function observeJob(jobId: string, timing: JobTiming = {}) {
      setRestoring(false);
      setActiveJobId(jobId);
      setJobTiming(timing);
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
        updateJobTiming,
      ).then((result) => {
        if (!result || cancelled) return;
        terminal = true;
        setRetryJobId("");
        setComparison(result);
        setStage("complete");
        refreshCatalogAfterComparison();
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
          if (terminal) {
            setActiveJobId("");
            setJobTiming({});
          }
          setRunning(false);
        }
      });
    }

    setRestoring(true);
    setError("");
    void (async () => {
      try {
        const activeJob = savedJobId
          ? { jobId: savedJobId, createdAt: undefined, updatedAt: undefined }
          : await api.activeJob(prId, "comparison");
        if (cancelled) return;
        if (activeJob) {
          observeJob(activeJob.jobId, activeJob);
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
  const liveStatus = stage && stage !== "complete"
    ? comparisonStageLabel(stage)
    : catalogAnnouncement || (stage
      ? comparisonStageLabel(stage)
    : restoring
      ? "Restoring the latest completed comparison…"
      : loading
        ? "Loading pull requests…"
        : "");

  function reloadCatalog() {
    automaticCatalogRefresh.current = false;
    setCatalogAnnouncement("");
    manualCasesRetry.current = true;
    setCasesRetryKey((value) => value + 1);
  }

  function refreshCatalogAfterComparison() {
    automaticCatalogRefresh.current = true;
    setCatalogAnnouncement("");
    setCasesRetryKey((value) => value + 1);
  }

  async function runComparison() {
    if (!selected) return;
    setRunning(true);
    setError("");
    setComparison(null);
    setActiveJobId("");
    setJobTiming({});
    setRetryJobId("");
    setStage("queued");
    let jobId = "";
    let terminal = false;
    try {
      const started = await api.startComparison(selected);
      jobId = started.jobId;
      setActiveJobId(jobId);
      setJobTiming({ createdAt: started.createdAt, updatedAt: started.updatedAt });
      saveActiveJob("comparison", selected, jobId);
      if (started.reused) setStage("comparison_reattached");
      const result = await api.comparisonJob(jobId, (next) => {
        if (alive.current) setStage(next);
      }, () => alive.current, updateJobTiming);
      if (!result || !alive.current) return;
      terminal = true;
      setRetryJobId("");
      setComparison(result);
      setStage("complete");
      refreshCatalogAfterComparison();
    } catch (reason) {
      if (!alive.current) return;
      terminal = reason instanceof TerminalJobError;
      if (reason instanceof PollingUnavailableError && jobId) setRetryJobId(jobId);
      setError(reason instanceof Error ? reason.message : "Comparison failed");
      setStage(reason instanceof TerminalJobError || !jobId ? "" : "status_unavailable");
    } finally {
      if (terminal && jobId) clearActiveJob("comparison", selected, jobId);
      if (alive.current) {
        if (terminal) {
          setActiveJobId("");
          setJobTiming({});
        }
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
      }, () => alive.current, updateJobTiming);
      if (!result || !alive.current) return;
      terminal = true;
      setComparison(result);
      setStage("complete");
      refreshCatalogAfterComparison();
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
        if (terminal) {
          setActiveJobId("");
          setJobTiming({});
        }
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
      <section className="evaluation-cases" aria-labelledby="evaluation-cases-title">
        <div className="evaluation-cases-head">
          <div>
            <h2 id="evaluation-cases-title" ref={casesHeading} tabIndex={-1}>Verified evaluation fixtures</h2>
            <p>Two synthetic held-out cases have recorded live Hindsight/Gemini proofs. These are case counts, not an accuracy score.</p>
            {casesCheckedAt ? (
              <p className="catalog-checked">
                Last checked <time dateTime={casesCheckedAt}>{formatWhen(casesCheckedAt) ?? casesCheckedAt}</time>
              </p>
            ) : null}
          </div>
          <span>{evaluationCases.length} {evaluationCases.length === 1 ? "case" : "cases"}</span>
        </div>
        {casesLoading ? <p className="hint">Loading fixture catalog…</p> : null}
        {casesError ? (
          <div className="catalog-recovery">
            <ErrorNote>Fixture catalog unavailable: {casesError}</ErrorNote>
            <button ref={casesRetryButton} type="button" className="secondary" disabled={casesLoading} onClick={reloadCatalog}>
              Retry fixture catalog
            </button>
          </div>
        ) : null}
        {!casesLoading && !casesError && evaluationCases.length === 0 ? <p className="hint">No authoritative evaluation fixtures are available.</p> : null}
        <ul>
          {evaluationCases.map((item) => {
            const active = repoId === item.repository_id && selected === item.candidate_pr_id;
            const recorded = item.latest_evaluation;
            return (
              <li key={item.candidate_pr_id} className={active ? "active" : undefined}>
                <div>
                  <strong>{item.repository_name}</strong>
                  <span>Source PR #{item.source_pr_number} → held-out PR #{item.candidate_pr_number}</span>
                  <span>{item.decision_id} · {item.decision_status}</span>
                  <span>
                    {recorded
                      ? `${recorded.passed_checks}/${recorded.total_checks} guardrails passed in latest stored run${recorded.updated_at ? ` · ${formatWhen(recorded.updated_at)}` : ""}`
                      : "No completed comparison recorded in this database"}
                  </span>
                </div>
                <Link
                  className="secondary"
                  aria-current={active ? "true" : undefined}
                  to={`/repos/${item.repository_id}/lab?case=${item.candidate_pr_id}`}
                >
                  {active ? "Case selected" : "Open case"}
                </Link>
              </li>
            );
          })}
        </ul>
        {!casesLoading && !casesError && evaluationCases.length > 0 ? (
          <button type="button" className="secondary catalog-refresh" onClick={reloadCatalog}>
            Refresh fixture catalog
          </button>
        ) : null}
      </section>
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
      <ActiveJobDetails jobId={activeJobId} status={comparisonStageLabel(stage)} {...jobTiming} />
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
