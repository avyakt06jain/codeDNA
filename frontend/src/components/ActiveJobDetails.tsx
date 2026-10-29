export function ActiveJobDetails({ jobId, status }: { jobId: string; status: string }) {
  if (!jobId) return null;
  return (
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
      </dl>
    </details>
  );
}
