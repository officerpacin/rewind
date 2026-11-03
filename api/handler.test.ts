import { describe, expect, it } from "vitest";
import handler from "./handler";

describe("standalone API handler", () => {
  it("answers preflight requests without requiring database credentials", async () => {
    const response = await handler(
      new Request("https://music.example.com/v1/auth/login", {
        method: "OPTIONS",
      }),
    );

    expect(response.status).toBe(204);
    expect(response.headers.get("access-control-allow-origin")).toBe("*");
    expect(response.headers.get("access-control-allow-headers")).toContain(
      "authorization",
    );
  });
});
