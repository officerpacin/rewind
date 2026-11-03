import { beforeEach, describe, expect, it, vi } from "vitest";
import { useConnectivityStore } from "./connectivityStore";

vi.mock("../lib/diagnostics", () => ({
  runAllChecks: vi.fn().mockResolvedValue({ checks: [], main: null }),
  DIAG_ENDPOINTS: {
    api: "https://api.tryliner.fun",
    covers: "https://covers.tryliner.fun",
    link: "https://link.tryliner.fun",
  },
}));

describe("connectivityStore failure tracking", () => {
  beforeEach(() => {
    useConnectivityStore.getState().reset();
    vi.useFakeTimers();
  });

  it("keeps recording failures without opening a blocking network alert", () => {
    const { recordFailure } = useConnectivityStore.getState();
    recordFailure({ method: "GET", path: "/v1/me", latencyMs: 5 });
    recordFailure({ method: "GET", path: "/v1/me", latencyMs: 5 });
    recordFailure({ method: "GET", path: "/v1/me", latencyMs: 5 });
    const state = useConnectivityStore.getState();
    expect(state.tripped).toBe(false);
    expect(state.visible).toBe(false);
    expect(state.failures).toHaveLength(3);
  });

  it("ignores track playback and lyrics failures without tripping", () => {
    const { recordFailure } = useConnectivityStore.getState();
    recordFailure({
      method: "POST",
      path: "/v1/tracks/trk_1/playback",
      latencyMs: 50,
    });
    recordFailure({
      method: "POST",
      path: "/v1/tracks/trk_2/playback",
      latencyMs: 50,
    });
    recordFailure({
      method: "POST",
      path: "/v1/tracks/trk_3/playback",
      latencyMs: 50,
    });
    recordFailure({
      method: "GET",
      path: "/v1/tracks/trk_1/lyrics",
      latencyMs: 50,
    });
    recordFailure({
      method: "GET",
      path: "/v1/playback/sess_123/media",
      latencyMs: 50,
    });

    const state = useConnectivityStore.getState();
    expect(state.tripped).toBe(false);
    expect(state.visible).toBe(false);
    expect(state.failures).toHaveLength(0);
  });

  it("lets old failures age out of the window", () => {
    const store = useConnectivityStore.getState();
    store.recordFailure({ method: "GET", path: "/v1/me", latencyMs: 5 });
    store.recordFailure({ method: "GET", path: "/v1/me", latencyMs: 5 });
    vi.advanceTimersByTime(61_000);
    useConnectivityStore
      .getState()
      .recordFailure({ method: "GET", path: "/v1/me", latencyMs: 5 });
    useConnectivityStore
      .getState()
      .recordFailure({ method: "GET", path: "/v1/me", latencyMs: 5 });
    expect(useConnectivityStore.getState().tripped).toBe(false);
  });

  it("caps the failure log", () => {
    for (let i = 0; i < 30; i++) {
      useConnectivityStore
        .getState()
        .recordFailure({ method: "GET", path: "/v1/me", latencyMs: 1 });
    }
    expect(useConnectivityStore.getState().failures.length).toBeLessThanOrEqual(
      20,
    );
  });
});
