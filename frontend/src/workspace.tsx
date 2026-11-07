import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api, type Health, type PullRequestSummary, type Repository } from "./api";
import { DEFAULT_REPO_ID, memoryState } from "./text";

const HEALTH_RETRY_MS = 2_000;
const HEALTH_READY_POLL_MS = 30_000;
const HEALTH_FAILURE_MAX_MS = 30_000;
const HEALTH_REQUEST_TIMEOUT_MS = 10_000;

type WorkspaceValue = {
  repositories: Repository[];
  repoId: string;
  setRepoId: (id: string) => void;
  health: Health | null;
  healthCheckedAt: string;
  healthReadFailed: boolean;
  healthChecking: boolean;
  checkHealth: () => void;
  hindsight: "ready" | "unavailable" | "starting";
  prs: PullRequestSummary[];
  loadingRepos: boolean;
  repoError: string;
};

const WorkspaceContext = createContext<WorkspaceValue | null>(null);

function initialRepoId(): string {
  if (typeof window === "undefined") return DEFAULT_REPO_ID;
  const match = window.location.pathname.match(/\/repos\/([^/]+)/);
  return match?.[1] || DEFAULT_REPO_ID;
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [repoId, setRepoId] = useState(initialRepoId);
  const [health, setHealth] = useState<Health | null>(null);
  const [healthCheckedAt, setHealthCheckedAt] = useState("");
  const [healthReadFailed, setHealthReadFailed] = useState(false);
  const [healthChecking, setHealthChecking] = useState(false);
  const healthCheckRef = useRef<() => void>(() => undefined);
  const [prs, setPrs] = useState<PullRequestSummary[]>([]);
  const [loadingRepos, setLoadingRepos] = useState(true);
  const [repoError, setRepoError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    let inFlight = false;
    let requestController: AbortController | null = null;
    let consecutiveFailures = 0;

    const isVisible = () => document.visibilityState !== "hidden";
    const schedule = (delay: number) => {
      window.clearTimeout(timer);
      if (cancelled || !isVisible()) return;
      timer = window.setTimeout(() => void tick(), delay);
    };
    const tick = async () => {
      if (cancelled || inFlight || !isVisible()) return;
      inFlight = true;
      setHealthChecking(true);
      const controller = new AbortController();
      requestController = controller;
      const requestTimeout = window.setTimeout(() => controller.abort(), HEALTH_REQUEST_TIMEOUT_MS);
      let nextDelay = HEALTH_RETRY_MS;
      try {
        const next = await api.health(controller.signal);
        if (cancelled) return;
        setHealth(next);
        setHealthCheckedAt(new Date().toISOString());
        setHealthReadFailed(false);
        consecutiveFailures = 0;
        nextDelay = next.hindsight === "ready" ? HEALTH_READY_POLL_MS : HEALTH_RETRY_MS;
      } catch {
        if (cancelled) return;
        setHealthReadFailed(true);
        consecutiveFailures += 1;
        nextDelay = Math.min(HEALTH_RETRY_MS * (2 ** (consecutiveFailures - 1)), HEALTH_FAILURE_MAX_MS);
      } finally {
        window.clearTimeout(requestTimeout);
        if (requestController === controller) requestController = null;
        inFlight = false;
        if (!cancelled) setHealthChecking(false);
        schedule(nextDelay);
      }
    };

    const handleVisibility = () => {
      window.clearTimeout(timer);
      if (isVisible()) void tick();
    };

    document.addEventListener("visibilitychange", handleVisibility);
    healthCheckRef.current = () => {
      window.clearTimeout(timer);
      void tick();
    };
    void tick();
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      requestController?.abort();
      healthCheckRef.current = () => undefined;
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, []);

  const checkHealth = useCallback(() => healthCheckRef.current(), []);

  useEffect(() => {
    let cancelled = false;
    api.repositories()
      .then((rows) => {
        if (cancelled) return;
        setRepositories(rows);
        setRepoId((current) => {
          if (rows.some((item) => item.id === current)) return current;
          return rows[0]?.id || current;
        });
        setRepoError("");
      })
      .catch((reason: Error) => {
        if (!cancelled) setRepoError(reason.message);
      })
      .finally(() => {
        if (!cancelled) setLoadingRepos(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    api.prs(repoId)
      .then((rows) => {
        if (!cancelled) setPrs(rows);
      })
      .catch(() => {
        if (!cancelled) setPrs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [repoId]);

  const value = useMemo<WorkspaceValue>(() => ({
    repositories,
    repoId,
    setRepoId,
    health,
    healthCheckedAt,
    healthReadFailed,
    healthChecking,
    checkHealth,
    hindsight: healthReadFailed ? "unavailable" : memoryState(health?.hindsight),
    prs,
    loadingRepos,
    repoError,
  }), [repositories, repoId, health, healthCheckedAt, healthReadFailed, healthChecking, checkHealth, prs, loadingRepos, repoError]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceValue {
  const value = useContext(WorkspaceContext);
  if (!value) throw new Error("Workspace is unavailable.");
  return value;
}
