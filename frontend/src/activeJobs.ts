export type ActiveJobKind = "review" | "comparison";

export type ActiveJobLocator = {
  jobId: string;
  createdAt?: string;
  updatedAt?: string;
};

const PREFIX = "codedna.active-job.v2";
const LEGACY_PREFIX = "codedna.active-job.v1";
const SAFE_JOB_ID = /^job-[A-Za-z0-9_-]{1,80}$/;

function storageKey(kind: ActiveJobKind, prId: string, prefix = PREFIX): string {
  return `${prefix}:${kind}:${prId}`;
}

function normalizeTimestamp(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : undefined;
}

function parseLocator(raw: string): ActiveJobLocator | null {
  try {
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const row = value as Record<string, unknown>;
    if (typeof row.jobId !== "string" || !SAFE_JOB_ID.test(row.jobId)) return null;
    if (row.createdAt === undefined && row.updatedAt === undefined) return { jobId: row.jobId };
    const createdAt = normalizeTimestamp(row.createdAt);
    const updatedAt = normalizeTimestamp(row.updatedAt);
    if (!createdAt || !updatedAt || Date.parse(updatedAt) < Date.parse(createdAt)) return null;
    return { jobId: row.jobId, createdAt, updatedAt };
  } catch {
    return null;
  }
}

export function loadActiveJobLocator(kind: ActiveJobKind, prId: string): ActiveJobLocator | null {
  try {
    const key = storageKey(kind, prId);
    const raw = window.sessionStorage.getItem(key);
    if (raw) {
      const locator = parseLocator(raw);
      if (locator) return locator;
      window.sessionStorage.removeItem(key);
    }
    const legacyKey = storageKey(kind, prId, LEGACY_PREFIX);
    const legacyJobId = window.sessionStorage.getItem(legacyKey);
    if (!legacyJobId) return null;
    if (SAFE_JOB_ID.test(legacyJobId)) return { jobId: legacyJobId };
    window.sessionStorage.removeItem(legacyKey);
    return null;
  } catch {
    return null;
  }
}

export function loadActiveJob(kind: ActiveJobKind, prId: string): string | null {
  return loadActiveJobLocator(kind, prId)?.jobId ?? null;
}

export function saveActiveJob(
  kind: ActiveJobKind,
  prId: string,
  jobId: string,
  timing: { createdAt?: string; updatedAt?: string } = {},
): void {
  if (!SAFE_JOB_ID.test(jobId)) return;
  let locator: ActiveJobLocator = { jobId };
  if (timing.createdAt !== undefined || timing.updatedAt !== undefined) {
    const createdAt = normalizeTimestamp(timing.createdAt);
    const updatedAt = normalizeTimestamp(timing.updatedAt);
    if (!createdAt || !updatedAt || Date.parse(updatedAt) < Date.parse(createdAt)) return;
    locator = { jobId, createdAt, updatedAt };
  }
  try {
    window.sessionStorage.setItem(storageKey(kind, prId), JSON.stringify(locator));
    window.sessionStorage.removeItem(storageKey(kind, prId, LEGACY_PREFIX));
  } catch {
    // Storage is an optional refresh aid; the in-page job still continues.
  }
}

export function clearActiveJob(kind: ActiveJobKind, prId: string, jobId: string): void {
  try {
    const key = storageKey(kind, prId);
    const raw = window.sessionStorage.getItem(key);
    if (raw && parseLocator(raw)?.jobId === jobId) window.sessionStorage.removeItem(key);
    const legacyKey = storageKey(kind, prId, LEGACY_PREFIX);
    if (window.sessionStorage.getItem(legacyKey) === jobId) window.sessionStorage.removeItem(legacyKey);
  } catch {
    // No recovery action is needed when session storage is unavailable.
  }
}
