import { formatWhen } from "../text";

export const JOB_STALE_AFTER_MS = 3 * 60 * 1000;

export function isStaleJob(updatedAt?: string, now = Date.now()): boolean {
  if (!updatedAt) return false;
  const timestamp = Date.parse(updatedAt);
  return Number.isFinite(timestamp) && now - timestamp >= JOB_STALE_AFTER_MS;
}

function ageLabel(value: string): string {
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1000));
  if (elapsedSeconds < 60) return `${elapsedSeconds}s ago`;
  if (elapsedSeconds < 3600) return `${Math.floor(elapsedSeconds / 60)}m ago`;
  if (elapsedSeconds < 86400) return `${Math.floor(elapsedSeconds / 3600)}h ago`;
  return `${Math.floor(elapsedSeconds / 86400)}d ago`;
}

function JobTime({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  const exact = formatWhen(value) ?? value;
  return (
    <div>
      <dt>{label}</dt>
      <dd className="job-time"><time dateTime={value}>{ageLabel(value)}</time><small>{exact}</small></dd>
    </div>
  );
}

export function ActiveJobDetails({ jobId, status, createdAt, updatedAt }: {
  jobId: string;
  status: string;
  createdAt?: string;
  updatedAt?: string;
}) {
  if (!jobId) return null;
  const stale = isStaleJob(updatedAt);
  return (
    <div className="job-observability">
      {stale ? (
        <p className="job-stale" role="status">
          This job has not reported progress for at least 3 minutes. CodeDNA is still checking the same job; no retry or provider call was started.
        </p>
      ) : null}
      <details className="job-details">
        <summary>Active job details</summary>
        <dl>
          <div>
            <dt>Job ID</dt>
            <dd><code>{jobId}</code></dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>{status}</dd>
          </div>
          <JobTime label="Started" value={createdAt} />
          <JobTime label="Updated" value={updatedAt} />
        </dl>
      </details>
    </div>
  );
}
