import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ getRadio: vi.fn() }));

vi.mock("./clientCatalog", () => ({
  clientCatalog: {
    getRadio: (id: string, k: number | undefined, server: () => unknown) =>
      mocks.getRadio(id, k, server),
  },
}));

import { api } from "./api";

describe("api.getRadio", () => {
  beforeEach(() => {
    mocks.getRadio.mockReset();
  });

  it("keeps listening history local when falling back to the catalog API", async () => {
    mocks.getRadio.mockImplementation(
      (_id: string, _k: number, server: () => Promise<unknown>) => server(),
    );
    const getServerRadio = vi.spyOn(api, "getServerRadio").mockResolvedValue({
      items: [
        {
          id: "played",
          title: "Already played",
          artists: [],
          durationMs: 1000,
        },
        {
          id: "fresh",
          title: "New track",
          artists: [],
          durationMs: 1000,
        },
      ],
    });

    await expect(
      api.getRadio("seed", {
        history: ["played"],
        k: 20,
        wave_id: "wave",
      }),
    ).resolves.toEqual({
      items: [
        {
          id: "fresh",
          title: "New track",
          artists: [],
          durationMs: 1000,
        },
      ],
    });
    expect(getServerRadio).toHaveBeenCalledWith("seed", {
      k: 20,
      wave_id: "wave",
    });
    getServerRadio.mockRestore();
  });
});
