import type { Finding } from "../api";
import { isTeamFinding } from "../text";

export function FindingArticle({
  finding,
  onAccept,
  onDismiss,
  onEvidence,
  onOpenFile,
}: {
  finding: Finding;
  onAccept?: () => void;
  onDismiss?: () => void;
  onEvidence?: () => void;
  onOpenFile?: (path: string, line?: number | null) => void;
}) {
  const team = isTeamFinding(finding.category);
  const evidenceIds = finding.evidence_ids ?? [];
  return (
    <article className={`finding ${team ? "team" : "general"}`} aria-label={finding.title}>
      <div className="finding-tags">
        <span className={`sev sev-${finding.severity}`}>{finding.severity}</span>
        {team ? (
          <>
            <span className="tag mismatch">Design mismatch</span>
            <span className="tag basis">Based on team design</span>
          </>
        ) : (
          <span className="tag general">General</span>
        )}
        <span className="confidence">{finding.confidence} confidence</span>
      </div>
      <h3>{finding.title}</h3>
      <p>{finding.explanation}</p>
      {finding.file_path ? (
        onOpenFile ? (
          <button type="button" className="location" onClick={() => onOpenFile(finding.file_path, finding.new_line)}>
            {finding.file_path}{finding.new_line ? `:${finding.new_line}` : ""}
          </button>
        ) : (
          <p className="location">{finding.file_path}{finding.new_line ? `:${finding.new_line}` : ""}</p>
        )
      ) : null}
      {team && evidenceIds.length > 0 ? <p className="related">Related decision {evidenceIds.join(", ")}</p> : null}
      {finding.suggested_change ? <pre className="suggestion">{finding.suggested_change}</pre> : null}
      {team && evidenceIds.length > 0 && onEvidence ? (
        <button type="button" className="secondary" onClick={onEvidence}>View evidence</button>
      ) : null}
      {onAccept && onDismiss ? (
        <div className="finding-actions">
          <button type="button" onClick={onAccept}>Accept</button>
          <button type="button" onClick={onDismiss}>Dismiss</button>
        </div>
      ) : null}
    </article>
  );
}
