import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { api } from "./api";
import { useWorkspace, WorkspaceProvider } from "./workspace";

function HealthProbe() {
  const { health, healthCheckedAt, healthReadFailed, hindsight } = useWorkspace();
  return <p>{hindsight}:{health?.hindsight ?? "none"}:{healthReadFailed ? "read-failed" : "read-ok"}<time dateTime={healthCheckedAt}>{healthCheckedAt}</time></p>;
}

function renderWorkspace() {
  vi.spyOn(api, "repositories").mockResolvedValue([]);
  vi.spyOn(api, "prs").mockResolvedValue([]);
  return render(<WorkspaceProvider><HealthProbe /></WorkspaceProvider>);
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
    .mockResolvedValueOnce({ status: "ok", hindsight: "ready" })
    .mockRejectedValueOnce(new Error("health unavailable"));

  renderWorkspace();
  await act(async () => Promise.resolve());
  expect(screen.getByText(/ready:ready:read-ok/)).toBeTruthy();
  expect(health).toHaveBeenCalledTimes(1);
  expect(screen.getByText("2026-11-06T12:00:00.000Z")).toBeTruthy();

  await act(async () => vi.advanceTimersByTimeAsync(30_000));
  expect(screen.getByText(/unavailable:ready:read-failed/)).toBeTruthy();
  expect(health).toHaveBeenCalledTimes(2);
  expect(screen.getByText("2026-11-06T12:00:00.000Z")).toBeTruthy();
});

it("pauses health checks while hidden and reconciles when visible", async () => {
  vi.useFakeTimers();
  vi.setSystemTime("2026-11-06T12:00:00.000Z");
  let visibility: DocumentVisibilityState = "visible";
  vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibility);
  const health = vi.spyOn(api, "health")
    .mockResolvedValueOnce({ status: "ok", hindsight: "ready" })
    .mockResolvedValueOnce({ status: "ok", hindsight: "unavailable" });

  renderWorkspace();
  await act(async () => Promise.resolve());
  expect(screen.getByText(/ready:ready:read-ok/)).toBeTruthy();
  visibility = "hidden";
  document.dispatchEvent(new Event("visibilitychange"));
  await act(async () => vi.advanceTimersByTimeAsync(60_000));
  expect(health).toHaveBeenCalledTimes(1);

  visibility = "visible";
  await act(async () => document.dispatchEvent(new Event("visibilitychange")));
  expect(screen.getByText(/unavailable:unavailable:read-ok/)).toBeTruthy();
  expect(health).toHaveBeenCalledTimes(2);
  expect(screen.getByText("2026-11-06T12:01:00.000Z")).toBeTruthy();
});
