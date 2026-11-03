import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Decision, type PullRequestSummary, type RepositoryActiveJob, type Summary } from "../api";
import { ActiveJobDetails } from "../components/ActiveJobDetails";
import { EmptyNote, ErrorNote, LoadingNote } from "../components/Status";
import { designStatus, formatWhen, recentPullRequests, sourceLabel, statValue } from "../text";
import { useWorkspace } from "../workspace";

const ACTIVE_WORK_REFRESH_MS = import.meta.env.MODE === "test" ? 10 : 5000;

export function OverviewPage() {
  const { repoId, repositories } = useWorkspace();
  const repo = repositories.find((item) => item.id === repoId);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [summaryError, setSummaryError] = useState("");
  const [prs, setPrs] = useState<PullRequestSummary[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [activeJobs, setActiveJobs] = useState<RepositoryActiveJob[]>([]);
  const [activeJobsError, setActiveJobsError] = useState("");
  const [listError, setListError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setSummaryError("");
    setListError("");
    Promise.allSettled([api.summary(repoId), api.prs(repoId), api.decisions(repoId)]).then(([summaryResult, prResult, decisionResult]) => {
      if (cancelled) return;
      if (summaryResult.status === "fulfilled") setSummary(summaryResult.value);
      else {
        setSummary(null);
        setSummaryError("Repository summary is unavailable.");
      }
      const problems: string[] = [];
      if (prResult.status === "fulfilled") setPrs(prResult.value);
      else problems.push(prResult.reason instanceof Error ? prResult.reason.message : "Pull requests are unavailable.");
      if (decisionResult.status === "fulfilled") setDecisions(decisionResult.value);
      else problems.push(decisionResult.reason instanceof Error ? decisionResult.reason.message : "Decisions are unavailable.");
      if (prResult.status === "rejected") setPrs([]);
      if (decisionResult.status === "rejected") setDecisions([]);
      setListError(problems.join(" "));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [repoId]);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    setActiveJobs([]);
    setActiveJobsError("");

    const refresh = async () => {
      try {
        const rows = await api.repositoryActiveJobs(repoId);
        if (cancelled) return;
        setActiveJobs(rows);
        setActiveJobsError("");
        if (rows.length > 0) {
          timer = window.setTimeout(() => void refresh(), ACTIVE_WORK_REFRESH_MS);
        }
      } catch {
        if (cancelled) return;
        setActiveJobs([]);
        setActiveJobsError("Active work is unavailable.");
      }
    };

    void refresh();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [repoId]);

  const name = summary?.display_name || repo?.display_name || repoId;
  const recent = recentPullRequests(prs);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Repository overview</h1>
          <p>Engineering memory for {name}.</p>
        </div>
      </header>
      {loading ? <LoadingNote>Loading repository overview…</LoadingNote> : null}
      {summaryError ? <ErrorNote>{summaryError}</ErrorNote> : null}
      {summary ? (
        <section className="stat-grid" aria-label="Repository counts">
          <article className="card stat-card" aria-label="Pull requests">
            <span>Pull requests</span>
            <strong>{statValue(summary.pr_count)}</strong>
            <small>Indexed in this repository</small>
          </article>
          <article className="card stat-card" aria-label="Recorded decisions">
            <span>Recorded decisions</span>
            <strong>{statValue(summary.decision_count)}</strong>
            <small>{statValue(summary.active_decisions)} active · {statValue(summary.superseded_decisions)} superseded · {statValue(summary.pending_decisions)} pending</small>
          </article>
          <article className="card stat-card" aria-label="Review runs">
            <span>Review runs</span>
            <strong>{statValue(summary.review_run_count)}</strong>
            <small>Completed CodeDNA reviews</small>
          </article>
        </section>
      ) : null}
      {listError ? <ErrorNote>{listError}</ErrorNote> : null}
      {activeJobsError ? <ErrorNote>{activeJobsError}</ErrorNote> : null}
      {!loading && activeJobs.length > 0 ? (
        <section className="card active-work" aria-labelledby="active-work-heading">
          <div className="panel-head">
            <div>
              <h2 id="active-work-heading">Active work</h2>
              <p className="quiet">Read-only status from persisted background jobs. Opening a PR does not start new provider work.</p>
            </div>
            <span className="nav-count" aria-label={`${activeJobs.length} active jobs`}>{activeJobs.length}</span>
          </div>
          <ul className="active-work-list">
            {activeJobs.map((job) => (
              <li key={job.jobId}>
                <div>
                  <Link to={`/repos/${repoId}/prs/${job.prId}`}>PR #{job.prNumber}: {job.prTitle}</Link>
                  <p>{job.kind === "comparison" ? "Memory Lab comparison" : "Code review"} · {job.status} · {job.stage.replaceAll("_", " ")}</p>
                </div>
                <ActiveJobDetails
                  jobId={job.jobId}
                  status={`${job.status} · ${job.stage.replaceAll("_", " ")}`}
                  createdAt={job.createdAt}
                  updatedAt={job.updatedAt}
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      <div className="split">
        <section className="card list-card">
          <div className="panel-head">
            <h2>Pull requests</h2>
          </div>
          {recent.length === 0 && !loading ? <EmptyNote title="No pull requests">Nothing is indexed for this repository yet.</EmptyNote> : null}
          {recent.length > 0 ? (
            <table className="table">
              <thead>
                <tr><th scope="col">#</th><th scope="col">Title</th><th scope="col">Opened</th></tr>
              </thead>
              <tbody>
                {recent.map((item) => (
                  <tr key={item.id}>
                    <td>#{item.number}</td>
                    <td><Link to={`/repos/${repoId}/prs/${item.id}`}>{item.title}</Link></td>
                    <td>{formatWhen(item.created_at) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
        <section className="card list-card">
          <div className="panel-head">
            <h2>Decisions</h2>
          </div>
          {decisions.length === 0 && !loading ? <EmptyNote title="No decisions">No design decisions are recorded for this repository.</EmptyNote> : null}
          {decisions.length > 0 ? (
            <table className="table">
              <thead>
                <tr><th scope="col">Decision</th><th scope="col">Status</th><th scope="col">Source</th></tr>
              </thead>
              <tbody>
                {decisions.map((item) => (
                  <tr key={item.id}>
                    <td><Link to={`/repos/${repoId}/dna/${item.id}`}>{item.title}</Link></td>
                    <td><span className={`status ${item.status}`}>{item.status}</span> <span className="quiet">{designStatus(item.status)}</span></td>
                    <td>{sourceLabel(item, recent) ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </section>
      </div>
    </div>
  );
}
