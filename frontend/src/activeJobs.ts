export type ActiveJobKind = "review" | "comparison";

const PREFIX = "codedna.active-job.v1";
const SAFE_JOB_ID = /^job-[A-Za-z0-9_-]{1,80}$/;

function storageKey(kind: ActiveJobKind, prId: string): string {
  return `${PREFIX}:${kind}:${prId}`;
}

export function loadActiveJob(kind: ActiveJobKind, prId: string): string | null {
  try {
    const key = storageKey(kind, prId);
    const jobId = window.sessionStorage.getItem(key);
    if (!jobId) return null;
    if (!SAFE_JOB_ID.test(jobId)) {
      window.sessionStorage.removeItem(key);
      return null;
    }
    return jobId;
  } catch {
    return null;
  }
}

export function saveActiveJob(kind: ActiveJobKind, prId: string, jobId: string): void {
  if (!SAFE_JOB_ID.test(jobId)) return;
  try {
    window.sessionStorage.setItem(storageKey(kind, prId), jobId);
  } catch {
    // Storage is an optional refresh aid; the in-page job still continues.
  }
}

export function clearActiveJob(kind: ActiveJobKind, prId: string, jobId: string): void {
  try {
    const key = storageKey(kind, prId);
    if (window.sessionStorage.getItem(key) === jobId) window.sessionStorage.removeItem(key);
  } catch {
    // No recovery action is needed when session storage is unavailable.
  }
}
