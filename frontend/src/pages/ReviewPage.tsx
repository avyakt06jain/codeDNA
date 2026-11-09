import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api, CreationOutcomeUnknownError, MissingJobError, PollingUnavailableError, TerminalJobError, type Decision, type Finding, type JobTiming, type PullRequest, type Review } from "../api";
import { clearActiveJob, loadActiveJob, saveActiveJob } from "../activeJobs";
import { DiffView } from "../components/DiffView";
import { ActiveJobDetails } from "../components/ActiveJobDetails";
import { EvidencePanel } from "../components/EvidencePanel";
import { FeedbackDialog } from "../components/FeedbackDialog";
import { FindingArticle } from "../components/FindingArticle";
import { EmptyNote, ErrorNote, LiveStatus, LoadingNote } from "../components/Status";
import { splitDiff } from "../diffFiles";
import { bindingCopy, formatSeconds, stageLabel } from "../text";
import { useWorkspace } from "../workspace";

export function ReviewPage() {
  const { repoId = "", prId = "" } = useParams();
  const { hindsight, prs } = useWorkspace();
  const alive = useRef(true);
  const recoveryRetryRequested = useRef(false);
  const recoveryRetryButton = useRef<HTMLButtonElement>(null);
  const workspaceRegion = useRef<HTMLDivElement>(null);
  const findingsHeading = useRef<HTMLHeadingElement>(null);
  const [pr, setPr] = useState<PullRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveredPrId, setRecoveredPrId] = useState("");
  const [recoveryFailed, setRecoveryFailed] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");
  const [recoveryRetryKey, setRecoveryRetryKey] = useState(0);
  const [creationUncertainPrId, setCreationUncertainPrId] = useState("");
  const [error, setError] = useState("");
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [running, setRunning] = useState(false);
  const [activeJobId, setActiveJobId] = useState("");
  const [jobTiming, setJobTiming] = useState<JobTiming>({});
  const [retryJobId, setRetryJobId] = useState("");
  const [stage, setStage] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [filePath, setFilePath] = useState("");
  const [evidenceFinding, setEvidenceFinding] = useState<Finding | null>(null);
  const [evidence, setEvidence] = useState<Decision[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState("");
  const [dismissFinding, setDismissFinding] = useState<Finding | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [diffFocus, setDiffFocus] = useState<{ line: number | null; request: number }>({ line: null, request: 0 });

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
    recoveryRetryRequested.current = false;
    setCreationUncertainPrId("");
  }, [prId]);

  useEffect(() => {
    let cancelled = false;
    const savedJobId = loadActiveJob("review", prId);
    setRecoveredPrId("");
    setRecoveryFailed(false);
    setRecoveryMessage("");
    setLoading(true);
    setRunning(false);
    setError("");
    setPr(null);
    setReview(null);
    setActiveJobId("");
    setJobTiming({});
    setRetryJobId("");
    setStage("");
    setEvidenceFinding(null);
    setEvidence([]);
    setFeedbackMessage("");
    setDiffFocus({ line: null, request: 0 });

    function observeJob(jobId: string, timing: JobTiming = {}, reattached = false) {
      setActiveJobId(jobId);
      setJobTiming(timing);
      saveActiveJob("review", prId, jobId);
      setRunning(true);
      setStage(reattached ? "review_reattached" : "queued");
      let terminal = false;
      void api.reviewJob(
        jobId,
        prId,
        (next) => {
          if (!cancelled) setStage(next);
        },
        () => !cancelled && alive.current,
        updateJobTiming,
      ).then((result) => {
        if (!result || cancelled) return;
        terminal = true;
        setRetryJobId("");
        setReview(result);
        setStage("complete");
      }).catch(async (reason) => {
        if (cancelled) return;
        terminal = reason instanceof TerminalJobError;
        if (reason instanceof MissingJobError) {
          try {
            const restored = await api.latestReview(prId, "memory");
            if (cancelled) return;
            if (restored) {
              setReview(restored);
              setStage("review_restored");
              return;
            }
          } catch (fallbackReason) {
            if (cancelled) return;
            setError(fallbackReason instanceof Error ? fallbackReason.message : "Saved review unavailable");
            setStage("");
            return;
          }
          setError("The active review is no longer available. Start a new review.");
          setStage("");
          return;
        }
        if (reason instanceof PollingUnavailableError) setRetryJobId(jobId);
        setError(reason instanceof Error ? reason.message : "Review failed");
        setStage(reason instanceof TerminalJobError ? "" : "status_unavailable");
      }).finally(() => {
        if (terminal) clearActiveJob("review", prId, jobId);
        if (!cancelled) {
          if (terminal) {
            setActiveJobId("");
            setJobTiming({});
          }
          setRunning(false);
        }
      });
    }

    const recovery = savedJobId
      ? Promise.resolve({ job: { jobId: savedJobId, createdAt: undefined, updatedAt: undefined }, review: null as Review | null })
      : api.activeJob(prId, "review").then(async (job) => ({
        job,
        review: job ? null : await api.latestReview(prId, "memory"),
      }));

    const reconcilingCreation = creationUncertainPrId === prId;
    let recoveryRejected = false;
    Promise.allSettled([api.pr(prId), recovery])
      .then(([pullRequestResult, recoveryResult]) => {
        if (cancelled) return;
        if (pullRequestResult.status === "fulfilled") {
          setPr(pullRequestResult.value);
        } else {
          setPr(null);
          setError(pullRequestResult.reason instanceof Error ? pullRequestResult.reason.message : "Pull request unavailable.");
        }
        if (recoveryResult.status === "rejected") {
          recoveryRejected = true;
          const detail = recoveryResult.reason instanceof Error ? recoveryResult.reason.message : "Saved review recovery failed.";
          setError(reconcilingCreation
            ? `Review creation status is still unavailable: ${detail} No review or provider call was started by this check. Check creation status again before trying another review.`
            : `Review recovery unavailable: ${detail} No review or provider call was started. Use the controls to start a new review when dependencies are ready.`);
          setRecoveryFailed(true);
        } else {
          if (reconcilingCreation) setCreationUncertainPrId("");
          if (recoveryResult.value.job) {
            observeJob(recoveryResult.value.job.jobId, recoveryResult.value.job, reconcilingCreation);
          } else if (recoveryResult.value.review) {
            setReview(recoveryResult.value.review);
            setStage("review_restored");
          } else if (recoveryRetryRequested.current) {
            setRecoveryMessage(reconcilingCreation
              ? "Creation status checked. No active or completed review was found, and no provider work was started by this check. You can start a new review."
              : "Saved review recovery completed. No persisted review was found, and no provider work was started.");
          }
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          if (!reconcilingCreation || !recoveryRejected) setRecoveredPrId(prId);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [prId, recoveryRetryKey]);

  const files = useMemo(() => splitDiff(pr?.diff_text ?? ""), [pr?.diff_text]);
  useEffect(() => {
    setFilePath((current) => (files.some((file) => file.path === current) ? current : files[0]?.path ?? ""));
  }, [files]);

  const selected = files.find((file) => file.path === filePath) ?? files[0];
  const findings = review?.findings ?? [];
  const fileFindings = findings.filter((item) => item.file_path === selected?.path);
  const memoryBlocked = memoryEnabled && hindsight !== "ready";
  const liveStatus = feedbackMessage || recoveryMessage || (stage ? stageLabel(stage) : loading ? "Loading pull request…" : "");

  useLayoutEffect(() => {
    if (!recoveryRetryRequested.current || loading) return;
    recoveryRetryRequested.current = false;
    if (recoveryFailed) recoveryRetryButton.current?.focus();
    else if (review) findingsHeading.current?.focus();
    else workspaceRegion.current?.focus();
  }, [loading, recoveryFailed, review]);

  function retrySavedRecovery() {
    recoveryRetryRequested.current = true;
    setLoading(true);
    setRecoveryFailed(false);
    setRecoveryMessage("");
    setError("");
    setRecoveryRetryKey((value) => value + 1);
  }

  async function runReview() {
    setRunning(true);
    setRecoveryFailed(false);
    setRecoveryMessage("");
    setError("");
    setReview(null);
    setActiveJobId("");
    setJobTiming({});
    setRetryJobId("");
    setEvidenceFinding(null);
    setEvidence([]);
    setFeedbackMessage("");
    setDiffFocus({ line: null, request: 0 });
    setStage("queued");
    let jobId = "";
    let terminal = false;
    try {
      const started = await api.startReview(prId, memoryEnabled);
      jobId = started.jobId;
      setActiveJobId(jobId);
      setJobTiming({ createdAt: started.createdAt, updatedAt: started.updatedAt });
      saveActiveJob("review", prId, jobId);
      if (started.reused) setStage("review_reattached");
      const result = await api.reviewJob(jobId, prId, (next) => {
        if (alive.current) setStage(next);
      }, () => alive.current, updateJobTiming);
      if (!result || !alive.current) return;
      terminal = true;
      setRetryJobId("");
      setReview(result);
      setStage("complete");
    } catch (reason) {
      if (!alive.current) return;
      if (reason instanceof CreationOutcomeUnknownError) {
        setCreationUncertainPrId(prId);
        setRecoveryFailed(true);
        setRecoveredPrId("");
      }
      terminal = reason instanceof TerminalJobError;
      if (reason instanceof PollingUnavailableError && jobId) setRetryJobId(jobId);
      setError(reason instanceof Error ? reason.message : "Review failed");
      setStage(reason instanceof TerminalJobError || !jobId ? "" : "status_unavailable");
    } finally {
      if (terminal && jobId) clearActiveJob("review", prId, jobId);
      if (alive.current) {
        if (terminal) {
          setActiveJobId("");
          setJobTiming({});
        }
        setRunning(false);
      }
    }
  }

  async function checkReviewAgain() {
    if (!retryJobId) return;
    const jobId = retryJobId;
    setRunning(true);
    setRetryJobId("");
    setError("");
    setStage("queued");
    let terminal = false;
    try {
      const result = await api.reviewJob(jobId, prId, (next) => {
        if (alive.current) setStage(next);
      }, () => alive.current, updateJobTiming);
      if (!result || !alive.current) return;
      terminal = true;
      setReview(result);
      setStage("complete");
    } catch (reason) {
      if (!alive.current) return;
      terminal = reason instanceof TerminalJobError;
      if (reason instanceof MissingJobError) {
        try {
          const restored = await api.latestReview(prId, "memory");
          if (!alive.current) return;
          if (restored) {
            setReview(restored);
            setStage("review_restored");
            return;
          }
        } catch (fallbackReason) {
          if (!alive.current) return;
          setError(fallbackReason instanceof Error ? fallbackReason.message : "Saved review unavailable");
          setStage("");
          return;
        }
      }
      if (reason instanceof PollingUnavailableError) setRetryJobId(jobId);
      setError(reason instanceof Error ? reason.message : "Review failed");
      setStage(reason instanceof TerminalJobError ? "" : "status_unavailable");
    } finally {
      if (terminal) clearActiveJob("review", prId, jobId);
      if (alive.current) {
        if (terminal) {
          setActiveJobId("");
          setJobTiming({});
        }
        setRunning(false);
      }
    }
  }

  async function openEvidence(finding: Finding) {
    if (!review) return;
    setEvidenceFinding(finding);
    setEvidenceLoading(true);
    setEvidenceError("");
    setEvidence([]);
    try {
      const result = await api.evidence(review.run_id);
      const ids = new Set(finding.evidence_ids);
      setEvidence(result.decisions.filter((item) => ids.has(item.id)));
    } catch (reason) {
      setEvidenceError(reason instanceof Error ? reason.message : "Evidence is unavailable.");
    } finally {
      setEvidenceLoading(false);
    }
  }

  async function accept(finding: Finding) {
    setError("");
    try {
      const result = await api.feedback(finding.id, "accepted", "Accepted");
      setFeedbackMessage(`${finding.title}: ${bindingCopy(result.binding)}`);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Feedback failed");
    }
  }

  function openFindingLocation(path: string, line?: number | null) {
    setFilePath(path);
    setDiffFocus((current) => ({ line: line ?? null, request: current.request + 1 }));
  }

  return (
    <div ref={workspaceRegion} className="page" role="region" aria-label="Review workspace" aria-busy={loading} tabIndex={-1}>
      <LiveStatus>{liveStatus}</LiveStatus>
      <header className="page-head review-head">
        <div>
          <h1>{pr ? `#${pr.number} ${pr.title}` : "Pull request"}</h1>
          {pr?.description ? <p>{pr.description}</p> : null}
        </div>
        <div className="review-controls">
          <div className="toggle">
            <span>{memoryEnabled ? "Memory on" : "Memory off"}</span>
            <button
              type="button"
              role="switch"
              className={memoryEnabled ? "switch on" : "switch"}
              aria-checked={memoryEnabled}
              aria-label={memoryEnabled ? "Memory enabled" : "Memory off"}
              onClick={() => setMemoryEnabled((value) => !value)}
            >
              <span className="switch-knob" />
            </button>
          </div>
          <button type="button" className="primary" disabled={recoveredPrId !== prId || running || !pr || memoryBlocked} onClick={() => void runReview()}>
            Run CodeDNA Review
          </button>
          {memoryBlocked ? <p className="hint">Memory reviews wait until Hindsight is ready. Turn memory off to run a baseline.</p> : null}
          {!memoryEnabled ? <p className="hint">Baseline review uses this diff only.</p> : null}
        </div>
      </header>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {recoveryFailed ? (
        <button ref={recoveryRetryButton} type="button" className="secondary" disabled={loading || running} onClick={retrySavedRecovery}>
          {creationUncertainPrId === prId ? "Check creation status" : "Retry saved review recovery"}
        </button>
      ) : null}
      <ActiveJobDetails jobId={activeJobId} status={stageLabel(stage)} {...jobTiming} />
      {retryJobId ? (
        <button type="button" className="secondary" disabled={running} onClick={() => void checkReviewAgain()}>
          Check review again
        </button>
      ) : null}
      {loading ? <LoadingNote announce={false}>Loading pull request…</LoadingNote> : null}
      {pr ? (
        <div className="review-grid">
          <section className="card file-card" aria-label="Files changed">
            <div className="panel-head"><h2>Files changed ({files.length})</h2></div>
            {files.length === 0 ? <EmptyNote title="No files in this diff" /> : (
              <div className="file-list">
                {files.map((file) => {
                  const flagged = findings.some((item) => item.file_path === file.path && item.new_line);
                  return (
                    <button
                      type="button"
                      key={file.path}
                      className={file.path === selected?.path ? "file active" : "file"}
                      onClick={() => {
                        setFilePath(file.path);
                        setDiffFocus({ line: null, request: 0 });
                      }}
                    >
                      <span>{file.path}</span>
                      <span className="file-counts">
                        {flagged ? <span className="line-flag" aria-label="Finding in this file">●</span> : null}
                        <span className="add">+{file.added}</span>
                        <span className="del">-{file.removed}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>
          <section className="card diff-card">
            <div className="panel-head">
              <h2>{selected?.path ?? "Diff"}</h2>
              {selected ? <span className="file-counts"><span className="add">+{selected.added}</span><span className="del">-{selected.removed}</span></span> : null}
            </div>
            {selected ? (
              <DiffView diff={selected.text} findings={fileFindings} focusLine={diffFocus.line} focusRequest={diffFocus.request} />
            ) : <EmptyNote title="This pull request has no diff text" />}
          </section>
          <aside className="review-side">
            {stage ? <p className="stage" aria-hidden="true">{stageLabel(stage)}</p> : null}
            {feedbackMessage ? <p className="feedback-result" aria-hidden="true">{feedbackMessage}</p> : null}
            {evidenceFinding ? (
              <EvidencePanel
                repoId={repoId}
                finding={evidenceFinding}
                decisions={evidence}
                pullRequests={prs}
                loading={evidenceLoading}
                error={evidenceError}
                onClose={() => setEvidenceFinding(null)}
              />
            ) : null}
            <section className="card findings-card">
              <div className="panel-head"><h2 ref={findingsHeading} tabIndex={-1}>Review findings{review ? ` (${review.findings.length})` : ""}</h2></div>
              {review ? (
                <div className="run-summary">
                  <span>{review.mode === "memory" ? "Memory review" : "Baseline review"}</span>
                  {review.run_id ? <span>Run <code>{review.run_id}</code></span> : null}
                  <span>{review.findings.length} findings</span>
                  {typeof review.elapsed_ms === "number" ? <span>{formatSeconds(review.elapsed_ms)}</span> : null}
                  {review.model ? <span>{review.model}</span> : null}
                  {review.validation?.dropped ? <span>{review.validation.dropped.length} dropped by validation</span> : null}
                </div>
              ) : null}
              {!review && !running ? <EmptyNote title="No review yet">Run CodeDNA Review to inspect this diff.</EmptyNote> : null}
              {running && !review ? <LoadingNote announce={false}>{stageLabel(stage)}</LoadingNote> : null}
              {review && review.findings.length === 0 ? <EmptyNote title="No validated findings">This run returned no findings that passed validation.</EmptyNote> : null}
              <div className="finding-list">
                {findings.map((finding) => (
                  <FindingArticle
                    key={finding.id}
                    finding={finding}
                    onOpenFile={openFindingLocation}
                    onEvidence={() => void openEvidence(finding)}
                    onAccept={() => void accept(finding)}
                    onDismiss={() => setDismissFinding(finding)}
                  />
                ))}
              </div>
            </section>
          </aside>
        </div>
      ) : null}
      {dismissFinding ? (
        <FeedbackDialog
          finding={dismissFinding}
          onClose={() => setDismissFinding(null)}
          onSaved={setFeedbackMessage}
        />
      ) : null}
    </div>
  );
}
