import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiBaseUrl: "https://own-api.test",
  musicOnlyMode: false,
  getAuthSession: vi.fn(() => ({
    user: { id: "account-123", username: "listener" },
  })),
}));

vi.mock("./auth-session", () => ({
  getAuthSession: () => mocks.getAuthSession(),
  getSessionExpiryMs: vi.fn(),
  getValidAccessToken: vi.fn(async () => null),
  refreshAuthSession: vi.fn(),
  setAuthSession: vi.fn(),
}));

vi.mock("./requestSigner", () => ({
  signApiRequest: vi.fn(async () => ({})),
  syncServerTime: vi.fn(),
}));

vi.mock("./baseUrl", () => ({
  get MUSIC_ONLY_MODE() {
    return mocks.musicOnlyMode;
  },
  getApiBaseUrl: () => mocks.apiBaseUrl,
  getCatalogApiBaseUrl: () => "https://liner-catalog.test",
}));

vi.mock("@/features/player/store/playerStore", () => ({
  usePlayerStore: {
    getState: () => ({ currentTrack: { id: "currently-playing-track" } }),
  },
}));

vi.mock("@/shared/telemetry", () => ({
  telemetry: { trackNetwork: vi.fn() },
}));

vi.mock("@/features/connectivity", () => ({
  isConnectivityFailure: vi.fn(() => false),
  isPlaybackPath: vi.fn(() => false),
  recordConnectivityFailure: vi.fn(),
  statusOf: vi.fn(() => 0),
  stripQuery: vi.fn((path: string) => path),
}));

import { api } from "./api";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
  mocks.apiBaseUrl = "https://own-api.test";
  mocks.musicOnlyMode = false;
});

describe("API account-context headers", () => {
  it("does not send account or current-track identifiers to the catalog API", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ items: [] })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.getServerRadio("seed", { k: 5 });

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get("x-user-id")).toBeNull();
    expect(headers.get("x-user-name")).toBeNull();
    expect(headers.get("x-session-id")).toBeNull();
  });

  it("keeps account context on requests to the app's own API", async () => {
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({})),
    );
    vi.stubGlobal("fetch", fetchMock);

    await api.getMe();

    const [, init] = fetchMock.mock.calls[0];
    const headers = new Headers(init?.headers);
    expect(headers.get("x-user-id")).toBe("account-123");
    expect(headers.get("x-user-name")).toBe("listener");
    expect(headers.get("x-session-id")).toBe("currently-playing-track");
  });

  it("blocks account API calls in music-only mode but keeps catalog calls available", async () => {
    mocks.musicOnlyMode = true;
    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(JSON.stringify({ items: [] })),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(api.getMe()).rejects.toMatchObject({
      code: "MUSIC_ONLY_MODE",
    });
    await expect(api.getServerRadio("seed", { k: 5 })).resolves.toEqual({
      items: [],
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe(
      "https://liner-catalog.test/v1/tracks/seed/radio?k=5",
    );
  });
});
