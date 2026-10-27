import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type Decision, type Finding, type PullRequest, type Review } from "../api";
import { DiffView } from "../components/DiffView";
import { EvidencePanel } from "../components/EvidencePanel";
import { FeedbackDialog } from "../components/FeedbackDialog";
import { FindingArticle } from "../components/FindingArticle";
import { EmptyNote, ErrorNote, LoadingNote } from "../components/Status";
import { splitDiff } from "../diffFiles";
import { bindingCopy, formatSeconds, stageLabel } from "../text";
import { useWorkspace } from "../workspace";

export function ReviewPage() {
  const { repoId = "", prId = "" } = useParams();
  const { hindsight, prs } = useWorkspace();
  const alive = useRef(true);
  const [pr, setPr] = useState<PullRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [running, setRunning] = useState(false);
  const [stage, setStage] = useState("");
  const [review, setReview] = useState<Review | null>(null);
  const [filePath, setFilePath] = useState("");
  const [evidenceFinding, setEvidenceFinding] = useState<Finding | null>(null);
  const [evidence, setEvidence] = useState<Decision[]>([]);
  const [evidenceLoading, setEvidenceLoading] = useState(false);
  const [evidenceError, setEvidenceError] = useState("");
  const [dismissFinding, setDismissFinding] = useState<Finding | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState("");

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
    setReview(null);
    setStage("");
    setEvidenceFinding(null);
    setEvidence([]);
    setFeedbackMessage("");
    Promise.allSettled([api.pr(prId), api.latestReview(prId, "memory")])
      .then(([pullRequestResult, reviewResult]) => {
        if (cancelled) return;
        if (pullRequestResult.status === "fulfilled") {
          setPr(pullRequestResult.value);
        } else {
          setPr(null);
          setError(pullRequestResult.reason instanceof Error ? pullRequestResult.reason.message : "Pull request unavailable.");
        }
        if (reviewResult.status === "fulfilled" && reviewResult.value) {
          setReview(reviewResult.value);
          setStage("complete");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [prId]);

  const files = useMemo(() => splitDiff(pr?.diff_text ?? ""), [pr?.diff_text]);
  useEffect(() => {
    setFilePath((current) => (files.some((file) => file.path === current) ? current : files[0]?.path ?? ""));
  }, [files]);

  const selected = files.find((file) => file.path === filePath) ?? files[0];
  const findings = review?.findings ?? [];
  const fileFindings = findings.filter((item) => item.file_path === selected?.path);
  const memoryBlocked = memoryEnabled && hindsight !== "ready";

  async function runReview() {
    setRunning(true);
    setError("");
    setReview(null);
    setEvidenceFinding(null);
    setEvidence([]);
    setFeedbackMessage("");
    setStage("queued");
    try {
      const result = await api.review(prId, memoryEnabled, (next) => {
        if (alive.current) setStage(next);
      }, () => alive.current);
      if (!result || !alive.current) return;
      setReview(result);
      setStage("complete");
    } catch (reason) {
      if (!alive.current) return;
      setError(reason instanceof Error ? reason.message : "Review failed");
      setStage("");
    } finally {
      if (alive.current) setRunning(false);
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

  return (
    <div className="page">
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
          <button type="button" className="primary" disabled={running || !pr || memoryBlocked} onClick={() => void runReview()}>
            Run CodeDNA Review
          </button>
          {memoryBlocked ? <p className="hint">Memory reviews wait until Hindsight is ready. Turn memory off to run a baseline.</p> : null}
          {!memoryEnabled ? <p className="hint">Baseline review uses this diff only.</p> : null}
        </div>
      </header>
      {error ? <ErrorNote>{error}</ErrorNote> : null}
      {loading ? <LoadingNote>Loading pull request…</LoadingNote> : null}
      {pr ? (
        <div className="review-grid">
          <section className="card file-card" aria-label="Files changed">
            <div className="panel-head"><h2>Files changed ({files.length})</h2></div>
            {files.length === 0 ? <EmptyNote title="No files in this diff" /> : (
              <div className="file-list">
                {files.map((file) => {
                  const flagged = findings.some((item) => item.file_path === file.path && item.new_line);
                  return (
                    <button type="button" key={file.path} className={file.path === selected?.path ? "file active" : "file"} onClick={() => setFilePath(file.path)}>
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
            {selected ? <DiffView diff={selected.text} findings={fileFindings} /> : <EmptyNote title="This pull request has no diff text" />}
          </section>
          <aside className="review-side">
            {stage ? <p className="stage" role="status">{stageLabel(stage)}</p> : null}
            {feedbackMessage ? <p className="feedback-result" role="status">{feedbackMessage}</p> : null}
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
              <div className="panel-head"><h2>Review findings{review ? ` (${review.findings.length})` : ""}</h2></div>
              {review ? (
                <div className="run-summary">
                  <span>{review.mode === "memory" ? "Memory review" : "Baseline review"}</span>
                  <span>{review.findings.length} findings</span>
                  {typeof review.elapsed_ms === "number" ? <span>{formatSeconds(review.elapsed_ms)}</span> : null}
                  {review.model ? <span>{review.model}</span> : null}
                  {review.validation?.dropped ? <span>{review.validation.dropped.length} dropped by validation</span> : null}
                </div>
              ) : null}
              {!review && !running ? <EmptyNote title="No review yet">Run CodeDNA Review to inspect this diff.</EmptyNote> : null}
              {running && !review ? <LoadingNote>{stageLabel(stage)}</LoadingNote> : null}
              {review && review.findings.length === 0 ? <EmptyNote title="No validated findings">This run returned no findings that passed validation.</EmptyNote> : null}
              <div className="finding-list">
                {findings.map((finding) => (
                  <FindingArticle
                    key={finding.id}
                    finding={finding}
                    onOpenFile={setFilePath}
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
