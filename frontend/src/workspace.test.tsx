import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "./api";
import { useWorkspace, WorkspaceProvider } from "./workspace";

function HealthProbe() {
  const { health, healthCheckedAt, healthReadFailed, healthChecking, checkHealth, hindsight } = useWorkspace();
  return <><p>{hindsight}:{health?.hindsight ?? "none"}:{healthReadFailed ? "read-failed" : "read-ok"}:{healthChecking ? "checking" : "idle"}<time dateTime={healthCheckedAt}>{healthCheckedAt}</time></p><button type="button" onClick={checkHealth}>Check</button></>;
}

function renderWorkspace() {
  vi.spyOn(api, "repositories").mockResolvedValue([]);
  vi.spyOn(api, "prs").mockResolvedValue([]);
  return render(<WorkspaceProvider><HealthProbe /></WorkspaceProvider>);
}

function healthPayload(hindsight: "ready" | "starting" | "unavailable") {
  return { status: "ok" as const, memory: "configured" as const, hindsight, interrupted_jobs: 0 };
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.restoreAllMocks();
});

it("keeps checking health after Hindsight first becomes ready", async () => {
  vi.useFakeTimers();
  vi.setSystemTime("2026-11-06T12:00:00.000Z");
  const health = vi.spyOn(api, "health")
    .mockResolvedValueOnce(healthPayload("ready"))
    .mockRejectedValueOnce(new Error("health unavailable"));

  renderWorkspace();
  await act(async () => Promise.resolve());
  expect(screen.getByText(/ready:ready:read-ok:idle/)).toBeTruthy();
  expect(health).toHaveBeenCalledTimes(1);
  expect(screen.getByText("2026-11-06T12:00:00.000Z")).toBeTruthy();

  await act(async () => vi.advanceTimersByTimeAsync(30_000));
  expect(screen.getByText(/unavailable:ready:read-failed:idle/)).toBeTruthy();
  expect(health).toHaveBeenCalledTimes(2);
  expect(screen.getByText("2026-11-06T12:00:00.000Z")).toBeTruthy();
});

it("pauses health checks while hidden and reconciles when visible", async () => {
  vi.useFakeTimers();
  vi.setSystemTime("2026-11-06T12:00:00.000Z");
  let visibility: DocumentVisibilityState = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
  const health = vi.spyOn(api, "health")
    .mockResolvedValueOnce(healthPayload("ready"))
    .mockResolvedValueOnce(healthPayload("unavailable"));

  renderWorkspace();
  await act(async () => Promise.resolve());
  expect(screen.getByText(/ready:ready:read-ok:idle/)).toBeTruthy();
  visibility = "hidden";
  document.dispatchEvent(new Event("visibilitychange"));
  await act(async () => vi.advanceTimersByTimeAsync(60_000));
  expect(health).toHaveBeenCalledTimes(1);

  visibility = "visible";
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  expect(screen.getByText(/unavailable:unavailable:read-ok:idle/)).toBeTruthy();
  expect(health).toHaveBeenCalledTimes(2);
  expect(screen.getByText("2026-11-06T12:01:00.000Z")).toBeTruthy();
});

it("backs off consecutive application health failures and resets after success", async () => {
  vi.useFakeTimers();
  const health = vi.spyOn(api, "health")
    .mockRejectedValueOnce(new Error("offline"))
    .mockRejectedValueOnce(new Error("still offline"))
    .mockResolvedValueOnce(healthPayload("unavailable"))
    .mockRejectedValue(new Error("offline again"));

  renderWorkspace();
  await act(async () => Promise.resolve());
  expect(health).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/unavailable:none:read-failed:idle/)).toBeTruthy();

  await act(async () => vi.advanceTimersByTimeAsync(1_999));
  expect(health).toHaveBeenCalledTimes(1);
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(health).toHaveBeenCalledTimes(2);

  await act(async () => vi.advanceTimersByTimeAsync(3_999));
  expect(health).toHaveBeenCalledTimes(2);
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(health).toHaveBeenCalledTimes(3);
  expect(screen.getByText(/unavailable:unavailable:read-ok:idle/)).toBeTruthy();

  await act(async () => vi.advanceTimersByTimeAsync(2_000));
  expect(health).toHaveBeenCalledTimes(4);
  await act(async () => vi.advanceTimersByTimeAsync(1_999));
  expect(health).toHaveBeenCalledTimes(4);
  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(health).toHaveBeenCalledTimes(5);
});

it("caps application health failure backoff at thirty seconds", async () => {
  vi.useFakeTimers();
  const health = vi.spyOn(api, "health").mockRejectedValue(new Error("offline"));

  renderWorkspace();
  await act(async () => Promise.resolve());
  expect(health).toHaveBeenCalledTimes(1);

  for (const [index, delay] of [2_000, 4_000, 8_000, 16_000, 30_000, 30_000].entries()) {
    await act(async () => vi.advanceTimersByTimeAsync(delay - 1));
    expect(health).toHaveBeenCalledTimes(index + 1);
    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(health).toHaveBeenCalledTimes(index + 2);
  }
});

it("times out a hung health read and releases manual recovery", async () => {
  vi.useFakeTimers();
  const health = vi.spyOn(api, "health")
    .mockImplementationOnce((signal?: AbortSignal) => new Promise((_resolve, reject) => {
      signal?.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
    }))
    .mockResolvedValue(healthPayload("unavailable"));

  renderWorkspace();
  await act(async () => Promise.resolve());
  expect(screen.getByText(/starting:none:read-ok:checking/)).toBeTruthy();
  await act(async () => vi.advanceTimersByTimeAsync(9_999));
  expect(health).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/starting:none:read-ok:checking/)).toBeTruthy();

  await act(async () => vi.advanceTimersByTimeAsync(1));
  expect(screen.getByText(/unavailable:none:read-failed:idle/)).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Check" }));
  await act(async () => Promise.resolve());
  expect(health).toHaveBeenCalledTimes(2);
  expect(screen.getByText(/unavailable:unavailable:read-ok:idle/)).toBeTruthy();
});
